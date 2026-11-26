-- Migration: Comprehensive Realtime Replication and Event Notifications for Family
-- Ensures instant cross-device notifications and data sync for all family events:
-- 1. Payments / Transactions added (payment, extra, unable)
-- 2. Member role and monthly limit updates
-- 3. Member removed or left family
-- 4. Expense updated or deleted
-- 5. Family deleted
-- 6. Adds tables to supabase_realtime publication with REPLICA IDENTITY FULL
-- Run this in the Supabase SQL editor.

-- ── 1. Enable Full Replica Identity for Real-time Replication ────────────────

alter table if exists public.notifications replica identity full;
alter table if exists public.families replica identity full;
alter table if exists public.family_members replica identity full;
alter table if exists public.family_expenses replica identity full;
alter table if exists public.family_expense_contributors replica identity full;
alter table if exists public.family_transactions replica identity full;

-- ── 2. Add Family & Notification Tables to supabase_realtime Publication ──────

do $$
declare
  t text;
  tables text[] := array[
    'notifications',
    'families',
    'family_members',
    'family_expenses',
    'family_expense_contributors',
    'family_transactions'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ── 3. Notification Trigger: Family Transaction / Payment Added ───────────────

create or replace function public.notify_family_transaction_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_actor_user_id uuid;
  v_expense_category text;
  v_title text;
  v_message text;
  v_accent text := 'green';
  v_target record;
begin
  -- Resolve actor user ID and display name from membership
  select fm.user_id,
         coalesce(p.full_name, nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'A family member')
    into v_actor_user_id, v_actor_name
    from public.family_members fm
    left join public.profiles p on p.id = fm.user_id
   where fm.id = new.member_id;

  if v_actor_name is null then
    v_actor_name := 'A family member';
  end if;

  -- Resolve expense category
  select category into v_expense_category
    from public.family_expenses
   where id = new.expense_id;

  v_expense_category := coalesce(v_expense_category, 'expense');

  -- Build title & message by transaction type
  if new.type = 'payment' then
    v_title := v_actor_name || ' recorded a family payment';
    v_message := v_actor_name || ' paid ৳' || to_char(new.amount, 'FM9999999990.00') || ' for ' || v_expense_category || '.';
    v_accent := 'green';
  elsif new.type = 'extra' then
    v_title := v_actor_name || ' added extra payment';
    v_message := v_actor_name || ' added ৳' || to_char(new.amount, 'FM9999999990.00') || ' extra for ' || v_expense_category || '.';
    v_accent := 'blue';
  elsif new.type = 'unable' then
    v_title := v_actor_name || ' reported unable to pay';
    v_message := v_actor_name || ' is unable to pay ৳' || to_char(new.amount, 'FM9999999990.00') || ' for ' || v_expense_category || '.';
    v_accent := 'orange';
  else
    v_title := v_actor_name || ' recorded a transaction';
    v_message := v_actor_name || ' recorded ৳' || to_char(new.amount, 'FM9999999990.00') || ' for ' || v_expense_category || '.';
    v_accent := 'blue';
  end if;

  if new.note is not null and btrim(new.note) <> '' then
    v_message := v_message || ' (' || btrim(new.note) || ')';
  end if;

  -- Notify all OTHER members of this family
  for v_target in
    select user_id
      from public.family_members
     where family_id = new.family_id
       and user_id <> coalesce(v_actor_user_id, auth.uid())
  loop
    begin
      insert into public.notifications
        (user_id, category, title, message, progress, accent_color, is_read, action_type)
      values
        (v_target.user_id, 'family', v_title, v_message, null, v_accent, false, 'view_family');
    exception when others then
      null;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_family_transaction_added_notify on public.family_transactions;
create trigger trg_family_transaction_added_notify
  after insert on public.family_transactions
  for each row execute function public.notify_family_transaction_added();

-- ── 4. Notification Trigger: Family Member Role / Limit Updated ───────────────

create or replace function public.notify_family_member_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_name text;
  v_family_name text;
  v_actor_name text;
  v_target record;
begin
  -- Only fire if role or monthly_limit actually changed
  if (old.role is not distinct from new.role) and
     (old.monthly_limit is not distinct from new.monthly_limit) then
    return new;
  end if;

  select coalesce(p.full_name, nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'Family member')
    into v_member_name
    from public.profiles p
   where p.id = new.user_id;

  v_member_name := coalesce(v_member_name, 'Family member');

  select name into v_family_name
    from public.families
   where id = new.family_id;

  v_family_name := coalesce(v_family_name, 'the family');

  -- Role changed
  if old.role is distinct from new.role then
    -- Notify the member directly if changed by admin
    if auth.uid() is null or auth.uid() <> new.user_id then
      begin
        insert into public.notifications
          (user_id, category, title, message, progress, accent_color, is_read, action_type)
        values
          (new.user_id, 'family', 'Family role updated',
           'Your role in ' || v_family_name || ' was changed to ' || new.role || '.',
           null, 'blue', false, 'view_family');
      exception when others then null;
      end;
    end if;

    -- Notify other members
    for v_target in
      select user_id from public.family_members
       where family_id = new.family_id
         and user_id <> new.user_id
         and user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    loop
      begin
        insert into public.notifications
          (user_id, category, title, message, progress, accent_color, is_read, action_type)
        values
          (v_target.user_id, 'family', v_member_name || '''s role updated',
           v_member_name || '''s role in ' || v_family_name || ' was updated to ' || new.role || '.',
           null, 'blue', false, 'view_family');
      exception when others then null;
      end;
    end loop;
  end if;

  -- Monthly limit changed
  if old.monthly_limit is distinct from new.monthly_limit then
    if auth.uid() is null or auth.uid() <> new.user_id then
      -- Admin changed member's limit: notify member
      begin
        insert into public.notifications
          (user_id, category, title, message, progress, accent_color, is_read, action_type)
        values
          (new.user_id, 'family', 'Monthly budget limit updated',
           'Your monthly budget limit in ' || v_family_name || ' was set to ৳' || to_char(new.monthly_limit, 'FM9999999990.00') || '.',
           null, 'blue', false, 'view_family');
      exception when others then null;
      end;
    else
      -- Member updated their own limit: notify other members
      for v_target in
        select user_id from public.family_members
         where family_id = new.family_id and user_id <> new.user_id
      loop
        begin
          insert into public.notifications
            (user_id, category, title, message, progress, accent_color, is_read, action_type)
          values
            (v_target.user_id, 'family', v_member_name || ' updated budget contribution',
             v_member_name || ' updated their monthly limit to ৳' || to_char(new.monthly_limit, 'FM9999999990.00') || '.',
             null, 'blue', false, 'view_family');
        exception when others then null;
        end;
      end loop;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_family_member_updated_notify on public.family_members;
create trigger trg_family_member_updated_notify
  after update on public.family_members
  for each row execute function public.notify_family_member_updated();

-- ── 5. Notification Trigger: Member Left or Removed ───────────────────────────

create or replace function public.notify_family_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_name text;
  v_family_name text;
  v_target record;
  v_is_self boolean;
begin
  select coalesce(p.full_name, nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'A family member')
    into v_member_name
    from public.profiles p
   where p.id = old.user_id;

  v_member_name := coalesce(v_member_name, 'A family member');

  select name into v_family_name
    from public.families
   where id = old.family_id;

  v_family_name := coalesce(v_family_name, 'the family');
  v_is_self := (auth.uid() = old.user_id);

  if not v_is_self and auth.uid() is not null then
    -- Removed by Admin: notify the removed member
    begin
      insert into public.notifications
        (user_id, category, title, message, progress, accent_color, is_read, action_type)
      values
        (old.user_id, 'family', 'Removed from family group',
         'You were removed from ' || v_family_name || '.',
         null, 'orange', false, 'view_family');
    exception when others then null;
    end;
  end if;

  -- Notify remaining family members
  for v_target in
    select user_id from public.family_members
     where family_id = old.family_id and user_id <> old.user_id
  loop
    begin
      insert into public.notifications
        (user_id, category, title, message, progress, accent_color, is_read, action_type)
      values
        (v_target.user_id, 'family',
         case when v_is_self then v_member_name || ' left the family' else v_member_name || ' removed from family' end,
         case when v_is_self then v_member_name || ' has left ' || v_family_name || '.' else v_member_name || ' was removed from ' || v_family_name || '.' end,
         null, 'blue', false, 'view_family');
    exception when others then null;
    end;
  end loop;

  return old;
end;
$$;

drop trigger if exists trg_family_member_removed_notify on public.family_members;
create trigger trg_family_member_removed_notify
  after delete on public.family_members
  for each row execute function public.notify_family_member_removed();

-- ── 6. Notification Trigger: Expense Updated or Deleted ───────────────────────

create or replace function public.notify_family_expense_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_target record;
begin
  if (old.category is not distinct from new.category) and (old.total is not distinct from new.total) then
    return new;
  end if;

  select coalesce(p.full_name, nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'A family member')
    into v_actor_name
    from public.profiles p
   where p.id = coalesce(auth.uid(), new.created_by);

  v_actor_name := coalesce(v_actor_name, 'A family member');

  for v_target in
    select user_id from public.family_members
     where family_id = new.family_id
       and user_id <> coalesce(auth.uid(), new.created_by)
  loop
    begin
      insert into public.notifications
        (user_id, category, title, message, progress, accent_color, is_read, action_type)
      values
        (v_target.user_id, 'family', v_actor_name || ' updated a family expense',
         v_actor_name || ' updated the ' || new.category || ' expense to ৳' || to_char(new.total, 'FM9999999990.00') || '.',
         null, 'blue', false, 'view_family');
    exception when others then null;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_family_expense_updated_notify on public.family_expenses;
create trigger trg_family_expense_updated_notify
  after update on public.family_expenses
  for each row execute function public.notify_family_expense_updated();

create or replace function public.notify_family_expense_deleted()
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
   where p.id = coalesce(auth.uid(), old.created_by);

  v_actor_name := coalesce(v_actor_name, 'A family member');

  for v_target in
    select user_id from public.family_members
     where family_id = old.family_id
       and user_id <> coalesce(auth.uid(), old.created_by)
  loop
    begin
      insert into public.notifications
        (user_id, category, title, message, progress, accent_color, is_read, action_type)
      values
        (v_target.user_id, 'family', v_actor_name || ' deleted a family expense',
         v_actor_name || ' removed the ' || old.category || ' expense of ৳' || to_char(old.total, 'FM9999999990.00') || '.',
         null, 'blue', false, 'view_family');
    exception when others then null;
    end;
  end loop;

  return old;
end;
$$;

drop trigger if exists trg_family_expense_deleted_notify on public.family_expenses;
create trigger trg_family_expense_deleted_notify
  after delete on public.family_expenses
  for each row execute function public.notify_family_expense_deleted();

-- ── 7. Update delete_family RPC to notify members before disbanding ───────────

create or replace function public.delete_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_name text;
  v_target record;
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

  select name into v_family_name from public.families where id = p_family_id;

  -- Notify all other members before the family is deleted and records cascade
  for v_target in
    select user_id from public.family_members
     where family_id = p_family_id and user_id <> auth.uid()
  loop
    begin
      insert into public.notifications
        (user_id, category, title, message, progress, accent_color, is_read, action_type)
      values
        (v_target.user_id, 'family', 'Family group deleted',
         coalesce(v_family_name, 'The family') || ' was deleted by the admin.',
         null, 'blue', false, 'view_family');
    exception when others then null;
    end;
  end loop;

  delete from public.families where id = p_family_id;
end;
$$;
