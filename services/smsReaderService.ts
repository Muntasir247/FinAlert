import { Platform, PermissionsAndroid } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TransactionType } from '../lib/transactions';

export type MfsProvider = 'bkash' | 'nagad' | 'rocket' | 'upay' | 'cards';
export const ALL_MFS_PROVIDERS: MfsProvider[] = ['bkash', 'nagad', 'rocket', 'upay', 'cards'];

export interface MfsTransaction {
  trxId: string;
  amount: number;
  type: TransactionType;
  counterparty: string;
  reference?: string;
  fee?: number;
  balance?: number;
  date: string; // YYYY-MM-DD
  rawTimestamp?: string;
  category: string;
  rawSms: string;
  sender: string;
  provider: MfsProvider;
}

export type BKashTransaction = MfsTransaction;

export const MFS_PROVIDER_CONFIG: Record<
  MfsProvider,
  {
    id: MfsProvider;
    name: string;
    nameBn: string;
    brandColor: string;
    badgeBgDark: string;
    badgeBgLight: string;
    senders: string[];
    shortcodes: string[];
  }
> = {
  bkash: {
    id: 'bkash',
    name: 'bKash',
    nameBn: 'বিকাশ',
    brandColor: '#D12053',
    badgeBgDark: '#361523',
    badgeBgLight: '#FCE7F3',
    senders: ['bKash', '16247'],
    shortcodes: ['16247'],
  },
  nagad: {
    id: 'nagad',
    name: 'Nagad',
    nameBn: 'নগদ',
    brandColor: '#EA580C',
    badgeBgDark: '#3D1D0D',
    badgeBgLight: '#FFEDD5',
    senders: ['Nagad', '16167'],
    shortcodes: ['16167'],
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket',
    nameBn: 'রকেট',
    brandColor: '#7C3AED',
    badgeBgDark: '#2E1A47',
    badgeBgLight: '#F3E8FF',
    senders: ['Rocket', '16216', 'DBBL'],
    shortcodes: ['16216'],
  },
  upay: {
    id: 'upay',
    name: 'Upay',
    nameBn: 'উপায়',
    brandColor: '#0284C7',
    badgeBgDark: '#0E2A38',
    badgeBgLight: '#E0F2FE',
    senders: ['upay', '16268', 'UCB'],
    shortcodes: ['16268'],
  },
  cards: {
    id: 'cards',
    name: 'Bank Cards',
    nameBn: 'ব্যাংক কার্ড (ডেবিট/ক্রেডিট)',
    brandColor: '#2563EB',
    badgeBgDark: '#1E293B',
    badgeBgLight: '#EFF6FF',
    senders: [
      'CityBank', '16234', 'Citygem', 'CityTouch',
      'EBL', '16230', 'EasternBank', 'EBLConnect',
      'BRACBank', 'BRAC Bank', '16221', 'Astha',
      'DBBL', 'NexusPay', '16216', 'Nexus',
      'SCB', 'SCBBD', '16233', 'StanChart',
      'MTB', '16245', '16268', 'MutualTrust',
      'PrimeBank', '16218', 'Altitude',
      'UCB', '16419',
      'BankAsia', '16205',
      'DhakaBank', '16559',
      'SEBL', '16206', 'SoutheastBank',
      'PremierBank', '16411',
      'JamunaBank', '16742',
      'OneBank', '16269',
      'TrustBank', '16201', 'TAP',
      'NCCBank', '16315',
      'MidlandBank', '16285',
      'MBL', '16225', 'MercantileBank',
      'PubaliBank', '16228',
      'UttaraBank',
      'ABBank', '16207',
      'IFIC', '16255',
      'MeghnaBank', '16735',
      'Modhumoti', '16353',
      'NRBBank', '16240',
      'NRBCBank', '16120',
      'SBACBank', '16720',
      'ShimantoBank', '16856',
      'PadmaBank', '16612',
      'BCBL', '16766',
      'CitizensBank', '16773',
      'CommunityBank', '16707',
      'IBBL', '16259', 'IslamiBank', 'Cellfin',
      'AIBL', '16434',
      'SIBL', '16491',
      'FSIBL', '16257',
      'EXIMBank', '16246',
      'SJIBL', '16247',
      'UnionBank', '16736',
      'GIB', '16713',
      'StandardBank', '16474',
      'SonaliBank', '16639',
      'JanataBank', '16111',
      'AgraniBank', '16236',
      'RupaliBank', '16495',
      'BASICBank',
      'BKB',
      'RAKUB',
      'HSBC', 'HSBCBD',
      'CBC', '16322',
      'SBIBD', '16214',
      'WooriBank',
      'BankAlfalah', '16277',
    ],
    shortcodes: [
      '16234', '16230', '16221', '16216', '16233', '16245', '16268',
      '16218', '16419', '16205', '16559', '16206', '16411', '16742',
      '16269', '16201', '16315', '16285', '16225', '16228', '16207',
      '16255', '16735', '16353', '16240', '16120', '16720', '16856',
      '16612', '16766', '16773', '16707', '16259', '16434', '16491',
      '16257', '16246', '16247', '16736', '16713', '16474', '16639',
      '16111', '16236', '16495', '16322', '16214', '16277',
    ],
  },
};

const STORAGE_KEY_PROCESSED_TRX = 'finalert_bkash_processed_trx';
const STORAGE_KEY_TRACKED_PROVIDERS = 'finalert_tracked_mfs_providers';
const STORAGE_KEY_PROVIDERS_CONFIGURED = 'finalert_mfs_providers_configured';

// In-memory cache for fast deduplication lookups
const inMemoryProcessedTrxIds = new Set<string>();
let isCacheLoaded = false;

// In-memory cache for user-selected providers
let cachedTrackedProviders: Set<MfsProvider> = new Set(ALL_MFS_PROVIDERS);
let isProvidersCacheLoaded = false;

/**
 * Loads tracked MFS providers from SecureStore into memory.
 */
export async function loadTrackedProviders(): Promise<MfsProvider[]> {
  if (isProvidersCacheLoaded) {
    return Array.from(cachedTrackedProviders);
  }
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY_TRACKED_PROVIDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedTrackedProviders = new Set(
          parsed.filter((p): p is MfsProvider => ALL_MFS_PROVIDERS.includes(p))
        );
      }
    } else {
      cachedTrackedProviders = new Set(ALL_MFS_PROVIDERS);
    }
  } catch (e) {
    console.warn('[smsReaderService] Error loading tracked providers:', e);
    cachedTrackedProviders = new Set(ALL_MFS_PROVIDERS);
  } finally {
    isProvidersCacheLoaded = true;
  }
  return Array.from(cachedTrackedProviders);
}

/**
 * Checks if the user has explicitly configured provider tracking settings.
 */
export async function isTrackedProvidersConfigured(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY_PROVIDERS_CONFIGURED);
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * Saves tracked providers to SecureStore and marks setting as configured.
 */
