-- Budgets tables + RLS policies.
-- Run this in the Supabase SQL editor.

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  monthly_income numeric(12, 2) not null check (monthly_income > 0),
  savings_target_percentage numeric(5, 2) not null check (savings_target_percentage between 0 and 100),
  total_spending_budget numeric(12, 2) not null check (total_spending_budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'Bills & Utilities',
    'Food & Dining',
    'Grocery',
    'Transport',
    'Health',
    'Shopping',
    'Entertainment',
    'Other'
  )),
  allocated_amount numeric(12, 2) not null check (allocated_amount >= 0),
  percentage_of_budget numeric(5, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, category)
);

create index if not exists budgets_user_idx on public.budgets (user_id);
create index if not exists category_budgets_budget_idx on public.category_budgets (budget_id);

alter table public.budgets enable row level security;
alter table public.category_budgets enable row level security;

drop policy if exists "Users view own budgets" on public.budgets;
create policy "Users view own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own budgets" on public.budgets;
create policy "Users insert own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own budgets" on public.budgets;
create policy "Users update own budgets"
  on public.budgets for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own budgets" on public.budgets;
create policy "Users delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);

drop policy if exists "Users view own category budgets" on public.category_budgets;
create policy "Users view own category budgets"
  on public.category_budgets for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own category budgets" on public.category_budgets;
create policy "Users insert own category budgets"
  on public.category_budgets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own category budgets" on public.category_budgets;
create policy "Users update own category budgets"
  on public.category_budgets for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own category budgets" on public.category_budgets;
create policy "Users delete own category budgets"
  on public.category_budgets for delete
  using (auth.uid() = user_id);
