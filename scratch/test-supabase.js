import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const lines = envText.split('\n');
let url = '';
let key = '';

for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    url = line.split('=')[1].trim();
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    key = line.split('=')[1].trim();
  }
}

console.log('Testing Supabase connection...');
console.log('URL:', url);

const supabase = createClient(url, key);

async function test() {
  const { data: shops, error: shopsErr } = await supabase.from('shops').select('*');
  console.log('Shops in DB:', shops, 'Error:', shopsErr);

  const { data: ops, error: opsErr } = await supabase.from('sync_operations').select('*');
  console.log('Sync Operations count in DB:', ops?.length || 0, 'Error:', opsErr);
}

test();
