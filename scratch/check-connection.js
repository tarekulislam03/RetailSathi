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

async function checkConnection() {
  console.log('--- SUPABASE CLOUD DATABASE DIAGNOSTIC ---');
  console.log('Project URL:', url);
  
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.from('shops').select('id, shop_name').limit(1);
    const latency = Date.now() - startTime;
    
    if (error) {
      console.log('Status: FAILED TO CONNECT');
      console.log('Error Message:', error.message);
    } else {
      console.log('Status: CONNECTED SUCCESSFULLY');
      console.log('Response Latency:', latency + 'ms');
      console.log('Shops Found in Cloud:', data);
    }
  } catch (err) {
    console.log('Status: NETWORK/CONNECTION ERROR', err);
  }
}

checkConnection();
