import Database, { QueryResult } from "@tauri-apps/plugin-sql";
import { triggerSync } from "./syncProcessor";

let dbInstance: Database | null = null;
let rawExecuteFn: ((query: string, bindValues?: unknown[]) => Promise<QueryResult>) | null = null;

const SYNC_TABLES = new Set([
  "products",
  "sales",
  "sale_items",
  "purchases",
  "purchase_items",
  "suppliers",
  "customers",
  "marketing",
]);

function formatSqlValue(val: unknown): string {
  if (val === null || val === undefined) {
    return "NULL";
  }
  if (typeof val === "number") {
    if (isNaN(val) || !isFinite(val)) return "NULL";
    return val.toString();
  }
  if (typeof val === "boolean") {
    return val ? "TRUE" : "FALSE";
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (typeof val === "string") {
    return `'${val.replace(/'/g, "''")}'`;
  }
  return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
}

function substituteParams(sql: string, bindValues?: unknown[]): string {
  if (!bindValues || bindValues.length === 0) {
    return sql;
  }
  // Substitute $1, $2, etc.
  if (/\$\d+/.test(sql)) {
    return sql.replace(/\$(\d+)/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < bindValues.length) {
        return formatSqlValue(bindValues[index]);
      }
      return match;
    });
  }
  // Substitute ? placeholders if present
  let paramIdx = 0;
  return sql.replace(/\?/g, () => {
    if (paramIdx < bindValues.length) {
      return formatSqlValue(bindValues[paramIdx++]);
    }
    return "?";
  });
}

function getSyncTable(sql: string): string | null {
  const trimmed = sql.trim();
  const insertMatch = trimmed.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
  if (insertMatch && SYNC_TABLES.has(insertMatch[1].toLowerCase())) {
    return insertMatch[1].toLowerCase();
  }
  const updateMatch = trimmed.match(/^UPDATE\s+([a-zA-Z0-9_]+)/i);
  if (updateMatch && SYNC_TABLES.has(updateMatch[1].toLowerCase())) {
    return updateMatch[1].toLowerCase();
  }
  const deleteMatch = trimmed.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
  if (deleteMatch && SYNC_TABLES.has(deleteMatch[1].toLowerCase())) {
    return deleteMatch[1].toLowerCase();
  }
  return null;
}

function prepareSyncQuery(
  sql: string,
  bindValues: unknown[] | undefined,
  lastInsertId?: number
): string {
  let formatted = substituteParams(sql, bindValues);

  // Replace scalar MAX(0, ... with GREATEST(0, ... for Postgres compatibility
  formatted = formatted.replace(/\bMAX\s*\(\s*0\s*,/gi, "GREATEST(0,");

  const trimmed = formatted.trim().replace(/;+$/, "");

  // Check if it is an INSERT statement
  const insertMatch = trimmed.match(
    /^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]+)\)$/i
  );

  if (insertMatch && lastInsertId && lastInsertId > 0) {
    const tableName = insertMatch[1];
    const cols = insertMatch[2];
    const vals = insertMatch[3];
    const colNames = cols.split(",").map((c) => c.trim().toLowerCase());
    if (!colNames.includes("id")) {
      return `INSERT INTO ${tableName} (id, ${cols}) VALUES (${lastInsertId}, ${vals});`;
    }
  }

  return trimmed.endsWith(";") ? trimmed : trimmed + ";";
}

export async function rawExecute(
  query: string,
  bindValues?: unknown[]
): Promise<QueryResult> {
  if (!rawExecuteFn) {
    const db = await getDb();
    return db.execute(query, bindValues);
  }
  return rawExecuteFn(query, bindValues);
}

