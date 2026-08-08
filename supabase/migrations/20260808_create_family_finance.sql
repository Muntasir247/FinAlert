-- Family finance persistence: shared expenses, per-member contributions,
-- and transaction logs, plus RPCs for admin role changes and removals.
-- Run this in the Supabase SQL editor.

-- Per-member monthly contribution limit (set by the Admin via Change Role).
alter table public.family_members
  add column if not exists monthly_limit numeric(12, 2) not null default 0;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.family_expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  category text not null,
  total numeric(12, 2) not null check (total > 0),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_expense_contributors (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.family_expenses (id) on delete cascade,
  member_id uuid not null references public.family_members (id) on delete cascade,
  amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  unique (expense_id, member_id)
);

create table if not exists public.family_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  expense_id uuid not null references public.family_expenses (id) on delete cascade,
  member_id uuid not null references public.family_members (id) on delete cascade,
  type text not null check (type in ('payment', 'extra', 'unable')),
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists family_expenses_family_idx
  on public.family_expenses (family_id, created_at desc);
create index if not exists family_contributors_expense_idx
  on public.family_expense_contributors (expense_id);
create index if not exists family_transactions_family_idx
  on public.family_transactions (family_id, created_at desc);

alter table public.family_expenses enable row level security;
alter table public.family_expense_contributors enable row level security;
alter table public.family_transactions enable row level security;

-- All writes go through the security definer RPCs below, so read-only RLS is
-- enough: members may only read finance data of their own family.
drop policy if exists "Family members view own expenses" on public.family_expenses;
create policy "Family members view own expenses"
  on public.family_expenses for select
  using (public.is_family_member(family_id));

drop policy if exists "Family members view own expense contributors" on public.family_expense_contributors;
create policy "Family members view own expense contributors"
  on public.family_expense_contributors for select
  using (
    exists (
      select 1 from public.family_expenses e
      where e.id = expense_id and public.is_family_member(e.family_id)
    )
  );

drop policy if exists "Family members view own family transactions" on public.family_transactions;
create policy "Family members view own family transactions"
  on public.family_transactions for select
  using (public.is_family_member(family_id));

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- Full finance snapshot for a family: members (with limits + totals),
-- expenses (with contributors), and transactions. One round trip, joins
-- resolve display names regardless of profiles RLS.
create or replace function public.get_family_finance(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select jsonb_build_object(
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'member_id', fm.id,
        'user_id', fm.user_id,
        'name', coalesce(p.full_name, nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'Family Member'),
        'role', fm.role,
        'limit', fm.monthly_limit,
        'extra', coalesce((
          select sum(t.amount) from public.family_transactions t
          where t.member_id = fm.id and t.type = 'extra'
        ), 0),
        'unable', coalesce((
          select sum(t.amount) from public.family_transactions t
          where t.member_id = fm.id and t.type = 'unable'
        ), 0)
      ) order by fm.joined_at asc), '[]'::jsonb)
      from public.family_members fm
      left join public.profiles p on p.id = fm.user_id
      where fm.family_id = p_family_id
    ),
    'expenses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'category', e.category,
        'total', e.total,
        'contributors', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'member_id', fc.member_id,
            'amount', fc.amount,
            'paid_amount', fc.paid_amount,
            'paid', fc.paid_amount >= fc.amount - 0.01
          )), '[]'::jsonb)
          from public.family_expense_contributors fc
          where fc.expense_id = e.id
        )
      ) order by e.created_at desc), '[]'::jsonb)
      from public.family_expenses e
      where e.family_id = p_family_id
    ),
    'transactions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'type', t.type,
        'expense_id', t.expense_id,
        'expense_category', e.category,
        'member_id', t.member_id,
        'member_name', coalesce(p.full_name, nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'Member'),
        'amount', t.amount,
        'note', t.note,
        'date', to_char(t.created_at, 'YYYY-MM-DD')
      ) order by t.created_at desc), '[]'::jsonb)
      from public.family_transactions t
      join public.family_expenses e on e.id = t.expense_id
      join public.family_members fm on fm.id = t.member_id
      left join public.profiles p on p.id = fm.user_id
      where t.family_id = p_family_id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Create a shared expense with per-member assignments, atomically.
