const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://aknyebfdrgazyqncjrro.supabase.co';
const supabaseKey = 'sb_publishable_tNNnEWGgG-uvm-LURjvA4w_X26lY_4y';
const client = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await client.from('cash_ledgers').select('*').limit(1);
  console.log('Ledgers:', data, error);
}
test();
