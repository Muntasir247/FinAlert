-- Migration: Add leave_family and delete_family RPCs
-- Run this in the Supabase SQL editor.

-- 1. leave_family: Allows the authenticated user to leave their current family group.
-- If the user is the sole Admin and other members exist, they cannot leave until another Admin is appointed.
-- If the user is the only member left in the family, leaving automatically removes the family.
create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_member_id uuid;
  v_role text;
  v_admin_count int;
  v_total_count int;
begin
  select id, family_id, role
    into v_member_id, v_family_id, v_role
    from public.family_members
   where user_id = auth.uid();

  if v_member_id is null then
    raise exception 'NOT_IN_FAMILY';
  end if;

  select count(*) into v_total_count
    from public.family_members
   where family_id = v_family_id;

  select count(*) into v_admin_count
    from public.family_members
   where family_id = v_family_id and role = 'Admin';

  -- If sole member, delete the family
  if v_total_count <= 1 then
    delete from public.families where id = v_family_id;
    return;
  end if;

  -- If sole admin and other members exist, require promoting another admin first
  if v_role = 'Admin' and v_admin_count <= 1 then
    raise exception 'SOLE_ADMIN_CANNOT_LEAVE';
  end if;

  -- Delete caller's membership
  delete from public.family_members where id = v_member_id;
end;
$$;

-- 2. delete_family: Allows an Admin / Creator to completely disband and delete the family group.
-- Cascades automatically in Postgres to delete members, shared expenses, contributors, transactions.
create or replace function public.delete_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Caller must be in this family and have the Admin role
  if not exists (
    select 1 from public.family_members
     where family_id = p_family_id
       and user_id = auth.uid()
       and role = 'Admin'
  ) then
    raise exception 'NOT_ADMIN';
  end if;

  delete from public.families where id = p_family_id;
end;
$$;

revoke execute on function public.leave_family() from public;
grant execute on function public.leave_family() to authenticated;

revoke execute on function public.delete_family(uuid) from public;
grant execute on function public.delete_family(uuid) to authenticated;