create or replace function public.add_family_expense(
  p_family_id uuid,
  p_category text,
  p_total numeric,
  p_assignments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_assignment jsonb;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.family_expenses (family_id, category, total, created_by)
  values (p_family_id, p_category, p_total, auth.uid())
  returning id into v_expense_id;

  for v_assignment in select * from jsonb_array_elements(p_assignments) loop
    insert into public.family_expense_contributors (expense_id, member_id, amount)
    values (
      v_expense_id,
      (v_assignment ->> 'memberId')::uuid,
      (v_assignment ->> 'amount')::numeric
    );
  end loop;

  return v_expense_id;
end;
$$;

-- Record a payment/extra/unable transaction and update the expense's paid
-- totals. A member can contribute to any expense in their family even if they
-- were not assigned a share (used for extra payments).
create or replace function public.record_family_transaction(
  p_expense_id uuid,
  p_member_id uuid,
  p_type text,
  p_amount numeric,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_tx_id uuid;
begin
  select family_id into v_family_id
    from public.family_expenses
   where id = p_expense_id;

  if v_family_id is null then
    raise exception 'EXPENSE_NOT_FOUND';
  end if;
  if not public.is_family_member(v_family_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if not exists (
    select 1 from public.family_members
    where id = p_member_id and family_id = v_family_id
  ) then
    raise exception 'MEMBER_NOT_IN_FAMILY';
  end if;

  insert into public.family_transactions (family_id, expense_id, member_id, type, amount, note)
  values (v_family_id, p_expense_id, p_member_id, p_type, p_amount, coalesce(p_note, ''))
  returning id into v_tx_id;

  if p_type in ('payment', 'extra') then
    insert into public.family_expense_contributors (expense_id, member_id, amount, paid_amount)
    values (p_expense_id, p_member_id, 0, 0)
    on conflict (expense_id, member_id) do nothing;

    update public.family_expense_contributors
    set paid_amount = paid_amount + p_amount
    where expense_id = p_expense_id and member_id = p_member_id;
  end if;

  return v_tx_id;
end;
$$;

-- Admin-only: change a member's role and monthly contribution limit.
create or replace function public.update_family_member_role(
  p_member_id uuid,
  p_role text,
  p_limit numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id
    from public.family_members
   where id = p_member_id;

  if v_family_id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.family_members
    where family_id = v_family_id and user_id = auth.uid() and role = 'Admin'
  ) then
    raise exception 'NOT_ADMIN';
  end if;

  if p_role not in ('Admin', 'Contributor', 'Dependent') then
    raise exception 'INVALID_ROLE';
  end if;

  update public.family_members
  set role = p_role, monthly_limit = p_limit
  where id = p_member_id;
end;
$$;

-- Admin-only: remove a member from the family. Their contributions and
-- transaction logs cascade-delete.
create or replace function public.remove_family_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id
    from public.family_members
   where id = p_member_id;

  if v_family_id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.family_members
    where family_id = v_family_id and user_id = auth.uid() and role = 'Admin'
  ) then
    raise exception 'NOT_ADMIN';
  end if;

  delete from public.family_members where id = p_member_id;
end;
$$;

revoke execute on function public.get_family_finance(uuid) from public;
grant execute on function public.get_family_finance(uuid) to authenticated;

revoke execute on function public.add_family_expense(uuid, text, numeric, jsonb) from public;
grant execute on function public.add_family_expense(uuid, text, numeric, jsonb) to authenticated;

revoke execute on function public.record_family_transaction(uuid, uuid, text, numeric, text) from public;
grant execute on function public.record_family_transaction(uuid, uuid, text, numeric, text) to authenticated;

revoke execute on function public.update_family_member_role(uuid, text, numeric) from public;
grant execute on function public.update_family_member_role(uuid, text, numeric) to authenticated;

revoke execute on function public.remove_family_member(uuid) from public;
grant execute on function public.remove_family_member(uuid) to authenticated;
