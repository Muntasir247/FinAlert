import { fetchHistoricalTransactions, type Transaction } from '../lib/transactions';
import { fetchSavingsGoals, type SavingsGoal } from '../lib/savingsGoals';
import { TRANSACTION_CATEGORIES } from '../lib/transactionCategories';

export interface CategorySpendingMetric {
  category: string;
  totalSpent: number;
  monthlyAverage: number;
  percentageOfTotalExpense: number;
  transactionCount: number;
}

export interface SavingsGoalMetric {
  id: string;
  name: string;
  target: number;
  current: number;
  percentage: number;
  color: string;
}

export interface SpendingAnalyticsSummary {
  daysAnalyzed: number;
  monthsCount: number;
  totalIncome: number;
  averageMonthlyIncome: number;
  totalExpense: number;
  averageMonthlyExpense: number;
  estimatedMonthlyBurnRate: number;
  netSavingsRate: number; // percentage of income saved
  categories: CategorySpendingMetric[];
  topCategories: string[];
  savingsGoals: {
    totalTarget: number;
    totalSaved: number;
    goalsCount: number;
    goals: SavingsGoalMetric[];
  };
  hasHistoricalData: boolean;
  transactionCount: number;
}

const ALL_CATEGORY_LABELS = TRANSACTION_CATEGORIES.map((c) => c.label);

/**
 * Aggregates user's transactions over the last 30 to 90 days,
 * calculating per-category spending, average monthly burn rate,
 * recent income, and savings goal progress.
 */
export async function getSpendingAnalytics(
  userId: string,
  days: number = 90
): Promise<SpendingAnalyticsSummary> {
  const monthsCount = Math.max(1, Math.round((days / 30) * 10) / 10);

  // 1. Fetch historical transactions (centralized in lib)
  let transactions: Transaction[] = [];
  try {
    transactions = await fetchHistoricalTransactions(userId, days);
  } catch (err) {
    console.warn('[spendingAnalyticsService] Failed to fetch transactions:', err);
    transactions = [];
  }

  // 2. Fetch savings goals (centralized in lib)
  let savingsGoalsData: SavingsGoal[] = [];
  try {
    savingsGoalsData = await fetchSavingsGoals(userId);
  } catch (err) {
    console.warn('[spendingAnalyticsService] Failed to fetch savings goals:', err);
    savingsGoalsData = [];
  }

  // 3. Process transactions
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap: Record<string, { total: number; count: number }> = {};

  // Initialize all standard categories so every category has an entry
  for (const label of ALL_CATEGORY_LABELS) {
    categoryMap[label] = { total: 0, count: 0 };
  }

  for (const tx of transactions) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
      const cat = ALL_CATEGORY_LABELS.includes(tx.category) ? tx.category : 'Other';
      categoryMap[cat].total += tx.amount;
      categoryMap[cat].count += 1;
    }
  }

  const averageMonthlyIncome = Math.round((totalIncome / monthsCount) * 100) / 100;
  const averageMonthlyExpense = Math.round((totalExpense / monthsCount) * 100) / 100;
  const estimatedMonthlyBurnRate = averageMonthlyExpense;

  // Net savings rate: % of income that was not spent
  let netSavingsRate = 0;
  if (totalIncome > 0) {
    const saved = Math.max(0, totalIncome - totalExpense);
    netSavingsRate = Math.min(100, Math.round((saved / totalIncome) * 100));
  }

  // Build category metrics
  const categories: CategorySpendingMetric[] = ALL_CATEGORY_LABELS.map((label) => {
    const data = categoryMap[label] || { total: 0, count: 0 };
    const monthlyAverage = Math.round((data.total / monthsCount) * 100) / 100;
    const percentageOfTotalExpense =
      totalExpense > 0 ? Math.round((data.total / totalExpense) * 1000) / 10 : 0;

    return {
      category: label,
      totalSpent: Math.round(data.total * 100) / 100,
      monthlyAverage,
      percentageOfTotalExpense,
      transactionCount: data.count,
    };
  });

  // Top spending categories (sorted descending by total spend)
  const topCategories = [...categories]
    .filter((c) => c.totalSpent > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .map((c) => c.category);

  // 4. Process savings goals
  const goals: SavingsGoalMetric[] = savingsGoalsData.map((g) => ({
    id: g.id,
    name: g.name,
    target: g.target_amount,
    current: g.current_amount,
    percentage: g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0,
    color: g.color,
  }));

  const totalTarget = goals.reduce((acc, cur) => acc + cur.target, 0);
  const totalSaved = goals.reduce((acc, cur) => acc + cur.current, 0);

  const hasHistoricalData = transactions.filter((t) => t.type === 'expense').length >= 3 && totalExpense > 0;

  return {
    daysAnalyzed: days,
    monthsCount,
    totalIncome: Math.round(totalIncome * 100) / 100,
    averageMonthlyIncome,
    totalExpense: Math.round(totalExpense * 100) / 100,
    averageMonthlyExpense,
    estimatedMonthlyBurnRate,
    netSavingsRate,
    categories,
    topCategories,
    savingsGoals: {
      totalTarget,
      totalSaved,
      goalsCount: goals.length,
      goals,
    },
    hasHistoricalData,
    transactionCount: transactions.length,
  };
}
