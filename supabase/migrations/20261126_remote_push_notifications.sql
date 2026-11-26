-- Migration: Remote Push Notifications via pg_net and Expo/Firebase Cloud Messaging (FCM)
-- This ensures notifications wake up locked phones and display immediately even when the user
-- is in another app (like Messenger, YouTube, etc.) or when the app is completely closed.
-- Run this in the Supabase SQL Editor.

-- ── 1. Enable pg_net extension for async HTTP requests ──────────────────────

create extension if not exists pg_net;

-- ── 2. Add push_token column to profiles ────────────────────────────────────

alter table if exists public.profiles
  add column if not exists push_token text;

-- Allow users to update their own push_token in profiles
drop policy if exists "Users update own push token" on public.profiles;
create policy "Users update own push token"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── 3. Trigger: Send Push Notification via Expo/FCM ──────────────────────────

create or replace function public.send_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_push_token text;
  v_payload jsonb;
begin
  -- Resolve the recipient user's push token
  select push_token into v_push_token
    from public.profiles
   where id = new.user_id;

  if v_push_token is not null and btrim(v_push_token) <> '' then
    -- Format push request for Expo/FCM gateway
    v_payload := jsonb_build_object(
      'to', v_push_token,
      'sound', 'default',
      'title', new.title,
      'body', new.message,
      'channelId', 'finalert_default',
      'priority', 'high',
      '_displayInForeground', true,
      'data', jsonb_build_object(
        'id', new.id,
        'action_type', new.action_type,
        'category', new.category
      )
    );

    -- Asynchronously POST to Expo Push API (which relays to Firebase Cloud Messaging)
    -- This call is non-blocking and executes in the background via pg_net
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json',
        'Accept-Encoding', 'gzip, deflate'
      ),
      body := v_payload
    );
  end if;

  return new;
exception when others then
  -- Fail-safe so push attempts never abort or rollback database transactions
  return new;
end;
$$;

drop trigger if exists trg_send_push_notification on public.notifications;
create trigger trg_send_push_notification
  after insert on public.notifications
  for each row execute function public.send_push_notification();
