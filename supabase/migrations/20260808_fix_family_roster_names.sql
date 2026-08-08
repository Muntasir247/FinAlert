-- Family roster with display names, fetched through a security definer RPC so
-- names resolve even when profiles RLS would hide other members' rows from a
-- newly-joined user (this is what caused the Admin to render as "Family M...").
-- Run this in the Supabase SQL editor.

-- Roster of a family joined against profiles, returning each member's real
-- display name (falling back to the email local part when full_name is null).
-- security definer + is_family_member guard keeps the RPC safe: a caller can
-- only read rosters of families they belong to.
create or replace function public.get_family_roster(p_family_id uuid)
returns table (
  id uuid,
  family_id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  full_name text
)
language sql
security definer
set search_path = public
as $$
  select
    fm.id,
    fm.family_id,
    fm.user_id,
    fm.role,
    fm.joined_at,
    coalesce(
      p.full_name,
      nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
      null
    ) as full_name
  from public.family_members fm
  left join public.profiles p on p.id = fm.user_id
  where fm.family_id = p_family_id
    and public.is_family_member(p_family_id)
  order by fm.joined_at asc
$$;

revoke execute on function public.get_family_roster(uuid) from public;
grant execute on function public.get_family_roster(uuid) to authenticated;
