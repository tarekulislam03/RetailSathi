import { createClient } from "@supabase/supabase-js";
import { getDb, rawExecute } from "./database";

const DEFAULT_SUPABASE_URL = "https://icrlnkszpdeuwbqnkcwu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imljcmxua3N6cGRldXdicW5rY3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0Nzc1NDcsImV4cCI6MjEwOTA1MzU0N30.uTEtoK02NHQX-SWP446ZusScAbL4p3C7FqsPHe2rj2I";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL || "").trim();
const rawKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_ANON_KEY ||
  ""
).trim();

export const isCloudSyncConfigured = Boolean(
  rawUrl &&
  rawKey &&
  rawUrl.startsWith("http") &&
  !rawUrl.includes("your-project-ref")
);

const supabaseUrl = isCloudSyncConfigured ? rawUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = isCloudSyncConfigured ? rawKey : "placeholder-anon-key";

function initSupabase() {
  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn("[SyncProcessor] Failed to create Supabase client:", err);
    return createClient("https://placeholder.supabase.co", "placeholder-key");
  }
}

export const supabase = initSupabase();

let isProcessing = false;
let isPulling = false;
let syncTimeout: any = null;

/**
 * Explicit column lists per table (avoids SELECT * and reduces egress payload size).
 */
const TABLE_COLUMNS = {
  stores: "id, name, code, address, phone, email, setup_cost, amc, is_active, created_at, updated_at",
  settings: "store_id, key, value, updated_ms",
  users: "id, username, password_hash, full_name, role, phone, store_id, is_active, created_at, updated_at",
  products: "id, barcode, name, batch_no, mrp, price, cost_price, stock, hsn_code, reorder_threshold, gst_rate, category, created_at",
  marketing: "id, name, phone, area, sales, commission, created_at",
  suppliers: "id, name, company_name, gst_no, contact_no, email, address, created_at",
  customers: "id, name, phone, address, purchase_item_id, loyalty_points, lucky_draw_used, dues, created_at",
  purchases: "id, supplier_name, invoice_no, purchase_date, gst_no, contact_no, total_amount, item_count, created_at",
  purchase_items: "id, purchase_id, product_id, product_name, barcode, batch_no, hsn_code, category, purchase_price, mrp, selling_price, gst_rate, quantity, subtotal",
  sales: "id, invoice_no, customer_name, customer_phone, total_amount, discount, tax_amount, grand_total, payment_mode, marketing_person_id, customer_id, loyalty_points, created_at",
  sale_items: "id, sale_id, invoice_no, product_id, product_name, barcode, batch_no, price, quantity, total_price, mrp",
} as const;

/**
 * Per-table sync state persisted in localStorage, scoped by Supabase URL so
 * switching to a new Supabase project automatically performs a fresh sync.
 */
interface TableSyncMeta {
  lastUpdatedAt?: string | null;
  lastMaxId?: number;
  lastCount?: number;
  initialSyncDone?: boolean;
  hasUpdatedAtCol?: boolean;
}

const SYNC_STATE_STORAGE_KEY = `retail_sathi_sync_meta_${supabaseUrl}`;
const SALES_WINDOW_DAYS = 60;
const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes (instead of 4 seconds)
const JOB_BATCH_SIZE = 25;

let tableSyncState: Record<string, TableSyncMeta> = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SYNC_STATE_STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

function saveTableSyncState(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SYNC_STATE_STORAGE_KEY, JSON.stringify(tableSyncState));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function isNetworkOrTransientError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("timeout") ||
    lower.includes("connection")
  );
}

function isMissingFunctionError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return lower.includes("could not find the function") || lower.includes("schema cache");
}

/**
 * Drain the sync_jobs queue in batches (up to 25 statements per RPC call) in strict FIFO order.
 * Batching cuts Supabase RPC requests and Postgres log insertions by ~95%.
 * If a batch fails due to a bad query, falls back to executing that batch one-by-one
 * so the invalid query is discarded immediately and never retried endlessly.
 */
