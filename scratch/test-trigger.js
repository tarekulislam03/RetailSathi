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

async function testTrigger() {
  const randomShopId = crypto.randomUUID();
  console.log('Testing insert with non-existent Shop ID:', randomShopId);

  const testOp = {
    shop_id: randomShopId,
    uuid: crypto.randomUUID(),
    counter_id: 'counter-1',
    operation: 'INSERT',
    table_name: 'products',
    record_uuid: crypto.randomUUID(),
    payload: { name: 'Trigger Test Product', price: 250, stock: 5 },
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('sync_operations').insert(testOp).select();
  console.log('Insert Result:', data);
  console.log('Insert Error:', error);
}

testTrigger();
