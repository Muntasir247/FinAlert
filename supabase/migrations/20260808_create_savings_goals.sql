-- Savings goals table + RLS policies + contribution RPC.
-- Run this in the Supabase SQL editor.

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  icon text not null check (icon in (
    'shield',
    'plane',
    'phone',
    'house',
    'graduation',
    'car',
    'ring',
    'laptop',
    'gym',
    'vacation',
    'savings'
  )),
  target_amount numeric(12, 2) not null check (target_amount > 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  color text not null default '#0FB384',
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists savings_goals_user_idx on public.savings_goals (user_id);

alter table public.savings_goals enable row level security;

drop policy if exists "Users view own savings goals" on public.savings_goals;
create policy "Users view own savings goals"
  on public.savings_goals for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own savings goals" on public.savings_goals;
create policy "Users insert own savings goals"
  on public.savings_goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own savings goals" on public.savings_goals;
create policy "Users update own savings goals"
  on public.savings_goals for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own savings goals" on public.savings_goals;
create policy "Users delete own savings goals"
  on public.savings_goals for delete
  using (auth.uid() = user_id);

-- Atomic contribution update: increments current_amount in the database and
-- enforces ownership, so the running total can never drift from client races.
create or replace function public.add_savings_contribution(
  p_goal_id uuid,
  p_amount numeric
)
returns public.savings_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal public.savings_goals;
begin
  if p_amount <= 0 then
    raise exception 'Contribution must be greater than zero';
  end if;

  update public.savings_goals
     set current_amount = current_amount + p_amount,
         updated_at = now()
   where id = p_goal_id
     and user_id = auth.uid()
  returning * into v_goal;

  if v_goal is null then
    raise exception 'Savings goal not found';
  end if;

  return v_goal;
end;
$$;

revoke execute on function public.add_savings_contribution(uuid, numeric) from public;
grant execute on function public.add_savings_contribution(uuid, numeric) to authenticated;
