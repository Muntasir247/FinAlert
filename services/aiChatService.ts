import { isGroqConfigured, generateGroqChatCompletion, type GroqChatMessage } from './groqClient';
import { generateGeminiContent, DEFAULT_GEMINI_MODELS } from './geminiClient';
import type { SpendingAnalyticsSummary } from './spendingAnalyticsService';
import type { CategoryBudgetWithSpend } from '../lib/budgets';
import type { SavingsGoal } from '../lib/savingsGoals';
import type { Transaction } from '../lib/transactions';
import type { FinancialInsight } from './aiInsightService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelUsed?: string;
  isInitialInsight?: boolean;
}

export interface ChatContextParams {
  analytics?: SpendingAnalyticsSummary | null;
  budgets?: CategoryBudgetWithSpend[];
  goals?: SavingsGoal[];
  recentTransactions?: Transaction[];
  insight?: FinancialInsight | null;
}

/**
 * Builds a dense, token-optimized context summary (~150-250 tokens).
 * Instead of dumping endless transactions, aggregates metrics to respect free-tier TPM limits.
 */
export function buildFinancialContextPrompt({
  analytics,
  budgets = [],
  goals = [],
  recentTransactions = [],
  insight,
}: ChatContextParams): string {
  const parts: string[] = [];

  parts.push(
    `You are FinAlert AI, a friendly, concise, and ultra-practical financial advisor in Bangladesh (currency BDT / ৳ Taka).`
  );
  parts.push(
    `The user is asking questions about their personal expenses, budget status, and financial health in the FinAlert app.`
  );

  parts.push('\n--- CURRENT USER FINANCIAL SNAPSHOT ---');

  if (analytics && analytics.hasHistoricalData) {
    parts.push(
      `- 30-Day Income: ৳${analytics.totalIncome.toLocaleString()} | Total Expenses: ৳${analytics.totalExpense.toLocaleString()} (Avg ৳${Math.round(analytics.averageMonthlyExpense).toLocaleString()}/mo)`
    );
    parts.push(`- Net Savings Rate: ${analytics.netSavingsRate}%`);

    const topCats = analytics.categories
      .filter((c) => c.totalSpent > 0)
      .slice(0, 4)
      .map((c) => `${c.category}: ৳${c.totalSpent.toLocaleString()} (${Math.round(c.percentageOfTotalExpense)}%)`)
      .join(', ');
    if (topCats) {
      parts.push(`- Top Expense Categories: ${topCats}`);
    }
  } else {
    parts.push(`- Spending Data: New user or limited logged transactions.`);
  }

  // Active Category Budgets
  if (budgets && budgets.length > 0) {
    const budgetList = budgets
      .slice(0, 5)
      .map((b) => `${b.category}: ৳${b.spent.toLocaleString()} / ৳${b.limit.toLocaleString()} (${Math.round(b.percentage_used)}% used)`)
      .join('; ');
    parts.push(`- Category Budgets: ${budgetList}`);
  }

  // Savings Goals
  if (goals && goals.length > 0) {
    const goalsList = goals
      .slice(0, 3)
      .map((g) => {
        const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
        return `${g.name}: ৳${g.current_amount.toLocaleString()}/৳${g.target_amount.toLocaleString()} (${pct}%)`;
      })
      .join('; ');
    parts.push(`- Savings Goals: ${goalsList}`);
  }

  // Recent 5 Transactions
  if (recentTransactions && recentTransactions.length > 0) {
    const recentSummary = recentTransactions
      .slice(0, 5)
      .map((t) => `${t.type === 'income' ? '+' : '-'}৳${t.amount} in ${t.category} (${t.description || t.category})`)
      .join(', ');
    parts.push(`- Recent Activity: ${recentSummary}`);
  }

  // Pinned AI Insight Context
  if (insight) {
    parts.push(`- Latest AI Insight: "${insight.headline}" — ${insight.short_summary}`);
  }

  parts.push('\n--- BEHAVIOR RULES ---');
  parts.push('1. Keep replies concise (2 to 4 sentences or a short bulleted list). Never write long essays.');
  parts.push('2. Always format money with ৳ (Taka), e.g. ৳1,500.');
  parts.push(
    '3. When the user asks "Can I afford X?", calculate based on their category budgets, recent burn rate, and tell them directly if it fits or how to adjust.'
  );
  parts.push('4. Provide realistic, culturally relevant tips for Bangladesh (e.g., bKash cashbacks, local bazaar shopping, Pathao/Uber ride split).');
  parts.push('5. Be encouraging, warm, and clear.');

  return parts.join('\n');
}

