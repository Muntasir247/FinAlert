import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';
import { useTransactions } from './TransactionsContext';
import { useNotifications } from './NotificationsContext';
import {
  fetchBudgetPlan,
  saveBudgetPlan as saveBudgetPlanDb,
  computeCategoryBudgetsWithSpend,
} from '../lib/budgets';
import type {
  Budget,
  BudgetPlan,
  CategoryBudgetWithSpend,
  SaveBudgetInput,
} from '../lib/budgets';
import type { NewNotification } from '../lib/notifications';

interface BudgetsContextType {
  budget: Budget | null;
  categoryBudgets: CategoryBudgetWithSpend[];
  monthlySpent: number;
  isLoading: boolean;
  refreshBudgets: () => Promise<void>;
  saveBudgetPlan: (input: SaveBudgetInput) => Promise<{ error: any }>;
  budgetModalVisible: boolean;
  openBudgetModal: () => void;
  closeBudgetModal: () => void;
  budgetTabRequested: boolean;
  requestBudgetTab: () => void;
  clearBudgetTabRequest: () => void;
}

const BudgetsContext = createContext<BudgetsContextType | undefined>(undefined);

// Auto-created income transaction used to reflect the budget's monthly income
// as a real, visible income transaction (one per month).
const BUDGET_INCOME_CATEGORY = 'Income';
const BUDGET_INCOME_MARKER = 'Monthly budget income';