export async function setTrackedProviders(providers: MfsProvider[]): Promise<void> {
  cachedTrackedProviders = new Set(providers);
  isProvidersCacheLoaded = true;

  // Immediately drop any pending transactions from providers the user just unchecked
  const beforeCount = pendingTransactions.length;
  pendingTransactions = pendingTransactions.filter((t) => cachedTrackedProviders.has(t.provider));
  if (pendingTransactions.length !== beforeCount) {
    batchListeners.forEach((cb) => {
      try {
        cb([...pendingTransactions]);
      } catch (e) {
        console.error('[smsReaderService] Error notifying batch listeners:', e);
      }
    });
  }

  try {
    await SecureStore.setItemAsync(STORAGE_KEY_TRACKED_PROVIDERS, JSON.stringify(providers));
    await SecureStore.setItemAsync(STORAGE_KEY_PROVIDERS_CONFIGURED, 'true');
  } catch (e) {
    console.warn('[smsReaderService] Failed to persist tracked providers:', e);
  }
}

/**
 * Fast synchronous check whether a provider is enabled.
 */
export function isProviderTracked(provider: MfsProvider): boolean {
  return cachedTrackedProviders.has(provider);
}

/**
 * Returns currently cached tracked providers.
 */
export function getCachedTrackedProviders(): MfsProvider[] {
  return Array.from(cachedTrackedProviders);
}

/**
 * Detects MFS provider from SMS sender string and message body.
 * Returns null if the SMS does not belong to bKash, Nagad, Rocket, or Upay,
 * preventing false positives from bank/promo/OTP messages.
 */
export function detectProvider(sender?: string, body?: string): MfsProvider | null {
  const s = (sender || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = (body || '').toLowerCase();

  // 1. Check card-specific markers first (handles bank senders and card keywords)
  const isCardPattern =
    /\b(?:card\s*(?:ending|no|number|#)?\s*(?:with|in)?\s*[:.]?\s*(?:\*{1,4}|x{1,4})?\d{4}|credit\s*card|debit\s*card|prepaid\s*card|visa(?:\s*card)?|mastercard|amex|nexus\s*pay|nexus\s*card)\b/i.test(b) ||
    /\b(?:debited\s+for|debited\s+by|debited\s+with|debited|used\s+for|spent\s+at|purchase\s+of|purchase\s+at|authorized\s+for|swiped\s+for|transaction\s+on\s+card|trx\s+of\s+bdt|pos\s+purchase|e-com(?:merce)?\s+purchase|atm\s+withdrawal)\b/i.test(b);

  const isBankSender =
    s.includes('citybank') || s.includes('16234') ||
    s.includes('ebl') || s.includes('16230') || s.includes('easternbank') ||
    s.includes('brac') || s.includes('16221') || s.includes('astha') ||
    s.includes('dbbl') || s.includes('16216') || s.includes('nexus') ||
    s.includes('scb') || s.includes('16233') || s.includes('stanchart') ||
    s.includes('mtb') || s.includes('16245') || s.includes('16268') || s.includes('mutualtrust') ||
    s.includes('primebank') || s.includes('16218') || s.includes('altitude') ||
    s.includes('dhakabank') || s.includes('16559') ||
    s.includes('bankasia') || s.includes('16205') ||
    s.includes('trustbank') || s.includes('16201') ||
    s.includes('ibbl') || s.includes('16259') || s.includes('cellfin') ||
    s.includes('nccbank') || s.includes('16315') ||
    s.includes('sebl') || s.includes('16206') || s.includes('southeastbank') ||
    s.includes('premierbank') || s.includes('16411') ||
    s.includes('jamunabank') || s.includes('16742') ||
    s.includes('onebank') || s.includes('16269') ||
    s.includes('midlandbank') || s.includes('16285') ||
    s.includes('mercantilebank') || s.includes('16225') || s.includes('mbl') ||
    s.includes('pubalibank') || s.includes('16228') ||
    s.includes('uttarabank') ||
    s.includes('abbank') || s.includes('16207') ||
    s.includes('ific') || s.includes('16255') ||
    s.includes('meghnabank') || s.includes('16735') ||
    s.includes('modhumoti') || s.includes('16353') ||
    s.includes('nrbbank') || s.includes('16240') ||
    s.includes('nrbcbank') || s.includes('16120') ||
    s.includes('sbacbank') || s.includes('16720') ||
    s.includes('shimantobank') || s.includes('16856') ||
    s.includes('padmabank') || s.includes('16612') ||
    s.includes('bcbl') || s.includes('16766') ||
    s.includes('citizensbank') || s.includes('16773') ||
    s.includes('communitybank') || s.includes('16707') ||
    s.includes('aibl') || s.includes('16434') ||
    s.includes('sibl') || s.includes('16491') ||
    s.includes('fsibl') || s.includes('16257') ||
    s.includes('eximbank') || s.includes('16246') ||
    s.includes('sjibl') || s.includes('16247') ||
    s.includes('unionbank') || s.includes('16736') ||
    s.includes('gib') || s.includes('16713') ||
    s.includes('standardbank') || s.includes('16474') ||
    s.includes('sonalibank') || s.includes('16639') ||
    s.includes('janatabank') || s.includes('16111') ||
    s.includes('agranibank') || s.includes('16236') ||
    s.includes('rupalibank') || s.includes('16495') ||
    s.includes('hsbc') ||
    s.includes('cbc') || s.includes('16322') ||
    s.includes('sbibd') || s.includes('16214') ||
    s.includes('bankalfalah') || s.includes('16277') ||
    s.includes('bank');

  if (
    (isBankSender && (isCardPattern || /\b(?:bdt|tk|৳|taka|usd)\b/i.test(b))) ||
    (isCardPattern && (s.includes('bank') || s.includes('card') || s.includes('nexus') || /\b(?:debited|card\s*ending)\b/i.test(b)))
  ) {
    return 'cards';
  }

  // If DBBL or UCB has card references:
  if ((s.includes('dbbl') || s.includes('nexus') || s.includes('ucb')) && isCardPattern) {
    return 'cards';
  }

  // 2. Explicit sender checks (handles shortcodes, masked headers, +88 prefixes)
  if (s.includes('nagad') || s.includes('16167')) return 'nagad';
  if ((s.includes('rocket') || s.includes('16216') || s.includes('dbbl')) && !b.includes('card')) return 'rocket';
  if ((s.includes('upay') || s.includes('16268') || s.includes('ucb')) && !b.includes('card')) return 'upay';
  if (s.includes('bkash') || s.includes('16247')) return 'bkash';

  // 3. Explicit body keyword checks & unique provider markers
  if (b.includes('nagad') || b.includes('16167') || b.includes('uddokta')) return 'nagad';
  if (
    (b.includes('rocket') ||
      b.includes('dbbl') ||
      b.includes('16216') ||
      (b.includes('your a/c balance') && /txnid/i.test(b))) &&
    !b.includes('card')
  ) {
    return 'rocket';
  }
  if ((b.includes('upay') || b.includes('16268') || b.includes('ucb') || /\bUP[0-9A-Z]{6,}\b/i.test(b)) && !b.includes('card')) {
    return 'upay';
  }
  if (b.includes('bkash') || b.includes('16247')) return 'bkash';

  // 4. Fallback: If body matches card pattern with currency and a merchant indicator
  if (isCardPattern && /\b(?:tk|bdt|৳|taka|usd)\b/i.test(b) && /\b(?:at|to|for)\b/i.test(b)) {
    return 'cards';
  }

  return null;
}

/**
 * Loads processed TrxIDs from SecureStore into memory cache.
 */
async function loadProcessedTrxIds(): Promise<void> {
  if (isCacheLoaded) return;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY_PROCESSED_TRX);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => inMemoryProcessedTrxIds.add(id));
      }
    }
  } catch (e) {
    console.warn('[smsReaderService] Failed to load processed TrxIDs from SecureStore:', e);
  } finally {
    isCacheLoaded = true;
  }
}

