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

async function checkMirrorTables() {
  console.log('Checking products_cloud...');
  const { data: pData, error: pErr } = await supabase.from('products_cloud').select('*');
  console.log('products_cloud count:', pData?.length || 0, 'Error:', pErr);

  console.log('Checking sales_cloud...');
  const { data: sData, error: sErr } = await supabase.from('sales_cloud').select('*');
  console.log('sales_cloud count:', sData?.length || 0, 'Error:', sErr);

  console.log('Checking customers_cloud...');
  const { data: cData, error: cErr } = await supabase.from('customers_cloud').select('*');
  console.log('customers_cloud count:', cData?.length || 0, 'Error:', cErr);
}

checkMirrorTables();