export async function processSyncJobs(): Promise<boolean> {
  if (isProcessing) return false;
  if (!isCloudSyncConfigured) return false;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }

  isProcessing = true;
  let pushedAny = false;

  try {
    const db = await getDb();

    while (true) {
      const rows = await db.select<{ id: number; query: string }[]>(
        `SELECT id, query FROM sync_jobs ORDER BY id ASC LIMIT ${JOB_BATCH_SIZE}`
      );

      if (!rows || rows.length === 0) {
        break; // Queue is completely empty
      }

      // Attempt batched execution when multiple jobs are queued
      if (rows.length > 1) {
        const combinedSql = rows
          .map((r) => {
            const q = r.query.trim();
            return q.endsWith(";") ? q : `${q};`;
          })
          .join("\n");

        try {
          const { error } = await supabase.rpc("exec_sql", {
            query_text: combinedSql,
          });

          if (!error) {
            const ids = rows.map((r) => r.id).join(",");
            await rawExecute(`DELETE FROM sync_jobs WHERE id IN (${ids})`);
            pushedAny = true;
            continue;
          }

          const errMsg = error.message || "";
          if (isMissingFunctionError(errMsg)) {
            console.warn(
              "[Sync] Cloud exec_sql function not found in Supabase. Please install the function in Supabase SQL editor."
            );
            break;
          }
          if (isNetworkOrTransientError(errMsg)) {
            console.warn("[Sync] Network issue while syncing batch. Retrying later.");
            break;
          }
          // Non-network SQL error in batch: fall through to single-job execution to isolate the bad query
        } catch (networkErr: any) {
          console.warn(
            "[Sync] Exception sending batch to cloud. Pausing sync:",
            networkErr?.message || networkErr
          );
          break;
        }
      }

      // Single-job execution (either only 1 job in queue, or isolating a bad query from a failed batch)
      let pausedOnNetwork = false;
      for (const job of rows) {
        try {
          const { error } = await supabase.rpc("exec_sql", {
            query_text: job.query,
          });

          if (error) {
            const errMsg = error.message || "";
            if (isMissingFunctionError(errMsg)) {
              console.warn(
                "[Sync] Cloud exec_sql function not found in Supabase. Please install the function in Supabase SQL editor."
              );
              pausedOnNetwork = true;
              break;
            }
            if (isNetworkOrTransientError(errMsg)) {
              console.warn("[Sync] Network issue while syncing job #" + job.id + ". Retrying later.");
              pausedOnNetwork = true;
              break;
            }
            // Unrecoverable query error: log once and discard so it never loops in logs
            console.error(
              `[Sync] Unrecoverable error on job #${job.id} (${error.message}). Discarding query:`,
              job.query
            );
          } else {
            pushedAny = true;
          }

          await rawExecute("DELETE FROM sync_jobs WHERE id = $1", [job.id]);
        } catch (networkErr: any) {
          console.warn(
            `[Sync] Exception sending job #${job.id} to cloud. Pausing sync:`,
            networkErr?.message || networkErr
          );
          pausedOnNetwork = true;
          break;
        }
      }

      if (pausedOnNetwork) {
        break;
      }
    }
  } catch (err) {
    console.error("[Sync] Error running processSyncJobs:", err);
  } finally {
    isProcessing = false;
  }

  return pushedAny;
}

/**
 * Cheap 1-row check to determine whether a table on Supabase has changed since our last pull.
 * Checks exact row count, max(id), and max(updated_at) (if updated_at column exists).
 */
async function checkTableChanged(table: string): Promise<{
  changed: boolean;
  canIncremental: boolean;
  sinceUpdatedAt?: string;
  latestUpdatedAt?: string | null;
  latestMaxId?: number;
  latestCount?: number;
  hasUpdatedAtCol?: boolean;
}> {
  const meta = tableSyncState[table] || {};

  // Try probing with updated_at unless we already know this table lacks updated_at
  if (meta.hasUpdatedAtCol !== false) {
    const { data, count, error } = await supabase
      .from(table)
      .select("id, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!error) {
      const top = data && data[0] ? data[0] : null;
      const latestUpdatedAt = top?.updated_at || null;
      const latestMaxId = top?.id ? Number(top.id) : 0;
      const latestCount = count ?? 0;

      const unchanged =
        Boolean(meta.initialSyncDone) &&
        meta.lastCount === latestCount &&
        meta.lastUpdatedAt === latestUpdatedAt &&
        meta.lastMaxId === latestMaxId;

      // We can do an incremental pull (WHERE updated_at > lastUpdatedAt) if:
      // 1. Initial full sync was already completed
      // 2. We have a previous lastUpdatedAt timestamp
      // 3. The cloud row count did not decrease (no deletions occurred)
      const canIncremental =
        Boolean(meta.initialSyncDone) &&
        Boolean(meta.lastUpdatedAt) &&
        latestCount >= (meta.lastCount ?? 0);

      return {
        changed: !unchanged,
        canIncremental,
        sinceUpdatedAt: meta.lastUpdatedAt || undefined,
        latestUpdatedAt,
        latestMaxId,
        latestCount,
        hasUpdatedAtCol: true,
      };
    }
  }

  // Fallback probe using id and exact row count (when updated_at column is not present yet)
  const { data, count, error } = await supabase
    .from(table)
    .select("id", { count: "exact" })
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    return { changed: true, canIncremental: false };
  }

  const top = data && data[0] ? data[0] : null;
  const latestMaxId = top?.id ? Number(top.id) : 0;
  const latestCount = count ?? 0;

  const unchanged =
    Boolean(meta.initialSyncDone) &&
    meta.lastCount === latestCount &&
    meta.lastMaxId === latestMaxId;

  return {
    changed: !unchanged,
    canIncremental: false,
    latestUpdatedAt: null,
    latestMaxId,
    latestCount,
    hasUpdatedAtCol: false,
  };
}