/**
 * Helper to check if two transactions match as duplicates considering
 * settlement delay (+/- 3.5 days) and description / merchant keyword overlap.
 * Used for bidirectional deduplication between Card/MFS SMS and Bank Statement PDF.
 */
export function isDuplicateTransactionMatch(
  t1: { amount?: number; date?: string; type?: string; description?: string | null },
  t2: { amount?: number; date?: string; type?: string; description?: string | null }
): boolean {
  if (t1.amount == null || t2.amount == null || !t1.date || !t2.date) return false;
  if (Math.abs(t1.amount - t2.amount) >= 0.01) return false;
  if (t1.type && t2.type && t1.type !== t2.type) return false;

  const isExactDate = t1.date === t2.date;
  let diffDays = 0;
  const d1 = new Date(t1.date).getTime();
  const d2 = new Date(t2.date).getTime();
  if (!isNaN(d1) && !isNaN(d2)) {
    diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
  }

  // Exact date + exact amount is an automatic duplicate
  if (isExactDate) return true;

  // Within 3.5 days (standard bank clearing/settlement window): verify merchant or keyword overlap
  if (diffDays <= 3.5) {
    const desc1 = (t1.description || '').toLowerCase();
    const desc2 = (t2.description || '').toLowerCase();
    if (!desc1 || !desc2) return true;

    // Card last 4 digits match
    const card1 = desc1.match(/\b\d{4}\b/);
    const card2 = desc2.match(/\b\d{4}\b/);
    if (card1 && card2 && card1[0] === card2[0]) {
      return true;
    }

    const stopWords = new Set([
      'payment',
      'from',
      'with',
      'card',
      'bank',
      'debit',
      'credit',
      'ref',
      'trxid',
      'purchase',
      'bill',
      'pos',
      'to',
      'at',
      'bdt',
      'tk',
      'taka',
    ]);
    const words2 = desc2.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stopWords.has(w));
    if (words2.some((w) => desc1.includes(w))) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts a bKash / Card TrxID from a transaction description string.
 * Example strings:
 * - "Payment to Uber - Trips (TrxID: 9J38DH291)"
 * - "Received from John Doe (TrxID: 8KL291823)"
 * - "bKash recharge TrxID: 7X819203"
 */
export function extractTrxIdFromDescription(description: string | null | undefined): string | null {
  if (!description || typeof description !== 'string') return null;
  const match = description.match(
    /(?:Trx\s*ID|Txn\s*ID|Transaction\s*ID|Trans\s*ID|TrxId|TxnId|Txn|Trx)\s*[:.]?\s*([A-Za-z0-9]+)/i
  );
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Synchronizes processed bKash TrxIDs from the user's database transactions.
 * When the app is uninstalled and reinstalled, local SecureStore is cleared.
 * This function scans the user's loaded transactions from Supabase, extracts all
 * previously added bKash TrxIDs, and re-populates the processed set so they are
 * NEVER shown again as pending or detected.
 */
export async function syncProcessedTrxIdsFromTransactions(
  transactions: Array<{
    description?: string | null;
    date?: string;
    amount?: number;
    type?: string;
  }>
): Promise<number> {
  await loadProcessedTrxIds();
  let newlyAdded = 0;

  for (const tx of transactions) {
    const trxId = extractTrxIdFromDescription(tx.description);
    if (trxId && !inMemoryProcessedTrxIds.has(trxId)) {
      inMemoryProcessedTrxIds.add(trxId);
      newlyAdded++;
    }
  }

  // Remove any currently pending transactions that match existing transactions
  if (pendingTransactions.length > 0) {
    const beforeCount = pendingTransactions.length;
    pendingTransactions = pendingTransactions.filter((p) => {
      // 1. Match by TrxID
      if (inMemoryProcessedTrxIds.has(p.trxId)) return false;

      // 2. Match by exact date + amount + type OR settlement window + merchant in existing transactions
      const duplicateExists = transactions.some((existing) => {
        if (!existing.amount || !existing.date) return false;
        return isDuplicateTransactionMatch(existing, p);
      });

      if (duplicateExists) {
        inMemoryProcessedTrxIds.add(p.trxId);
        newlyAdded++;
        return false;
      }

      return true;
    });

    if (pendingTransactions.length !== beforeCount) {
      batchListeners.forEach((cb) => {
        try {
          cb([...pendingTransactions]);
        } catch (e) {
          console.error('[smsReaderService] Error notifying batch listeners:', e);
        }
      });
    }
  }

  if (newlyAdded > 0) {
    try {
      const arr = Array.from(inMemoryProcessedTrxIds).slice(-300);
      await SecureStore.setItemAsync(STORAGE_KEY_PROCESSED_TRX, JSON.stringify(arr));
    } catch (e) {
      console.warn('[smsReaderService] Failed to persist synced TrxIDs:', e);
    }
  }

  return newlyAdded;
}

/**
 * Checks whether a given TrxID has already been processed or exists in database.
 */
export async function hasProcessedTrxId(
  trxId: string,
  existingTransactions?: Array<{
    description?: string | null;
    date?: string;
    amount?: number;
    type?: string;
  }>
): Promise<boolean> {
  await loadProcessedTrxIds();
  if (inMemoryProcessedTrxIds.has(trxId)) return true;

  if (existingTransactions && existingTransactions.length > 0) {
    const found = existingTransactions.some((tx) => {
      const existingTrxId = extractTrxIdFromDescription(tx.description);
      return existingTrxId === trxId;
    });
    if (found) {
      inMemoryProcessedTrxIds.add(trxId);
      return true;
    }
  }

  return false;
}

/**
 * Marks a TrxID as processed / handled to prevent duplicate prompts.
 */
export async function markTrxIdProcessed(trxId: string): Promise<void> {
  await loadProcessedTrxIds();
  inMemoryProcessedTrxIds.add(trxId);
  try {
    const arr = Array.from(inMemoryProcessedTrxIds).slice(-300); // Keep last 300
    await SecureStore.setItemAsync(STORAGE_KEY_PROCESSED_TRX, JSON.stringify(arr));
  } catch (e) {
    console.warn('[smsReaderService] Failed to persist processed TrxID:', e);
  }
}

/**
 * Resets processed TrxID cache (useful for testing).
 */
export async function resetProcessedTrxIds(): Promise<void> {
  inMemoryProcessedTrxIds.clear();
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY_PROCESSED_TRX);
  } catch (e) {
    console.warn('[smsReaderService] Failed to clear processed TrxIDs:', e);
  }
}

