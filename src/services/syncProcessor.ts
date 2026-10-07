import { createClient } from "@supabase/supabase-js";
import { getDb, rawExecute } from "./database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let isProcessing = false;
let isPulling = false;
let syncTimeout: any = null;

/**
 * Drain the sync_jobs queue one by one in strict FIFO order (lowest ID first).
 * Sends each SQL query to Supabase via exec_sql RPC.
 */
export async function processSyncJobs(): Promise<void> {
  if (isProcessing) return;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }

  isProcessing = true;

  try {
    const db = await getDb();

    while (true) {
      // Pick the oldest job in the queue
      const rows = await db.select<{ id: number; query: string }[]>(
        "SELECT id, query FROM sync_jobs ORDER BY id ASC LIMIT 1"
      );

      if (!rows || rows.length === 0) {
        break; // Queue is completely empty
      }

      const job = rows[0];

      try {
        const { error } = await supabase.rpc("exec_sql", {
          query_text: job.query,
        });

        if (error) {
          const errMsg = (error.message || "").toLowerCase();

          // If the exec_sql function is not yet installed on Supabase, pause and don't discard
          if (
            errMsg.includes("could not find the function") ||
            errMsg.includes("schema cache")
          ) {
            console.warn(
              "[Sync] Cloud exec_sql function not found in Supabase. Please install the function in Supabase SQL editor."
            );
            break;
          }

          // Network or timeout errors: keep the job and retry when reconnected
          if (
            errMsg.includes("fetch") ||
            errMsg.includes("network") ||
            errMsg.includes("failed to fetch") ||
            errMsg.includes("timeout") ||
            errMsg.includes("connection")
          ) {
            console.warn("[Sync] Network issue while syncing job #" + job.id + ". Retrying later.");
            break;
          }

          // Other errors (e.g. invalid query or syntax): log and discard so the queue doesn't stay blocked
          console.error(
            `[Sync] Unrecoverable error on job #${job.id} (${error.message}). Discarding query:`,
            job.query
          );
        }

        // Successfully executed or discarded: remove from sync_jobs
        await rawExecute("DELETE FROM sync_jobs WHERE id = $1", [job.id]);
      } catch (networkErr: any) {
        console.warn(
          `[Sync] Exception sending job #${job.id} to cloud. Pausing sync:`,
          networkErr?.message || networkErr
        );
        break;
      }
    }
  } catch (err) {
    console.error("[Sync] Error running processSyncJobs:", err);
  } finally {
    isProcessing = false;
  }
}

/**
 * Pull all stores from Supabase Cloud and upsert into local SQLite.
 */
async function pullStores(): Promise<void> {
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, code, address, phone, email, setup_cost, amc, is_active, created_at, updated_at");

  if (error || !data || data.length === 0) return;

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
}

/**
 * Pull per-store settings from cloud. Newest write wins (updated_ms), so a
 * stale cloud row can never overwrite a newer local save.
 */
