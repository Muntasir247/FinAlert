import * as SecureStore from 'expo-secure-store';
import {
  getSpendingAnalytics,
  type SpendingAnalyticsSummary,
} from './spendingAnalyticsService';
import {
  generateGeminiContent,
  DEFAULT_GEMINI_MODELS,
} from './geminiClient';
import { isGroqConfigured, generateGroqJsonContent } from './groqClient';
import { AiErrorCode, classifyAiError } from './aiError';
import type { Transaction } from '../lib/transactions';
import type { SavingsGoal } from '../lib/savingsGoals';

export interface FinancialInsight {
  headline: string;
  short_summary: string;
  detailed_advice: string;
  actionable_tips: string[];
  severity: 'positive' | 'warning' | 'info';
  timestamp: number;
  isCached: boolean;
  stateSignature: string;
  errorCode?: AiErrorCode;
}

export interface GetInsightOptions {
  forceRefresh?: boolean;
  inMemoryTransactions?: Transaction[];
  inMemoryGoals?: SavingsGoal[];
}

const STORAGE_KEY_INSIGHT = '@finalert_ai_financial_insight';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours cache
const MIN_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes manual cooldown

const SYSTEM_INSTRUCTION = `You are FinAlert's elite personal financial AI advisor for users in Bangladesh (currency BDT/৳ Taka).
Analyze the user's spending habits, burn rate, and savings goals over the past 30 days.

Rules:
1. Identify the SINGLE most noteworthy financial pattern, anomaly, or positive habit.
2. If spending in discretionary categories (Food & Dining, Shopping, Entertainment) spiked, use severity 'warning'.
3. If the user saved >= 20% of their income or progressed on savings goals, use severity 'positive'.
4. Otherwise, use severity 'info'.
5. "headline": Punchy, maximum 7 words (e.g., "Dining Out Spiked This Month", "Great Savings Rate in Grocery").
6. "short_summary": Maximum 16 words tailored for a mobile dashboard banner (e.g., "Food took 42% of total expenses. Tap for ways to optimize.").
7. "detailed_advice": 2-3 friendly, constructive sentences explaining the impact on their monthly finances and future savings goals.
8. "actionable_tips": Array of 2 to 3 hyper-practical, culturally relevant tips for Bangladesh (e.g. bKash/Nagad/Rocket/Upay grocery cashback deals, cook at home 2 days/week, bulk shopping in local bazaar, carpool/Pathao split).

Respond with valid JSON only.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    short_summary: { type: 'STRING' },
    detailed_advice: { type: 'STRING' },
    actionable_tips: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    severity: {
      type: 'STRING',
      enum: ['positive', 'warning', 'info'],
    },
  },
  required: ['headline', 'short_summary', 'detailed_advice', 'actionable_tips', 'severity'],
};

/**
 * Safe wrapper for SecureStore getItem to guarantee it never hangs.
 */
async function safeSecureStoreGet(key: string, timeoutMs = 1200): Promise<string | null> {
  try {
    const promise = SecureStore.getItemAsync(key);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    return await Promise.race([promise, timeout]);
  } catch (err) {
    console.warn('[aiInsightService] SecureStore get error:', err);
    return null;
  }
}

/**
 * Safe wrapper for SecureStore setItem to guarantee it never hangs.
 */
async function safeSecureStoreSet(key: string, value: string, timeoutMs = 1200): Promise<void> {
  try {
    const promise = SecureStore.setItemAsync(key, value);
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([promise, timeout]);
  } catch (err) {
    console.warn('[aiInsightService] SecureStore set error:', err);
  }
}

/**
 * Deterministic rule-based fallback that intelligently handles:
 * - 0 transactions (brand new users)
 * - 1 transaction (immediate first-expense congratulations & category tracking)
 * - 2 transactions (building momentum across categories)
 * - 3+ transactions when offline or rate-limited
 *
 * Consumes 0 API credits and computes in 0ms.
 */
export function buildFallbackInsight(
  analytics: SpendingAnalyticsSummary,
  reason: 'new_user' | 'offline_or_limited' = 'new_user',
  errorCode?: AiErrorCode
): FinancialInsight {
  const now = Date.now();
  const txCount = analytics.transactionCount;

  // CASE 1: Brand New User (0 Transactions)
  if (txCount === 0 || !analytics.hasHistoricalData) {
    return {
      headline: 'Welcome to FinAlert AI',
      short_summary: 'Tap to chat with your AI assistant and explore smart budgeting tips.',
      detailed_advice:
        'FinAlert AI is your personal financial co-pilot in Bangladesh. Start logging expenses via voice, receipt scan, or manual entry to unlock intelligent spending trends and alerts.',
      actionable_tips: [
        'Use the Voice mic button on the home screen for 1-second hands-free expense entry.',
        'Snap paper receipts or invoices with the scanner to auto-extract line items.',
        'Tap this card anytime to chat with FinAlert AI about personal budgeting.',
      ],
      severity: 'info',
      timestamp: now,
      isCached: false,
      stateSignature: 'fallback_0tx_new_user',
      errorCode,
    };
  }

  // CASE 2: Exactly 1 Transaction
  if (txCount === 1) {
    const isIncomeOnly = analytics.totalExpense === 0 && analytics.totalIncome > 0;
    if (isIncomeOnly) {
      return {
        headline: `Income Logged: ৳${analytics.totalIncome.toLocaleString()}`,
        short_summary: `Recorded ৳${analytics.totalIncome.toLocaleString()} income. Tap to set savings targets or budget limits.`,
        detailed_advice: `You've recorded your first income of ৳${analytics.totalIncome.toLocaleString()}. Setting a category budget now will allocate your funds before spending begins.`,
        actionable_tips: [
          'Set up monthly spending budgets in the Budgets tab to pace your expenses.',
          'Create a savings goal to automatically stash away at least 20% of your earnings.',
          'Tap this card to chat with FinAlert AI about allocating your budget.',
        ],
        severity: 'positive',
        timestamp: now,
        isCached: false,
        stateSignature: `fallback_1tx_income_${analytics.totalIncome}`,
        errorCode,
      };
    }

    const topCat = analytics.topCategories[0] || 'General';
    const spent = analytics.totalExpense > 0 ? analytics.totalExpense : analytics.totalIncome;

    return {
      headline: `First Expense: ৳${spent.toLocaleString()} in ${topCat}`,
      short_summary: `Tracked ৳${spent.toLocaleString()} in ${topCat}. Tap to chat or set a budget for this category.`,
      detailed_advice: `Great job taking the first step in tracking your personal finances! Tracking everyday expenses in real-time is the easiest way to prevent month-end cash crunches in Bangladesh.`,
      actionable_tips: [
        `Set a category budget for ${topCat} in the Budgets tab to keep spending in check.`,
        'Tap this card to ask FinAlert AI how to plan your remaining budget this month.',
        'Log recurring transport or food expenses using the voice mic on the home screen.',
      ],
      severity: 'positive',
      timestamp: now,
      isCached: false,
      stateSignature: `fallback_1tx_${spent}_${topCat}`,
      errorCode,
    };
  }

  // CASE 3: Exactly 2 Transactions
  if (txCount === 2) {
    const topCat = analytics.topCategories[0] || 'General';
    const secondCat = analytics.topCategories[1];
    const spent = analytics.totalExpense;

    const categoriesText = secondCat ? `${topCat} and ${secondCat}` : topCat;

    return {
      headline: `৳${spent.toLocaleString()} Tracked Across 2 Expenses`,
      short_summary: `Activity noted in ${categoriesText}. Tap to review budgets or chat with AI.`,
      detailed_advice: `You've logged 2 transactions totaling ৳${spent.toLocaleString()}. You are building a consistent tracking habit. As you add more expenses, FinAlert AI will unlock deep monthly burn-rate projections.`,
      actionable_tips: [
        `Check your ${topCat} spending to make sure it aligns with your monthly expectations.`,
        'Ask FinAlert AI: "Can I afford to spend ৳1,500 more this week?"',
        'Set an emergency fund goal in the Savings Goals carousel.',
      ],
      severity: 'positive',
      timestamp: now,
      isCached: false,
      stateSignature: `fallback_2tx_${spent}_${topCat}`,
      errorCode,
    };
  }

  // CASE 4: 3+ Transactions (Offline or Rule-Based Fallback)
  const topCat = analytics.categories.find((c) => c.category === analytics.topCategories[0]);
  const isHighSpend = topCat && topCat.percentageOfTotalExpense >= 35;

  if (isHighSpend && topCat) {
    return {
      headline: `${topCat.category} Dominates Spending`,
      short_summary: `${topCat.category} represents ${Math.round(topCat.percentageOfTotalExpense)}% of total expenses. Tap for tips.`,
      detailed_advice: `You spent ৳${topCat.totalSpent.toLocaleString()} on ${topCat.category} over the last 30 days. Keeping major categories below 30% helps accelerate your savings targets.`,
      actionable_tips: [
        `Review recurring ${topCat.category.toLowerCase()} transactions to identify non-essential spending.`,
        'Set a monthly category budget limit in the Budgets tab to track weekly burn rate.',
        'Allocate the trimmed difference directly to your active savings goals.',
      ],
      severity: 'warning',
      timestamp: now,
      isCached: true,
      stateSignature: 'fallback_rule_based',
      errorCode,
    };
  }

  return {
    headline: 'Healthy Financial Balance',
    short_summary: `You saved ${analytics.netSavingsRate}% of your recorded income over the past 30 days.`,
    detailed_advice: `Your average monthly burn rate is ৳${analytics.averageMonthlyExpense.toLocaleString()}. Balanced spending across essentials keeps your financial health resilient.`,
    actionable_tips: [
      'Maintain an emergency fund covering at least 3 months of basic household expenses.',
      'Check your active savings goal progress at the end of each week.',
    ],
    severity: analytics.netSavingsRate >= 20 ? 'positive' : 'info',
    timestamp: now,
    isCached: true,
    stateSignature: 'fallback_rule_based',
    errorCode,
  };
}

