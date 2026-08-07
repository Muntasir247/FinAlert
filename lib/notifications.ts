import { supabase } from './supabase';

export type NotificationCategory = 'budget' | 'bills' | 'savings' | 'family';
export type NotificationAccent = 'red' | 'orange' | 'green' | 'blue';
export type NotificationActionType =
  | 'review_spending'
  | 'review_budget'
  | 'view_goal'
  | 'view_family';

export interface AppNotification {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  progress: number | null;
  accent_color: NotificationAccent;
  is_read: boolean;
  action_type: NotificationActionType;
  created_at: string;
}

export interface NewNotification {
  category: NotificationCategory;
  title: string;
  message: string;
  progress: number | null;
  accent_color: NotificationAccent;
  action_type: NotificationActionType;
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AppNotification[];
}

export async function insertNotification(
  userId: string,
  notif: NewNotification
): Promise<AppNotification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      category: notif.category,
      title: notif.title,
      message: notif.message,
      progress: notif.progress,
      accent_color: notif.accent_color,
      action_type: notif.action_type,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as AppNotification;
}

export async function markNotificationRead(notifId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notifId);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .is('is_read', false);

  if (error) {
    throw error;
  }
}

export async function deleteNotification(notifId: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', notifId);

  if (error) {
    throw error;
  }
}

// Seed a small set of realistic demo notifications for a brand-new user so the
// Alerts screen is populated on first open. No-op once the user has rows.
export async function seedDemoNotificationsIfEmpty(userId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();

  const demo: Array<NewNotification & { is_read: boolean; created_at: string }> = [
    {
      category: 'budget',
      title: 'Budget almost used up',
      message: 'You have used 80% of your Grocery budget this month. Slow down to stay on track.',
      progress: 0.8,
      accent_color: 'red',
      action_type: 'review_budget',
      is_read: false,
      created_at: hoursAgo(2),
    },
    {
      category: 'bills',
      title: 'Bill payment due soon',
      message: 'Your Electricity bill of ৳1,250 is due in 2 days.',
      progress: null,
      accent_color: 'orange',
      action_type: 'review_spending',
      is_read: false,
      created_at: hoursAgo(5),
    },
    {
      category: 'savings',
      title: 'Savings goal on track',
      message: 'You are 60% of the way toward your Emergency Fund goal. Keep it up!',
      progress: 0.6,
      accent_color: 'green',
      action_type: 'view_goal',
      is_read: false,
      created_at: hoursAgo(8),
    },
    {
      category: 'family',
      title: 'Family spending updated',
      message: 'Family dining crossed its monthly budget limit of ৳6,000.',
      progress: 1,
      accent_color: 'blue',
      action_type: 'view_family',
      is_read: true,
      created_at: hoursAgo(26),
    },
    {
      category: 'budget',
      title: 'Budget overrun',
      message: 'Food & Dining is 15% over its monthly limit. Review your recent spending.',
      progress: 1.15,
      accent_color: 'red',
      action_type: 'review_budget',
      is_read: true,
      created_at: hoursAgo(50),
    },
    {
      category: 'bills',
      title: 'Payment overdue',
      message: 'Your Internet bill payment is 3 days overdue. Settle it to avoid a late fee.',
      progress: null,
      accent_color: 'orange',
      action_type: 'review_spending',
      is_read: true,
      created_at: hoursAgo(74),
    },
  ];

  const { error } = await supabase.from('notifications').insert(
    demo.map((row) => ({
      user_id: userId,
      category: row.category,
      title: row.title,
      message: row.message,
      progress: row.progress,
      accent_color: row.accent_color,
      action_type: row.action_type,
      is_read: row.is_read,
      created_at: row.created_at,
    }))
  );

  if (error) {
    throw error;
  }
}
