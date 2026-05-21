const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://aknyebfdrgazyqncjrro.supabase.co';
const supabaseKey = 'sb_publishable_tNNnEWGgG-uvm-LURjvA4w_X26lY_4y';
const client = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = `test.user${Math.floor(Math.random() * 100000)}@gmail.com`;
  const { data: authData, error: authError } = await client.auth.signUp({
    email,
    password: 'Password123!',
  });
  
  if (authError) {
    console.log('Auth error:', authError);
    return;
  }
  
  const user = authData.user;
  
  // Create profile
  await client.from('profiles').upsert({ id: user.id, full_name: 'Test', email, role: 'creator' });
  
  // Try to insert ledger without admin (should fail)
  const { error: err1 } = await client.from('cash_ledgers').insert({ label: "Main", opening_balance: 0, current_balance: 0 });
  console.log('Insert without admin:', err1?.code);
  
  // Upgrade to admin
  const { error: err2 } = await client.from('profiles').update({ role: 'admin' }).eq('id', user.id);
  console.log('Upgrade to admin:', err2);
  
  // Try to insert ledger as admin
  const { data: data3, error: err3 } = await client.from('cash_ledgers').insert({ label: "Main", opening_balance: 0, current_balance: 0 }).select('*');
  console.log('Insert as admin:', data3, err3);
}
test();
