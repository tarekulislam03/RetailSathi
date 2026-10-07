import { getDb } from "../../../services/database";
import { Store, CreateStoreInput, UpdateStoreInput } from "../types";
import { User } from "../../users/types";
import { getStoredSession, setStoredSession } from "../../auth/services/authService";

const STORE_SELECT_FIELDS = `
  id, name, code, tagline, promo_text, address, phone, email, gstin, fssai,
  logo_url, return_policy, setup_cost, amc, is_active,
  upi_id, upi_name, receipt_footer, paper_width, default_printer,
  show_barcode, show_upi_qr, show_header, show_customer, show_savings,
  show_tax, show_return_policy, mandatory_bill_note,
  barcode_printer, label_width_mm, label_height_mm, label_gap_mm,
  created_at, updated_at
`;

// ---------------------------------------------------------------------------
// Settings table (per-store key/value). Source of truth for receipt / printer /
// label settings. Synced to the cloud `settings` table; newest write wins.
// ---------------------------------------------------------------------------

const BOOL_SETTING_KEYS = [
  "show_barcode", "show_upi_qr", "show_header", "show_customer", "show_savings",
  "show_tax", "show_return_policy", "mandatory_bill_note",
] as const;

const NUM_SETTING_KEYS = [
  "paper_width", "label_width_mm", "label_height_mm", "label_gap_mm",
] as const;

const TEXT_SETTING_KEYS = [
  "address", "phone", "email", "gstin", "fssai", "tagline", "promo_text",
  "logo_url", "return_policy", "upi_id", "upi_name", "receipt_footer",
  "default_printer", "barcode_printer",
] as const;

const ALL_SETTING_KEYS: string[] = [
  ...BOOL_SETTING_KEYS, ...NUM_SETTING_KEYS, ...TEXT_SETTING_KEYS,
];

const settingsReadyDbs = new WeakSet<object>();

async function ensureSettingsTable(db: any): Promise<void> {
  if (settingsReadyDbs.has(db)) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      store_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_ms INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (store_id, key)
    )
  `);
  settingsReadyDbs.add(db);
}

function encodeSetting(key: string, val: any): string {
  if ((BOOL_SETTING_KEYS as readonly string[]).includes(key)) return val ? "1" : "0";
  if (val === null || val === undefined) return "";
  return typeof val === "string" ? val.trim() : String(val);
}

/**
 * Write settings for a store into the settings table (local first, then synced).
 */
export async function saveStoreSettings(
  storeId: number,
  values: Record<string, any>,
  stamp: number = Date.now()
): Promise<void> {
  const db = await getDb();
  await ensureSettingsTable(db);
  for (const [key, val] of Object.entries(values)) {
    if (!ALL_SETTING_KEYS.includes(key) || val === undefined) continue;
    await db.execute(
      `INSERT INTO settings (store_id, key, value, updated_ms)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(store_id, key) DO UPDATE SET
         value = excluded.value,
         updated_ms = excluded.updated_ms`,
      [storeId, key, encodeSetting(key, val), stamp]
    );
  }
}

/**
 * Overlay settings-table values onto the store row. If a store has no settings
 * yet (first run after upgrade), seed them once from the legacy store columns.
 */
async function applySettings(db: any, store: Store): Promise<Store> {
  if (!store?.id) return store;
  await ensureSettingsTable(db);

  let rows: { key: string; value: string | null }[] =
    (await db.select("SELECT key, value FROM settings WHERE store_id = $1", [store.id])) || [];

  if (rows.length === 0) {
    const seed: Record<string, any> = {};
    for (const k of ALL_SETTING_KEYS) {
      const v = (store as any)[k];
      if (v !== null && v !== undefined && v !== "") seed[k] = v;
    }
    if (Object.keys(seed).length > 0) {
      // stamp 1 => any real (newer) cloud/local write wins over the seed
      await saveStoreSettings(store.id, seed, 1);
      rows = Object.entries(seed).map(([key, v]) => ({ key, value: encodeSetting(key, v) }));
    }
  }

  const merged: any = { ...store };
  for (const { key, value } of rows) {
    if ((BOOL_SETTING_KEYS as readonly string[]).includes(key)) {
      merged[key] = value === "1" ? 1 : 0;
    } else if ((NUM_SETTING_KEYS as readonly string[]).includes(key)) {
      const n = Number(value);
      if (value !== null && value !== "" && !isNaN(n)) merged[key] = n;
    } else if (ALL_SETTING_KEYS.includes(key)) {
      merged[key] = value === null || value === "" ? null : value;
    }
  }
  return merged as Store;
}

export async function fetchStores(searchQuery = ""): Promise<Store[]> {
  const db = await getDb();
  const trimmed = searchQuery.trim().toLowerCase();

  let query = `
    SELECT ${STORE_SELECT_FIELDS}
    FROM stores
  `;
  const params: any[] = [];

  if (trimmed) {
    query += ` WHERE LOWER(name) LIKE $1 OR LOWER(code) LIKE $2 OR phone LIKE $3 OR LOWER(email) LIKE $4`;
    params.push(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`);
  }

  query += ` ORDER BY id ASC`;

  const rows = (await db.select<Store[]>(query, params)) || [];
  return Promise.all(rows.map((r) => applySettings(db, r)));
}

