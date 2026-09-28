import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { isEncrypted, decryptPDF } from '@pdfsmaller/pdf-decrypt';
import { PDFDocument } from 'pdf-lib';
import { TRANSACTION_CATEGORIES, INCOME_CATEGORIES } from '../lib/transactionCategories';
import type { TransactionType } from '../lib/transactions';
import { generateGeminiContent, GeminiAllRateLimitedError } from './geminiClient';

export interface ExtractedStatementTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  type: TransactionType; // 'expense' | 'income'
  amount: number;
  category: string;
  selected: boolean;
  originalType: 'debit' | 'credit';
}

export interface StatementExtractionResult {
  bankName: string;
  period?: string;
  transactions: ExtractedStatementTransaction[];
  totalDebit: number;
  totalCredit: number;
}

export class PdfStatementError extends Error {}
export class PdfPasswordRequiredError extends PdfStatementError {}
export class PdfInvalidPasswordError extends PdfStatementError {}

/**
 * Primary model is Gemini 1.5 Flash as requested, followed by fallback models
 * if rate limited (429).
 */
const GEMINI_STATEMENT_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.5-flash',
  'gemini-3.5-flash',
];

const EXPENSE_CATEGORIES_LIST = TRANSACTION_CATEGORIES.map((c) => c.label).join(', ');
const INCOME_CATEGORIES_LIST = INCOME_CATEGORIES.map((c) => c.label).join(', ');

