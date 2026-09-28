import { generateGeminiContent, GeminiAllRateLimitedError } from './geminiClient';
import type { SpendingAnalyticsSummary } from './spendingAnalyticsService';

export interface AiCategoryAllocation {
  category: string;
  percentage_of_budget: number;
  allocated_amount: number;
  reasoning: string;
}

export interface AiBudgetInsight {
  headline: string;
  reasoning: string;
  tips: string[];
}

export interface AiBudgetRecommendation {
  monthly_income: number;
  savings_target_percentage: number;
  total_spending_budget: number;
  category_allocations: AiCategoryAllocation[];
  insight: AiBudgetInsight;
  isFallback: boolean;
}

const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.5-flash',
  'gemini-3.5-flash',
];

const STANDARD_CATEGORIES = [
  'Bills & Utilities',
  'Food & Dining',
  'Grocery',
  'Transport',
  'Health',
  'Shopping',
  'Entertainment',
  'Other',
];

const SYSTEM_INSTRUCTION = `You are an elite personal financial advisor and AI budget planner for a personal finance app in Bangladesh (currency BDT / ৳ Taka).

Your mission is to construct an intelligent, realistic, and personalized monthly budget plan based on the user's past spending behavior, income, and active savings goals.

Guidelines:
1. Balance realistic habits with smart financial discipline. If a user spends heavily on Food & Dining or Shopping, don't unrealistically slash it to 2%; instead gently optimize/trim it (e.g. from 28% to 20%) to free up savings for their stated goals.
2. The category allocations MUST cover exactly these 8 categories:
   - "Bills & Utilities"
   - "Food & Dining"
   - "Grocery"
   - "Transport"
   - "Health"
   - "Shopping"
   - "Entertainment"
   - "Other"
3. "percentage_of_budget" across all 8 categories MUST sum to 100%.
4. "allocated_amount" for each category must equal (total_spending_budget * percentage_of_budget / 100).
5. The insight reasoning should be empathetic, specific, and directly cite their actual numbers (e.g., "You averaged ৳12,000 on Food & Dining. By trimming 15%, you save an extra ৳1,800/month towards your 'Trip to Cox's Bazar' goal while leaving ample room for groceries.").
6. Include 2 to 3 actionable, high-impact tips suitable for life in Bangladesh (e.g., using bKash cashbacks, cooking at home on weekdays, rideshare pooling).

Respond with structured JSON strictly matching the response schema.`;

const BUDGET_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recommended_monthly_income: { type: 'NUMBER' },
    recommended_savings_percentage: { type: 'NUMBER' },
    recommended_spending_budget: { type: 'NUMBER' },
    category_allocations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING' },
          percentage_of_budget: { type: 'NUMBER' },
          allocated_amount: { type: 'NUMBER' },
          reasoning: { type: 'STRING' },
        },
        required: ['category', 'percentage_of_budget', 'allocated_amount', 'reasoning'],
      },
    },
    insight: {
      type: 'OBJECT',
      properties: {
        headline: { type: 'STRING' },
        reasoning: { type: 'STRING' },
        tips: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
      required: ['headline', 'reasoning', 'tips'],
    },
  },
  required: [
    'recommended_monthly_income',
    'recommended_savings_percentage',
    'recommended_spending_budget',
    'category_allocations',
    'insight',
  ],
};

/**
 * Generates a classical 50/30/20 starter budget plan when historical transaction
 * data is insufficient or when the Gemini API is unreachable.
 */
