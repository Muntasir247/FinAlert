import { TRANSACTION_CATEGORIES, INCOME_CATEGORIES } from '../lib/transactionCategories';
import { generateGeminiContent, GeminiAllRateLimitedError, DEFAULT_GEMINI_MODELS } from './geminiClient';
import { isGroqConfigured, generateGroqJsonContent } from './groqClient';
import { AiErrorCode, classifyAiError, formatAiErrorString } from './aiError';

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

const MAX_AMOUNT = 1_000_000_000;

const EXPENSE_CATEGORIES = TRANSACTION_CATEGORIES.map((c) => c.label).join(', ');
const INCOME_CATEGORY_LIST = INCOME_CATEGORIES.map((c) => c.label).join(', ');

const SYSTEM_INSTRUCTION = `You are the voice parser for a personal finance app used in Bangladesh (currency BDT/taka).

Convert the user's spoken request into ONE structured action. The user may speak in English, Bangla (Bengali), or Banglish (Bangla written in English letters, e.g. "khawr khoori khoroch").

Rules:
- If money was spent, action is ADD_EXPENSE. Choose the closest expense category from this exact list: ${EXPENSE_CATEGORIES}.
- If money was received/income (salary, wages, earnings, etc.), action is ADD_INCOME. Choose the closest income category from this exact list: ${INCOME_CATEGORY_LIST}.
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

export class VoiceIntentError extends Error {
  public code: AiErrorCode;

  constructor(message: string, code: AiErrorCode = 'AI_ERR_UNKNOWN') {
    const formatted = message.startsWith('[AI_ERR_') ? message : formatAiErrorString(code, message);
    super(formatted);
    this.name = 'VoiceIntentError';
    this.code = code;
  }
}

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

const INCOME_CATEGORY_LABELS = INCOME_CATEGORIES.map((c) => c.label);
const EXPENSE_CATEGORY_LABELS = TRANSACTION_CATEGORIES.map((c) => c.label);

// Coerce the parsed category to the app's exact list for the action's type so a
// prefilled transaction always matches a real category tile. Falls back to
// "Other", which exists in both expense and income lists.
const sanitizeCategory = (value: unknown, action: VoiceIntentAction): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const list = action === 'ADD_INCOME' ? INCOME_CATEGORY_LABELS : EXPENSE_CATEGORY_LABELS;
  // Case-insensitive match so the prefilled category always lands on a real
  // category tile (and therefore the right budget limit), even if the AI
  // returns a differently-cased label.
  return list.find((label) => label.toLowerCase() === trimmed.toLowerCase()) ?? 'Other';
};

/**
 * Validates, normalizes, and sanitizes the parsed raw JSON from the AI engine.
 */
function buildVoiceIntentFromParsed(parsed: Record<string, unknown>): VoiceIntent {
  if (!isValidAction(parsed.action)) {
    throw new VoiceIntentError('Could not understand that command. Please try again.');
  }

  return {
    action: parsed.action,
    amount: toNumber(parsed.amount),
    category: sanitizeCategory(parsed.category, parsed.action),
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
}

/**
 * Sends the transcribed text to Groq (if configured) or Gemini, returning a structured VoiceIntent.
 * Leverages Groq for ultra-low-latency (~200ms) parsing with automatic fallback to Gemini.
 */
export async function parseVoiceIntent(
  text: string,
  timeoutMs = 25000
): Promise<VoiceIntent> {
  const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const groqAvailable = isGroqConfigured();

  if (!geminiApiKey && !groqAvailable) {
    throw new VoiceIntentError(
      'Voice assistant is not configured yet. Add EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_GROQ_API_KEY to your .env file.',
      'AI_ERR_NO_KEY'
    );
  }

  // 1. Try Groq fast path first if configured (~200ms response time)
  if (groqAvailable) {
    try {
      const { data } = await generateGroqJsonContent<Record<string, unknown>>({
        systemPrompt: SYSTEM_INSTRUCTION,
        userPrompt: text,
        timeoutMs: Math.min(8000, timeoutMs),
        perModelTimeoutMs: 4000,
      });

      if (data && typeof data === 'object') {
        return buildVoiceIntentFromParsed(data);
      }
    } catch (groqErr) {
      console.warn('[voiceIntentService] Groq fast-path failed or rate-limited, falling back to Gemini:', groqErr);
    }
  }

  // 2. Fall back to Gemini API
  if (!geminiApiKey) {
    throw new VoiceIntentError(
      'Voice AI failed on Groq and Gemini API key is not configured.',
      'AI_ERR_NO_KEY'
    );
  }

  try {
    const { response } = await generateGeminiContent({
      apiKey: geminiApiKey,
      models: DEFAULT_GEMINI_MODELS,
      timeoutMs,
      perModelTimeoutMs: 7000,
      body: {
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
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Gemini error:', response.status, body);
      const classified = classifyAiError(`Gemini error ${response.status}: ${body}`, 'gemini');
      throw new VoiceIntentError(classified.message, classified.code);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return buildVoiceIntentFromParsed(parsed);
  } catch (error) {
    if (error instanceof VoiceIntentError) throw error;
    const classified = classifyAiError(error, 'all');
    console.error(`[voiceIntentService] [${classified.code}] Voice parsing failed:`, error);
    throw new VoiceIntentError(classified.message, classified.code);
  }
}
