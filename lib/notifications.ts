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