export function generateFallbackBudget(
  analytics: SpendingAnalyticsSummary,
  userGivenIncome?: number
): AiBudgetRecommendation {
  const income = userGivenIncome && userGivenIncome > 0
    ? userGivenIncome
    : analytics.averageMonthlyIncome > 0
    ? analytics.averageMonthlyIncome
    : 50000;

  const savingsPct = 20; // 20% savings target (50/30/20 rule)
  const spendingBudget = Math.round(income * (1 - savingsPct / 100));

  const defaultSplits: Record<string, { pct: number; reason: string }> = {
    'Bills & Utilities': { pct: 30, reason: 'Covers electricity (DESCO/DPDC), gas, water, and internet.' },
    'Food & Dining': { pct: 18, reason: 'Balanced allocation for daily meals and dining out.' },
    'Grocery': { pct: 12, reason: 'Core household provisions and essentials.' },
    'Transport': { pct: 8, reason: 'Daily commute via rideshare, CNG, or transit.' },
    'Health': { pct: 8, reason: 'Routine medical, pharmacy, and wellness buffer.' },
    'Shopping': { pct: 8, reason: 'Clothing, personal care, and periodic retail.' },
    'Entertainment': { pct: 6, reason: 'Movies, streaming services, and social outings.' },
    'Other': { pct: 10, reason: 'Miscellaneous buffer for unexpected expenses.' },
  };

  let allocatedSum = 0;
  const allocations: AiCategoryAllocation[] = STANDARD_CATEGORIES.map((cat, idx) => {
    const item = defaultSplits[cat];
    let amount = Math.round((spendingBudget * item.pct) / 100);
    if (idx === STANDARD_CATEGORIES.length - 1) {
      amount = Math.max(0, spendingBudget - allocatedSum);
    } else {
      allocatedSum += amount;
    }
    return {
      category: cat,
      percentage_of_budget: item.pct,
      allocated_amount: amount,
      reasoning: item.reason,
    };
  });

  return {
    monthly_income: income,
    savings_target_percentage: savingsPct,
    total_spending_budget: spendingBudget,
    category_allocations: allocations,
    insight: {
      headline: 'Balanced 50/30/20 Starter Budget',
      reasoning:
        'Based on the classic 50/30/20 rule (50% essentials, 30% lifestyle, 20% savings). As you track more expenses with bKash and receipt scanning, your recommendations will automatically personalize to your unique spending habits.',
      tips: [
        'Track daily expenses quickly via voice entry or automated bKash SMS sync.',
        'Aim to automate your 20% savings at the start of each month.',
        'Review your category limits every month to adjust for changes in income or lifestyle.',
      ],
    },
    isFallback: true,
  };
}

/**
 * Analyzes historical user spending metrics and calls Gemini 1.5 Flash
 * to generate a personalized, realistic smart budget plan.
 */
