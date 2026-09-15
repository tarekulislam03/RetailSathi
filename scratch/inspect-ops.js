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

async function inspectOps() {
  console.log('Fetching sync_operations rows from Supabase...');
  const { data, error } = await supabase.from('sync_operations').select('*').limit(10);
  
  if (error) {
    console.error('Error fetching sync_operations:', error);
  } else {
    console.log('Found', data?.length || 0, 'sync_operations rows.');
    console.log('Sample rows:', JSON.stringify(data, null, 2));
  }
}

inspectOps();
