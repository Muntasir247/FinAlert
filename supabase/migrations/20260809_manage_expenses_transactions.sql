-- Admin-only edit/delete of shared expenses, and members deleting their own
-- transactions. Deleting a transaction rolls back the paid_amount it added.
-- Run this in the Supabase SQL editor.

-- Admin-only: update a shared expense's category, total and member assignments.
-- Paid amounts are preserved for contributors who have already paid; the new
-- total cannot drop below what has already been paid.
create or replace function public.update_family_expense(
  p_expense_id uuid,
  p_category text,
  p_total numeric,
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_paid numeric;
  v_assignment jsonb;
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
    where family_id = v_family_id and user_id = auth.uid() and role = 'Admin'
  ) then
    raise exception 'NOT_ADMIN';
  end if;
  if p_total <= 0 then
    raise exception 'INVALID_TOTAL';
  end if;

  select coalesce(sum(paid_amount), 0) into v_paid
    from public.family_expense_contributors
   where expense_id = p_expense_id;

  if p_total < v_paid - 0.01 then
    raise exception 'TOTAL_BELOW_PAID';
  end if;

  update public.family_expenses
  set category = p_category, total = p_total
  where id = p_expense_id;

  -- Upsert assignments, preserving paid_amount for existing contributors.
  for v_assignment in select * from jsonb_array_elements(p_assignments) loop
    insert into public.family_expense_contributors (expense_id, member_id, amount, paid_amount)
    values (
      p_expense_id,
      (v_assignment ->> 'memberId')::uuid,
      (v_assignment ->> 'amount')::numeric,
      0
    )
    on conflict (expense_id, member_id) do update
      set amount = excluded.amount;
  end loop;

  -- Drop contributors that are no longer assigned and have not paid anything.
  delete from public.family_expense_contributors fc
  where fc.expense_id = p_expense_id
    and fc.paid_amount <= 0.01
    and not exists (
      select 1 from jsonb_array_elements(p_assignments) a
      where (a ->> 'memberId')::uuid = fc.member_id
    );
end;
$$;

-- Admin-only: delete a shared expense. Contributors and transaction logs
-- cascade-delete.
create or replace function public.delete_family_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
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
    where family_id = v_family_id and user_id = auth.uid() and role = 'Admin'
  ) then
    raise exception 'NOT_ADMIN';
  end if;

  delete from public.family_expenses where id = p_expense_id;
end;
$$;

-- Any member may delete their own transaction. Rolls back the paid_amount the
-- transaction added, so expense totals stay accurate.
create or replace function public.delete_family_transaction(p_tx_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_expense_id uuid;
  v_type text;
  v_amount numeric;
begin
  select member_id, expense_id, type, amount
    into v_member_id, v_expense_id, v_type, v_amount
    from public.family_transactions
   where id = p_tx_id;

  if v_member_id is null then
    raise exception 'TX_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.family_members
    where id = v_member_id and user_id = auth.uid()
  ) then
    raise exception 'NOT_OWN_TX';
  end if;

  delete from public.family_transactions where id = p_tx_id;

  if v_type in ('payment', 'extra') then
    update public.family_expense_contributors
    set paid_amount = greatest(paid_amount - v_amount, 0)
    where expense_id = v_expense_id and member_id = v_member_id;
  end if;
end;
$$;

revoke execute on function public.update_family_expense(uuid, text, numeric, jsonb) from public;
grant execute on function public.update_family_expense(uuid, text, numeric, jsonb) to authenticated;

revoke execute on function public.delete_family_expense(uuid) from public;
grant execute on function public.delete_family_expense(uuid) to authenticated;

revoke execute on function public.delete_family_transaction(uuid) from public;
grant execute on function public.delete_family_transaction(uuid) to authenticated;
