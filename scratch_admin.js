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
  
  const user = authData.user;
  await client.from('profiles').upsert({
    id: user.id,
    full_name: 'Test',
    email,
    role: 'creator'
  });

  const { error: upgradeError } = await client.from('profiles').update({ role: 'admin' }).eq('id', user.id);
  console.log('Upgrade error:', upgradeError);

  if (!upgradeError) {
    const { data, error } = await client.from('cash_ledgers').insert({ label: "Main Petty Cash", opening_balance: 0, current_balance: 0 }).select('*').single();
    console.log('Inserted ledger:', data, error);
  }
}
test();
