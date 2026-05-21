create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role text not null check (role in ('creator', 'checker', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.cash_ledgers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  opening_balance numeric(12,2) not null default 0,
  current_balance numeric(12,2) not null default 0,
  opening_balance_date date,
  created_at timestamptz not null default now()
);

alter table public.cash_ledgers
add column if not exists opening_balance_date date;

create table if not exists public.accounting_heads (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_at timestamptz not null default now()
);

insert into public.cash_ledgers (label, opening_balance, current_balance)
select 'Main Petty Cash', 0, 0
where not exists (
  select 1
  from public.cash_ledgers
);

insert into public.accounting_heads (label)
select 'Petty Cash'
where not exists (
  select 1
  from public.accounting_heads
  where label = 'Petty Cash'
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.cash_ledgers(id) on delete restrict,
  accounting_head text,
  description text not null,
  purchase_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  transaction_type text not null default 'debit' check (transaction_type in ('debit', 'credit')),
  bill_image_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  checker_id uuid references public.profiles(id) on delete restrict,
  checker_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses
add column if not exists transaction_type text not null default 'debit' check (transaction_type in ('debit', 'credit'));

alter table public.expenses
add column if not exists accounting_head text;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.profiles enable row level security;
alter table public.cash_ledgers enable row level security;
alter table public.accounting_heads enable row level security;
alter table public.expenses enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists "ledgers_select_authenticated" on public.cash_ledgers;
drop policy if exists "ledgers_insert_first_or_admin" on public.cash_ledgers;
drop policy if exists "accounting_heads_select_authenticated" on public.accounting_heads;
drop policy if exists "accounting_heads_insert_authenticated" on public.accounting_heads;
drop policy if exists "accounting_heads_update_authenticated" on public.accounting_heads;
drop policy if exists "ledgers_update_creator_or_admin" on public.cash_ledgers;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "push_tokens_select_self" on public.push_tokens;
drop policy if exists "push_tokens_insert_self" on public.push_tokens;
drop policy if exists "push_tokens_update_self" on public.push_tokens;
drop policy if exists "expenses_select_authenticated" on public.expenses;
drop policy if exists "creators_insert_expenses" on public.expenses;
drop policy if exists "checkers_update_expenses" on public.expenses;
drop policy if exists "creators_update_own_pending_expenses" on public.expenses;
drop policy if exists "creators_delete_own_pending_expenses" on public.expenses;
drop policy if exists "bill_images_read_authenticated" on storage.objects;
drop policy if exists "bill_images_upload_authenticated" on storage.objects;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

create or replace function public.refresh_cash_ledger_balance()
returns trigger
language plpgsql
as $$
declare
  approved_net numeric(12,2);
begin
  select coalesce(sum(case when transaction_type = 'credit' then amount else -amount end), 0)
    into approved_net
  from public.expenses
  where ledger_id = coalesce(new.ledger_id, old.ledger_id)
    and status = 'approved';

  update public.cash_ledgers
  set current_balance = opening_balance + approved_net
  where id = coalesce(new.ledger_id, old.ledger_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_cash_ledger_balance on public.expenses;
create trigger trg_refresh_cash_ledger_balance
after insert or update or delete on public.expenses
for each row
execute function public.refresh_cash_ledger_balance();

insert into storage.buckets (id, name, public)
values ('expense-bills', 'expense-bills', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'expenses'
  ) then
    alter publication supabase_realtime add table public.expenses;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cash_ledgers'
  ) then
    alter publication supabase_realtime add table public.cash_ledgers;
  end if;
end
$$;

create policy "ledgers_select_authenticated"
on public.cash_ledgers
for select
to authenticated
using (true);

create policy "ledgers_insert_first_or_admin"
on public.cash_ledgers
for insert
to authenticated
with check (
  not exists (
    select 1
    from public.cash_ledgers
  )
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "ledgers_update_creator_or_admin"
on public.cash_ledgers
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('creator', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('creator', 'admin')
  )
);

create policy "accounting_heads_select_authenticated"
on public.accounting_heads
for select
to authenticated
using (true);

create policy "accounting_heads_insert_authenticated"
on public.accounting_heads
for insert
to authenticated
with check (true);

create policy "accounting_heads_update_authenticated"
on public.accounting_heads
for update
to authenticated
using (true)
with check (true);

create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "push_tokens_select_self"
on public.push_tokens
for select
to authenticated
using (user_id = auth.uid());

create policy "push_tokens_insert_self"
on public.push_tokens
for insert
to authenticated
with check (user_id = auth.uid());

create policy "push_tokens_update_self"
on public.push_tokens
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "expenses_select_authenticated"
on public.expenses
for select
to authenticated
using (true);

create policy "creators_insert_expenses"
on public.expenses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where id = creator_id
      and role in ('creator', 'admin')
  )
);

create policy "checkers_update_expenses"
on public.expenses
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('checker', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('checker', 'admin')
  )
);

create policy "creators_update_own_pending_expenses"
on public.expenses
for update
to authenticated
using (
  creator_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('creator', 'admin')
  )
)
with check (
  creator_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('creator', 'admin')
  )
);

create policy "creators_delete_own_pending_expenses"
on public.expenses
for delete
to authenticated
using (
  creator_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('creator', 'admin')
  )
);

create policy "bill_images_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'expense-bills');

create policy "bill_images_upload_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-bills'
  and auth.uid()::text = (storage.foldername(name))[1]
);
