-- Family groups + membership tables, RLS policies, and RPCs.
-- Run this in the Supabase SQL editor.

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  invite_code text not null unique check (invite_code ~ '^FAMS-[0-9]{4}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'Contributor' check (role in ('Admin', 'Contributor', 'Dependent')),
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create index if not exists families_created_by_idx on public.families (created_by);
create index if not exists family_members_family_idx on public.family_members (family_id);
create index if not exists family_members_user_idx on public.family_members (user_id);

alter table public.families enable row level security;
alter table public.family_members enable row level security;

-- Membership check helper (security definer so it bypasses RLS and cannot
-- recurse when referenced from an RLS policy on the same tables).
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = auth.uid()
  );
$$;

-- Families: members of the family may read it. Rows are only ever created via
-- the create_family RPC (security definer), so no direct insert policy exists.
drop policy if exists "Family members view own family" on public.families;
create policy "Family members view own family"
  on public.families for select
  using (public.is_family_member(id));

-- Family members: a member may read their own membership row and the full
-- roster of any family they belong to.
drop policy if exists "Family members view own family's members" on public.family_members;
create policy "Family members view own family's members"
  on public.family_members for select
  using (
    user_id = auth.uid()
    or public.is_family_member(family_id)
  );

-- Create a family and make the caller its Admin. Generates a unique
-- FAMS-XXXX invite code. Rejects callers who already belong to a family.
create or replace function public.create_family(p_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_code text;
  v_code_taken boolean;
  v_family public.families;
begin
  if btrim(p_name) is null or length(btrim(p_name)) = 0 then
    raise exception 'Family name is required';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'ALREADY_IN_FAMILY';
  end if;

  loop
    v_code := 'FAMS-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    select exists (
      select 1 from public.families where invite_code = v_code
    ) into v_code_taken;
    exit when not v_code_taken;
  end loop;

  insert into public.families (name, invite_code, created_by)
  values (btrim(p_name), v_code, auth.uid())
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'Admin');

  select * into v_family from public.families where id = v_family_id;
  return v_family;
end;
$$;

-- Join an existing family via its invite code. Rejects unknown codes and
-- callers who already belong to a family.
create or replace function public.join_family(p_invite_code text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families;
begin
  select * into v_family
    from public.families
   where invite_code = upper(btrim(p_invite_code))
   limit 1;

  if v_family is null then
    raise exception 'INVALID_CODE';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'ALREADY_IN_FAMILY';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_family.id, auth.uid(), 'Contributor');

  return v_family;
end;
$$;

revoke execute on function public.is_family_member(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;

revoke execute on function public.create_family(text) from public;
grant execute on function public.create_family(text) to authenticated;

revoke execute on function public.join_family(text) from public;
grant execute on function public.join_family(text) to authenticated;