function recordTableSynced(
  table: string,
  probe: {
    latestUpdatedAt?: string | null;
    latestMaxId?: number;
    latestCount?: number;
    hasUpdatedAtCol?: boolean;
  }
): void {
  tableSyncState[table] = {
    lastUpdatedAt: probe.latestUpdatedAt ?? tableSyncState[table]?.lastUpdatedAt ?? null,
    lastMaxId: probe.latestMaxId ?? tableSyncState[table]?.lastMaxId ?? 0,
    lastCount: probe.latestCount ?? tableSyncState[table]?.lastCount ?? 0,
    hasUpdatedAtCol: probe.hasUpdatedAtCol ?? tableSyncState[table]?.hasUpdatedAtCol,
    initialSyncDone: true,
  };
  saveTableSyncState();
}

/**
 * Paginated fetch supporting narrow column lists and optional filters
 * (e.g. incremental updated_at > X or 60-day created_at cutoff).
 */
async function fetchRowsPaginated(
  table: string,
  columns: string,
  options?: {
    sinceUpdatedAt?: string;
    sinceCreatedAt?: string;
    sinceId?: number;
  }
): Promise<{ data: any[] | null; error: any }> {
  const PAGE = 1000;
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (options?.sinceUpdatedAt) {
      query = query.gt("updated_at", options.sinceUpdatedAt);
    }
    if (options?.sinceCreatedAt) {
      query = query.gte("created_at", options.sinceCreatedAt);
    }
    if (options?.sinceId !== undefined && options.sinceId > 0) {
      query = query.gt("id", options.sinceId);
    }

    const { data, error } = await query;
    if (error) return { data: null, error };
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { data: all, error: null };
}

/**
 * Pull all stores from Supabase Cloud and upsert into local SQLite.
 */
async function pullStores(): Promise<boolean> {
  const probe = await checkTableChanged("stores");
  if (!probe.changed) return false;

  const { data, error } = await fetchRowsPaginated(
    "stores",
    TABLE_COLUMNS.stores,
    probe.canIncremental ? { sinceUpdatedAt: probe.sinceUpdatedAt } : undefined
  );

  if (error || !data) return false;

  for (const store of data) {
    const isActiveVal = store.is_active === true || store.is_active === 1 ? 1 : 0;
    await rawExecute(
      `INSERT INTO stores (id, name, code, address, phone, email, setup_cost, amc, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT(id) DO UPDATE SET
         name = COALESCE(NULLIF(stores.name, ''), excluded.name),
         code = COALESCE(NULLIF(stores.code, ''), excluded.code),
         address = COALESCE(NULLIF(stores.address, ''), excluded.address),
         phone = COALESCE(NULLIF(stores.phone, ''), excluded.phone),
         email = COALESCE(NULLIF(stores.email, ''), excluded.email),
         setup_cost = excluded.setup_cost,
         amc = excluded.amc,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`,
      [
        store.id,
        store.name,
        store.code || null,
        store.address || null,
        store.phone || null,
        store.email || null,
        store.setup_cost ?? 0,
        store.amc ?? 0,
        isActiveVal,
        store.created_at || new Date().toISOString(),
        store.updated_at || new Date().toISOString(),
      ]
    );
  }

  recordTableSynced("stores", probe);
  return data.length > 0;
}

/**
 * Pull per-store settings from cloud. Newest write wins (updated_ms), so a
 * stale cloud row can never overwrite a newer local save.
 */