export async function getStoreById(id: number): Promise<Store | null> {
  const db = await getDb();
  const rows = await db.select<Store[]>(
    `SELECT ${STORE_SELECT_FIELDS}
     FROM stores WHERE id = $1`,
    [id]
  );
  return rows && rows.length > 0 ? applySettings(db, rows[0]) : null;
}

export async function getActiveOrFirstStore(): Promise<Store | null> {
  const session = getStoredSession();

  if (session?.store_id) {
    const store = await getStoreById(session.store_id);
    if (store) return store;
  }

  if (typeof localStorage !== "undefined") {
    const savedId = localStorage.getItem("active_store_id");
    if (savedId) {
      const parsed = parseInt(savedId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        const store = await getStoreById(parsed);
        if (store) return store;
      }
    }
  }

  const all = await fetchStores();
  if (all.length > 0) {
    const firstStore = all[0];
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("active_store_id", String(firstStore.id));
    }
    return firstStore;
  }

  // If no store row exists at all, auto-create default store
  const res = await createStore({
    name: "Retail Sathi Supermarket",
    code: "STORE-01",
    tagline: "Your Daily Grocery & Supermarket",
    promo_text: "Fresh Items * Best Prices Every Day",
    receipt_footer: "Thank you for shopping with us! Please visit again.",
    return_policy: "Exchange within 7 days with original receipt.",
    mandatory_bill_note: true,
    paper_width: 80,
    show_barcode: true,
    show_upi_qr: true,
    show_header: true,
    show_customer: true,
    show_savings: true,
    show_tax: true,
    show_return_policy: true,
  });

  if (res.id) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("active_store_id", String(res.id));
    }
    return getStoreById(res.id);
  }
  return null;
}

export async function getStoreUsers(storeId: number): Promise<User[]> {
  const db = await getDb();
  const rows = await db.select<User[]>(
    `SELECT u.id, u.username, u.full_name, u.role, u.phone, u.store_id, s.name as store_name, u.is_active, u.created_at, u.updated_at
     FROM users u
     LEFT JOIN stores s ON u.store_id = s.id
     WHERE u.store_id = $1
     ORDER BY u.id ASC`,
    [storeId]
  );
  return rows || [];
}

