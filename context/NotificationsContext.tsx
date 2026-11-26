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
import { useLanguage } from './LanguageContext';
import {
  translateNotification,
  getNotificationDedupeKey,
  deduplicateNotificationList,
} from '../lib/notificationLocalization';
import {
  fetchNotifications,
  insertNotification,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  subscribeToNotifications,
  saveUserPushToken,
} from '../lib/notifications';
import type { AppNotification, NewNotification } from '../lib/notifications';
import { reconnectRealtime } from '../lib/supabase';
import {
  setupDeviceNotificationsAsync,
  presentDeviceNotification,
  dismissDeviceNotification,
  dismissAllDeviceNotifications,
  setAppBadgeCount,
  registerNotificationResponseListener,
  requestDeviceNotificationPermissions,
  checkDeviceNotificationPermissions,
  registerForPushNotificationsAsync,
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
  refreshNotifications: (silent?: boolean, presentNewAlerts?: boolean) => Promise<void>;
  notify: (
    notif: NewNotification,
    options?: { skipDuplicateCheck?: boolean; dedupeHours?: number }
  ) => Promise<{ error: any; notification?: AppNotification | null }>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isBangla } = useLanguage();
  const router = useRouter();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);

  // Keep a ref of current notifications to prevent duplicate insertions from realtime events
  const notifMapRef = useRef<Map<string, AppNotification>>(new Map());
  const notificationsRef = useRef<AppNotification[]>([]);
  // Ref of recently presented device notification keys/IDs to prevent double-firing alerts
  const presentedDeviceKeysRef = useRef<Map<string, number>>(new Map());

  const safePresentDevice = useCallback(
    async (notif: {
      id?: string;
      title: string;
      message: string;
      category?: any;
      action_type?: any;
    }) => {
      if (!notificationsEnabled) return;

      const key = getNotificationDedupeKey(notif);
      const now = Date.now();
      const lastByKey = presentedDeviceKeysRef.current.get(key);
      if (lastByKey && now - lastByKey < 60000) {
        return;
      }
      if (notif.id) {
        const lastById = presentedDeviceKeysRef.current.get(notif.id);
        if (lastById && now - lastById < 60000) {
          return;
        }
        presentedDeviceKeysRef.current.set(notif.id, now);
      }
      presentedDeviceKeysRef.current.set(key, now);

      const localized = translateNotification(notif, isBangla);
      await presentDeviceNotification({
        id: notif.id,
        title: localized.title,
        body: localized.message,
        data: {
          id: notif.id,
          action_type: notif.action_type,
          category: notif.category,
        },
      });
    },
    [notificationsEnabled, isBangla]
  );

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
            title: isBangla ? 'FinAlert বিজ্ঞপ্তি সক্রিয় হয়েছে' : 'FinAlert Notifications Enabled',
            body: isBangla
              ? 'আপনি এখন থেকে বাজেট, লেনদেন এবং সঞ্চয় লক্ষ্যের সময়োপযোগী বিজ্ঞপ্তি পাবেন।'
              : 'You will now receive timely alerts for budgets, transactions, and goals.',
            data: { action_type: 'notifications_enabled' },
          });
        }
        return true;
      } catch (error) {
        console.error('[NotificationsContext] Failed to save notification preference:', error);
        return false;
      }
    },
    [isBangla]
  );

  // ── 3. Load Notifications From Database ───────────────────────────────────
  const loadNotifications = useCallback(
    async (userId: string, silent = false, presentNewAlerts = false) => {
      if (!silent) setIsLoading(true);
      try {
        const data = await fetchNotifications(userId);
        const deduped = deduplicateNotificationList(data);

        // When returning to the foreground, present any new alerts that arrived while backgrounded
        if (presentNewAlerts) {
          const existingMap = notifMapRef.current;
          const now = Date.now();
          deduped.forEach((item) => {
            if (!item.is_read && !existingMap.has(item.id)) {
              const itemTime = new Date(item.created_at).getTime();
              // Only alert for events from the past 60 minutes
              if (now - itemTime < 60 * 60 * 1000) {
                safePresentDevice(item);
              }
            }
          });
        }

        setNotifications(deduped);
        notificationsRef.current = deduped;

        // Update lookup map
        const newMap = new Map<string, AppNotification>();
        deduped.forEach((n) => newMap.set(n.id, n));
        notifMapRef.current = newMap;

        setHasLoaded(true);
      } catch (e) {
        console.error('[NotificationsContext] Failed to load notifications:', e);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [safePresentDevice]
  );

  const refreshNotifications = useCallback(
    async (silent = false, presentNewAlerts = false) => {
      if (!user) {
        setNotifications([]);
        notificationsRef.current = [];
        notifMapRef.current.clear();
        setIsLoading(false);
        setHasLoaded(false);
        return;
      }
      await loadNotifications(user.id, silent, presentNewAlerts);
    },
    [user, loadNotifications]
  );

  // Initial load when user changes
  useEffect(() => {
    if (user) {
      loadNotifications(user.id);
    } else {
      setNotifications([]);
      notificationsRef.current = [];
      notifMapRef.current.clear();
      setIsLoading(false);
      setHasLoaded(false);
    }
  }, [user, loadNotifications]);

  // Keep notificationsRef synced whenever notifications state changes
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Register push token for remote notifications (FCM / background & lock-screen delivery)
  useEffect(() => {
    if (!user || !notificationsEnabled) return;
    registerForPushNotificationsAsync().then((token) => {
      if (token && user?.id) {
        saveUserPushToken(user.id, token);
      }
    });
  }, [user, notificationsEnabled]);

  // ── 4. Real-time Subscription to Database Notifications ───────────────────
  // Isolated listener that stays stably connected without tearing down on every state change
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(
      user.id,
      (newNotif) => {
        // Check if we already have this notification locally to avoid duplication
        if (notifMapRef.current.has(newNotif.id)) {
          return;
        }

        const dedupeKey = getNotificationDedupeKey(newNotif);
        const currentList = notificationsRef.current;
        const isDupe = currentList.some((n) => {
          if (n.id === newNotif.id) return true;
          const k = getNotificationDedupeKey(n);
          const diffMs = Math.abs(
            new Date(n.created_at).getTime() - new Date(newNotif.created_at).getTime()
          );
          return k === dedupeKey && diffMs < 12 * 60 * 60 * 1000;
        });

        if (isDupe) {
          return;
        }

        notifMapRef.current.set(newNotif.id, newNotif);
        setNotifications((prev) => {
          const updated = deduplicateNotificationList([newNotif, ...prev]);
          notificationsRef.current = updated;
          return updated;
        });

        // Present native phone notification on dashboard/panel immediately
        safePresentDevice(newNotif);
      },
      (err) => {
        console.warn('[NotificationsContext] Realtime subscription notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, safePresentDevice]);

  // ── 5. AppState Listener & Foreground Polling Fallback ────────────────────
  // When user returns to the app, reconnect socket and sync notifications instantly
  useEffect(() => {
    if (!user) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        reconnectRealtime();
        refreshNotifications(true, true);
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

      // Check in-memory list first with semantic dedupe key to avoid rapid duplicate triggers
      if (!options?.skipDuplicateCheck) {
        const windowMs = (options?.dedupeHours ?? 12) * 60 * 60 * 1000;
        const now = Date.now();
        const dedupeKey = getNotificationDedupeKey(notif);
        const recentDupe = notifications.find((n) => {
          const k = getNotificationDedupeKey(n);
          const t = new Date(n.created_at).getTime();
          return k === dedupeKey && now - t < windowMs;
        });
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
        setNotifications((prev) =>
          deduplicateNotificationList([created, ...prev.filter((n) => n.id !== created.id)])
        );

        // Display on device notification panel with current language
        await safePresentDevice(created);

        return { error: null, notification: created };
      } catch (error) {
        console.error('[NotificationsContext] Error inserting notification:', error);
        return { error };
      }
    },
    [user, notifications, safePresentDevice]
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