import { getRecentSms } from '../modules/sms-reader';

const STORAGE_KEY_PERMISSION_GRANTED = 'finalert_bkash_permission_granted';

/**
 * Checks if SMS reading is supported on current platform (Android only).
 */
export function isSmsReadingSupported(): boolean {
  return Platform.OS === 'android';
}

/**
 * Checks if Android SMS permissions are already granted.
 * Checks READ_SMS (the core inbox permission) and checks SecureStore persistent cache.
 */
export async function checkSmsPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    // Check actual Android OS permission
    const readGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
    const receiveGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
    );

    const isGranted = readGranted || receiveGranted;
    if (isGranted) {
      await SecureStore.setItemAsync(STORAGE_KEY_PERMISSION_GRANTED, 'true');
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY_PERMISSION_GRANTED);
    }
    return isGranted;
  } catch (e) {
    console.warn('[smsReaderService] Error checking SMS permissions:', e);
    try {
      const cached = await SecureStore.getItemAsync(STORAGE_KEY_PERMISSION_GRANTED);
      return cached === 'true';
    } catch {
      return false;
    }
  }
}

/**
 * Prompts user to grant Android READ_SMS and RECEIVE_SMS permissions.
 * Persists the result so the app remembers it across launches.
 */
export async function requestSmsPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    const granted =
      result[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED ||
      result[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;

    if (granted) {
      await SecureStore.setItemAsync(STORAGE_KEY_PERMISSION_GRANTED, 'true');
      // Trigger an immediate initial sync once permission is granted
      await syncRecentSms();
    }
    return granted;
  } catch (err) {
    console.warn('[smsReaderService] Error requesting SMS permissions:', err);
    return false;
  }
}

let lastSyncTimestamp = 0;
const SYNC_THROTTLE_MS = 25000;

/**
 * Scans the Android SMS inbox for MFS and Card messages.
 * Uses a single fast unified query (15ms) instead of sequential loops.
 * Supports deep-scan mode to scan historical/previous SMS on the phone when requested.
 */
export async function syncRecentSms(
  existingTransactions?: Array<{
    description?: string | null;
    date?: string;
    amount?: number;
    type?: string;
  }>,
  options?: { isDeepScan?: boolean; limit?: number; force?: boolean }
): Promise<MfsTransaction[]> {
  if (Platform.OS !== 'android') return [];

  const now = Date.now();
  const isDeepScan = options?.isDeepScan === true;
  const isForced = options?.force === true || isDeepScan;

  // Throttle routine automatic background syncs so navigating between tabs is 0ms instant
  if (!isForced && now - lastSyncTimestamp < SYNC_THROTTLE_MS) {
    return [];
  }
  lastSyncTimestamp = now;

  // Ensure tracked providers cache is loaded
  await loadTrackedProviders();
  const tracked = getCachedTrackedProviders();
  if (tracked.length === 0) return [];

  // If existing transactions provided, sync TrxIDs first
  if (existingTransactions && existingTransactions.length > 0) {
    await syncProcessedTrxIdsFromTransactions(existingTransactions);
  }

  const hasPerm = await checkSmsPermissions();
  if (!hasPerm) return [];

  try {
    // When deep scan is requested (e.g. user hits "Scan SMS Inbox Now"), scan up to 800 previous SMS on phone!
    // For routine automatic background syncs, scan top 150 messages in a single 15ms query.
    const scanLimit = options?.limit || (isDeepScan ? 800 : 150);

    const inboxMessages = await getRecentSms(scanLimit);
    if (!inboxMessages || inboxMessages.length === 0) return [];

    // Filter to only messages relevant to tracked providers or card patterns
    const relevant = inboxMessages.filter((m) => {
      if (!m || !m.body) return false;
      const provider = detectProvider(m.address, m.body);
      return provider != null && isProviderTracked(provider);
    });

    if (relevant.length === 0) return [];

    return await processMultipleIncomingSms(
      relevant.map((m) => ({
        body: m.body,
        sender: m.address,
        timestamp: m.date,
      })),
      existingTransactions
    );
  } catch (err) {
    console.warn('[smsReaderService] Error syncing recent SMS:', err);
    return [];
  }
}

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Extracts and sanitizes the date from bKash SMS text.
 * bKash typically sends dates like: "at 25/09/2026 14:30", "at 24/09/26 18:22", or "24-Sep-2026".
 */
export function parseSmsDate(text: string, fallbackTimestamp?: number | Date): string {
  // 1. Text month dates (e.g. "24-Sep-2026", "Date:20-SEP-26", or "at 24 Sep 2026")
  const textMonthMatch =
    text.match(/(?:at|on|date:?)\s*(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})/i) ||
    text.match(/\b(\d{1,2})[-/\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\s](\d{2,4})\b/i);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const mStr = textMonthMatch[2].slice(0, 3).toLowerCase();
    const month = MONTH_NAMES[mStr];
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) year += 2000;
    if (month && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const iso = `${year}-${mm}-${dd}`;
      return iso > todayIso() ? todayIso() : iso;
    }
  }

  // 2. Numeric dates "at DD/MM/YYYY" or "at DD/MM/YY" or standalone DD/MM/YYYY or DD-MM-YYYY
  const match = text.match(/(?:at|on|date:?)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i)
    || text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);

  if (match) {
    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;

    // Validate boundaries
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const iso = `${year}-${mm}-${dd}`;
      return iso > todayIso() ? todayIso() : iso;
    }
  }

  if (fallbackTimestamp) {
    const d = new Date(fallbackTimestamp);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const iso = `${d.getFullYear()}-${mm}-${dd}`;
      return iso > todayIso() ? todayIso() : iso;
    }
  }

  return todayIso();
}

/**
 * Intelligent categorization based on counterparty, reference, and bKash keywords.
 */
export function guessCategory(
  type: TransactionType,
  counterparty: string,
  fullText: string
): string {
  const content = `${counterparty} ${fullText}`.toLowerCase();

  if (type === 'income') {
    if (/salary|payroll|remittance|wages|allowance/i.test(content)) return 'Salary';
    if (/upwork|fiverr|freelance|client|project/i.test(content)) return 'Freelance';
    if (/business|shop|sale|store|merchant|trade/i.test(content)) return 'Business';
    return 'Other';
  }

  // Expense categories (matching TRANSACTION_CATEGORIES in lib/transactionCategories.ts)
  if (/shwapno|agora|meena|unimart|chaldal|grocery|supershop|bazar|kitchen|bazaar|market/i.test(content)) {
    return 'Grocery';
  }
  if (/restaurant|cafe|burger|pizza|kfc|foodpanda|pathao food|chillox|takeout|madchef|dine|coffee|bakery|sweets|food/i.test(content)) {
    return 'Food & Dining';
  }
  if (/uber|pathao|shohoz|fuel|cng|petrol|filling|railway|train|bus|biman|airline|ride/i.test(content)) {
    return 'Transport';
  }
  if (/desco|dpdc|wasa|titas|nesco|breb|electricity|water|gas|internet|link3|carnival|amberit|bill|utility|recharge|airtime|flexiload|grameenphone|banglalink|robi|airtel|teletalk/i.test(content)) {
    return 'Bills & Utilities';
  }
  if (/pharma|hospital|labaid|square|ibn sina|doctor|diagnostic|clinic|medicine|drug|pharmacy/i.test(content)) {
    return 'Health';
  }
  if (/cineplex|blockbuster|movie|cinema|netflix|spotify|game|amusement|ticket|steam|playstation/i.test(content)) {
    return 'Entertainment';
  }
  if (/aarong|yellow|daraz|artisan|sailor|bata|apex|lotto|cloth|fashion|store|outlet|mall|shopping|brand/i.test(content)) {
    return 'Shopping';
  }

  return 'Other';
}

