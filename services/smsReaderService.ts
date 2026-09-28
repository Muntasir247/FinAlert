import { Platform, PermissionsAndroid } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TransactionType } from '../lib/transactions';

export interface BKashTransaction {
  trxId: string;
  amount: number;
  type: TransactionType;
  counterparty: string;
  date: string; // YYYY-MM-DD
  rawTimestamp?: string;
  category: string;
  rawSms: string;
  sender: string;
}

const STORAGE_KEY_PROCESSED_TRX = 'finalert_bkash_processed_trx';

// In-memory cache for fast deduplication lookups
const inMemoryProcessedTrxIds = new Set<string>();
let isCacheLoaded = false;

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
 * Checks whether a given TrxID has already been processed or dismissed.
 */
export async function hasProcessedTrxId(trxId: string): Promise<boolean> {
  await loadProcessedTrxIds();
  return inMemoryProcessedTrxIds.has(trxId);
}

/**
 * Marks a TrxID as processed / handled to prevent duplicate prompts.
 */
export async function markTrxIdProcessed(trxId: string): Promise<void> {
  await loadProcessedTrxIds();
  inMemoryProcessedTrxIds.add(trxId);
  try {
    const arr = Array.from(inMemoryProcessedTrxIds).slice(-150); // Keep last 150
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
    // Check if user previously granted permission stored in SecureStore
    const cached = await SecureStore.getItemAsync(STORAGE_KEY_PERMISSION_GRANTED);
    
    // Check actual Android OS permission
    const readGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
    const receiveGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
    );

    const isGranted = readGranted || receiveGranted || cached === 'true';
    if (readGranted || receiveGranted) {
      await SecureStore.setItemAsync(STORAGE_KEY_PERMISSION_GRANTED, 'true');
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

/**
 * Scans the Android SMS inbox for any bKash messages received since last check.
 * This runs when the app launches or returns from the background, ensuring
 * transactions that happened while the app was closed or sleeping are detected.
 */
export async function syncRecentSms(): Promise<BKashTransaction[]> {
  if (Platform.OS !== 'android') return [];

  const hasPerm = await checkSmsPermissions();
  if (!hasPerm) return [];

  try {
    const combined: Array<{ address: string; body: string; date: number }> = [];
    const seen = new Set<string>();

    const addUnique = (list: Array<{ address: string; body: string; date: number }> | null | undefined) => {
      if (!list) return;
      for (const m of list) {
        if (!m || !m.body) continue;
        const key = `${m.date}_${m.address}_${m.body.slice(0, 30)}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(m);
        }
      }
    };

    // 1. Fetch bKash specifically
    const bkashMessages = await getRecentSms(40, 'bKash');
    addUnique(bkashMessages);

    // 2. Fetch 16247 specifically
    const shortcodeMessages = await getRecentSms(40, '16247');
    addUnique(shortcodeMessages);

    // 3. Fetch general latest inbox messages (up to 50) to catch any format
    const generalMessages = await getRecentSms(50);
    addUnique(generalMessages);

    if (combined.length === 0) return [];

    return await processMultipleIncomingSms(
      combined.map((m) => ({
        body: m.body,
        sender: m.address,
        timestamp: m.date,
      }))
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

/**
 * Extracts and sanitizes the date from bKash SMS text.
 * bKash typically sends dates like: "at 25/09/2026 14:30" or "at 24/09/26 18:22".
 */
export function parseSmsDate(text: string, fallbackTimestamp?: number | Date): string {
  // Regex looks for "at DD/MM/YYYY" or "at DD/MM/YY" or standalone DD/MM/YYYY
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
  if (/desco|dpdc|wasa|titas|nesco|breb|electricity|water|gas|internet|link3|carnival|amberit|bill|utility/i.test(content)) {
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
 * Parses bKash SMS and extracts structured transaction data using strict regex rules.
 */
export function parseBkashSms(
  body: string,
  sender: string = 'bKash',
  timestamp?: number | Date
): BKashTransaction | null {
  if (!body || typeof body !== 'string') return null;

  const normalized = body.replace(/[\r\n]+/g, ' ').trim();

  // 1. TrxID Extraction (e.g. TrxID 9K47DHD829, TxnID BL7A29QW4, Trx Id: 8BL30XP1)
  const trxMatch = normalized.match(/(?:TrxID|TxnID|Trx\s*Id|Txn\s*Id)\s*[:]?\s*([A-Za-z0-9]+)/i);
  if (!trxMatch || !trxMatch[1]) {
    return null;
  }
  const trxId = trxMatch[1].trim();

  // 2. Amount Extraction (e.g. Tk 150.00, Tk. 1,500.00, BDT 450)
  const amountMatch = normalized.match(/(?:Tk|BDT|Tk\.)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch || !amountMatch[1]) {
    return null;
  }
  const rawAmountStr = amountMatch[1].replace(/,/g, '');
  const amount = parseFloat(rawAmountStr);
  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  // 3. Type Extraction:
  // "expense" for Send Money / Payment / Cash Out
  // "income" for Cash In / Receive Money / Deposit
  const lower = normalized.toLowerCase();
  let type: TransactionType = 'expense';

  if (
    lower.includes('received') ||
    lower.includes('cash in') ||
    lower.includes('deposit') ||
    lower.includes('credited') ||
    lower.includes('add money')
  ) {
    type = 'income';
  } else if (
    lower.includes('payment') ||
    lower.includes('sent') ||
    lower.includes('send money') ||
    lower.includes('cash out') ||
    lower.includes('fee') ||
    lower.includes('paid')
  ) {
    type = 'expense';
  }

  // 4. Counterparty Extraction (Merchant, agent, or phone number)
  let counterparty = '';
  if (type === 'expense') {
    // "to 01711000000 successful" or "to Shwapno successful" or "to 01700000000"
    const toMatch = normalized.match(/(?:to|from)\s+([A-Za-z0-9\s.&'/-]+?)(?=\s+successful|\s+Ref:|\s+Fee|\.|\sat\s|\n|;|$)/i);
    if (toMatch && toMatch[1]) {
      counterparty = toMatch[1].trim().replace(/^[:\s-]+|[:\s-]+$/g, '');
    }
  } else {
    // "from 01712345678" or "from City Bank"
    const fromMatch = normalized.match(/(?:from)\s+([A-Za-z0-9\s.&'/-]+?)(?=\s+successful|\s+Ref:|\s+Fee|\.|\sat\s|\n|;|$)/i);
    if (fromMatch && fromMatch[1]) {
      counterparty = fromMatch[1].trim().replace(/^[:\s-]+|[:\s-]+$/g, '');
    }
  }

  // Fallback counterparty check: BD 11-digit mobile number
  if (!counterparty) {
    const phoneMatch = normalized.match(/\b(01[3-9]\d{8})\b/);
    if (phoneMatch) {
      counterparty = phoneMatch[1];
    } else {
      counterparty = type === 'expense' ? 'bKash Merchant' : 'bKash Sender';
    }
  }

  // 5. Date Extraction
  const date = parseSmsDate(normalized, timestamp);

  // 6. Guessed Category
  const category = guessCategory(type, counterparty, normalized);

  // Extract raw timestamp string if present
  const timeMatch = normalized.match(/at\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)/i);
  const rawTimestamp = timeMatch ? timeMatch[1] : undefined;

  return {
    trxId,
    amount: Math.round(amount * 100) / 100,
    type,
    counterparty,
    date,
    rawTimestamp,
    category,
    rawSms: body,
    sender,
  };
}

/**
 * Sample real-world bKash SMS templates for instant testing & demonstration.
 */
export const SAMPLE_BKASH_MESSAGES = [
  {
    id: 'sample-1',
    label: 'Grocery Payment (Shwapno)',
    sender: 'bKash',
    body: 'Payment Tk 450.00 to Shwapno successful. Ref: GROCERY. Fee Tk 0.00. Balance Tk 3,120.00. TrxID BL7A29QW4 at 24/09/2026 18:22',
  },
  {
    id: 'sample-2',
    label: 'Food & Dining (Chillox Banani)',
    sender: 'bKash',
    body: 'Payment Tk 320.00 to Chillox Banani successful. Ref: DINNER. Fee Tk 0.00. Balance Tk 2,800.00. TrxID 8BL30XP1 at 25/09/2026 20:15',
  },
  {
    id: 'sample-3',
    label: 'Send Money to Friend',
    sender: 'bKash',
    body: 'You have sent Tk 500.00 to 01712345678. Fee Tk 5.00. Balance Tk 2,295.00. TrxID 7B90K1X8 at 25/09/2026 16:45',
  },
  {
    id: 'sample-4',
    label: 'Cash Out at Agent',
    sender: 'bKash',
    body: 'Cash Out Tk 2,000.00 to 01700000000 successful. Fee Tk 37.00. Balance Tk 258.00. TrxID 6C47A890 at 21/09/2026 19:00',
  },
  {
    id: 'sample-5',
    label: 'Cash In / Received Money',
    sender: 'bKash',
    body: 'You have received Tk 1,500.00 from 01719999999. Ref: Freelance. Balance Tk 1,758.00. TrxID 9LM34K89 at 26/09/2026 10:00',
  },
];

type SmsListenerCallback = (tx: BKashTransaction) => void;
type BatchListenerCallback = (txs: BKashTransaction[]) => void;

const listeners = new Set<SmsListenerCallback>();
const batchListeners = new Set<BatchListenerCallback>();
let pendingTransactions: BKashTransaction[] = [];

/**
 * Returns a copy of currently pending unconfirmed transactions.
 */
export function getPendingTransactions(): BKashTransaction[] {
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
 * Subscribes to detected bKash transactions (single-item listener).
 * Returns an unsubscribe callback.
 */
export function subscribeToBkashTransactions(callback: SmsListenerCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Dispatches an incoming SMS to all active listeners and queues it for batch verification.
 */
export async function processIncomingSms(
  body: string,
  sender: string = 'bKash',
  timestamp?: number | Date
): Promise<BKashTransaction | null> {
  const parsed = parseBkashSms(body, sender, timestamp);
  if (!parsed) return null;

  // Check if TrxID was already handled
  const alreadyProcessed = await hasProcessedTrxId(parsed.trxId);
  if (alreadyProcessed) {
    return null;
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
 * Deduplicates against SecureStore and adds new transactions to the pending queue.
 */
export async function processMultipleIncomingSms(
  messages: { body: string; sender?: string; timestamp?: number | Date }[]
): Promise<BKashTransaction[]> {
  const newlyDetected: BKashTransaction[] = [];

  for (const m of messages) {
    const parsed = parseBkashSms(m.body, m.sender ?? 'bKash', m.timestamp);
    if (!parsed) continue;

    const alreadyProcessed = await hasProcessedTrxId(parsed.trxId);
    if (alreadyProcessed) continue;

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