async function pullSettings(): Promise<boolean> {
  const meta = tableSyncState["settings"] || {};

  // Cheap 1-row check on updated_ms (avoids downloading 78KB base64 logo_url on every poll!)
  const { data: probeData, count, error: probeError } = await supabase
    .from("settings")
    .select("updated_ms", { count: "exact" })
    .order("updated_ms", { ascending: false })
    .limit(1);

  if (probeError) return false;

  const topMs = probeData && probeData[0] ? Number(probeData[0].updated_ms) || 0 : 0;
  const totalCount = count ?? 0;

  if (meta.initialSyncDone && meta.lastMaxId === topMs && meta.lastCount === totalCount) {
    return false;
  }

  let query = supabase.from("settings").select(TABLE_COLUMNS.settings);
  if (meta.initialSyncDone && meta.lastMaxId && totalCount >= (meta.lastCount ?? 0)) {
    query = query.gt("updated_ms", meta.lastMaxId);
  }

  const { data, error } = await query;
  if (error || !data) return false;

  const EXCLUDED_DEVICE_KEYS = new Set([
    "default_printer",
    "barcode_printer",
    "paper_width",
    "pos_printer",
    "pos_paper_width",
  ]);

  for (const s of data) {
    if (EXCLUDED_DEVICE_KEYS.has(s.key)) {
      continue;
    }
    await rawExecute(
      `INSERT INTO settings (store_id, key, value, updated_ms)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(store_id, key) DO UPDATE SET
         value = excluded.value,
         updated_ms = excluded.updated_ms
       WHERE excluded.updated_ms > settings.updated_ms`,
      [s.store_id, s.key, s.value ?? null, Number(s.updated_ms) || 0]
    );
  }

  recordTableSynced("settings", {
    latestMaxId: topMs,
    latestCount: totalCount,
    hasUpdatedAtCol: false,
  });
  return data.length > 0;
}

/**
 * Pull users from Supabase Cloud and upsert into local SQLite.
 */
async function pullUsers(): Promise<boolean> {
  const probe = await checkTableChanged("users");
  if (!probe.changed) return false;

  const { data, error } = await fetchRowsPaginated(
    "users",
    TABLE_COLUMNS.users,
    probe.canIncremental ? { sinceUpdatedAt: probe.sinceUpdatedAt } : undefined
  );

  if (error || !data) return false;

  for (const user of data) {
    const isActiveVal = user.is_active === true || user.is_active === 1 ? 1 : 0;
    await rawExecute(
      `INSERT INTO users (id, username, password_hash, full_name, role, phone, store_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(username) DO UPDATE SET
         id = excluded.id,
         password_hash = excluded.password_hash,
         full_name = excluded.full_name,
         role = excluded.role,
         phone = excluded.phone,
         store_id = excluded.store_id,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`,
      [
        user.id,
        user.username,
        user.password_hash,
        user.full_name,
        user.role || "cashier",
        user.phone || null,
        user.store_id ?? null,
        isActiveVal,
        user.created_at || new Date().toISOString(),
        user.updated_at || new Date().toISOString(),
      ]
    );
  }

  recordTableSynced("users", probe);
  return data.length > 0;
}

/**
 * Pull products / inventory items from Supabase Cloud into local SQLite.
 * Uses incremental pull (updated_at > lastSynced) whenever possible.
 */
async function pullProducts(): Promise<boolean> {
  const probe = await checkTableChanged("products");
  if (!probe.changed) return false;

  const { data, error } = await fetchRowsPaginated(
    "products",
    TABLE_COLUMNS.products,
    probe.canIncremental ? { sinceUpdatedAt: probe.sinceUpdatedAt } : undefined
  );
  if (error || !data) return false;

  for (const p of data) {
    await rawExecute(
      `INSERT INTO products (id, barcode, name, batch_no, mrp, price, cost_price, stock, hsn_code, reorder_threshold, gst_rate, category, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT(id) DO UPDATE SET
         barcode = excluded.barcode,
         name = excluded.name,
         batch_no = excluded.batch_no,
         mrp = excluded.mrp,
         price = excluded.price,
         cost_price = excluded.cost_price,
         stock = excluded.stock,
         hsn_code = excluded.hsn_code,
         reorder_threshold = excluded.reorder_threshold,
         gst_rate = excluded.gst_rate,
         category = excluded.category,
         created_at = excluded.created_at`,
      [
        p.id,
        p.barcode || null,
        p.name,
        p.batch_no || null,
        Number(p.mrp) || 0,
        Number(p.price) || 0,
        Number(p.cost_price) || 0,
        Number(p.stock) || 0,
        p.hsn_code || null,
        Number(p.reorder_threshold) || 0,
        Number(p.gst_rate) || 0,
        p.category || "General",
        p.created_at || new Date().toISOString(),
      ]
    );
  }

  recordTableSynced("products", probe);
  return data.length > 0;
}

/**
 * Pull marketing personnel from Supabase Cloud into local SQLite.
 */