export async function createStore(
  input: CreateStoreInput
): Promise<{ success: boolean; id?: number; error?: string }> {
  const cleanName = input.name.trim();
  const cleanCode = input.code?.trim() || null;

  if (!cleanName) {
    return { success: false, error: "Store name is required." };
  }

  const db = await getDb();

  // If code is provided, verify uniqueness
  if (cleanCode) {
    const existing = await db.select<Store[]>(
      "SELECT id FROM stores WHERE LOWER(code) = $1",
      [cleanCode.toLowerCase()]
    );
    if (existing && existing.length > 0) {
      return { success: false, error: "A store with this code already exists." };
    }
  }

  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;
  const address = input.address?.trim() || null;
  const tagline = input.tagline?.trim() || null;
  const promoText = input.promo_text?.trim() || null;
  const gstin = input.gstin?.trim() || null;
  const fssai = input.fssai?.trim() || null;
  const logoUrl = input.logo_url?.trim() || null;
  const returnPolicy = input.return_policy?.trim() || null;
  const setupCost = input.setup_cost ?? 0;
  const amc = input.amc ?? 0;
  const isActive = input.is_active === false ? 0 : 1;
  const upiId = input.upi_id?.trim() || null;
  const upiName = input.upi_name?.trim() || null;
  const receiptFooter = input.receipt_footer?.trim() || null;
  const paperWidth = input.paper_width ?? 80;
  const defaultPrinter = input.default_printer?.trim() || null;
  const showBarcode = input.show_barcode === false ? 0 : 1;
  const showUpiQr = input.show_upi_qr === false ? 0 : 1;
  const showHeader = input.show_header === false ? 0 : 1;
  const showCustomer = input.show_customer === false ? 0 : 1;
  const showSavings = input.show_savings === false ? 0 : 1;
  const showTax = input.show_tax === false ? 0 : 1;
  const showReturnPolicy = input.show_return_policy === false ? 0 : 1;
  const mandatoryBillNote = input.mandatory_bill_note === false ? 0 : 1;
  const barcodePrinter = input.barcode_printer?.trim() || null;
  const labelWidthMm = input.label_width_mm ?? 50;
  const labelHeightMm = input.label_height_mm ?? 30;
  const labelGapMm = input.label_gap_mm ?? 3;

  const result = await db.execute(
    `INSERT INTO stores (
      name, code, tagline, promo_text, address, phone, email, gstin, fssai,
      logo_url, return_policy, setup_cost, amc, is_active,
      upi_id, upi_name, receipt_footer, paper_width, default_printer,
      show_barcode, show_upi_qr, show_header, show_customer, show_savings,
      show_tax, show_return_policy, mandatory_bill_note,
      barcode_printer, label_width_mm, label_height_mm, label_gap_mm
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)`,
    [
      cleanName,
      cleanCode,
      tagline,
      promoText,
      address,
      phone,
      email,
      gstin,
      fssai,
      logoUrl,
      returnPolicy,
      setupCost,
      amc,
      isActive,
      upiId,
      upiName,
      receiptFooter,
      paperWidth,
      defaultPrinter,
      showBarcode,
      showUpiQr,
      showHeader,
      showCustomer,
      showSavings,
      showTax,
      showReturnPolicy,
      mandatoryBillNote,
      barcodePrinter,
      labelWidthMm,
      labelHeightMm,
      labelGapMm,
    ]
  );

  return {
    success: true,
    id: result.lastInsertId,
  };
}

