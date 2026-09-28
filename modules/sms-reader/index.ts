import { requireNativeModule } from 'expo-modules-core';

export interface NativeSms {
  address: string;
  body: string;
  date: number;
}

let SmsReader: any = null;
try {
  SmsReader = requireNativeModule('SmsReader');
} catch {
  // Not linked in Expo Go or non-Android platform
}

export async function getRecentSms(limit: number = 30, filter?: string): Promise<NativeSms[]> {
  if (!SmsReader || typeof SmsReader.getRecentSms !== 'function') {
    return [];
  }
  try {
    return await SmsReader.getRecentSms(limit, filter);
  } catch (e) {
    console.warn('[SmsReader] Failed to get recent SMS from device:', e);
    return [];
  }
}