async function pullMarketing(): Promise<boolean> {
  const probe = await checkTableChanged("marketing");
  if (!probe.changed) return false;

  const { data, error } = await fetchRowsPaginated(
    "marketing",
    TABLE_COLUMNS.marketing,
    probe.canIncremental ? { sinceUpdatedAt: probe.sinceUpdatedAt } : undefined
  );
  if (error || !data) return false;

  for (const m of data) {
    await rawExecute(
      `INSERT INTO marketing (id, name, phone, area, sales, commission, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         phone = excluded.phone,
         area = excluded.area,
         sales = excluded.sales,
         commission = excluded.commission,
         created_at = excluded.created_at`,
      [
        m.id,
        m.name,
        m.phone || null,
        m.area || null,
        Number(m.sales) || 0,
        Number(m.commission) || 0,
        m.created_at || new Date().toISOString(),
      ]
    );
  }

  recordTableSynced("marketing", probe);
  return data.length > 0;
}

/**
 * Pull suppliers from Supabase Cloud into local SQLite.
 */
async function pullSuppliers(): Promise<boolean> {
  const probe = await checkTableChanged("suppliers");
  if (!probe.changed) return false;

  const { data, error } = await fetchRowsPaginated(
    "suppliers",
    TABLE_COLUMNS.suppliers,
    probe.canIncremental ? { sinceUpdatedAt: probe.sinceUpdatedAt } : undefined
  );
  if (error || !data) return false;

  for (const s of data) {
    await rawExecute(
      `INSERT INTO suppliers (id, name, company_name, gst_no, contact_no, email, address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         company_name = excluded.company_name,
         gst_no = excluded.gst_no,
         contact_no = excluded.contact_no,
         email = excluded.email,
         address = excluded.address,
         created_at = excluded.created_at`,
      [
        s.id,
        s.name,
        s.company_name || null,
        s.gst_no || null,
        s.contact_no || null,
        s.email || null,
        s.address || null,
        s.created_at || new Date().toISOString(),
      ]
    );
  }

  recordTableSynced("suppliers", probe);
  return data.length > 0;
}

/**
 * Pull customers from Supabase Cloud into local SQLite.
 */
async function pullCustomers(): Promise<boolean> {
  const probe = await checkTableChanged("customers");
  if (!probe.changed) return false;

  const { data, error } = await fetchRowsPaginated(
    "customers",
    TABLE_COLUMNS.customers,
    probe.canIncremental ? { sinceUpdatedAt: probe.sinceUpdatedAt } : undefined
  );
  if (error || !data) return false;

  for (const c of data) {
    await rawExecute(
      `INSERT INTO customers (id, name, phone, address, purchase_item_id, loyalty_points, lucky_draw_used, dues, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         phone = excluded.phone,
         address = excluded.address,
         purchase_item_id = excluded.purchase_item_id,
         loyalty_points = excluded.loyalty_points,
         lucky_draw_used = excluded.lucky_draw_used,
         dues = excluded.dues,
         created_at = excluded.created_at`,
      [
        c.id,
        c.name,
        c.phone || null,
        c.address || null,
        c.purchase_item_id || null,
        Number(c.loyalty_points) || 0,
        Number(c.lucky_draw_used) || 0,
        Number(c.dues) || 0,
        c.created_at || new Date().toISOString(),
      ]
    );
  }

  recordTableSynced("customers", probe);
  return data.length > 0;
}

/**
 * Pull purchases and purchase_items from Supabase Cloud into local SQLite.
 */
