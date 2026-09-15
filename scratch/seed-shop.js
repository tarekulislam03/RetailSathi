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

async function seedDefaultShop() {
  const shopId = '00000000-0000-0000-0000-000000000001';
  console.log('Seeding default shop into Supabase with ID:', shopId);

  const { data, error } = await supabase.from('shops').upsert({
    id: shopId,
    license_key: 'RS-DEMO-LICENSE-2026',
    shop_name: 'Main Retail Store',
    owner_name: 'Store Owner',
    max_counters: 5,
    is_active: true,
  });

  if (error) {
    console.error('Failed to seed shop:', error);
  } else {
    console.log('Default shop successfully created in Supabase!');
  }
}

seedDefaultShop();
