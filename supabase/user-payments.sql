-- Payments made to a user against the expenses they recorded (reimbursements).
-- Kept separate from cash_ledgers: it does not change Cash In Hand.
create table if not exists public.user_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists user_payments_user_id_idx on public.user_payments (user_id);

alter table public.user_payments enable row level security;

drop policy if exists "user_payments_select_authenticated" on public.user_payments;
drop policy if exists "user_payments_insert_checker" on public.user_payments;
drop policy if exists "user_payments_delete_checker" on public.user_payments;

create policy "user_payments_select_authenticated"
on public.user_payments
for select
to authenticated
using (true);

create policy "user_payments_insert_checker"
on public.user_payments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('checker', 'admin')
  )
);

create policy "user_payments_delete_checker"
on public.user_payments
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('checker', 'admin')
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_payments'
  ) then
    alter publication supabase_realtime add table public.user_payments;
  end if;
end
$$;
