import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  deleteNotification,
  seedDemoNotificationsIfEmpty,
} from '../lib/notifications';
import type { AppNotification } from '../lib/notifications';

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasLoaded: boolean;
  markAllRead: () => Promise<{ error: any }>;
  dismissNotification: (notifId: string) => Promise<{ error: any }>;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const seededRef = useRef(false);

  const loadNotifications = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      // Seed demo rows for a brand-new user exactly once per session.
      if (!seededRef.current) {
        seededRef.current = true;
        try {
          await seedDemoNotificationsIfEmpty(userId);
        } catch (e) {
          console.error('Failed to seed demo notifications:', e);
        }
      }
      const data = await fetchNotifications(userId);
      setNotifications(data);
      setHasLoaded(true);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      setHasLoaded(false);
      return;
    }
    await loadNotifications(user.id);
  }, [user, loadNotifications]);

  useEffect(() => {
    if (user) {
      loadNotifications(user.id);
    } else {
      setNotifications([]);
      setIsLoading(false);
      setHasLoaded(false);
    }
  }, [user, loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const markAllRead = useCallback(async (): Promise<{ error: any }> => {
    if (!user) {
      return { error: { message: 'You must be signed in to update notifications.' } };
    }
    try {
      await markAllNotificationsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      return { error: null };
    } catch (error) {
      console.error('Error marking all notifications read:', error);
      return { error };
    }
  }, [user]);

  const dismissNotification = useCallback(
    async (notifId: string): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to dismiss a notification.' } };
      }
      try {
        await deleteNotification(notifId);
        setNotifications((prev) => prev.filter((n) => n.id !== notifId));
        return { error: null };
      } catch (error) {
        console.error('Error dismissing notification:', error);
        return { error };
      }
    },
    [user]
  );

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        hasLoaded,
        markAllRead,
        dismissNotification,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
