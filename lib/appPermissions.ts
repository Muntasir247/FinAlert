import { Platform, PermissionsAndroid } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Camera } from 'expo-camera';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { requestDeviceNotificationPermissions } from './deviceNotifications';
import { requestSmsPermissions } from '../services/smsReaderService';

const PERMISSIONS_ASKED_KEY_PREFIX = 'finalert_permissions_asked_v1_';

/**
 * Checks whether the initial one-time permissions prompt has already been run for this user.
 */
export async function hasRequestedAppPermissions(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const val = await SecureStore.getItemAsync(`${PERMISSIONS_ASKED_KEY_PREFIX}${userId}`);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Requests all required app permissions (SMS, Notifications, Camera, Microphone)
 * in sequence when the user reaches the Home screen.
 *
 * Guaranteed to execute only ONCE per user. Remembers that permissions were asked
 * so the user is never prompted multiple times.
 */
export async function requestAllAppPermissionsOnce(userId: string): Promise<void> {
  if (!userId) return;

  const alreadyAsked = await hasRequestedAppPermissions(userId);
  if (alreadyAsked) return;

  // Immediately persist that permissions have been requested to prevent duplicate execution
  try {
    await SecureStore.setItemAsync(`${PERMISSIONS_ASKED_KEY_PREFIX}${userId}`, 'true');
  } catch (err) {
    console.warn('[appPermissions] Failed to persist permissions asked flag:', err);
  }

  // 1. SMS Permissions (Android READ_SMS + RECEIVE_SMS for MFS and Card SMS tracking)
  try {
    if (Platform.OS === 'android') {
      await requestSmsPermissions();
    }
  } catch (err) {
    console.warn('[appPermissions] Error requesting SMS permissions:', err);
  }

  // 2. Notifications Permission (for alerts, budgets, and reminders)
  try {
    await requestDeviceNotificationPermissions();
  } catch (err) {
    console.warn('[appPermissions] Error requesting Notifications permission:', err);
  }

  // 3. Camera Permission (for scanning receipt / invoice)
  try {
    await Camera.requestCameraPermissionsAsync();
  } catch (err) {
    console.warn('[appPermissions] Error requesting Camera permission:', err);
  }

  // 4. Microphone / Audio Permission (for speech-to-text voice entries)
  try {
    if (
      ExpoSpeechRecognitionModule &&
      typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === 'function'
    ) {
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    } else if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }
  } catch (err) {
    console.warn('[appPermissions] Error requesting Audio/Microphone permission:', err);
  }
}