/**
 * Creates a unique state signature based on user transactions and 12-hour epoch.
 * If transactions have not changed, identical requests never invoke the Gemini/Groq API.
 */
function computeStateSignature(userId: string, analytics: SpendingAnalyticsSummary): string {
  const epoch12h = Math.floor(Date.now() / CACHE_TTL_MS);
  return `${userId}_${analytics.transactionCount}_${analytics.totalExpense}_${analytics.totalIncome}_${epoch12h}`;
}

/**
 * Fetches the user's current AI Financial Insight.
 *
 * Reliability & Speed Guarantees:
 * 1. Immediate resolution (0ms) for 0, 1, or 2 transactions using smart local analytics.
 * 2. Checks SecureStore persistent cache. If signature matches and TTL is valid, returns immediately.
 * 3. Tries ultra-fast Groq LPU first (~200ms), falling back to Gemini Flash.
 * 4. Never gets stuck in loading: bounded by strict timeouts and comprehensive fallbacks.
 */
export async function getFinancialInsight(
  userId?: string | null,
  options?: GetInsightOptions
): Promise<FinancialInsight> {
  const forceRefresh = options?.forceRefresh ?? false;
  const inMemory = options?.inMemoryTransactions;

  // 1. Instant 0ms Fast-Path for 0, 1, or 2 transactions (no API calls, no hanging)
  if (inMemory && inMemory.length <= 2) {
    const analytics = await getSpendingAnalytics(userId, 30, inMemory, options?.inMemoryGoals);
    return buildFallbackInsight(analytics, 'new_user');
  }

  // If no userId and no in-memory transactions, immediately return new user insight
  if (!userId && (!inMemory || inMemory.length === 0)) {
    const emptyAnalytics = await getSpendingAnalytics(null, 30);
    return buildFallbackInsight(emptyAnalytics, 'new_user');
  }

  const effectiveId = userId || 'local_user';

  // 2. Load Spending Analytics (30-day window)
  const analytics = await getSpendingAnalytics(effectiveId, 30, inMemory, options?.inMemoryGoals);

  // If user has 0, 1, or 2 transactions discovered from DB, return tailored local insight immediately
  if (!analytics.hasHistoricalData || analytics.transactionCount < 3) {
    return buildFallbackInsight(analytics, 'new_user');
  }

  const currentSignature = computeStateSignature(effectiveId, analytics);

  // 3. Check persistent cache in SecureStore (with safe timeout wrapper)
  try {
    const rawCache = await safeSecureStoreGet(STORAGE_KEY_INSIGHT, 1000);
    if (rawCache) {
      const cached: FinancialInsight = JSON.parse(rawCache);
      const isFresh = Date.now() - cached.timestamp < CACHE_TTL_MS;
      const signatureMatches = cached.stateSignature === currentSignature;
      const cooldownActive = Date.now() - cached.timestamp < MIN_REFRESH_INTERVAL_MS;

      if (!forceRefresh && (isFresh || signatureMatches)) {
        return { ...cached, isCached: true };
      }

      if (forceRefresh && cooldownActive) {
        return { ...cached, isCached: true };
      }
    }
  } catch (err) {
    console.warn('[aiInsightService] Cache read error:', err);
  }

  // 4. Prepare payload for AI processing
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const groqAvailable = isGroqConfigured();
  if (!apiKey && !groqAvailable) {
    return buildFallbackInsight(analytics, 'offline_or_limited', 'AI_ERR_NO_KEY');
  }

  const topCatsFormatted = analytics.categories
    .filter((c) => c.totalSpent > 0)
    .slice(0, 3)
    .map((c) => `${c.category}: ৳${c.totalSpent} (${c.percentageOfTotalExpense}%)`)
    .join(', ');

  const goalsFormatted =
    analytics.savingsGoals.goals.length > 0
      ? `${analytics.savingsGoals.goals.length} active goals (${analytics.savingsGoals.goals.map((g) => `${g.name}: ${g.percentage}%`).join(', ')})`
      : 'No active savings goals';

  const userPrompt = `USER SPENDING METRICS (PAST 30 DAYS):
- Total Income: ৳${analytics.totalIncome}
- Total Expense: ৳${analytics.totalExpense}
- Net Savings Rate: ${analytics.netSavingsRate}%
- Top Categories: ${topCatsFormatted || 'General'}
- Savings Goals: ${goalsFormatted}

Generate 1 clear insight, short mobile summary, detailed reasoning, and 2-3 actionable Bangladesh financial tips.`;

  // 5. Try Groq fast path if configured (~200ms)
  if (groqAvailable) {
    try {
      const { data } = await generateGroqJsonContent<Record<string, unknown>>({
        systemPrompt: `${SYSTEM_INSTRUCTION}\nReturn JSON strictly matching schema:\n${JSON.stringify(RESPONSE_SCHEMA)}`,
        userPrompt,
        timeoutMs: 6000,
        perModelTimeoutMs: 3500,
      });

      if (data && typeof data === 'object') {
        const result = parseFinancialInsightJson(data, currentSignature);
        safeSecureStoreSet(STORAGE_KEY_INSIGHT, JSON.stringify(result)).catch(() => {});
        return result;
      }
    } catch (groqErr) {
      console.warn('[aiInsightService] Groq insight failed, trying Gemini:', groqErr);
    }
  }

  // 6. Fall back to Gemini API
  if (!apiKey) {
    return buildFallbackInsight(analytics, 'offline_or_limited', 'AI_ERR_NO_KEY');
  }

  try {
    const { response } = await generateGeminiContent({
      apiKey,
      models: DEFAULT_GEMINI_MODELS,
      timeoutMs: 8000,
      perModelTimeoutMs: 4000,
      body: {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig: {
          response_mime_type: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      },
    });

    if (!response.ok) {
      console.warn('[aiInsightService] Gemini returned non-ok status:', response.status);
      const classified = classifyAiError(`Gemini status ${response.status}`, 'gemini');
      return buildFallbackInsight(analytics, 'offline_or_limited', classified.code);
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      return buildFallbackInsight(analytics, 'offline_or_limited', 'AI_ERR_PARSE');
    }

    const parsed = JSON.parse(raw);
    const result = parseFinancialInsightJson(parsed, currentSignature);
    safeSecureStoreSet(STORAGE_KEY_INSIGHT, JSON.stringify(result)).catch(() => {});
    return result;
  } catch (error) {
    const classified = classifyAiError(error, 'gemini');
    console.warn(`[aiInsightService] [${classified.code}] Insight generation failed:`, error);
    return buildFallbackInsight(analytics, 'offline_or_limited', classified.code);
  }
}

function parseFinancialInsightJson(
  parsed: any,
  currentSignature: string
): FinancialInsight {
  return {
    headline: String(parsed?.headline || 'Spending Insight').trim(),
    short_summary: String(parsed?.short_summary || 'Tap to view your latest financial insight.').trim(),
    detailed_advice: String(parsed?.detailed_advice || '').trim(),
    actionable_tips: Array.isArray(parsed?.actionable_tips)
      ? parsed.actionable_tips.map((t: unknown) => String(t).trim()).filter(Boolean)
      : [],
    severity: ['positive', 'warning', 'info'].includes(parsed?.severity)
      ? parsed.severity
      : 'info',
    timestamp: Date.now(),
    isCached: false,
    stateSignature: currentSignature,
  };
}
