-- Prevent overpaying a family expense: the total paid amount for an expense
-- (payments + extras) can never exceed the expense's total. "unable" entries
-- don't add to paid_amount so they are unaffected.
-- Run this in the Supabase SQL editor.

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
  v_total numeric;
  v_paid numeric;
begin
  select family_id, total into v_family_id, v_total
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

  if p_type in ('payment', 'extra') then
    select coalesce(sum(fc.paid_amount), 0) into v_paid
      from public.family_expense_contributors fc
     where fc.expense_id = p_expense_id;

    if v_paid + p_amount > v_total + 0.01 then
      raise exception 'OVERPAY_EXCEEDS_EXPENSE';
    end if;
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

revoke execute on function public.record_family_transaction(uuid, uuid, text, numeric, text) from public;
grant execute on function public.record_family_transaction(uuid, uuid, text, numeric, text) to authenticated;
