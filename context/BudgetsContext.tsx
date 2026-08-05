import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchBudgetPlan, saveBudgetPlan as saveBudgetPlanDb } from '../lib/budgets';
import type { BudgetPlan, SaveBudgetInput } from '../lib/budgets';

interface BudgetsContextType {
  budgetPlan: BudgetPlan | null;
  isLoading: boolean;
  refreshBudgets: () => Promise<void>;
  saveBudgetPlan: (input: SaveBudgetInput) => Promise<{ error: any }>;
}

const BudgetsContext = createContext<BudgetsContextType | undefined>(undefined);

export const BudgetsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadBudgets = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const plan = await fetchBudgetPlan(userId);
      setBudgetPlan(plan);
    } catch (e) {
      console.error('Failed to load budget plan:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshBudgets = useCallback(async () => {
    if (!user) {
      setBudgetPlan(null);
      setIsLoading(false);
      return;
    }
    await loadBudgets(user.id);
  }, [user, loadBudgets]);

  useEffect(() => {
    if (user) {
      loadBudgets(user.id);
    } else {
      setBudgetPlan(null);
      setIsLoading(false);
    }
  }, [user, loadBudgets]);

  const saveBudgetPlan = useCallback(
    async (input: SaveBudgetInput): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to save a budget plan.' } };
      }
      try {
        const plan = await saveBudgetPlanDb(user.id, input);
        setBudgetPlan(plan);
        return { error: null };
      } catch (error) {
        console.error('Error saving budget plan:', error);
        return { error };
      }
    },
    [user]
  );

  return (
    <BudgetsContext.Provider
      value={{ budgetPlan, isLoading, refreshBudgets, saveBudgetPlan }}
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