export async function updateStore(
  id: number,
  fullInput: UpdateStoreInput
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  // Receipt/printer/label settings live in the settings table (synced to cloud);
  // only core store fields (name, code, ...) remain in the stores table.
  const input: UpdateStoreInput = {};
  const settingsPart: Record<string, any> = {};
  for (const [k, v] of Object.entries(fullInput)) {
    if (ALL_SETTING_KEYS.includes(k)) settingsPart[k] = v;
    else (input as any)[k] = v;
  }

  const updates: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (input.name !== undefined) {
    const cleanName = input.name.trim();
    if (!cleanName) return { success: false, error: "Store name cannot be empty." };
    updates.push(`name = $${paramIdx++}`);
    params.push(cleanName);

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("active_store_id", String(id));
      const session = getStoredSession();
      if (session) {
        setStoredSession({
          ...session,
          store_id: id,
          store_name: cleanName,
        });
      }
    }
  }

  if (input.code !== undefined) {
    const cleanCode = input.code?.trim() || null;
    if (cleanCode) {
      const existing = await db.select<Store[]>(
        "SELECT id FROM stores WHERE LOWER(code) = $1 AND id != $2",
        [cleanCode.toLowerCase(), id]
      );
      if (existing && existing.length > 0) {
        return { success: false, error: "Another store already uses this code." };
      }
    }
    updates.push(`code = $${paramIdx++}`);
    params.push(cleanCode);
  }

  if (input.tagline !== undefined) {
    updates.push(`tagline = $${paramIdx++}`);
    params.push(input.tagline?.trim() || null);
  }

  if (input.promo_text !== undefined) {
    updates.push(`promo_text = $${paramIdx++}`);
    params.push(input.promo_text?.trim() || null);
  }

  if (input.address !== undefined) {
    updates.push(`address = $${paramIdx++}`);
    params.push(input.address?.trim() || null);
  }

  if (input.phone !== undefined) {
    updates.push(`phone = $${paramIdx++}`);
    params.push(input.phone?.trim() || null);
  }

  if (input.email !== undefined) {
    updates.push(`email = $${paramIdx++}`);
    params.push(input.email?.trim() || null);
  }

  if (input.gstin !== undefined) {
    updates.push(`gstin = $${paramIdx++}`);
    params.push(input.gstin?.trim() || null);
  }

  if (input.fssai !== undefined) {
    updates.push(`fssai = $${paramIdx++}`);
    params.push(input.fssai?.trim() || null);
  }

  if (input.logo_url !== undefined) {
    updates.push(`logo_url = $${paramIdx++}`);
    params.push(input.logo_url?.trim() || null);
  }

  if (input.return_policy !== undefined) {
    updates.push(`return_policy = $${paramIdx++}`);
    params.push(input.return_policy?.trim() || null);
  }

  if (input.setup_cost !== undefined) {
    updates.push(`setup_cost = $${paramIdx++}`);
    params.push(input.setup_cost ?? 0);
  }

  if (input.amc !== undefined) {
    updates.push(`amc = $${paramIdx++}`);
    params.push(input.amc ?? 0);
  }

  if (input.is_active !== undefined) {
    updates.push(`is_active = $${paramIdx++}`);
    params.push(input.is_active ? 1 : 0);
  }

  if (input.upi_id !== undefined) {
    updates.push(`upi_id = $${paramIdx++}`);
    params.push(input.upi_id?.trim() || null);
  }

  if (input.upi_name !== undefined) {
    updates.push(`upi_name = $${paramIdx++}`);
    params.push(input.upi_name?.trim() || null);
  }

  if (input.receipt_footer !== undefined) {
    updates.push(`receipt_footer = $${paramIdx++}`);
    params.push(input.receipt_footer?.trim() || null);
  }

  if (input.paper_width !== undefined) {
    updates.push(`paper_width = $${paramIdx++}`);
    params.push(input.paper_width ?? 80);
  }

  if (input.default_printer !== undefined) {
    updates.push(`default_printer = $${paramIdx++}`);
    params.push(input.default_printer?.trim() || null);
  }

  if (input.show_barcode !== undefined) {
    updates.push(`show_barcode = $${paramIdx++}`);
    params.push(input.show_barcode ? 1 : 0);
  }

  if (input.show_upi_qr !== undefined) {
    updates.push(`show_upi_qr = $${paramIdx++}`);
    params.push(input.show_upi_qr ? 1 : 0);
  }

  if (input.show_header !== undefined) {
    updates.push(`show_header = $${paramIdx++}`);
    params.push(input.show_header ? 1 : 0);
  }

  if (input.show_customer !== undefined) {
    updates.push(`show_customer = $${paramIdx++}`);
    params.push(input.show_customer ? 1 : 0);
  }

  if (input.show_savings !== undefined) {
    updates.push(`show_savings = $${paramIdx++}`);
    params.push(input.show_savings ? 1 : 0);
  }

  if (input.show_tax !== undefined) {
    updates.push(`show_tax = $${paramIdx++}`);
    params.push(input.show_tax ? 1 : 0);
  }

  if (input.show_return_policy !== undefined) {
    updates.push(`show_return_policy = $${paramIdx++}`);
    params.push(input.show_return_policy ? 1 : 0);
  }

  if (input.mandatory_bill_note !== undefined) {
    updates.push(`mandatory_bill_note = $${paramIdx++}`);
    params.push(input.mandatory_bill_note ? 1 : 0);
  }

  if (input.barcode_printer !== undefined) {
    updates.push(`barcode_printer = $${paramIdx++}`);
    params.push(input.barcode_printer?.trim() || null);
  }

  if (input.label_width_mm !== undefined) {
    updates.push(`label_width_mm = $${paramIdx++}`);
    params.push(input.label_width_mm ?? 50);
  }

  if (input.label_height_mm !== undefined) {
    updates.push(`label_height_mm = $${paramIdx++}`);
    params.push(input.label_height_mm ?? 30);
  }

  if (input.label_gap_mm !== undefined) {
    updates.push(`label_gap_mm = $${paramIdx++}`);
    params.push(input.label_gap_mm ?? 3);
  }

  if (Object.keys(settingsPart).length > 0) {
    await saveStoreSettings(id, settingsPart);
  }

  if (updates.length === 0) {
    return { success: true };
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const query = `UPDATE stores SET ${updates.join(", ")} WHERE id = $${paramIdx}`;
  await db.execute(query, params);

  return { success: true };
}

export async function deleteStore(
  id: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  // Nullify foreign keys on users referencing this store
  await db.execute("UPDATE users SET store_id = NULL WHERE store_id = $1", [id]);

  // Delete store
  await db.execute("DELETE FROM stores WHERE id = $1", [id]);

  return { success: true };
}
