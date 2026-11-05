import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationsContext';
import {
  fetchSavingsGoals,
  insertSavingsGoal,
  addSavingsContribution,
  deleteSavingsGoal,
  seedDemoSavingsGoalsIfEmpty,
} from '../lib/savingsGoals';
import type { SavingsGoal, NewSavingsGoal } from '../lib/savingsGoals';

interface SavingsGoalsContextType {
  goals: SavingsGoal[];
  isLoading: boolean;
  hasLoaded: boolean;
  refreshGoals: () => Promise<void>;
  addContribution: (goalId: string, amount: number) => Promise<{ error: any }>;
  createGoal: (input: NewSavingsGoal) => Promise<{ error: any }>;
  deleteGoal: (goalId: string) => Promise<{ error: any }>;
}

const SavingsGoalsContext = createContext<SavingsGoalsContextType | undefined>(undefined);

export const SavingsGoalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const seededRef = useRef(false);

  const loadGoals = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      // Seed demo rows for a brand-new user exactly once per session.
      if (!seededRef.current) {
        seededRef.current = true;
        try {
          await seedDemoSavingsGoalsIfEmpty(userId);
        } catch (e) {
          console.error('Failed to seed demo savings goals:', e);
        }
      }
      const data = await fetchSavingsGoals(userId);
      setGoals(data);
      setHasLoaded(true);
    } catch (e) {
      console.error('Failed to load savings goals:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshGoals = useCallback(async () => {
    if (!user) {
      setGoals([]);
      setIsLoading(false);
      setHasLoaded(false);
      return;
    }
    await loadGoals(user.id);
  }, [user, loadGoals]);

  useEffect(() => {
    if (user) {
      loadGoals(user.id);
    } else {
      setGoals([]);
      setIsLoading(false);
      setHasLoaded(false);
    }
  }, [user, loadGoals]);

  const addContribution = useCallback(
    async (goalId: string, amount: number): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to add a contribution.' } };
      }
      try {
        const updated = await addSavingsContribution(goalId, amount);
        setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));

        const previous = goals.find((g) => g.id === goalId);
        const target = updated.target_amount;
        const oldPct = previous && target > 0 ? (previous.current_amount / target) * 100 : 0;
        const newPct = target > 0 ? (updated.current_amount / target) * 100 : 0;

        // Alert on every 20% milestone crossed by this contribution.
        for (const milestone of [20, 40, 60, 80, 100]) {
          if (oldPct < milestone && newPct >= milestone) {
            notify({
              category: 'savings',
              title: `Savings goal ${milestone}% reached!`,
              message:
                milestone === 100
                  ? `You reached your ${updated.name} goal of ৳${Math.round(
                      target
                    ).toLocaleString()}. Great job!`
                  : `You're ${milestone}% of the way to your ${updated.name} goal (৳${Math.round(
                      updated.current_amount
                    ).toLocaleString()} of ৳${Math.round(target).toLocaleString()}).`,
              progress: milestone / 100,
              accent_color: milestone === 100 ? 'green' : 'blue',
              action_type: 'view_goal',
            });
          }
        }

        return { error: null };
      } catch (error) {
        console.error('Error adding contribution:', error);
        return { error };
      }
    },
    [user, goals, notify]
  );

  const createGoal = useCallback(
    async (input: NewSavingsGoal): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to create a savings goal.' } };
      }
      try {
        const created = await insertSavingsGoal(user.id, input);
        setGoals((prev) => [created, ...prev]);
        return { error: null };
      } catch (error) {
        console.error('Error creating savings goal:', error);
        return { error };
      }
    },
    [user]
  );

  const deleteGoal = useCallback(
    async (goalId: string): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to delete a savings goal.' } };
      }
      try {
        await deleteSavingsGoal(goalId);
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
        return { error: null };
      } catch (error) {
        console.error('Error deleting savings goal:', error);
        return { error };
      }
    },
    [user]
  );

  return (
    <SavingsGoalsContext.Provider
      value={{
        goals,
        isLoading,
        hasLoaded,
        refreshGoals,
        addContribution,
        createGoal,
        deleteGoal,
      }}
    >
      {children}
    </SavingsGoalsContext.Provider>
  );
};

export const useSavingsGoals = () => {
  const context = useContext(SavingsGoalsContext);
  if (context === undefined) {
    throw new Error('useSavingsGoals must be used within a SavingsGoalsProvider');
  }
  return context;
};
