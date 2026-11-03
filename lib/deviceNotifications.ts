import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior for incoming notifications when the app is in foreground.
// Enables banners, sounds, and badges so notifications are clearly visible on the phone.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NOTIFICATION_CHANNEL_ID = 'finalert_default';

/**
 * Configure the Android notification channel with high importance so notifications
 * appear as heads-up banners on the phone dashboard and status bar.
 */
export async function setupDeviceNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'FinAlert Notifications',
      description: 'Alerts for budgets, spending spikes, savings milestones, and family activity',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0FB384',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      sound: 'default',
    });
  }
}

/**
 * Request notification permissions from the OS (including Android 13+ POST_NOTIFICATIONS).
 */
export async function requestDeviceNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (error) {
    console.error('[DeviceNotifications] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Check whether notification permissions are currently granted.
 */
export async function checkDeviceNotificationPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export interface PresentNotificationOptions {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  categoryIdentifier?: string;
}

/**
 * Present a local notification on the phone's actual dashboard / notification panel.
 */
export async function presentDeviceNotification(
  options: PresentNotificationOptions
): Promise<string | null> {
  try {
    const hasPermission = await checkDeviceNotificationPermissions();
    if (!hasPermission) {
      // Try to request if not yet asked
      const granted = await requestDeviceNotificationPermissions();
      if (!granted) {
        return null;
      }
    }

    const triggerInput =
      Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNEL_ID } : null;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        data: options.data ?? {},
        sound: true,
      },
      trigger: triggerInput, // deliver immediately to device panel
    });

    return identifier;
  } catch (error) {
    console.error('[DeviceNotifications] Error presenting device notification:', error);
    return null;
  }
}

/**
 * Dismiss a specific device notification from the phone's tray.
 */
export async function dismissDeviceNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (error) {
    console.error('[DeviceNotifications] Error dismissing notification:', error);
  }
}

/**
 * Dismiss all notifications from the phone's tray.
 */
export async function dismissAllDeviceNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('[DeviceNotifications] Error dismissing all notifications:', error);
  }
}

/**
 * Update app icon badge count (iOS / supported Android launchers).
 */
export async function setAppBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // Non-fatal if device launcher does not support badges
  }
}

/**
 * Register a listener for when the user taps on a notification in the phone's dashboard/panel.
 */
export function registerNotificationResponseListener(
  onResponse: (data: Record<string, any>) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data;
    if (data) {
      onResponse(data);
    }
  });

  return () => {
    subscription.remove();
  };
}