async function pullPurchases(): Promise<boolean> {
  let updated = false;

  const pProbe = await checkTableChanged("purchases");
  if (pProbe.changed) {
    const { data: purchasesData, error: pError } = await fetchRowsPaginated(
      "purchases",
      TABLE_COLUMNS.purchases,
      pProbe.canIncremental ? { sinceUpdatedAt: pProbe.sinceUpdatedAt } : undefined
    );
    if (!pError && purchasesData) {
      for (const p of purchasesData) {
        await rawExecute(
          `INSERT INTO purchases (id, supplier_name, invoice_no, purchase_date, gst_no, contact_no, total_amount, item_count, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT(id) DO UPDATE SET
             supplier_name = excluded.supplier_name,
             invoice_no = excluded.invoice_no,
             purchase_date = excluded.purchase_date,
             gst_no = excluded.gst_no,
             contact_no = excluded.contact_no,
             total_amount = excluded.total_amount,
             item_count = excluded.item_count,
             created_at = excluded.created_at`,
          [
            p.id,
            p.supplier_name,
            p.invoice_no,
            p.purchase_date,
            p.gst_no || null,
            p.contact_no || null,
            Number(p.total_amount) || 0,
            Number(p.item_count) || 0,
            p.created_at || new Date().toISOString(),
          ]
        );
      }
      recordTableSynced("purchases", pProbe);
      if (purchasesData.length > 0) updated = true;
    }
  }

  const piProbe = await checkTableChanged("purchase_items");
  if (piProbe.changed) {
    const prevMaxId = tableSyncState["purchase_items"]?.initialSyncDone
      ? tableSyncState["purchase_items"]?.lastMaxId
      : undefined;
    const { data: itemsData, error: iError } = await fetchRowsPaginated(
      "purchase_items",
      TABLE_COLUMNS.purchase_items,
      piProbe.canIncremental
        ? { sinceUpdatedAt: piProbe.sinceUpdatedAt }
        : prevMaxId
        ? { sinceId: prevMaxId }
        : undefined
    );
    if (!iError && itemsData) {
      for (const it of itemsData) {
        await rawExecute(
          `INSERT INTO purchase_items (id, purchase_id, product_id, product_name, barcode, batch_no, hsn_code, category, purchase_price, mrp, selling_price, gst_rate, quantity, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT(id) DO UPDATE SET
             purchase_id = excluded.purchase_id,
             product_id = excluded.product_id,
             product_name = excluded.product_name,
             barcode = excluded.barcode,
             batch_no = excluded.batch_no,
             hsn_code = excluded.hsn_code,
             category = excluded.category,
             purchase_price = excluded.purchase_price,
             mrp = excluded.mrp,
             selling_price = excluded.selling_price,
             gst_rate = excluded.gst_rate,
             quantity = excluded.quantity,
             subtotal = excluded.subtotal`,
          [
            it.id,
            it.purchase_id,
            it.product_id,
            it.product_name,
            it.barcode || null,
            it.batch_no || null,
            it.hsn_code || null,
            it.category || "General",
            Number(it.purchase_price) || 0,
            Number(it.mrp) || 0,
            Number(it.selling_price) || 0,
            Number(it.gst_rate) || 0,
            Number(it.quantity) || 0,
            Number(it.subtotal) || 0,
          ]
        );
      }
      recordTableSynced("purchase_items", piProbe);
      if (itemsData.length > 0) updated = true;
    }
  }

  return updated;
}

/**
 * Pull sales and sale_items from Supabase Cloud into local SQLite.
 * - Uses cheap change check first so idle polls download 0 rows.
 * - After the first full sync on a counter, only pulls the last 60 days of sales
 *   (or rows updated since last sync) so historical sales stay in local SQLite
 *   without consuming egress on every sync.
 */
