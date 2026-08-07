import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchSavingsGoals,
  insertSavingsGoal,
  addSavingsContribution,
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
}

const SavingsGoalsContext = createContext<SavingsGoalsContextType | undefined>(undefined);

export const SavingsGoalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
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
        return { error: null };
      } catch (error) {
        console.error('Error adding contribution:', error);
        return { error };
      }
    },
    [user]
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

  return (
    <SavingsGoalsContext.Provider
      value={{
        goals,
        isLoading,
        hasLoaded,
        refreshGoals,
        addContribution,
        createGoal,
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
