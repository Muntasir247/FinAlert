-- Family event notifications: when a member joins the group or adds a shared
-- expense, every OTHER member gets a real notification row.
-- Requires the notifications + families tables (run prior migrations first).
-- Run this in the Supabase SQL editor.

-- ── Member joined ──────────────────────────────────────────────────────────

create or replace function public.notify_family_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_name text;
  v_family_name text;
  v_target record;
begin
  select coalesce(p.full_name, nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'A family member')
    into v_member_name
    from public.profiles p
   where p.id = new.user_id;

  if v_member_name is null then
    v_member_name := 'A family member';
  end if;

  select f.name into v_family_name
    from public.families f
   where f.id = new.family_id;

  if v_family_name is null then
    v_family_name := 'the family';
  end if;

  for v_target in
    select user_id
      from public.family_members
     where family_id = new.family_id and user_id <> new.user_id
  loop
    begin
      insert into public.notifications
        (user_id, category, title, message, progress, accent_color, is_read, action_type)
      values
        (v_target.user_id, 'family', v_member_name || ' joined the family',
         v_member_name || ' joined ' || v_family_name || '.',
         null, 'blue', false, 'view_family');
    exception when others then
      null;
    end;
  end loop;

  return new;
end;
$$;

-- ── Family expense added ───────────────────────────────────────────────────

create or replace function public.notify_family_expense_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_target record;
begin
  select coalesce(p.full_name, nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'A family member')
    into v_actor_name
    from public.profiles p
   where p.id = new.created_by;

  if v_actor_name is null then
    v_actor_name := 'A family member';
  end if;

  for v_target in
    select user_id
      from public.family_members
     where family_id = new.family_id and user_id <> new.created_by
  loop
    begin
      insert into public.notifications
        (user_id, category, title, message, progress, accent_color, is_read, action_type)
      values
        (v_target.user_id, 'family', v_actor_name || ' added a family expense',
         v_actor_name || ' added a ' || new.category || ' expense of ৳' ||
         to_char(new.total, 'FM9999999990.00') || '.',
         null, 'blue', false, 'view_family');
    exception when others then
      null;
    end;
  end loop;

  return new;
end;
$$;

-- ── Triggers ───────────────────────────────────────────────────────────────

drop trigger if exists trg_family_member_joined_notify on public.family_members;
create trigger trg_family_member_joined_notify
  after insert on public.family_members
  for each row execute function public.notify_family_member_joined();

drop trigger if exists trg_family_expense_added_notify on public.family_expenses;
create trigger trg_family_expense_added_notify
  after insert on public.family_expenses
  for each row execute function public.notify_family_expense_added();
