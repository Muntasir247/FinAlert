-- Members can set or edit their own monthly contribution limit. The family
-- Admin can still set any member's limit (and role) via update_family_member_role.
-- Run this in the Supabase SQL editor.

create or replace function public.update_own_contribution(
  p_member_id uuid,
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
    where id = p_member_id and user_id = auth.uid()
  ) then
    raise exception 'NOT_OWN_MEMBER';
  end if;

  update public.family_members
  set monthly_limit = p_limit
  where id = p_member_id;
end;
$$;

revoke execute on function public.update_own_contribution(uuid, numeric) from public;
grant execute on function public.update_own_contribution(uuid, numeric) to authenticated;