async function pullSales(): Promise<boolean> {
  const db = await getDb();

  const salesProbe = await checkTableChanged("sales");
  const itemsProbe = await checkTableChanged("sale_items");
  if (!salesProbe.changed && !itemsProbe.changed) {
    return false;
  }

  const localSales = await db.select<{ id: number; invoice_no: string; created_at?: string }[]>(
    "SELECT id, invoice_no, created_at FROM sales"
  );
  const hasLocalHistory = localSales.length > 0 && Boolean(tableSyncState["sales"]?.initialSyncDone);

  // 60-day window cutoff for subsequent syncs
  const cutoffDateIso = new Date(
    Date.now() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // 1. Fetch sales from Supabase (incremental or 60-day window after initial sync)
  const salesFetchOptions = salesProbe.canIncremental
    ? { sinceUpdatedAt: salesProbe.sinceUpdatedAt }
    : hasLocalHistory
    ? { sinceCreatedAt: cutoffDateIso }
    : undefined;

  const { data: salesData, error: sError } = await fetchRowsPaginated(
    "sales",
    TABLE_COLUMNS.sales,
    salesFetchOptions
  );
  if (sError || !salesData) {
    if (sError) console.warn("[SyncProcessor] Failed to pull sales:", sError);
    return false;
  }

  // Map to resolve Supabase sale.id -> invoice_no
  const cloudSaleIdToInvoice = new Map<number, string>();

  // Upsert sales by invoice_no into local SQLite (never force cloud ID onto local autoincrement ID)
  for (const s of salesData) {
    if (!s.invoice_no) continue;
    cloudSaleIdToInvoice.set(s.id, s.invoice_no);

    await rawExecute(
      `INSERT INTO sales (invoice_no, customer_name, customer_phone, total_amount, discount, tax_amount, grand_total, payment_mode, marketing_person_id, customer_id, loyalty_points, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT(invoice_no) DO UPDATE SET
         customer_name = excluded.customer_name,
         customer_phone = excluded.customer_phone,
         total_amount = excluded.total_amount,
         discount = excluded.discount,
         tax_amount = excluded.tax_amount,
         grand_total = excluded.grand_total,
         payment_mode = excluded.payment_mode,
         marketing_person_id = excluded.marketing_person_id,
         customer_id = excluded.customer_id,
         loyalty_points = excluded.loyalty_points,
         created_at = excluded.created_at`,
      [
        s.invoice_no,
        s.customer_name || null,
        s.customer_phone || null,
        Number(s.total_amount) || 0,
        Number(s.discount) || 0,
        Number(s.tax_amount) || 0,
        Number(s.grand_total) || 0,
        s.payment_mode,
        s.marketing_person_id || null,
        s.customer_id || null,
        Number(s.loyalty_points) || 0,
        s.created_at || new Date().toISOString(),
      ]
    );
  }

  // 2. Fetch sale_items from Supabase
  // After initial sync, only fetch new/updated sale_items (or items for the fetched sales window)
  let saleItemsData: any[] | null = null;
  let siError: any = null;

  const prevMaxItemId = tableSyncState["sale_items"]?.initialSyncDone
    ? tableSyncState["sale_items"]?.lastMaxId
    : undefined;
  const itemsCountDecreased =
    (itemsProbe.latestCount ?? 0) < (tableSyncState["sale_items"]?.lastCount ?? 0);

  if (itemsProbe.canIncremental && !itemsCountDecreased) {
    const res = await fetchRowsPaginated("sale_items", TABLE_COLUMNS.sale_items, {
      sinceUpdatedAt: itemsProbe.sinceUpdatedAt,
    });
    saleItemsData = res.data;
    siError = res.error;
  } else if (hasLocalHistory && prevMaxItemId && !itemsCountDecreased && salesProbe.canIncremental) {
    const res = await fetchRowsPaginated("sale_items", TABLE_COLUMNS.sale_items, {
      sinceId: prevMaxItemId,
    });
    saleItemsData = res.data;
    siError = res.error;
  } else if (hasLocalHistory && salesData.length > 0 && salesData.length <= 300) {
    // Fetch sale_items only for the invoices in our 60-day window
    const invoices = salesData.map((s) => s.invoice_no).filter(Boolean);
    const allWindowItems: any[] = [];
    const CHUNK = 100;
    for (let i = 0; i < invoices.length; i += CHUNK) {
      const batch = invoices.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("sale_items")
        .select(TABLE_COLUMNS.sale_items)
        .in("invoice_no", batch);
      if (error) {
        siError = error;
        break;
      }
      if (data) allWindowItems.push(...data);
    }
    if (!siError) saleItemsData = allWindowItems;
  } else {
    const res = await fetchRowsPaginated("sale_items", TABLE_COLUMNS.sale_items);
    saleItemsData = res.data;
    siError = res.error;
  }

  if (siError || !saleItemsData) {
    if (siError) console.warn("[SyncProcessor] Failed to pull sale_items:", siError);
    return salesData.length > 0;
  }

  // Refresh local sales map after upserting sales
  const refreshedLocalSales = await db.select<{ id: number; invoice_no: string; created_at?: string }[]>(
    "SELECT id, invoice_no, created_at FROM sales"
  );
  const localSaleMap = new Map<string, number>();
  for (const ls of refreshedLocalSales) {
    if (ls.invoice_no) localSaleMap.set(ls.invoice_no, ls.id);
  }

  // Group cloud sale items by invoice_no, deduplicating any duplicate sync entries
  const cloudItemsByInvoice = new Map<string, typeof saleItemsData>();
  for (const it of saleItemsData) {
    const inv = it.invoice_no || cloudSaleIdToInvoice.get(it.sale_id);
    if (!inv) continue;
    if (!cloudItemsByInvoice.has(inv)) {
      cloudItemsByInvoice.set(inv, []);
    }
    const list = cloudItemsByInvoice.get(inv)!;
    const isDup = list.some(
      (existing) =>
        existing.product_id === it.product_id &&
        Number(existing.quantity) === Number(it.quantity) &&
        Number(existing.price) === Number(it.price)
    );
    if (!isDup) {
      list.push(it);
    }
  }

  // Reconcile items per invoice
  for (const [invoiceNo, cloudItems] of cloudItemsByInvoice.entries()) {
    const localSaleId = localSaleMap.get(invoiceNo);
    if (!localSaleId) continue;

    const localItems = await db.select<{ id: number; product_id: number; quantity: number }[]>(
      "SELECT id, product_id, quantity FROM sale_items WHERE invoice_no = $1",
      [invoiceNo]
    );

    if (localItems.length === cloudItems.length && localItems.length > 0) {
      continue;
    }

    await rawExecute("DELETE FROM sale_items WHERE invoice_no = $1", [invoiceNo]);

    for (const it of cloudItems) {
      await rawExecute(
        `INSERT INTO sale_items (sale_id, invoice_no, product_id, product_name, barcode, batch_no, price, quantity, total_price, mrp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          localSaleId,
          invoiceNo,
          it.product_id,
          it.product_name,
          it.barcode || null,
          it.batch_no || null,
          Number(it.price) || 0,
          Number(it.quantity) || 0,
          Number(it.total_price) || 0,
          Number(it.mrp) || Number(it.price) || 0,
        ]
      );
    }
  }

  // 3. Handle deleted sales from cloud (only when a full or 60-day window scan was run, not incremental)
  if (!salesProbe.canIncremental) {
    const cloudInvoiceSet = new Set(salesData.map((s) => s.invoice_no));
    for (const ls of refreshedLocalSales) {
      if (!ls.invoice_no) continue;
      // When using the 60-day window, never delete local historical sales older than 60 days
      if (hasLocalHistory && ls.created_at && ls.created_at < cutoffDateIso) {
        continue;
      }
      if (!cloudInvoiceSet.has(ls.invoice_no)) {
        const pending = await db.select<{ count: number }[]>(
          "SELECT count(*) as count FROM sync_jobs WHERE query LIKE '%' || $1 || '%'",
          [ls.invoice_no]
        );
        if (pending && pending[0] && pending[0].count > 0) {
          continue;
        }
        await rawExecute("DELETE FROM sale_items WHERE invoice_no = $1", [ls.invoice_no]);
        await rawExecute("DELETE FROM sales WHERE invoice_no = $1", [ls.invoice_no]);
      }
    }
  }

  recordTableSynced("sales", salesProbe);
  recordTableSynced("sale_items", itemsProbe);
  return salesData.length > 0 || saleItemsData.length > 0;
}

export const DB_UPDATED_EVENT = "retail_sathi_db_updated";

/**
 * Dispatch an event to notify active React components that local SQLite data has been updated.
 */
export function notifyDbUpdated(table = "all"): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(DB_UPDATED_EVENT, { detail: { table, timestamp: Date.now() } })
    );
  }
}

/**
 * Pull changed tables from Supabase Cloud and upsert into local SQLite.
 * Uses cheap 1-row checks and incremental pulls to minimize Supabase egress.
 */
export async function pullDataFromCloud(): Promise<void> {
  if (isPulling) return;
  if (!isCloudSyncConfigured) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }

  isPulling = true;
  try {
    let anyChanged = false;
    // Topological order: parent tables first, then dependent child tables
    if (await pullStores()) anyChanged = true;
    if (await pullSettings()) anyChanged = true;
    if (await pullUsers()) anyChanged = true;
    if (await pullMarketing()) anyChanged = true;
    if (await pullSuppliers()) anyChanged = true;
    if (await pullProducts()) anyChanged = true;
    if (await pullCustomers()) anyChanged = true;
    if (await pullPurchases()) anyChanged = true;
    if (await pullSales()) anyChanged = true;

    if (anyChanged) {
      notifyDbUpdated("all");
    }
  } catch (err) {
    console.error("[Sync] Error in pullDataFromCloud:", err);
  } finally {
    isPulling = false;
  }
}

/**
 * Backward compatibility alias for user pull.
 */
export async function pullUsersFromCloud(): Promise<void> {
  return pullDataFromCloud();
}

/**
 * Trigger background sync job processing with debounce.
 * Note: Pushing local writes does NOT re-download the entire cloud database,
 * because the write was already applied to local SQLite.
 */
export function triggerSync(delayMs = 250): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    processSyncJobs().catch((err) => {
      console.error("[Sync] Background sync execution failed:", err);
    });
  }, delayMs);
}

// Automatically flush queued jobs and pull cloud changes on a low-egress schedule
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[Sync] Online status detected, flushing sync jobs and pulling changed data from cloud...");
    processSyncJobs()
      .then(() => pullDataFromCloud())
      .catch((err) => console.error("[Sync] Reconnect sync error:", err));
  });

  // Initial startup sync (flush any offline jobs, then pull changes)
  setTimeout(() => {
    processSyncJobs()
      .then(() => pullDataFromCloud())
      .catch((err) => console.error("[Sync] Initial sync error:", err));
  }, 1500);

  // Check local sync_jobs queue every 15s (zero network requests if local queue is empty)
  setInterval(() => {
    processSyncJobs().catch((err) => console.error("[Sync] Queue flush error:", err));
  }, 15000);

  // Poll cloud for remote counter changes every 3 minutes instead of every 4 seconds
  setInterval(() => {
    pullDataFromCloud().catch((err) => console.error("[Sync] Periodic pull error:", err));
  }, POLL_INTERVAL_MS);
}
