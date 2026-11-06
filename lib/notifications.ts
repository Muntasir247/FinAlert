import { supabase } from './supabase';
import { getNotificationDedupeKey } from './notificationLocalization';

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

/**
 * Check whether an identical notification has already been created for this user recently.
 * Prevents unnecessary duplicate notifications from flooding the user's alerts and phone panel.
 */
export async function isDuplicateRecentNotification(
  userId: string,
  category: NotificationCategory,
  title: string,
  message?: string,
  withinHours = 12
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('notifications')
    .select('id, category, title, message, created_at')
    .eq('user_id', userId)
    .eq('category', category)
    .gte('created_at', cutoff);

  if (error || !data || data.length === 0) {
    return false;
  }

  const targetKey = getNotificationDedupeKey({ category, title, message: message || '' });
  return data.some((item) => {
    if (item.title === title) return true;
    const itemKey = getNotificationDedupeKey(item);
    return itemKey === targetKey;
  });
}

export async function insertNotification(
  userId: string,
  notif: NewNotification,
  options?: { skipDuplicateCheck?: boolean; dedupeHours?: number }
): Promise<AppNotification | null> {
  if (!options?.skipDuplicateCheck) {
    const isDupe = await isDuplicateRecentNotification(
      userId,
      notif.category,
      notif.title,
      notif.message,
      options?.dedupeHours ?? 12
    );
    if (isDupe) {
      // Already sent recently, ignore to prevent spam
      return null;
    }
  }

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

export async function deleteAllNotifications(userId: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('user_id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Real-time subscription helper isolated behind the lib layer (per backend portability rules).
 * Listens for new rows inserted into public.notifications for this user.
 */
export function subscribeToNotifications(
  userId: string,
  onInsert: (notif: AppNotification) => void,
  onError?: (err: any) => void
): () => void {
  const channelName = `realtime:notifications:${userId}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload?.new && typeof payload.new === 'object') {
          onInsert(payload.new as AppNotification);
        }
      }
    )
    .subscribe((status, err) => {
      if (err) {
        console.warn(`[Realtime notifications] channel ${channelName} error:`, err);
        onError?.(err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
