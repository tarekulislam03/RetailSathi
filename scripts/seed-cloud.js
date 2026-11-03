import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 1. Read environment variables from .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`Cannot find .env file at ${envPath}`);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  let url = '';
  let key = '';
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      url = trimmed.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      key = trimmed.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  }
  return { url, key };
}

// 2. Find local SQLite database path
function getLocalDbPath() {
  if (process.env.LOCAL_DB_PATH && fs.existsSync(process.env.LOCAL_DB_PATH)) {
    return process.env.LOCAL_DB_PATH;
  }
  const possiblePaths = [
    path.join(os.homedir(), '.config', 'com.tarekul.retail-sathi', 'retail_sathi.db'),
    path.join(process.cwd(), 'retail_sathi.db'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Local retail_sathi.db not found in searched paths: ${possiblePaths.join(', ')}`);
}

// Helper to convert date strings to valid ISO format for PostgreSQL
function formatIsoDate(dateVal) {
  if (!dateVal) return new Date().toISOString();
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return new Date().toISOString();
}

const ALLOWED_COLUMNS = {
  stores: [
    'id', 'name', 'code', 'address', 'phone', 'email', 'setup_cost', 'amc',
    'is_active', 'upi_id', 'upi_name', 'gstin', 'receipt_footer', 'paper_width',
    'default_printer', 'show_barcode', 'show_upi_qr', 'tagline', 'promo_text',
    'fssai', 'logo_url', 'return_policy', 'show_header', 'show_customer',
    'show_savings', 'show_tax', 'show_return_policy', 'mandatory_bill_note',
    'barcode_printer', 'label_width_mm', 'label_height_mm', 'label_gap_mm',
    'created_at', 'updated_at',
  ],
  settings: ['store_id', 'key', 'value', 'updated_ms'],
  users: [
    'id', 'username', 'password_hash', 'full_name', 'role', 'phone',
    'store_id', 'is_active', 'created_at', 'updated_at',
  ],
  products: [
    'id', 'barcode', 'name', 'batch_no', 'mrp', 'price', 'cost_price',
    'stock', 'hsn_code', 'reorder_threshold', 'gst_rate', 'category', 'created_at',
  ],
  marketing: ['id', 'name', 'phone', 'area', 'sales', 'commission', 'created_at'],
  suppliers: [
    'id', 'name', 'company_name', 'gst_no', 'contact_no', 'email', 'address', 'created_at',
  ],
  customers: [
    'id', 'name', 'phone', 'address', 'purchase_item_id', 'loyalty_points',
    'lucky_draw_used', 'dues', 'created_at',
  ],
  purchases: [
    'id', 'supplier_name', 'invoice_no', 'purchase_date', 'gst_no', 'contact_no',
    'total_amount', 'item_count', 'created_at',
  ],
  purchase_items: [
    'id', 'purchase_id', 'product_id', 'product_name', 'barcode', 'batch_no',
    'hsn_code', 'category', 'purchase_price', 'mrp', 'selling_price', 'gst_rate',
    'quantity', 'subtotal',
  ],
  sales: [
    'id', 'invoice_no', 'customer_name', 'customer_phone', 'total_amount',
    'discount', 'tax_amount', 'grand_total', 'payment_mode', 'marketing_person_id',
    'customer_id', 'loyalty_points', 'created_at',
  ],
  sale_items: [
    'id', 'sale_id', 'invoice_no', 'product_id', 'product_name', 'barcode',
    'batch_no', 'price', 'quantity', 'total_price', 'mrp',
  ],
};

const EXCLUDED_DEVICE_KEYS = new Set([
  'default_printer',
  'barcode_printer',
  'paper_width',
  'pos_printer',
  'pos_paper_width',
]);

// 3. Main seeding function
async function seedCloud() {
  console.log('--- RetailSathi Cloud Database Seeder ---');
  const { url, key } = loadEnv();
  const dbPath = getLocalDbPath();
  console.log(`Local SQLite DB: ${dbPath}`);
  console.log(`Supabase URL:    ${url}`);

  const localDb = new Database(dbPath, { readonly: true });
  const supabase = createClient(url, key);

  // Topological order respecting foreign keys across all 11 tables:
  const tables = [
    'stores',
    'settings',
    'users',
    'products',
    'marketing',
    'suppliers',
    'customers',
    'purchases',
    'purchase_items',
    'sales',
    'sale_items',
  ];

  console.log('\nSeeding tables to Supabase (in 250-row batches)...\n');

  for (const table of tables) {
    process.stdout.write(`Processing "${table}"... `);

    let localRows = [];
    try {
      localRows = localDb.prepare(`SELECT * FROM ${table}`).all();
    } catch {
      console.log('table not found locally (skipped).');
      continue;
    }

    if (table === 'settings') {
      localRows = localRows.filter((r) => !EXCLUDED_DEVICE_KEYS.has(r.key));
    }

    if (localRows.length === 0) {
      console.log('0 rows found locally (skipped).');
      continue;
    }

    // Clean rows: keep only columns defined in the Supabase schema and normalize dates
    const allowedCols = ALLOWED_COLUMNS[table];
    const sanitizedRows = localRows.map((row) => {
      const clean = {};
      for (const col of allowedCols) {
        if (col in row) {
          clean[col] = row[col];
        }
      }

      if ('created_at' in clean) {
        clean.created_at = formatIsoDate(clean.created_at);
      }
      if ('updated_at' in clean) {
        clean.updated_at = formatIsoDate(clean.updated_at);
      }
      if ('purchase_date' in clean && clean.purchase_date) {
        clean.purchase_date = String(clean.purchase_date);
      }

      return clean;
    });

    const batchSize = 250;
    let totalUpserted = 0;
    const conflictTarget = table === 'settings' ? 'store_id,key' : 'id';

    for (let i = 0; i < sanitizedRows.length; i += batchSize) {
      const batch = sanitizedRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict: conflictTarget });

      if (error) {
        console.error(`\n[Error in "${table}"]:`, error.message);
        throw error;
      }
      totalUpserted += batch.length;
    }

    console.log(`Done (${totalUpserted} rows upserted).`);
  }

  // Reset sequence values on Supabase in a SINGLE batched RPC call
  console.log('\nResetting PostgreSQL sequence IDs on cloud tables...');
  const tablesWithSerialId = tables.filter((t) => t !== 'settings');
  const combinedSeqSql = tablesWithSerialId
    .map(
      (t) =>
        `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1));`
    )
    .join('\n');

  try {
    const { error } = await supabase.rpc('exec_sql', { query_text: combinedSeqSql });
    if (error) {
      console.warn('Could not reset sequences via exec_sql:', error.message);
    } else {
      console.log('All sequences reset in 1 batched RPC call.');
    }
  } catch (seqErr) {
    console.warn('Could not reset sequences:', seqErr?.message || seqErr);
  }

  // Verification
  console.log('\n--- Verification Summary ---');
  console.log('| Table Name      | Local Count | Cloud Count | Status  |');
  console.log('|-----------------|-------------|-------------|---------|');

  for (const table of tables) {
    let localCount = 0;
    try {
      const rows = localDb.prepare(`SELECT * FROM ${table}`).all();
      localCount =
        table === 'settings'
          ? rows.filter((r) => !EXCLUDED_DEVICE_KEYS.has(r.key)).length
          : rows.length;
    } catch {
      continue;
    }

    const { count: cloudCount } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    const status = localCount === cloudCount ? ' MATCH  ' : 'MISMATCH';
    console.log(
      `| ${table.padEnd(15)} | ${String(localCount).padStart(11)} | ${String(cloudCount ?? 'err').padStart(11)} | ${status} |`
    );
  }

  console.log('\nCloud seeding completed successfully!\n');
}

seedCloud().catch((err) => {
  console.error('\nCloud seeding failed:', err);
  process.exit(1);
});