async function pullSettings(): Promise<void> {
  const { data, error } = await supabase
    .from("settings")
    .select("store_id, key, value, updated_ms");

  if (error || !data || data.length === 0) return;

  for (const s of data) {
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
}

/**
 * Pull all users from Supabase Cloud and upsert into local SQLite.
 */
async function pullUsers(): Promise<void> {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, password_hash, full_name, role, phone, store_id, is_active, created_at, updated_at");

  if (error || !data || data.length === 0) return;

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
}

/**
 * Pull all products / inventory items from Supabase Cloud into local SQLite.
 */
async function pullProducts(): Promise<void> {
  const { data, error } = await supabase.from("products").select("*");
  if (error || !data || data.length === 0) return;

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
}

/**
 * Pull marketing personnel from Supabase Cloud into local SQLite.
 */
async function pullMarketing(): Promise<void> {
  const { data, error } = await supabase.from("marketing").select("*");
  if (error || !data || data.length === 0) return;

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
}

/**
 * Pull suppliers from Supabase Cloud into local SQLite.
 */
async function pullSuppliers(): Promise<void> {
  const { data, error } = await supabase.from("suppliers").select("*");
  if (error || !data || data.length === 0) return;

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
}

/**
 * Pull customers from Supabase Cloud into local SQLite.
 */
async function pullCustomers(): Promise<void> {
  const { data, error } = await supabase.from("customers").select("*");
  if (error || !data || data.length === 0) return;

  for (const c of data) {
    await rawExecute(
      `INSERT INTO customers (id, name, phone, address, purchase_item_id, loyalty_points, dues, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         phone = excluded.phone,
         address = excluded.address,
         purchase_item_id = excluded.purchase_item_id,
         loyalty_points = excluded.loyalty_points,
         dues = excluded.dues,
         created_at = excluded.created_at`,
      [
        c.id,
        c.name,
        c.phone || null,
        c.address || null,
        c.purchase_item_id || null,
        Number(c.loyalty_points) || 0,
        Number(c.dues) || 0,
        c.created_at || new Date().toISOString(),
      ]
    );
  }
}

/**
 * Pull purchases and purchase_items from Supabase Cloud into local SQLite.
 */
async function pullPurchases(): Promise<void> {
  const { data: purchasesData, error: pError } = await supabase.from("purchases").select("*");
  if (!pError && purchasesData && purchasesData.length > 0) {
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
  }

  const { data: itemsData, error: iError } = await supabase.from("purchase_items").select("*");
  if (!iError && itemsData && itemsData.length > 0) {
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
  }
}

/**
 * Pull sales and sale_items from Supabase Cloud into local SQLite.
 */
async function pullSales(): Promise<void> {
  const { data: salesData, error: sError } = await supabase.from("sales").select("*");
  if (!sError && salesData && salesData.length > 0) {
    for (const s of salesData) {
      await rawExecute(
        `INSERT INTO sales (id, invoice_no, customer_name, customer_phone, total_amount, discount, tax_amount, grand_total, payment_mode, marketing_person_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT(id) DO UPDATE SET
           invoice_no = excluded.invoice_no,
           customer_name = excluded.customer_name,
           customer_phone = excluded.customer_phone,
           total_amount = excluded.total_amount,
           discount = excluded.discount,
           tax_amount = excluded.tax_amount,
           grand_total = excluded.grand_total,
           payment_mode = excluded.payment_mode,
           marketing_person_id = excluded.marketing_person_id,
           created_at = excluded.created_at`,
        [
          s.id,
          s.invoice_no,
          s.customer_name || null,
          s.customer_phone || null,
          Number(s.total_amount) || 0,
          Number(s.discount) || 0,
          Number(s.tax_amount) || 0,
          Number(s.grand_total) || 0,
          s.payment_mode,
          s.marketing_person_id || null,
          s.created_at || new Date().toISOString(),
        ]
      );
    }
  }

  const { data: saleItemsData, error: siError } = await supabase.from("sale_items").select("*");
  if (!siError && saleItemsData && saleItemsData.length > 0) {
    for (const it of saleItemsData) {
      await rawExecute(
        `INSERT INTO sale_items (id, sale_id, product_id, product_name, barcode, price, quantity, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(id) DO UPDATE SET
           sale_id = excluded.sale_id,
           product_id = excluded.product_id,
           product_name = excluded.product_name,
           barcode = excluded.barcode,
           price = excluded.price,
           quantity = excluded.quantity,
           total_price = excluded.total_price`,
        [
          it.id,
          it.sale_id,
          it.product_id,
          it.product_name,
          it.barcode || null,
          Number(it.price) || 0,
          Number(it.quantity) || 0,
          Number(it.total_price) || 0,
        ]
      );
    }
  }
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
 * Pull all tables from Supabase Cloud and upsert into local SQLite.
 * Uses rawExecute to avoid enqueuing redundant sync jobs.
 */
export async function pullDataFromCloud(): Promise<void> {
  if (isPulling) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }

  isPulling = true;
  try {
    // Topological order: parent tables first, then dependent child tables
    await pullStores();
    await pullSettings();
    await pullUsers();
    await pullMarketing();
    await pullSuppliers();
    await pullProducts();
    await pullCustomers();
    await pullPurchases();
    await pullSales();
    
    // Notify all active React pages to reload fresh data from SQLite
    notifyDbUpdated("all");
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
 */
export function triggerSync(delayMs = 150): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    processSyncJobs()
      .then(() => pullDataFromCloud())
      .catch((err) => {
        console.error("[Sync] Background sync execution failed:", err);
      });
  }, delayMs);
}

// Automatically process sync jobs on network restoration and constant interval
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[Sync] Online status detected, flushing sync jobs and pulling all data from cloud...");
    triggerSync(200);
    pullDataFromCloud();
  });

  // Constantly check queue and pull fresh updates from cloud every 4 seconds
  setInterval(() => {
    triggerSync(0);
  }, 4000);
}