/**
 * Parses mobile financial service (bKash, Nagad, Rocket, Upay) SMS and extracts structured
 * transaction data using strict regex rules.
 */
export function parseMfsSms(
  body: string,
  sender: string = 'bKash',
  timestamp?: number | Date
): MfsTransaction | null {
  if (!body || typeof body !== 'string') return null;

  const normalized = body.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // 0. Reject OTPs, verification codes, failed/declined transactions, or non-MFS messages
  if (
    /\b(?:otp|one[\s-]*time[\s-]*password|verification\s+code|pin\s+reset|has\s+failed|is\s+failed|failed\.|unsuccessful|declined|insufficient\s+(?:balance|fund))\b/i.test(
      normalized
    )
  ) {
    return null;
  }

  // Detect provider strictly — ignore non-MFS SMS (banks, promos, personal texts)
  const provider = detectProvider(sender, normalized);
  if (!provider) {
    return null;
  }

  // 1. TrxID / TxnID / Auth Code / Approval Code Extraction (requires >= 4 alphanumeric chars)
  const trxMatch = normalized.match(
    /(?:Trx\s*ID|Txn\s*ID|Transaction\s*ID|Trans\s*ID|Trx\s*Id|Txn\s*Id|TxnId|TrxId|Auth\s*Code|Approval\s*Code|Ref(?:erence)?\s*(?:No|ID)?)\s*[:.#-]?\s*([A-Za-z0-9]{4,})/i
  );
  let trxId = trxMatch && trxMatch[1] ? trxMatch[1].trim() : '';

  // For non-card providers, a verified TrxID/TxnID is strictly required
  if (!trxId && provider !== 'cards') {
    return null;
  }

  // 2. Amount Extraction (supports bKash, Nagad key-value, Rocket A/C, Upay, Cards — 100% Hermes-safe, no lookbehind)
  let amount: number | null = null;

  // 2a. Priority: Explicit "Amount: Tk ..." label (standard Nagad multi-line format)
  const labeledAmountMatch = normalized.match(
    /\bAmount\s*[:.]?\s*(?:Tk|BDT|Tk\.|\u09F3|৳|Taka)?\.?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (labeledAmountMatch && labeledAmountMatch[1]) {
    const val = parseFloat(labeledAmountMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) amount = val;
  }

  // 2b. Priority: Amount directly linked to transaction action verb (bKash, Upay, Nagad single-line, Cards)
  if (amount === null) {
    const actionAmountMatch = normalized.match(
      /(?:Merchant\s+Payment|Payment|sent|Cash[\s-]*Out|Cash[\s-]*In|received|Money\s*Received|Cashback|Recharge|Mobile\s*Recharge|Top[\s-]*Up|Pay\s*Bill|Bill\s*Pay(?:ment)?|Send\s*Money|Add\s*Money|Deposit|Transfer(?:red)?|debited\s+for|debited|used\s+for|spent|purchase\s+of|charged\s+for|charged|authorized\s+for|authorized|swiped\s+for|transaction\s+of|trx\s+of)\s+(?:of\s+)?(?:Tk|BDT|Tk\.|\u09F3|৳|Taka|USD)?\.?\s*([\d,]+(?:\.\d{1,2})?)/i
    );
    if (actionAmountMatch && actionAmountMatch[1]) {
      const val = parseFloat(actionAmountMatch[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) amount = val;
    }
  }

  // 2c. Priority: Rocket format "<verb> to/from <A/C or Merchant> Tk <amount>"
  if (amount === null) {
    const verbTargetAmountMatch = normalized.match(
      /(?:Merchant\s+Payment|Payment|Cash[\s-]*Out|Cash[\s-]*In|Send\s*Money|Bill\s*Pay(?:ment)?|Pay\s*Bill|Top[\s-]*Up|Recharge|Transfer)\s+(?:to|from)\s+[^\s]+(?:\s+[^\s]+){0,3}?\s+(?:Tk|BDT|Tk\.|\u09F3|৳|Taka)\.?\s*([\d,]+(?:\.\d{1,2})?)/i
    );
    if (verbTargetAmountMatch && verbTargetAmountMatch[1]) {
      const val = parseFloat(verbTargetAmountMatch[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) amount = val;
    }
  }

  // 2d. Priority: Amount followed by to/from
  if (amount === null) {
    const toFromAmountMatch = normalized.match(
      /(?:Tk|BDT|Tk\.|\u09F3|৳|Taka)\.?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:to|from)/i
    );
    if (toFromAmountMatch && toFromAmountMatch[1]) {
      const val = parseFloat(toFromAmountMatch[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) amount = val;
    }
  }

  // 2e. Fallback: match any Tk / BDT / ৳ / Taka amount NOT immediately preceded by Fee/Charge/Comm/Balance
  if (amount === null) {
    const currencyRegex = /(?:Tk|BDT|Tk\.|\u09F3|৳|Taka)\.?\s*([\d,]+(?:\.\d{1,2})?)/gi;
    let m: RegExpExecArray | null;
    while ((m = currencyRegex.exec(normalized)) !== null) {
      const prefix = normalized.slice(Math.max(0, m.index - 24), m.index);
      if (/(?:fee|charge|comm|commission|balance|bal)\s*[:.]?\s*$/i.test(prefix)) {
        continue;
      }
      if (m[1]) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
          amount = val;
          break;
        }
      }
    }
  }

  if (amount === null || isNaN(amount) || amount <= 0) {
    return null;
  }

  // 3. Type Extraction:
  // "income" for Cash-In / Cash In / Receive Money / Cashback / Deposit / Add Money / Refund
  // "expense" for Send Money / Payment / Cash-Out / Cash Out / Mobile Recharge / TopUp / Pay Bill
  const lower = normalized.toLowerCase();
  let type: TransactionType = 'expense';

  if (
    /cash[\s-]*in/i.test(lower) ||
    lower.includes('received') ||
    lower.includes('cashback') ||
    lower.includes('deposit') ||
    lower.includes('credited') ||
    /add[\s-]*money/i.test(lower) ||
    lower.includes('refund')
  ) {
    type = 'income';
  } else if (
    /cash[\s-]*out/i.test(lower) ||
    lower.includes('payment') ||
    lower.includes('sent') ||
    /send[\s-]*money/i.test(lower) ||
    lower.includes('paid') ||
    lower.includes('recharge') ||
    /top[\s-]*up/i.test(lower) ||
    /pay[\s-]*bill/i.test(lower) ||
    /bill[\s-]*pay/i.test(lower) ||
    lower.includes('debited') ||
    lower.includes('transfer')
  ) {
    type = 'expense';
  }

  // 4. Counterparty Extraction (supports Nagad key-value labels, Rocket A/C, and standard to/from)
  let counterparty = '';

  // 4a. Labeled counterparty (Nagad: Merchant:, Receiver:, Sender:, Uddokta:, Biller:, Number:)
  const labeledCounterpartyMatch = normalized.match(
    /\b(?:Merchant|Receiver|Sender|Uddokta|Biller|Agent|Customer|Number|Recipient)\s*:\s*([A-Za-z0-9\s.&'/()_+-]+?)(?=\s+(?:Amount|Txn\s*ID|Trx\s*ID|TxnId|TrxId|Fee|Comm|Ref|Balance|Bal|Date)\b|\.|\n|;|$)/i
  );
  if (labeledCounterpartyMatch && labeledCounterpartyMatch[1]) {
    counterparty = labeledCounterpartyMatch[1].trim().replace(/^[:\s-]+|[:\s-]+$/g, '');
  }

  // 4b. Check "from <phone> to <merchant>" pattern (common in Rocket / DBBL)
  if (!counterparty) {
    const fromPhoneToMatch = normalized.match(
      /from\s+(?:A\/C\s*:\s*)?01[3-9]\d{8,9}\s+to\s+(?:A\/C\s*:\s*)?([A-Za-z0-9\s.&'/()_-]+?)(?=\s+(?:Tk|BDT|৳|Taka)\b|\s+is\s+successful|\s+successful|\s+Ref|\s+Fee|\.|\sat\s|\son\s|\n|;|$|\s+Balance|\s+Your\s+A\/C|\s+Bal:)/i
    );
    if (fromPhoneToMatch && fromPhoneToMatch[1]) {
      counterparty = fromPhoneToMatch[1].trim().replace(/^[:\s-]+|[:\s-]+$/g, '');
    }
  }

  // 4c. Standard "to / from <counterparty>" (stops cleanly before Tk / Fee / Balance / successful)
  if (!counterparty) {
    const actionCounterpartyMatch = normalized.match(
      /(?:(?:Tk|BDT|Tk\.|\u09F3|৳|Taka)?\.?\s*[\d,]+(?:\.\d{1,2})?\s+)?(?:to|from)\s+(?:A\/C\s*:\s*)?([A-Za-z0-9\s.&'/()_-]+?)(?=\s+(?:Tk|BDT|৳|Taka)\b|\s+is\s+successful|\s+successful|\s+Ref|\s+Fee|\.|\sat\s|\son\s|\n|;|$|\s+Balance|\s+Your\s+A\/C|\s+Bal:)/i
    );
    if (actionCounterpartyMatch && actionCounterpartyMatch[1]) {
      counterparty = actionCounterpartyMatch[1].trim().replace(/^[:\s-]+|[:\s-]+$/g, '');
    }
  }

  // 4d. Card merchant extraction (e.g. "at SHWAPNO on ...", "at KFC BANANI")
  if (provider === 'cards') {
    const cardMatch = normalized.match(
      /(?:card\s*(?:ending|no|number|#)?\s*(?:with|in)?\s*[:.]?\s*(?:\*{1,4}|x{1,4})?(\d{4})|\*{2,4}(\d{4}))/i
    );
    const cardSuffix = cardMatch ? cardMatch[1] || cardMatch[2] : null;

    const atMerchantMatch = normalized.match(
      /\bat\s+([A-Za-z0-9\s.&'/()_-]+?)(?=\s+on\b|\s+at\b|\s+Ref\b|\s+Avail\b|\s+Balance\b|\s+Auth\b|\.|\n|;|$|\s+Limit\b|\s+Available\b)/i
    );
    let merchantName = atMerchantMatch && atMerchantMatch[1]
      ? atMerchantMatch[1].trim().replace(/^[:\s-]+|[:\s-]+$/g, '')
      : counterparty;

    if (!merchantName || merchantName.toLowerCase() === 'bank card merchant' || merchantName.toLowerCase() === 'cards merchant') {
      const senderBank = (sender || '').replace(/[^a-zA-Z]/g, '');
      merchantName = senderBank ? `${senderBank} Merchant` : 'Card Merchant';
    }

    if (cardSuffix) {
      counterparty = `${merchantName} (Card **${cardSuffix})`;
    } else {
      counterparty = merchantName;
    }
  }

  // 4e. Fallback counterparty check: BD 11-12 digit mobile/account number
  if (!counterparty) {
    const phoneMatch = normalized.match(/\b(01[3-9]\d{8,9})\b/);
    if (phoneMatch) {
      counterparty = phoneMatch[1];
    } else {
      const pName = MFS_PROVIDER_CONFIG[provider]?.name || 'MFS';
      counterparty = type === 'expense' ? `${pName} Merchant` : `${pName} Sender`;
    }
  }

  // 5. Reference Extraction (e.g. Ref: GROCERY or Ref Freelance)
  let reference: string | undefined;
  const refMatch = normalized.match(/\bRef\s*[:.]?\s*([A-Za-z0-9\s._-]+?)(?=\s+(?:Fee|Comm|Balance|Bal|Txn\s*ID|Trx\s*ID|TxnId|TrxId)\b|\.|\sat\s|\son\s|\n|;|$)/i);
  if (refMatch && refMatch[1]) {
    const cleanRef = refMatch[1].trim();
    if (cleanRef && cleanRef.toLowerCase() !== 'n/a') {
      reference = cleanRef;
    }
  }

  // 6. Fee Extraction (supports Fee Tk 5.00, Fee:Tk 5.00, Fee: Tk 5.00, Charge Tk 5.00)
  let fee: number | undefined;
  const feeMatch = normalized.match(/(?:Fee|Charge)\s*[:.]?\s*(?:Tk|BDT|Tk\.|\u09F3|৳|Taka)?\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (feeMatch && feeMatch[1]) {
    const f = parseFloat(feeMatch[1].replace(/,/g, ''));
    if (!isNaN(f)) fee = f;
  }

  // 7. Balance Extraction (supports Balance Tk ..., Balance: Tk ..., Your A/C Balance: Tk ...)
  let balance: number | undefined;
  const balMatch = normalized.match(/(?:Balance|Bal)\s*[:.]?\s*(?:Tk|BDT|Tk\.|\u09F3|৳|Taka)?\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    const b = parseFloat(balMatch[1].replace(/,/g, ''));
    if (!isNaN(b)) balance = b;
  }

  // 8. Date Extraction
  const date = parseSmsDate(normalized, timestamp);

  // 9. Guessed Category
  const category = guessCategory(type, counterparty, normalized);

  // Extract raw timestamp string if present
  const timeMatch =
    normalized.match(/(?:at|on|Date:?)\s*(\d{1,2}[/-](?:\d{1,2}|[A-Za-z]{3})[/-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)/i) ||
    normalized.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\b/);
  const rawTimestamp = timeMatch ? timeMatch[1] : undefined;

  // Fallback deterministic TrxID for card transactions with no explicit auth code
  if (!trxId && provider === 'cards') {
    const cardMatch = normalized.match(
      /(?:card\s*(?:ending|no|number|#)?\s*(?:with|in)?\s*[:.]?\s*(?:\*{1,4}|x{1,4})?(\d{4})|\*{2,4}(\d{4}))/i
    );
    const cardSuffix = cardMatch ? cardMatch[1] || cardMatch[2] : 'CARD';
    const cleanDate = date.replace(/-/g, '');
    let bodyHash = 0;
    for (let i = 0; i < normalized.length; i++) {
      bodyHash = (bodyHash * 31 + normalized.charCodeAt(i)) >>> 0;
    }
    trxId = `CARD-${cardSuffix}-${cleanDate}-${bodyHash.toString(36).toUpperCase()}`;
  }

  return {
    trxId,
    amount: Math.round(amount * 100) / 100,
    type,
    counterparty,
    reference,
    fee,
    balance,
    date,
    rawTimestamp,
    category,
    rawSms: body,
    sender,
    provider,
  };
}

export const parseBkashSms = parseMfsSms;

/**
 * Formats a clean, consistent description including provider tag and TrxID.
 */
export function formatMfsTransactionDescription(tx: MfsTransaction): string {
  if (tx.provider === 'cards') {
    const action = tx.type === 'expense' ? 'Payment to' : 'Received from';
    const ref = tx.reference ? ` - ${tx.reference}` : '';
    return `[Bank Card] ${action} ${tx.counterparty}${ref} (TrxID: ${tx.trxId})`;
  }
  const providerName = MFS_PROVIDER_CONFIG[tx.provider || 'bkash']?.name || 'MFS';
  const action = tx.type === 'expense' ? 'Payment to' : 'Received from';
  const ref = tx.reference ? ` - ${tx.reference}` : '';
  return `[${providerName}] ${action} ${tx.counterparty}${ref} (TrxID: ${tx.trxId})`;
}

/**
 * Sample real-world MFS SMS templates (bKash, Nagad, Rocket, Upay) for instant testing & demonstration.
 */
export const SAMPLE_MFS_MESSAGES = [
  // bKash
  {
    id: 'sample-bkash-1',
    provider: 'bkash' as MfsProvider,
    label: 'bKash - Grocery Payment (Shwapno)',
    sender: 'bKash',
    body: 'Payment Tk 450.00 to Shwapno successful. Ref: GROCERY. Fee Tk 0.00. Balance Tk 3,120.00. TrxID BL7A29QW4 at 24/09/2026 18:22',
  },
  {
    id: 'sample-bkash-2',
    provider: 'bkash' as MfsProvider,
    label: 'bKash - Food & Dining (Chillox)',
    sender: 'bKash',
    body: 'Payment Tk 320.00 to Chillox Banani successful. Ref: DINNER. Fee Tk 0.00. Balance Tk 2,800.00. TrxID 8BL30XP1 at 25/09/2026 20:15',
  },
  {
    id: 'sample-bkash-3',
    provider: 'bkash' as MfsProvider,
    label: 'bKash - Send Money to Friend',
    sender: 'bKash',
    body: 'You have sent Tk 500.00 to 01712345678. Fee Tk 5.00. Balance Tk 2,295.00. TrxID 7B90K1X8 at 25/09/2026 16:45',
  },
  {
    id: 'sample-bkash-4',
    provider: 'bkash' as MfsProvider,
    label: 'bKash - Cash In / Received Money',
    sender: 'bKash',
    body: 'You have received Tk 1,500.00 from 01719999999. Ref: Freelance. Balance Tk 1,758.00. TrxID 9LM34K89 at 26/09/2026 10:00',
  },
  // Nagad
  {
    id: 'sample-nagad-1',
    provider: 'nagad' as MfsProvider,
    label: 'Nagad - Shopping Payment (Aarong)',
    sender: 'Nagad',
    body: 'Payment Tk 750.00 to Aarong successful. Fee: Tk 0.00. Balance: Tk 3,250.00. TxnID: 71NB67H1 at 14/10/2026 18:20',
  },
  {
    id: 'sample-nagad-2',
    provider: 'nagad' as MfsProvider,
    label: 'Nagad - Electricity Bill (DPDC)',
    sender: '16167',
    body: 'Bill Pay of Tk 1,200.00 to DPDC successful. Fee Tk 0.00. Balance: Tk 2,050.00. TxnID: 98AB721C at 15/10/2026 11:00',
  },
  {
    id: 'sample-nagad-3',
    provider: 'nagad' as MfsProvider,
    label: 'Nagad - Send Money',
    sender: 'Nagad',
    body: 'Send Money of Tk 300.00 to 01711223344 successful. Fee Tk 0.00. Balance: Tk 1,750.00. TxnID: 55KL88M3 at 17/10/2026 09:15',
  },
  {
    id: 'sample-nagad-4',
    provider: 'nagad' as MfsProvider,
    label: 'Nagad - Cash In',
    sender: 'Nagad',
    body: 'Cash In Tk 1,000.00 from 01711000000 successful. Fee Tk 0.00. Balance: Tk 2,750.00. TxnID: 72A5K9PO at 12/10/2026 15:30',
  },
  // Rocket
  {
    id: 'sample-rocket-1',
    provider: 'rocket' as MfsProvider,
    label: 'Rocket - Payment to Merchant',
    sender: 'Rocket',
    body: 'Payment Tk 450.00 from 01711000000 to Shwapno successful. Txn ID: 987654321. Balance Tk 1,050.00 on 20/09/2026 14:00',
  },
  {
    id: 'sample-rocket-2',
    provider: 'rocket' as MfsProvider,
    label: 'Rocket - Received Money',
    sender: '16216',
    body: 'You have received Tk 2,500.00 from 01711000000. Txn ID: 55667788. Fee Tk 0.00. Balance Tk 3,550.00 on 21/09/2026 10:12',
  },
  {
    id: 'sample-rocket-3',
    provider: 'rocket' as MfsProvider,
    label: 'Rocket - Utility Bill (DESCO)',
    sender: 'DBBL',
    body: 'Bill Payment Tk 1,500.00 from 01711000000 to DESCO successful. Txn ID: 44556677. Balance Tk 2,050.00 on 23/09/2026 15:10',
  },
  // Upay
  {
    id: 'sample-upay-1',
    provider: 'upay' as MfsProvider,
    label: "Upay - Dining Payment (Domino's)",
    sender: 'upay',
    body: "Payment of Tk 350.00 to Domino's Pizza is successful. Fee Tk 0.00, Balance Tk 1,200.00, TrxID: UP12345678 at 18/09/2026 20:00",
  },
  {
    id: 'sample-upay-2',
    provider: 'upay' as MfsProvider,
    label: 'Upay - Send Money',
    sender: '16268',
    body: 'Send Money of Tk 500.00 to 01911000000 is successful. Fee Tk 0.00, Balance Tk 700.00, TrxID: UP33221100 at 19/09/2026 12:15',
  },
  {
    id: 'sample-upay-3',
    provider: 'upay' as MfsProvider,
    label: 'Upay - Cash In',
    sender: 'UCB',
    body: 'Cash In Tk 2,000.00 from Agent 01811000000 successful. Fee Tk 0.00, Balance Tk 2,700.00, TrxID: UP87654321 at 19/09/2026 14:30',
  },
  // Bank Cards (Credit / Debit)
  {
    id: 'sample-card-1',
    provider: 'cards' as MfsProvider,
    label: 'City Bank Card - Grocery (Shwapno)',
    sender: 'CityBank',
    body: 'Dear Cardmember, your City Bank Card ending 1234 has been debited for BDT 2,450.00 at SHWAPNO on 24-Nov-2026. Avail Bal: BDT 45,000.00. Ref: 891234',
  },
  {
    id: 'sample-card-2',
    provider: 'cards' as MfsProvider,
    label: 'EBL Card - Dining (KFC Banani)',
    sender: 'EBL',
    body: 'Your EBL Card 4***5678 was used for BDT 1,200.00 at KFC BANANI on 24/11/2026 13:45. Avail Bal BDT 28,800.00.',
  },
  {
    id: 'sample-card-3',
    provider: 'cards' as MfsProvider,
    label: 'BRAC Bank Card - Shopping (Unimart)',
    sender: 'BRACBank',
    body: 'Trx of BDT 3,450.00 on your BRAC Bank Card ending 4567 at UNIMART on 24-11-2026 19:30. Available Limit: BDT 75,000.00.',
  },
  {
    id: 'sample-card-4',
    provider: 'cards' as MfsProvider,
    label: 'DBBL Nexus Card - Meena Bazar',
    sender: 'DBBL',
    body: 'Your DBBL Card **7890 was debited for Tk 850.00 at MEENA BAZAR on 24/11/2026. Txn ID: 99887766.',
  },
];

export const SAMPLE_BKASH_MESSAGES = SAMPLE_MFS_MESSAGES;

type SmsListenerCallback = (tx: MfsTransaction) => void;
type BatchListenerCallback = (txs: MfsTransaction[]) => void;

const listeners = new Set<SmsListenerCallback>();
const batchListeners = new Set<BatchListenerCallback>();
let pendingTransactions: MfsTransaction[] = [];

/**
 * Returns a copy of currently pending unconfirmed transactions.
 */
export function getPendingTransactions(): MfsTransaction[] {
  return [...pendingTransactions];
}

/**
 * Subscribes to the live queue of pending unconfirmed transactions.
 * Calls callback immediately with existing pending transactions.
 */
export function subscribeToPendingTransactions(callback: BatchListenerCallback): () => void {
  batchListeners.add(callback);
  callback([...pendingTransactions]);
  return () => {
    batchListeners.delete(callback);
  };
}

/**
 * Removes a transaction from the pending queue.
 */
export function removePendingTransaction(trxId: string): void {
  pendingTransactions = pendingTransactions.filter((t) => t.trxId !== trxId);
  batchListeners.forEach((cb) => {
    try {
      cb([...pendingTransactions]);
    } catch (e) {
      console.error('[smsReaderService] Error in batch listener:', e);
    }
  });
}

/**
 * Clears all pending transactions.
 */
export function clearPendingTransactions(): void {
  pendingTransactions = [];
  batchListeners.forEach((cb) => {
    try {
      cb([]);
    } catch (e) {
      console.error('[smsReaderService] Error in batch listener:', e);
    }
  });
}

/**
 * Subscribes to detected transactions (single-item listener).
 * Returns an unsubscribe callback.
 */
export function subscribeToBkashTransactions(callback: SmsListenerCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export const subscribeToMfsTransactions = subscribeToBkashTransactions;

/**
 * Dispatches an incoming SMS to all active listeners and queues it for batch verification.
 */
export async function processIncomingSms(
  body: string,
  sender: string = '',
  timestamp?: number | Date,
  existingTransactions?: Array<{
    description?: string | null;
    date?: string;
    amount?: number;
    type?: string;
  }>
): Promise<MfsTransaction | null> {
  await loadTrackedProviders();

  const parsed = parseMfsSms(body, sender, timestamp);
  if (!parsed) return null;

  // Filter out if user has disabled this provider
  if (!isProviderTracked(parsed.provider)) {
    return null;
  }

  // Check if TrxID was already handled or in database
  const alreadyProcessed = await hasProcessedTrxId(parsed.trxId, existingTransactions);
  if (alreadyProcessed) {
    return null;
  }

  // Cross-check if matching date + amount + type exists in database
  if (existingTransactions && existingTransactions.length > 0) {
    const matchInDb = existingTransactions.some((existing) => {
      if (!existing.amount || !existing.date) return false;
      return isDuplicateTransactionMatch(existing, parsed);
    });
    if (matchInDb) {
      await markTrxIdProcessed(parsed.trxId);
      return null;
    }
  }

  // Queue to pending transactions if not already in queue
  if (!pendingTransactions.some((t) => t.trxId === parsed.trxId)) {
    pendingTransactions = [parsed, ...pendingTransactions];
    batchListeners.forEach((cb) => {
      try {
        cb([...pendingTransactions]);
      } catch (e) {
        console.error('[smsReaderService] Error in batch listener:', e);
      }
    });
  }

  // Notify single listeners
  listeners.forEach((cb) => {
    try {
      cb(parsed);
    } catch (err) {
      console.error('[smsReaderService] Error in listener callback:', err);
    }
  });

  return parsed;
}

/**
 * Processes a batch of incoming/stored SMS messages received since last sync.
 * Deduplicates against SecureStore and existing database transactions,
 * adding only genuinely new transactions to the pending queue.
 */
export async function processMultipleIncomingSms(
  messages: { body: string; sender?: string; timestamp?: number | Date }[],
  existingTransactions?: Array<{
    description?: string | null;
    date?: string;
    amount?: number;
    type?: string;
  }>
): Promise<MfsTransaction[]> {
  await loadTrackedProviders();
  const newlyDetected: MfsTransaction[] = [];

  for (const m of messages) {
    const parsed = parseMfsSms(m.body, m.sender ?? '', m.timestamp);
    if (!parsed) continue;

    // Filter out if user disabled this provider
    if (!isProviderTracked(parsed.provider)) continue;

    const alreadyProcessed = await hasProcessedTrxId(parsed.trxId, existingTransactions);
    if (alreadyProcessed) continue;

    // Cross-check if matching date + amount + type exists in database
    if (existingTransactions && existingTransactions.length > 0) {
      const matchInDb = existingTransactions.some((existing) => {
        if (!existing.amount || !existing.date) return false;
        return isDuplicateTransactionMatch(existing, parsed);
      });
      if (matchInDb) {
        await markTrxIdProcessed(parsed.trxId);
        continue;
      }
    }

    if (!pendingTransactions.some((t) => t.trxId === parsed.trxId)) {
      pendingTransactions.push(parsed);
      newlyDetected.push(parsed);
    }
  }

  if (newlyDetected.length > 0) {
    batchListeners.forEach((cb) => {
      try {
        cb([...pendingTransactions]);
      } catch (e) {
        console.error('[smsReaderService] Error in batch listener:', e);
      }
    });
  }

  return newlyDetected;
}

