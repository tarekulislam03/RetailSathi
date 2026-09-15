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
      url = trimmed.split('=')[1].trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      key = trimmed.split('=')[1].trim();
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
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return dateVal;
}

// 3. Main seeding function
async function seedCloud() {
  console.log('--- RetailSathi Cloud Database Seeder ---');
  const { url, key } = loadEnv();
  const dbPath = getLocalDbPath();
  console.log(`Local SQLite DB: ${dbPath}`);
  console.log(`Supabase URL:    ${url}`);

  const localDb = new Database(dbPath, { readonly: true });
  const supabase = createClient(url, key);

  // Topological order respecting foreign keys:
  // 1. Independent parent tables: products, marketing, suppliers
  // 2. Dependent tables: customers (references products), purchases
  // 3. Child tables: purchase_items (references purchases, products), sales (references marketing)
  // 4. Grandchild tables: sale_items (references sales, products)
  const tables = [
    'products',
    'marketing',
    'suppliers',
    'customers',
    'purchases',
    'purchase_items',
    'sales',
    'sale_items',
  ];

  console.log('\nSeeding tables to Supabase...\n');

  for (const table of tables) {
    process.stdout.write(`Processing "${table}"... `);

    // Fetch all rows from local SQLite
    const localRows = localDb.prepare(`SELECT * FROM ${table}`).all();

    if (localRows.length === 0) {
      console.log('0 rows found locally (skipped).');
      continue;
    }

    // Clean rows: remove local-only columns like 'uuid', normalize dates
    const sanitizedRows = localRows.map((row) => {
      const clean = { ...row };
      delete clean.uuid; // Not present in Supabase schema

      // Format created_at to ISO string if present
      if ('created_at' in clean && clean.created_at) {
        clean.created_at = formatIsoDate(clean.created_at);
      }

      // Format purchase_date if invalid string
      if ('purchase_date' in clean && clean.purchase_date) {
        clean.purchase_date = String(clean.purchase_date);
      }

      return clean;
    });

    // Upsert in batches of 50
    const batchSize = 50;
    let totalUpserted = 0;

    for (let i = 0; i < sanitizedRows.length; i += batchSize) {
      const batch = sanitizedRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`\n[Error in "${table}"]:`, error.message);
        throw error;
      }
      totalUpserted += batch.length;
    }

    console.log(`Done (${totalUpserted} rows upserted).`);
  }

  // Reset sequence values on Supabase so future inserts don't conflict with synced IDs
  console.log('\nResetting PostgreSQL sequence IDs on cloud tables...');
  for (const table of tables) {
    try {
      const seqSql = `
        SELECT setval(
          pg_get_serial_sequence('${table}', 'id'),
          COALESCE((SELECT MAX(id) FROM ${table}), 1)
        );
      `;
      await supabase.rpc('exec_sql', { query_text: seqSql });
    } catch (seqErr) {
      console.warn(`Could not reset sequence for ${table}:`, seqErr?.message || seqErr);
    }
  }

  // Verification
  console.log('\n--- Verification Summary ---');
  console.log('| Table Name      | Local Count | Cloud Count | Status  |');
  console.log('|-----------------|-------------|-------------|---------|');

  for (const table of tables) {
    const localCount = localDb.prepare(`SELECT count(*) as count FROM ${table}`).get().count;
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