export async function generateSmartBudgetRecommendation(
  analytics: SpendingAnalyticsSummary,
  userGivenIncome?: number,
  timeoutMs = 30000
): Promise<AiBudgetRecommendation> {
  // If user has zero or too few expense records, gracefully use 50/30/20 baseline
  if (!analytics.hasHistoricalData || analytics.totalExpense <= 0) {
    return generateFallbackBudget(analytics, userGivenIncome);
  }

  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[aiBudgetService] Missing EXPO_PUBLIC_GEMINI_API_KEY, using fallback budget.');
    return generateFallbackBudget(analytics, userGivenIncome);
  }

  const incomeToUse =
    userGivenIncome && userGivenIncome > 0
      ? userGivenIncome
      : analytics.averageMonthlyIncome > 0
      ? analytics.averageMonthlyIncome
      : Math.round(analytics.averageMonthlyExpense * 1.25);

  // Format historical metrics for the prompt
  const categoryLines = analytics.categories
    .map(
      (c) =>
        `- ${c.category}: ৳${c.monthlyAverage.toLocaleString()}/mo (${c.percentageOfTotalExpense}% of total spend, ${c.transactionCount} transactions)`
    )
    .join('\n');

  const goalsLines =
    analytics.savingsGoals.goals.length > 0
      ? analytics.savingsGoals.goals
          .map((g) => `- "${g.name}": ৳${g.current.toLocaleString()} saved of ৳${g.target.toLocaleString()} (${g.percentage}%)`)
          .join('\n')
      : 'No active savings goals set up yet.';

  const userPrompt = `Generate a smart monthly budget plan for this user in Bangladesh:

USER FINANCIAL PROFILE:
- Specified/Estimated Monthly Income: ৳${incomeToUse.toLocaleString()}
- Past ${analytics.daysAnalyzed} Days Total Spending: ৳${analytics.totalExpense.toLocaleString()}
- Average Monthly Burn Rate: ৳${analytics.averageMonthlyExpense.toLocaleString()}
- Top Expense Categories: ${analytics.topCategories.join(', ') || 'N/A'}

HISTORICAL MONTHLY SPENDING BY CATEGORY:
${categoryLines}

ACTIVE SAVINGS GOALS:
${goalsLines}

Please provide an optimized monthly budget plan tailored to this user. Analyze where they are overspending, trim non-essentials responsibly, and allocate adequate funds for essentials and savings goals.`;

  try {
    const { response, model } = await generateGeminiContent({
      apiKey,
      models: GEMINI_MODELS,
      timeoutMs,
      body: {
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          response_mime_type: 'application/json',
          responseSchema: BUDGET_RESPONSE_SCHEMA,
        },
      },
    });

    if (!response.ok) {
      console.warn(`[aiBudgetService] Gemini request failed status ${response.status} (${model}), falling back.`);
      return generateFallbackBudget(analytics, incomeToUse);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : '';
    const parsed = JSON.parse(raw);

    const recommendedIncome =
      typeof parsed.recommended_monthly_income === 'number' && parsed.recommended_monthly_income > 0
        ? parsed.recommended_monthly_income
        : incomeToUse;

    const savingsPct =
      typeof parsed.recommended_savings_percentage === 'number' &&
      parsed.recommended_savings_percentage >= 5 &&
      parsed.recommended_savings_percentage <= 50
        ? Math.round(parsed.recommended_savings_percentage)
        : 20;

    const spendingBudget = Math.round(recommendedIncome * (1 - savingsPct / 100));

    // Map and sanitize category allocations
    const rawAllocations = Array.isArray(parsed.category_allocations) ? parsed.category_allocations : [];
    const allocMap = new Map<string, { pct: number; amount: number; reasoning: string }>();

    for (const item of rawAllocations) {
      if (!item || typeof item !== 'object') continue;
      const catName = typeof item.category === 'string' ? item.category.trim() : '';
      const matched = STANDARD_CATEGORIES.find((sc) => sc.toLowerCase() === catName.toLowerCase());
      if (matched) {
        allocMap.set(matched, {
          pct: Number(item.percentage_of_budget) || 0,
          amount: Number(item.allocated_amount) || 0,
          reasoning: typeof item.reasoning === 'string' ? item.reasoning.trim() : '',
        });
      }
    }

    // Build final sanitized 8-category allocation array summing to spending budget
    let sumAssigned = 0;
    const finalAllocations: AiCategoryAllocation[] = STANDARD_CATEGORIES.map((cat, idx) => {
      const found = allocMap.get(cat);
      const pct = found ? Math.max(1, Math.round(found.pct)) : 10;
      let amount = Math.round((spendingBudget * pct) / 100);

      if (idx === STANDARD_CATEGORIES.length - 1) {
        amount = Math.max(0, spendingBudget - sumAssigned);
      } else {
        sumAssigned += amount;
      }

      return {
        category: cat,
        percentage_of_budget: pct,
        allocated_amount: amount,
        reasoning: found?.reasoning || `Recommended allocation based on spending habits.`,
      };
    });

    const headline = parsed?.insight?.headline || 'Optimized for Your Spending Habits';
    const reasoning =
      parsed?.insight?.reasoning ||
      `Based on your last ${analytics.daysAnalyzed} days of spending, we optimized your category limits to support your savings goals while funding essentials.`;
    const tips = Array.isArray(parsed?.insight?.tips) ? parsed.insight.tips : [];

    return {
      monthly_income: recommendedIncome,
      savings_target_percentage: savingsPct,
      total_spending_budget: spendingBudget,
      category_allocations: finalAllocations,
      insight: {
        headline,
        reasoning,
        tips: tips.slice(0, 3),
      },
      isFallback: false,
    };
  } catch (err) {
    if (err instanceof GeminiAllRateLimitedError) {
      console.warn('[aiBudgetService] Rate limited on all Gemini models, using fallback budget.');
    } else {
      console.error('[aiBudgetService] Error generating smart budget:', err);
    }
    return generateFallbackBudget(analytics, incomeToUse);
  }
}
