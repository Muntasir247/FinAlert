import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import { useTransactions } from './TransactionsContext';
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
