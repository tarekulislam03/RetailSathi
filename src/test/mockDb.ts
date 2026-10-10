import SQLite from "better-sqlite3";
import { vi } from "vitest";
import * as dbModule from "../services/database";

export function createMockDatabase() {
  const sqliteDb = new SQLite(":memory:");

  // Initialize in-memory database schema
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      address TEXT,
      phone TEXT,
      email TEXT,
      setup_cost REAL DEFAULT 0,
      amc REAL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      upi_id TEXT,
      upi_name TEXT,
      gstin TEXT,
      receipt_footer TEXT,
      paper_width INTEGER DEFAULT 80,
      default_printer TEXT,
      show_barcode INTEGER DEFAULT 1,
      show_upi_qr INTEGER DEFAULT 1,
      tagline TEXT,
      promo_text TEXT,
      fssai TEXT,
      logo_url TEXT,
      return_policy TEXT,
      show_header INTEGER DEFAULT 1,
      show_customer INTEGER DEFAULT 1,
      show_savings INTEGER DEFAULT 1,
      show_tax INTEGER DEFAULT 1,
      show_return_policy INTEGER DEFAULT 1,
      mandatory_bill_note INTEGER DEFAULT 1,
      barcode_printer TEXT,
      label_width_mm INTEGER DEFAULT 50,
      label_height_mm INTEGER DEFAULT 30,
      label_gap_mm INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      phone TEXT,
      store_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT,
      name TEXT NOT NULL,
      batch_no TEXT,
      mrp REAL DEFAULT 0,
      price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      stock INTEGER NOT NULL,
      hsn_code TEXT,
      reorder_threshold INTEGER DEFAULT 0,
      gst_rate REAL DEFAULT 0,
      category TEXT DEFAULT 'General',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      barcode TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

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

  const mockDb = {
    async execute(
      query: string,
      bindParams: any[] = []
    ): Promise<{ rowsAffected: number; lastInsertId: number }> {
      const sqliteQuery = query.replace(/\$[0-9]+/g, "?");
      const stmt = sqliteDb.prepare(sqliteQuery);
      const info = stmt.run(...bindParams);
      return {
        rowsAffected: info.changes,
        lastInsertId: Number(info.lastInsertRowid),
      };
    },

    async select<T>(query: string, bindParams: any[] = []): Promise<T> {
      const sqliteQuery = query.replace(/\$[0-9]+/g, "?");
      const stmt = sqliteDb.prepare(sqliteQuery);
      const rows = stmt.all(...bindParams);
      return rows as unknown as T;
    },
  };

  vi.spyOn(dbModule, "getDb").mockImplementation(async () => mockDb as any);

  return { sqliteDb, mockDb };
}
