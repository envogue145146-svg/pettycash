const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://aknyebfdrgazyqncjrro.supabase.co';
const supabaseKey = 'sb_publishable_tNNnEWGgG-uvm-LURjvA4w_X26lY_4y';
const client = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = `test.user${Date.now()}@gmail.com`;
  const { data: authData, error: authError } = await client.auth.signUp({
    email,
    password: 'Password123!',
  });
  
  if (authError) {
    console.log('Auth error:', authError);
    return;
  }
  
  const { data, error } = await client.from('cash_ledgers').select('*').limit(1);
  console.log('Ledgers (Auth):', data, error);
}
test();