export const BudgetsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const {
    transactions,
    hasLoaded,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions();
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);

  const loadBudgets = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const loaded = await fetchBudgetPlan(userId);
      setPlan(loaded);
    } catch (e) {
      console.error('Failed to load budget plan:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshBudgets = useCallback(async () => {
    if (!user) {
      setPlan(null);
      setIsLoading(false);
      return;
    }
    await loadBudgets(user.id);
  }, [user, loadBudgets]);

  useEffect(() => {
    if (user) {
      loadBudgets(user.id);
    } else {
      setPlan(null);
      setIsLoading(false);
    }
  }, [user, loadBudgets]);

  const saveBudgetPlan = useCallback(
    async (input: SaveBudgetInput): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to save a budget plan.' } };
      }
      try {
        const saved = await saveBudgetPlanDb(user.id, input);
        setPlan(saved);
        return { error: null };
      } catch (error) {
        console.error('Error saving budget plan:', error);
        return { error };
      }
    },
    [user]
  );

  const budget = plan?.budget ?? null;

  // Live per-category usage: plan limits combined with this month's expenses.
  // Recomputes automatically whenever transactions or the plan change.
  const categoryBudgets = useMemo(
    () => (plan ? computeCategoryBudgetsWithSpend(plan.categoryBudgets, transactions) : []),
    [plan, transactions]
  );

  // Total spent this month across all expense transactions.
  const monthlySpent = useMemo(() => {
    const now = new Date();
    const monthKey = now.getFullYear() * 100 + (now.getMonth() + 1);
    let total = 0;
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const [y, m] = tx.date.split('-').map(Number);
      if (y * 100 + m === monthKey) total += tx.amount;
    }
    return total;
  }, [transactions]);

  // ── Budget notifications ─────────────────────────────────────────────────
  // All alerts are derived from real data and fired at most once per key.
  // Keys are persisted in SecureStore so restarting the app never spams duplicate alerts:
  //   - Monthly budget 80% used / used up (total spending budget thresholds)
  //   - Per-category overrun (spent >= category limit)
  //   - "{Category} is higher than last month" (month-over-month comparison)
  //   - "You spent too much on {Category} today!" (daily spend vs daily pace)
  const budgetAlertedRef = useRef<Set<string>>(new Set());
  const alertsLoadedMonthRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !hasLoaded) return;

    const now = new Date();
    const monthKey = now.getFullYear() * 100 + (now.getMonth() + 1);
    const lastMonthKey =
      monthKey % 100 === 1 ? (Math.floor(monthKey / 100) - 1) * 100 + 12 : monthKey - 1;
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const storageKey = `finalert_budget_alerts_${user.id}_${monthKey}`;
    const fmt = (n: number) => `৳${Math.round(n).toLocaleString()}`;

    // Load persisted alerts for current month once per monthKey
    const ensureAlertsLoaded = async () => {
      if (alertsLoadedMonthRef.current !== monthKey) {
        try {
          const stored = await SecureStore.getItemAsync(storageKey);
          if (stored) {
            const arr = JSON.parse(stored);
            if (Array.isArray(arr)) {
              arr.forEach((k) => budgetAlertedRef.current.add(k));
            }
          }
          alertsLoadedMonthRef.current = monthKey;
        } catch {
          // Non-fatal, use in-memory ref
        }
      }
    };

    const fire = async (key: string, notif: NewNotification) => {
      if (budgetAlertedRef.current.has(key)) return;
      budgetAlertedRef.current.add(key);

      try {
        await SecureStore.setItemAsync(
          storageKey,
          JSON.stringify(Array.from(budgetAlertedRef.current))
        );
      } catch {
        // Fallback to in-memory set
      }

      await notify(notif, { dedupeHours: 24 });
    };

    ensureAlertsLoaded().then(() => {
      // Bucket real expenses by current month, last month, and today.
      const thisMonthSpent: Record<string, number> = {};
      const lastMonthSpent: Record<string, number> = {};
      const todaySpent: Record<string, number> = {};
      for (const tx of transactions) {
        if (tx.type !== 'expense') continue;
        const [y, m, d] = tx.date.split('-').map(Number);
        const key = y * 100 + m;
        if (key === monthKey) {
          thisMonthSpent[tx.category] = (thisMonthSpent[tx.category] || 0) + tx.amount;
          if (d === now.getDate()) {
            todaySpent[tx.category] = (todaySpent[tx.category] || 0) + tx.amount;
          }
        } else if (key === lastMonthKey) {
          lastMonthSpent[tx.category] = (lastMonthSpent[tx.category] || 0) + tx.amount;
        }
      }

      // Total budget thresholds (needs an active plan).
      if (plan) {
        const totalLimit = plan.budget.total_spending_budget;
        if (totalLimit > 0) {
          const pct = (monthlySpent / totalLimit) * 100;
          if (pct >= 80 && pct < 100) {
            fire(`total80:${monthKey}`, {
              category: 'budget',
              title: 'Monthly budget 80% used',
              message: `You've used ${Math.round(pct)}% of your monthly budget (${fmt(
                monthlySpent
              )} of ${fmt(totalLimit)}).`,
              progress: 0.8,
              accent_color: 'orange',
              action_type: 'review_budget',
            });
          }
          if (pct >= 100) {
            fire(`total100:${monthKey}`, {
              category: 'budget',
              title: 'Monthly budget used up',
              message: `You have spent ${fmt(monthlySpent)} of your ${fmt(
                totalLimit
              )} total budget this month.`,
              progress: Math.min(pct / 100, 1.99),
              accent_color: 'red',
              action_type: 'review_spending',
            });
          }
        }

        // Per-category overrun (spent >= category limit).
        for (const cb of categoryBudgets) {
          if (cb.limit > 0 && cb.percentage_used >= 100) {
            fire(`cat:${monthKey}:${cb.category}`, {
              category: 'budget',
              title: 'Budget overrun',
              message: `${cb.category} is ${Math.round(
                cb.percentage_used - 100
              )}% over its monthly limit of ${fmt(cb.limit)}. Review your recent spending.`,
              progress: Math.min(cb.spent / cb.limit, 1.99),
              accent_color: 'red',
              action_type: 'review_budget',
            });
          }
        }
      }

      // Month-over-month increase: Only alert when past mid-month or with massive increase,
      // and with meaningful minimum spend thresholds so users aren't spammed with trivial amounts.
      const daysElapsed = now.getDate();
      for (const cat of Object.keys(thisMonthSpent)) {
        const current = thisMonthSpent[cat];
        const last = lastMonthSpent[cat] || 0;
        const isMidMonthOrHuge = daysElapsed >= 15 || current >= last * 1.4;

        if (
          isMidMonthOrHuge &&
          last >= 500 &&
          current >= last * 1.25 &&
          current - last >= 500
        ) {
          fire(`mom:${monthKey}:${cat}`, {
            category: 'budget',
            title: `${cat} is higher than last month`,
            message: `You've spent ${fmt(current)} on ${cat} this month, up from ${fmt(
              last
            )} last month.`,
            progress: null,
            accent_color: 'orange',
            action_type: 'review_budget',
          });
        }

        // Daily spike: today's spend in a category at least 2.5x daily pace,
        // requiring at least 3 days into the month and meaningful spending (>= ৳1000).
        const today = todaySpent[cat] || 0;
        const avgDaily = daysElapsed > 0 ? current / daysElapsed : 0;
        if (
          daysElapsed >= 3 &&
          today >= 1000 &&
          avgDaily >= 200 &&
          today >= 2.5 * avgDaily
        ) {
          fire(`daily:${todayKey}:${cat}`, {
            category: 'budget',
            title: `You spent too much on ${cat} today!`,
            message: `Your ${cat} spending today (${fmt(
              today
            )}) is well above your usual daily pace.`,
            progress: null,
            accent_color: 'red',
            action_type: 'review_spending',
          });
        }
      }
    });
  }, [user, plan, categoryBudgets, monthlySpent, transactions, hasLoaded, notify]);

  const openBudgetModal = useCallback(() => setBudgetModalVisible(true), []);
  const closeBudgetModal = useCallback(() => setBudgetModalVisible(false), []);
  const [budgetTabRequested, setBudgetTabRequested] = useState(false);
  const requestBudgetTab = useCallback(() => setBudgetTabRequested(true), []);
  const clearBudgetTabRequest = useCallback(() => setBudgetTabRequested(false), []);

  // Keep the budget's monthly income reflected as a real income transaction.
  // Ensures one such transaction exists for the current month whenever a budget
  // plan is active; re-creates it lazily on a fresh month and syncs the amount
  // if the plan's income changes. Only runs once the initial transaction fetch
  // has completed (`hasLoaded`) so it never races the load and duplicates rows.
  const syncInFlight = useRef(false);
  const syncMonthlyBudgetIncome = useCallback(async () => {
    if (!user || !plan || !hasLoaded || syncInFlight.current) return;

    const now = new Date();
    const monthKey = now.getFullYear() * 100 + (now.getMonth() + 1);
    const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    const matchesMonth = (dateStr: string) => {
      const [y, m] = dateStr.split('-').map(Number);
      return y * 100 + m === monthKey;
    };

    const markers = transactions.filter(
      (tx) => tx.type === 'income' && tx.description === BUDGET_INCOME_MARKER && matchesMonth(tx.date)
    );

    syncInFlight.current = true;
    try {
      // Self-heal any duplicate monthly income rows for this month.
      for (const dup of markers.slice(1)) {
        const { error } = await deleteTransaction(dup.id);
        if (error) console.error('Failed to remove duplicate monthly budget income:', error);
      }

      const existing = markers[0];
      const income = Math.round(plan.budget.monthly_income * 100) / 100;
      const canonical = {
        type: 'income' as const,
        amount: income,
        category: BUDGET_INCOME_CATEGORY,
        description: BUDGET_INCOME_MARKER,
        date: isoDate,
      };

      if (existing) {
        if (existing.amount !== income) {
          const { error } = await updateTransaction(existing.id, canonical);
          if (error) console.error('Failed to sync monthly budget income:', error);
        }
      } else {
        const { error } = await addTransaction(canonical);
        if (error) console.error('Failed to create monthly budget income:', error);
      }
    } finally {
      syncInFlight.current = false;
    }
  }, [user, plan, transactions, hasLoaded, addTransaction, updateTransaction, deleteTransaction]);

  useEffect(() => {
    syncMonthlyBudgetIncome();
  }, [syncMonthlyBudgetIncome]);

  return (
    <BudgetsContext.Provider
      value={{
        budget,
        categoryBudgets,
        monthlySpent,
        isLoading,
        refreshBudgets,
        saveBudgetPlan,
        budgetModalVisible,
        openBudgetModal,
        closeBudgetModal,
        budgetTabRequested,
        requestBudgetTab,
        clearBudgetTabRequest,
      }}
    >
      {children}
    </BudgetsContext.Provider>
  );
};

export const useBudgets = () => {
  const context = useContext(BudgetsContext);
  if (context === undefined) {
    throw new Error('useBudgets must be used within a BudgetsProvider');
  }
  return context;
};
