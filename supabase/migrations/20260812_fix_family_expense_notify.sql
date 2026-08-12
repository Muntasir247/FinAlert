-- Fix the family-expense notification trigger. The original function referenced
-- NEW.user_id, but the trigger fires on public.family_expenses, which has no
-- user_id column (it has created_by), so adding any shared expense raised:
--   record "new" has no field "user_id"
-- Run this in the Supabase SQL editor.

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