function setupSyncInterceptor(db: Database) {
  const originalExecute = db.execute.bind(db);
  rawExecuteFn = originalExecute;

  db.execute = async (
    query: string,
    bindValues?: unknown[]
  ): Promise<QueryResult> => {
    // 1. Run query locally in SQLite first
    const result = await originalExecute(query, bindValues);

    // 2. Check if this query affects a syncable business table
    const table = getSyncTable(query);
    if (table) {
      try {
        const syncQuery = prepareSyncQuery(
          query,
          bindValues,
          result.lastInsertId
        );
        // Save query into sync_jobs
        await originalExecute(
          "INSERT INTO sync_jobs (query) VALUES ($1)",
          [syncQuery]
        );
        // Trigger background sync to send query to cloud DB
        triggerSync();
      } catch (syncErr) {
        console.error("[SyncQueue] Failed to enqueue sync job:", syncErr);
      }
    }

    return result;
  };
}

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    const rawDb = await Database.load("sqlite:retail_sathi.db");
    await initTables(rawDb);
    setupSyncInterceptor(rawDb);
    dbInstance = rawDb;
    // Trigger initial background sync for any pending offline jobs
    triggerSync(500);
  }
  return dbInstance;
}

async function initTables(db: Database) {
  // Sync jobs table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Products table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT,
      name TEXT NOT NULL,
      batch_no TEXT,
      mrp REAL DEFAULT 0,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      hsn_code TEXT,
      reorder_threshold INTEGER DEFAULT 0,
      gst_rate REAL DEFAULT 0,
      category TEXT DEFAULT 'General',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Sales table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      total_amount REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      marketing_person_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (marketing_person_id) REFERENCES marketing(id) ON DELETE SET NULL
    );
  `);

  // Sale items table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      barcode TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Purchases table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      invoice_no TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      gst_no TEXT,
      contact_no TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      item_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Purchase items table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      barcode TEXT,
      batch_no TEXT,
      hsn_code TEXT,
      category TEXT DEFAULT 'General',
      purchase_price REAL NOT NULL,
      mrp REAL DEFAULT 0,
      selling_price REAL NOT NULL,
      gst_rate REAL DEFAULT 0,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    );
  `);

  // Suppliers table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT,
      gst_no TEXT,
      contact_no TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Customers table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      purchase_item_id INTEGER,
      loyalty_points REAL DEFAULT 0,
      dues REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_item_id) REFERENCES products(id) ON DELETE SET NULL
    );
  `);

  // Marketing table (store marketing & delivery personnel)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS marketing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      area TEXT,
      sales REAL DEFAULT 0,
      commission REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Schema migrations for existing tables
  const alterQueries = [
    "ALTER TABLE products ADD COLUMN barcode TEXT",
    "ALTER TABLE products ADD COLUMN batch_no TEXT",
    "ALTER TABLE products ADD COLUMN mrp REAL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN hsn_code TEXT",
    "ALTER TABLE products ADD COLUMN reorder_threshold INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN gst_rate REAL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0",
    "ALTER TABLE sales ADD COLUMN marketing_person_id INTEGER",
    "ALTER TABLE purchase_items ADD COLUMN batch_no TEXT",
    "ALTER TABLE purchase_items ADD COLUMN mrp REAL DEFAULT 0",
    "ALTER TABLE purchase_items ADD COLUMN gst_rate REAL DEFAULT 0",
    "ALTER TABLE purchase_items ADD COLUMN hsn_code TEXT",
    "ALTER TABLE customers ADD COLUMN purchase_item_id INTEGER",
    "ALTER TABLE customers ADD COLUMN loyalty_points REAL DEFAULT 0",
    "ALTER TABLE customers ADD COLUMN dues REAL DEFAULT 0",
  ];

  for (const query of alterQueries) {
    try {
      await db.execute(query);
    } catch {
      // Column exists, ignore
    }
  }

  // Drop extra tables created previously
  const dropExtraTables = [
    "DROP TABLE IF EXISTS users",
    "DROP TABLE IF EXISTS sessions",
    "DROP TABLE IF EXISTS sync_queue",
    "DROP TABLE IF EXISTS sync_cursor",
    "DROP TABLE IF EXISTS id_map",
  ];

  for (const dropQuery of dropExtraTables) {
    try {
      await db.execute(dropQuery);
    } catch {
      // ignore
    }
  }
}
