import { TRANSACTION_CATEGORIES } from '../lib/transactionCategories';

export type VoiceIntentAction =
  | 'ADD_EXPENSE'
  | 'ADD_INCOME'
  | 'CREATE_SAVINGS_GOAL'
  | 'ADD_SAVINGS_CONTRIBUTION'
  | 'SET_BUDGET_LIMIT'
  | 'UNKNOWN';

export interface VoiceIntent {
  action: VoiceIntentAction;
  amount?: number;
  category?: string;
  goal_name?: string;
  description?: string;
  target_amount?: number;
}

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

const MAX_AMOUNT = 1_000_000_000;

const EXPENSE_CATEGORIES = TRANSACTION_CATEGORIES.map((c) => c.label).join(', ');

const SYSTEM_INSTRUCTION = `You are the voice parser for a personal finance app used in Bangladesh (currency BDT/taka).

Convert the user's spoken request into ONE structured action. The user may speak in English, Bangla (Bengali), or Banglish (Bangla written in English letters, e.g. "khawr khoori khoroch").

Rules:
- If money was spent, action is ADD_EXPENSE. Choose the closest expense category from this exact list: ${EXPENSE_CATEGORIES}.
- If money was received/income (salary, wages, earnings, etc.), action is ADD_INCOME with category "Salary" (or a fitting income category).
- If a new savings goal is mentioned (saving for something, want to save, target), action is CREATE_SAVINGS_GOAL. Capture the goal_name (e.g. "Trip to Cox's Bazar") and target_amount if stated.
- If adding money to an existing savings goal (add/save X to goal), action is ADD_SAVINGS_CONTRIBUTION. Capture goal_name and amount.
- If setting/updating a monthly budget limit, action is SET_BUDGET_LIMIT. Capture amount.
- If the request is unrelated or unclear, action is UNKNOWN.
- Always use the app's exact category labels when filling "category".
- "description" should be a short human-friendly summary of the transaction (keep the original language).
- "amount" and "target_amount" must be the amount as a plain number string with digits only (e.g. "500", "5000.50"). Convert Bangla digits or written-out words to standard digits.

Respond with JSON only.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    action: {
      type: 'STRING',
      enum: [
        'ADD_EXPENSE',
        'ADD_INCOME',
        'CREATE_SAVINGS_GOAL',
        'ADD_SAVINGS_CONTRIBUTION',
        'SET_BUDGET_LIMIT',
        'UNKNOWN',
      ],
    },
    amount: { type: 'STRING' },
    category: { type: 'STRING' },
    goal_name: { type: 'STRING' },
    description: { type: 'STRING' },
    target_amount: { type: 'STRING' },
  },
  required: ['action'],
};

export class VoiceIntentError extends Error {}

const isValidAction = (value: unknown): value is VoiceIntentAction =>
  typeof value === 'string' &&
  [
    'ADD_EXPENSE',
    'ADD_INCOME',
    'CREATE_SAVINGS_GOAL',
    'ADD_SAVINGS_CONTRIBUTION',
    'SET_BUDGET_LIMIT',
    'UNKNOWN',
  ].includes(value);

const toNumber = (value: unknown): number | undefined => {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    n = Number.parseFloat(value);
  } else {
    return undefined;
  }
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return undefined;
  return Math.round(n * 100) / 100;
};

/**
 * Sends the transcribed text to Gemini 3.5 Flash and returns a structured
 * VoiceIntent. Throws VoiceIntentError with a user-friendly message when the
 * key is missing, the network fails, or the model output cannot be parsed.
 */
export async function parseVoiceIntent(
  text: string,
  timeoutMs = 15000
): Promise<VoiceIntent> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new VoiceIntentError(
      'Voice assistant is not configured yet. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          response_mime_type: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Gemini error:', response.status, body);
      if (response.status === 429) {
        throw new VoiceIntentError(
          'Voice AI limit reached. Please try again later or check your API quota.'
        );
      }
      throw new VoiceIntentError('The voice assistant could not reach its AI backend.');
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (!isValidAction(parsed.action)) {
      throw new VoiceIntentError('Could not understand that command. Please try again.');
    }

    return {
      action: parsed.action,
      amount: toNumber(parsed.amount),
      category:
        typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : undefined,
      goal_name:
        typeof parsed.goal_name === 'string' && parsed.goal_name.trim()
          ? parsed.goal_name.trim()
          : undefined,
      description:
        typeof parsed.description === 'string' && parsed.description.trim()
          ? parsed.description.trim()
          : undefined,
      target_amount: toNumber(parsed.target_amount),
    };
  } catch (error) {
    if (error instanceof VoiceIntentError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new VoiceIntentError('The voice assistant took too long. Please try again.');
    }
    console.error('parseVoiceIntent failed:', error);
    throw new VoiceIntentError('Could not process that request. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}
