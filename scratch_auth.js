const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://aknyebfdrgazyqncjrro.supabase.co';
const supabaseKey = 'sb_publishable_tNNnEWGgG-uvm-LURjvA4w_X26lY_4y';
const client = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = `test-${Date.now()}@example.com`;
  const { data: authData, error: authError } = await client.auth.signUp({
    email,
    password: 'password123',
  });
  
  if (authError) {
    console.log('Auth error:', authError);
    return;
  }
  
  const { data, error } = await client.from('cash_ledgers').select('*').limit(1);
  console.log('Ledgers (Auth):', data, error);
  
  const { data: profile, error: profError } = await client.from('profiles').upsert({
    id: authData.user.id,
    full_name: 'Test',
    email,
    role: 'creator'
  });
  console.log('Profile setup:', profError);
}
test();
