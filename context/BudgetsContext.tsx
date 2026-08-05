import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
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
}

const BudgetsContext = createContext<BudgetsContextType | undefined>(undefined);

export const BudgetsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { transactions } = useTransactions();
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
