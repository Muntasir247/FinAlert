-- Notifications table + RLS policies.
-- Run this in the Supabase SQL editor.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('budget', 'bills', 'savings', 'family')),
  title text not null,
  message text not null,
  progress numeric(5, 2) check (progress >= 0),
  accent_color text not null check (accent_color in ('red', 'orange', 'green', 'blue')),
  is_read boolean not null default false,
  action_type text not null check (action_type in (
    'review_spending',
    'review_budget',
    'view_goal',
    'view_family'
  )),
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users view own notifications" on public.notifications;
create policy "Users view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own notifications" on public.notifications;
create policy "Users insert own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);