const SYSTEM_INSTRUCTION = `You are an expert financial document parser specializing in bank account and credit card statements (e.g. City Bank, BRAC Bank, Dutch-Bangla Bank, Eastern Bank, HSBC, Standard Chartered, Chase, etc.).

Analyze the provided bank statement PDF and extract all individual transaction line items with high precision.

For each individual transaction, extract:
- date: transaction date strictly in YYYY-MM-DD format. Infer the correct year from the statement period if only DD/MM or MM/DD is given.
- description: clear, clean narration or description of the transaction (merchant, ATM, beneficiary, fee, or check note).
- type: "debit" if funds were deducted (purchases, payments, withdrawals, fees) or "credit" if funds were deposited (salary, interest, deposits, refunds, transfers in).
- amount: the numeric transaction amount as a positive number string (e.g. "1250" or "450.50"), with NO currency symbols, no commas, and no negative signs.
- category: ONE best-fit category from the app's supported list:
  For debit (expense): ${EXPENSE_CATEGORIES_LIST}
  For credit (income): ${INCOME_CATEGORIES_LIST}

Rules:
- DO NOT extract statement summary rows, balance forward rows, opening balance, closing balance, or total lines.
- Only extract real transactional entries.
- If unsure of the category, assign "Other".
- If no transactions are found, return an empty array.

Respond with structured JSON adhering to the specified schema.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    bank_name: { type: 'STRING' },
    statement_period: { type: 'STRING' },
    transactions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING' },
          description: { type: 'STRING' },
          type: { type: 'STRING', enum: ['debit', 'credit'] },
          amount: { type: 'STRING' },
          category: { type: 'STRING' },
        },
        required: ['date', 'description', 'type', 'amount', 'category'],
      },
    },
  },
  required: ['transactions'],
};

/**
 * Reads a PDF file as a base64 encoded string across Web and Native platforms.
 */
export async function readPdfAsBase64(uri: string, webBase64?: string): Promise<string> {
  if (webBase64) {
    const commaIndex = webBase64.indexOf(',');
    return commaIndex >= 0 ? webBase64.slice(commaIndex + 1) : webBase64;
  }

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Native (Android / iOS)
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (err) {
    console.warn('[pdfStatementService] Native readAsStringAsync fallback to fetch blob:', err);
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

const todayIso = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const sanitizeDate = (val: unknown): string => {
  if (typeof val !== 'string') return todayIso();
  const trimmed = val.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return todayIso();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) {
    return todayIso();
  }
  return trimmed > todayIso() ? todayIso() : trimmed;
};

const sanitizeCategory = (cat: unknown, type: TransactionType): string => {
  if (typeof cat !== 'string') return 'Other';
  const trimmed = cat.trim().toLowerCase();
  const validList =
    type === 'income'
      ? INCOME_CATEGORIES.map((c) => c.label)
      : TRANSACTION_CATEGORIES.map((c) => c.label);

  const matched = validList.find((v) => v.toLowerCase() === trimmed);
  return matched ?? 'Other';
};

const sanitizeAmount = (val: unknown): number => {
  if (typeof val === 'number') return Math.max(0, val);
  if (typeof val === 'string') {
    const clean = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }
  return 0;
};

/**
 * Converts a base64 string into a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '');
  if (typeof atob === 'function') {
    const binary = atob(clean);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  throw new Error('No base64 decoder available');
}

/**
 * Converts a Uint8Array into a base64 string.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  throw new Error('No base64 encoder available');
}

/**
 * Detects whether a PDF file in base64 format is password-protected/encrypted.
 */
export async function isPdfEncrypted(base64: string): Promise<boolean> {
  if (!base64 || base64.length < 50) return false;
  try {
    const bytes = base64ToUint8Array(base64);

    // 1. Check with @pdfsmaller/pdf-decrypt
    const checkResult = await isEncrypted(bytes);
    if (checkResult && checkResult.encrypted) {
      return true;
    }

    // 2. Secondary check with pdf-lib
    try {
      await PDFDocument.load(bytes);
      return false;
    } catch (e: unknown) {
      const err = e as { message?: string };
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('encrypt')) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.warn('[pdfStatementService] isPdfEncrypted check failed:', err);
    return false;
  }
}

/**
 * Decrypts a password-protected PDF in base64 format and returns the decrypted base64.
 */
export async function decryptPdfBase64(base64: string, password: string): Promise<string> {
  if (!password || !password.trim()) {
    throw new PdfInvalidPasswordError('Please enter the password for this protected PDF.');
  }

  try {
    const bytes = base64ToUint8Array(base64);
    const decryptedBytes = await decryptPDF(bytes, password.trim());
    return uint8ArrayToBase64(decryptedBytes);
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    const msg = errorObj?.message || '';
    if (
      msg.includes('Incorrect password') ||
      msg.includes('does not match') ||
      msg.includes('password')
    ) {
      throw new PdfInvalidPasswordError(
        'Incorrect password. Bank statements are typically protected with your Date of Birth (DDMMYYYY) or NID. Please try again.'
      );
    }
    throw new PdfStatementError(`Failed to unlock PDF: ${msg || 'Decryption failed'}`);
  }
}

/**
 * Sends a bank statement PDF in base64 to Gemini 1.5 Flash Multimodal API
 * and parses the structured transaction line items.
 * If the PDF is encrypted, it decrypts it using the provided password before sending to Gemini.
 */
export async function parseBankStatementPdf(
  base64Pdf: string,
  password?: string,
  timeoutMs = 60000
): Promise<StatementExtractionResult> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new PdfStatementError(
      'Bank statement parsing is not configured yet. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.'
    );
  }

  if (!base64Pdf || base64Pdf.length < 50) {
    throw new PdfStatementError('The selected file appears to be empty or corrupted.');
  }

  // 1. Check if the PDF is password-protected
  const encrypted = await isPdfEncrypted(base64Pdf);
  let preparedPdfBase64 = base64Pdf;

  if (encrypted) {
    if (!password || !password.trim()) {
      throw new PdfPasswordRequiredError(
        'This bank statement is password-protected. Please enter your password to unlock and analyze transactions.'
      );
    }
    preparedPdfBase64 = await decryptPdfBase64(base64Pdf, password);
  }

  try {
    const { response, model } = await generateGeminiContent({
      apiKey,
      models: GEMINI_STATEMENT_MODELS,
      timeoutMs,
      body: {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Extract all bank statement transactions from this PDF according to the defined schema.',
              },
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: preparedPdfBase64,
                },
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          response_mime_type: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[pdfStatementService] Gemini error (${model}):`, response.status, errBody);
      throw new PdfStatementError('Could not process the bank statement with Gemini API.');
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const rawText = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => p.text ?? '').join('')
      : '';

    let parsedJson: Record<string, unknown>;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      console.error('[pdfStatementService] Failed to parse JSON response:', rawText);
      throw new PdfStatementError('The AI returned an invalid response structure.');
    }

    const bankName =
      typeof parsedJson.bank_name === 'string' && parsedJson.bank_name.trim()
        ? parsedJson.bank_name.trim()
        : 'Bank Statement';

    const period =
      typeof parsedJson.statement_period === 'string' ? parsedJson.statement_period.trim() : undefined;

    const rawTxs = Array.isArray(parsedJson.transactions) ? parsedJson.transactions : [];

    let totalDebit = 0;
    let totalCredit = 0;

    const transactions: ExtractedStatementTransaction[] = rawTxs
      .map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;

        const originalType = obj.type === 'credit' ? 'credit' : 'debit';
        const type: TransactionType = originalType === 'credit' ? 'income' : 'expense';
        const amount = sanitizeAmount(obj.amount);
        if (amount <= 0) return null;

        const description =
          typeof obj.description === 'string' && obj.description.trim()
            ? obj.description.trim()
            : `${type === 'income' ? 'Deposit' : 'Expense'} #${idx + 1}`;

        const date = sanitizeDate(obj.date);
        const category = sanitizeCategory(obj.category, type);

        if (type === 'income') totalCredit += amount;
        else totalDebit += amount;

        return {
          id: `stmt-tx-${idx}-${Date.now()}`,
          date,
          description,
          type,
          amount,
          category,
          selected: true, // Default checked for human-in-the-loop review
          originalType,
        };
      })
      .filter((tx): tx is ExtractedStatementTransaction => tx !== null);

    if (transactions.length === 0) {
      throw new PdfStatementError(
        'No transactions could be detected in this PDF. Please verify it is an account statement with a transaction table.'
      );
    }

    return {
      bankName,
      period,
      transactions,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
    };
  } catch (error) {
    if (error instanceof PdfStatementError) throw error;
    if (error instanceof GeminiAllRateLimitedError) {
      throw new PdfStatementError(
        'Gemini API quota exhausted or rate limit reached. Please try again in a few moments.'
      );
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new PdfStatementError('Statement parsing timed out. Please try a smaller PDF.');
    }
    console.error('[pdfStatementService] Unexpected error:', error);
    throw new PdfStatementError('Failed to parse bank statement PDF. Please try again.');
  }
}
