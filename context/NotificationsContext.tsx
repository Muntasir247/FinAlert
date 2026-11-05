import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import {
  fetchNotifications,
  insertNotification,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  subscribeToNotifications,
} from '../lib/notifications';
import type { AppNotification, NewNotification } from '../lib/notifications';
import {
  setupDeviceNotificationsAsync,
  presentDeviceNotification,
  dismissDeviceNotification,
  dismissAllDeviceNotifications,
  setAppBadgeCount,
  registerNotificationResponseListener,
  requestDeviceNotificationPermissions,
  checkDeviceNotificationPermissions,
} from '../lib/deviceNotifications';

const PREF_NOTIFICATIONS_ENABLED = 'finalert_pref_notifications_enabled';

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasLoaded: boolean;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<boolean>;
  markAllRead: () => Promise<{ error: any }>;
  dismissNotification: (notifId: string) => Promise<{ error: any }>;
  clearAllNotifications: () => Promise<{ error: any }>;
  refreshNotifications: (silent?: boolean) => Promise<void>;
  notify: (
    notif: NewNotification,
    options?: { skipDuplicateCheck?: boolean; dedupeHours?: number }
  ) => Promise<{ error: any; notification?: AppNotification | null }>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);

  // Keep a ref of current notifications to prevent duplicate insertions from realtime events
  const notifMapRef = useRef<Map<string, AppNotification>>(new Map());

  // ── 1. Setup Device Notifications Channel & Response Listener ─────────────
  useEffect(() => {
    // Configure Android channels and initial settings
    setupDeviceNotificationsAsync().catch((err) =>
      console.warn('[NotificationsContext] Setup channel error:', err)
    );

    // Load persisted user notification preferences
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(PREF_NOTIFICATIONS_ENABLED);
        if (stored !== null) {
          setNotificationsEnabledState(stored === 'true');
        } else {
          // If no explicit preference stored yet, check current system permission
          const granted = await checkDeviceNotificationPermissions();
          setNotificationsEnabledState(granted);
        }
      } catch (err) {
        console.warn('[NotificationsContext] Failed to load notification preference:', err);
      }
    })();

    // Listen for notification taps from the phone dashboard/panel
    const unsubscribeResponse = registerNotificationResponseListener((data) => {
      try {
        if (!data) {
          router.navigate('/notifications');
          return;
        }

        switch (data.action_type) {
          case 'review_budget':
          case 'review_spending':
            router.navigate('/(tabs)/transactions');
            break;
          case 'view_family':
            router.navigate('/(tabs)/family');
            break;
          case 'view_goal':
            router.navigate('/(tabs)');
            break;
          default:
            router.navigate('/notifications');
            break;
        }
      } catch (e) {
        console.error('[NotificationsContext] Error handling notification tap:', e);
      }
    });

    return () => {
      unsubscribeResponse();
    };
  }, [router]);

  // ── 2. Toggle Device Notifications Setting ────────────────────────────────
  const setNotificationsEnabled = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      try {
        if (enabled) {
          const granted = await requestDeviceNotificationPermissions();
          if (!granted) {
            // Permission denied by OS
            setNotificationsEnabledState(false);
            await SecureStore.setItemAsync(PREF_NOTIFICATIONS_ENABLED, 'false');
            return false;
          }
        }

        setNotificationsEnabledState(enabled);
        await SecureStore.setItemAsync(PREF_NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');

        if (!enabled) {
          await dismissAllDeviceNotifications();
        } else {
          // Send a test device notification so user sees immediate feedback that alerts are active
          await presentDeviceNotification({
            title: 'FinAlert Notifications Enabled',
            body: 'You will now receive timely alerts for budgets, transactions, and goals.',
            data: { action_type: 'notifications_enabled' },
          });
        }
        return true;
      } catch (error) {
        console.error('[NotificationsContext] Failed to save notification preference:', error);
        return false;
      }
    },
    []
  );

  // ── 3. Load Notifications From Database ───────────────────────────────────
  const loadNotifications = useCallback(
    async (userId: string, silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const data = await fetchNotifications(userId);
        setNotifications(data);

        // Update lookup map
        const newMap = new Map<string, AppNotification>();
        data.forEach((n) => newMap.set(n.id, n));
        notifMapRef.current = newMap;

        setHasLoaded(true);
      } catch (e) {
        console.error('[NotificationsContext] Failed to load notifications:', e);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    []
  );

  const refreshNotifications = useCallback(
    async (silent = false) => {
      if (!user) {
        setNotifications([]);
        notifMapRef.current.clear();
        setIsLoading(false);
        setHasLoaded(false);
        return;
      }
      await loadNotifications(user.id, silent);
    },
    [user, loadNotifications]
  );

  // Initial load when user changes
  useEffect(() => {
    if (user) {
      loadNotifications(user.id);
    } else {
      setNotifications([]);
      notifMapRef.current.clear();
      setIsLoading(false);
      setHasLoaded(false);
    }
  }, [user, loadNotifications]);

  // ── 4. Real-time Subscription to Database Notifications ───────────────────
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(
      user.id,
      (newNotif) => {
        // Check if we already have this notification locally to avoid duplication
        if (notifMapRef.current.has(newNotif.id)) {
          return;
        }

        notifMapRef.current.set(newNotif.id, newNotif);
        setNotifications((prev) => {
          if (prev.some((n) => n.id === newNotif.id)) return prev;
          return [newNotif, ...prev];
        });

        // Present native phone notification on dashboard/panel
        if (notificationsEnabled) {
          presentDeviceNotification({
            id: newNotif.id,
            title: newNotif.title,
            body: newNotif.message,
            data: {
              id: newNotif.id,
              action_type: newNotif.action_type,
              category: newNotif.category,
            },
          });
        }
      },
      (err) => {
        console.warn('[NotificationsContext] Realtime subscription notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, notificationsEnabled]);

  // ── 5. AppState Listener & Foreground Polling Fallback ────────────────────
  // When user returns to the app, sync notifications silently so any background events appear
  useEffect(() => {
    if (!user) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshNotifications(true);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    // Foreground interval check (every 60s) in case realtime websocket had connection gaps
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        refreshNotifications(true);
      }
    }, 60000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [user, refreshNotifications]);

  // ── 6. Compute Unread Count & Sync App Badge ──────────────────────────────
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  useEffect(() => {
    setAppBadgeCount(unreadCount);
  }, [unreadCount]);

  // ── 7. Mark All Read ──────────────────────────────────────────────────────
  const markAllRead = useCallback(async (): Promise<{ error: any }> => {
    if (!user) {
      return { error: { message: 'You must be signed in to update notifications.' } };
    }
    try {
      await markAllNotificationsRead(user.id);
      setNotifications((prev) =>
        prev.map((n) => {
          const updated = { ...n, is_read: true };
          notifMapRef.current.set(n.id, updated);
          return updated;
        })
      );
      await setAppBadgeCount(0);
      return { error: null };
    } catch (error) {
      console.error('[NotificationsContext] Error marking all read:', error);
      return { error };
    }
  }, [user]);

  // ── 8. Dismiss Single Notification ────────────────────────────────────────
  const dismissNotification = useCallback(
    async (notifId: string): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to dismiss a notification.' } };
      }
      try {
        await deleteNotification(notifId);
        notifMapRef.current.delete(notifId);
        setNotifications((prev) => prev.filter((n) => n.id !== notifId));
        await dismissDeviceNotification(notifId);
        return { error: null };
      } catch (error) {
        console.error('[NotificationsContext] Error dismissing notification:', error);
        return { error };
      }
    },
    [user]
  );

  // ── 9. Clear All Notifications ────────────────────────────────────────────
  const clearAllNotifications = useCallback(async (): Promise<{ error: any }> => {
    if (!user) {
      return { error: { message: 'You must be signed in to clear notifications.' } };
    }
    try {
      await deleteAllNotifications(user.id);
      notifMapRef.current.clear();
      setNotifications([]);
      await dismissAllDeviceNotifications();
      await setAppBadgeCount(0);
      return { error: null };
    } catch (error) {
      console.error('[NotificationsContext] Error clearing all notifications:', error);
      return { error };
    }
  }, [user]);

  // ── 10. Notify (Emit and post notification) ───────────────────────────────
  // Creates a notification, deduplicates to prevent spam, saves to database,
  // updates in-memory alerts list, and shows on device notification panel.
  const notify = useCallback(
    async (
      notif: NewNotification,
      options?: { skipDuplicateCheck?: boolean; dedupeHours?: number }
    ): Promise<{ error: any; notification?: AppNotification | null }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to be notified.' } };
      }

      // Check in-memory list first to avoid rapid duplicate triggers
      if (!options?.skipDuplicateCheck) {
        const windowMs = (options?.dedupeHours ?? 12) * 60 * 60 * 1000;
        const now = Date.now();
        const recentDupe = notifications.find(
          (n) =>
            n.category === notif.category &&
            n.title === notif.title &&
            now - new Date(n.created_at).getTime() < windowMs
        );
        if (recentDupe) {
          // Already notified recently, skip duplicate
          return { error: null, notification: recentDupe };
        }
      }

      try {
        const created = await insertNotification(user.id, notif, options);
        if (!created) {
          // Deduplication suppressed insertion
          return { error: null, notification: null };
        }

        notifMapRef.current.set(created.id, created);
        setNotifications((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);

        // Display on device notification panel
        if (notificationsEnabled) {
          await presentDeviceNotification({
            id: created.id,
            title: created.title,
            body: created.message,
            data: {
              id: created.id,
              action_type: created.action_type,
              category: created.category,
            },
          });
        }

        return { error: null, notification: created };
      } catch (error) {
        console.error('[NotificationsContext] Error inserting notification:', error);
        return { error };
      }
    },
    [user, notifications, notificationsEnabled]
  );

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        hasLoaded,
        notificationsEnabled,
        setNotificationsEnabled,
        markAllRead,
        dismissNotification,
        clearAllNotifications,
        refreshNotifications,
        notify,
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
