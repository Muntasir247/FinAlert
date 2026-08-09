import { TRANSACTION_CATEGORIES } from '../lib/transactionCategories';
import { generateGeminiContent, GeminiAllRateLimitedError } from './geminiClient';

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface ReceiptData {
  merchant: string;
  date?: string;
  total: number;
  category: string;
  items: ReceiptItem[];
}

/**
 * Models tried in order. Flash-Lite offers higher free-tier rate limits, so it
 * is preferred; if it is rate limited (429) the next model is tried
 * automatically.
 */
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-3.6-flash',
];

const MAX_AMOUNT = 1_000_000_000;

const EXPENSE_CATEGORIES = TRANSACTION_CATEGORIES.map((c) => c.label).join(', ');

const SYSTEM_INSTRUCTION = `You are the receipt scanner for a personal finance app used in Bangladesh (currency BDT/taka).

The user sends a photo of a receipt, invoice, or purchase slip. Extract:

- merchant: the store/shop name shown on the receipt.
- date: the purchase date in YYYY-MM-DD format if present, otherwise an empty string.
- total: the final amount paid, as a plain digit string (e.g. "1250" or "1250.50").
- category: ONE best-fit category from this exact list: ${EXPENSE_CATEGORIES}.
- items: the purchased line items. Each item has "name" (the product/service, e.g. "Rice 2kg") and "price" (a plain digit string). If individual line items are not readable, return a single item with name equal to the merchant and price equal to the total.

Rules:
- Use the app's exact category labels only. If unsure, use "Other".
- Convert Bangla digits or written-out words to standard digits.
- "price" and "total" must be plain digit strings with optional decimal point, no currency symbols or thousands separators.
- If the image is not a receipt/document, set merchant to an empty string, total to "0", and items to an empty array.

Respond with JSON only.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    merchant: { type: 'STRING' },
    date: { type: 'STRING' },
    total: { type: 'STRING' },
    category: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          price: { type: 'STRING' },
        },
        required: ['name', 'price'],
      },
    },
  },
  required: ['merchant', 'total'],
};

export class ReceiptError extends Error {}

const CATEGORY_LABELS = TRANSACTION_CATEGORIES.map((c) => c.label);

const toAmount = (value: unknown): number | undefined => {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    n = Number.parseFloat(value.replace(/,/g, ''));
  } else {
    return undefined;
  }
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return undefined;
  return Math.round(n * 100) / 100;
};

const sanitizeCategory = (value: unknown): string => {
  if (typeof value !== 'string') return 'Other';
  const trimmed = value.trim();
  if (!trimmed) return 'Other';
  const lower = trimmed.toLowerCase();
  // Case-insensitive match so an AI label like "shopping" or "SHOPPING" still
  // lands in the app's exact "Shopping" category and counts toward that
  // budget limit (strict matching silently rerouted these to "Other").
  return CATEGORY_LABELS.find((label) => label.toLowerCase() === lower) ?? 'Other';
};

const sanitizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${y}-${m}-${d}`;
};

/**
 * Sends a receipt image to Gemini Flash-Lite and returns structured ReceiptData.
 * Throws ReceiptError with a user-friendly message when the key is missing,
 * the network fails, or the model output cannot be parsed.
 */
export async function parseReceiptFromImage(
  base64Image: string,
  mimeType = 'image/jpeg',
  timeoutMs = 30000
): Promise<ReceiptData> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new ReceiptError(
      'Receipt scanning is not configured yet. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.'
    );
  }

  try {
    const { response } = await generateGeminiContent({
      apiKey,
      models: GEMINI_MODELS,
      timeoutMs,
      body: {
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Extract the receipt information from this image.' },
              { inline_data: { mime_type: mimeType, data: base64Image } },
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
      const body = await response.text();
      console.error('Gemini receipt error:', response.status, body);
      throw new ReceiptError('Could not reach the scanning AI backend.');
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const merchant = typeof parsed.merchant === 'string' ? parsed.merchant.trim() : '';
    const total = toAmount(parsed.total) ?? 0;
    const category = sanitizeCategory(parsed.category);
    const date = sanitizeDate(parsed.date);
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    const items: ReceiptItem[] = rawItems
      .map((it) => {
        if (typeof it !== 'object' || it === null) return null;
        const obj = it as Record<string, unknown>;
        const name = typeof obj.name === 'string' ? obj.name.trim() : '';
        const price = toAmount(obj.price);
        if (!name || price === undefined) return null;
        return { name, price };
      })
      .filter((it): it is ReceiptItem => it !== null);

    if (items.length === 0 && total > 0) {
      items.push({ name: merchant || 'Receipt', price: total });
    }

    if (total <= 0) {
      throw new ReceiptError(
        'Could not read a total from that image. Please try a clearer photo.'
      );
    }

    return { merchant, date, total, category, items };
  } catch (error) {
    if (error instanceof ReceiptError) throw error;
    if (error instanceof GeminiAllRateLimitedError) {
      throw new ReceiptError(
        'Scanning AI limit reached. Please try again later or check your API quota.'
      );
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ReceiptError('Scanning took too long. Please try again.');
    }
    console.error('parseReceiptFromImage failed:', error);
    throw new ReceiptError('Could not process that receipt. Please try again.');
  }
}
