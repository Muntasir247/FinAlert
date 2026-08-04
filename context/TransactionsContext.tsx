import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchTransactions, insertTransaction } from '../lib/transactions';
import type { Transaction, NewTransaction } from '../lib/transactions';

interface TransactionsContextType {
  transactions: Transaction[];
  isLoading: boolean;
  addTransaction: (input: NewTransaction) => Promise<{ error: any }>;
  refreshTransactions: () => Promise<void>;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);

export const TransactionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTransactions = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const data = await fetchTransactions(userId);
      setTransactions(data);
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }
    await loadTransactions(user.id);
  }, [user, loadTransactions]);

  useEffect(() => {
    if (user) {
      loadTransactions(user.id);
    } else {
      setTransactions([]);
      setIsLoading(false);
    }
  }, [user, loadTransactions]);

  const addTransaction = useCallback(
    async (input: NewTransaction): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to add a transaction.' } };
      }
      try {
        const created = await insertTransaction(user.id, input);
        setTransactions((prev) => [created, ...prev]);
        return { error: null };
      } catch (error) {
        console.error('Error inserting transaction:', error);
        return { error };
      }
    },
    [user]
  );

  return (
    <TransactionsContext.Provider
      value={{ transactions, isLoading, addTransaction, refreshTransactions }}
    >
      {children}
    </TransactionsContext.Provider>
  );
};

export const useTransactions = () => {
  const context = useContext(TransactionsContext);
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionsProvider');
  }
  return context;
};
