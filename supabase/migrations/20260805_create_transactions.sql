-- Transactions table + RLS policies.
-- Run this in the Supabase SQL editor.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  description text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

alter table public.transactions enable row level security;

drop policy if exists "Users view own transactions" on public.transactions;
create policy "Users view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own transactions" on public.transactions;
create policy "Users insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own transactions" on public.transactions;
create policy "Users update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own transactions" on public.transactions;
create policy "Users delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);