/**
 * Returns tailored prompt chips that help the user start a chat without typing.
 */
export function getQuickPromptSuggestions(insight?: FinancialInsight | null): string[] {
  const suggestions = [
    'How is my spending this month?',
    'Can I afford a ৳2,000 expense?',
    'Which category am I spending most on?',
    'How can I save more money?',
  ];

  if (insight?.headline) {
    // Context-specific suggestion based on the insight
    if (insight.severity === 'warning') {
      return [
        `How do I fix: ${insight.headline}?`,
        'Can I afford a ৳2,000 expense?',
        'How are my category budgets?',
        'Show me tips to cut spend',
      ];
    }
  }

  return suggestions;
}

export interface SendChatMessageResult {
  reply: string;
  model: string;
  provider: 'groq' | 'gemini' | 'fallback';
}

/**
 * Sends a conversation turn to Groq LPU (with Gemini Flash fallback).
 * Uses a sliding window of the last 6 messages to stay well within free-tier TPM quotas.
 */
export async function sendFinancialChatMessage(
  history: ChatMessage[],
  contextParams: ChatContextParams
): Promise<SendChatMessageResult> {
  const systemPrompt = buildFinancialContextPrompt(contextParams);

  // Sliding window: keep only the last 6 non-system messages
  const nonSystemMessages = history.filter((m) => m.role !== 'system');
  const recentWindow = nonSystemMessages.slice(-6);

  // 1. Try Groq (Ultra-fast, Llama 3.3 70B / 3.1 8B)
  if (isGroqConfigured()) {
    try {
      const groqMessages: GroqChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...recentWindow.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      const { reply, model } = await generateGroqChatCompletion({
        messages: groqMessages,
        maxTokens: 320,
        temperature: 0.5,
        timeoutMs: 12000,
        perModelTimeoutMs: 6000,
      });

      if (reply && reply.length > 0) {
        return {
          reply,
          model,
          provider: 'groq',
        };
      }
    } catch (groqErr) {
      console.warn('[aiChatService] Groq chat completion failed, attempting Gemini fallback:', groqErr);
    }
  }

  // 2. Fall back to Gemini Flash (1M TPM headroom)
  const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      // Convert recent window to Gemini format
      const contents = recentWindow.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      // Ensure at least one message is in contents
      if (contents.length === 0) {
        contents.push({ role: 'user', parts: [{ text: 'Hello, please summarize my finances.' }] });
      }

      const { response, model } = await generateGeminiContent({
        apiKey: geminiApiKey,
        models: DEFAULT_GEMINI_MODELS,
        timeoutMs: 14000,
        perModelTimeoutMs: 7000,
        body: {
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            maxOutputTokens: 320,
            temperature: 0.5,
          },
        },
      });

      if (response.ok) {
        const json = await response.json();
        const replyText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText && typeof replyText === 'string') {
          return {
            reply: replyText.trim(),
            model,
            provider: 'gemini',
          };
        }
      }
    } catch (geminiErr) {
      console.warn('[aiChatService] Gemini fallback failed:', geminiErr);
    }
  }

  // 3. Graceful offline / fallback response
  return {
    reply:
      "I'm having trouble connecting to AI services right now. You can still check your recent transactions and budget limits directly on the dashboard!",
    model: 'offline-fallback',
    provider: 'fallback',
  };
}
