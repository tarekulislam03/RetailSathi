import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';

for (const line of envText.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function testInsert() {
  const shopId = '00000000-0000-0000-0000-000000000001';

  console.log('1. Ensuring shop exists in shops table...');
  const { data: shopData, error: shopErr } = await supabase.from('shops').upsert(
    {
      id: shopId,
      license_key: 'RS-AUTO-' + shopId.slice(0, 8),
      shop_name: 'Main Retail Store',
      max_counters: 5,
      is_active: true,
    },
    { onConflict: 'id' }
  ).select();

  console.log('Shop Upsert Result:', shopData, 'Error:', shopErr);

  console.log('2. Inserting sync operation into sync_operations...');
  const testOp = {
    shop_id: shopId,
    uuid: crypto.randomUUID(),
    counter_id: 'counter-1',
    operation: 'INSERT',
    table_name: 'products',
    record_uuid: crypto.randomUUID(),
    payload: { name: 'Test Product', price: 100, stock: 10 },
    created_at: new Date().toISOString(),
  };

  const { data: opData, error: opErr } = await supabase.from('sync_operations').insert(testOp).select();

  console.log('Op Result Data:', opData);
  console.log('Op Result Error:', opErr);
}

testInsert();
