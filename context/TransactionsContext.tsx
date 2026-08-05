import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchTransactions,
  insertTransaction,
  updateTransaction as updateTransactionDb,
  deleteTransaction as deleteTransactionDb,
} from '../lib/transactions';
import type { Transaction, NewTransaction } from '../lib/transactions';

interface TransactionsContextType {
  transactions: Transaction[];
  isLoading: boolean;
  addTransaction: (input: NewTransaction) => Promise<{ error: any }>;
  updateTransaction: (txId: string, input: NewTransaction) => Promise<{ error: any }>;
  deleteTransaction: (txId: string) => Promise<{ error: any }>;
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

  const updateTransaction = useCallback(
    async (txId: string, input: NewTransaction): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to edit a transaction.' } };
      }
      try {
        const updated = await updateTransactionDb(txId, input);
        setTransactions((prev) =>
          prev.map((tx) => (tx.id === updated.id ? updated : tx))
        );
        return { error: null };
      } catch (error) {
        console.error('Error updating transaction:', error);
        return { error };
      }
    },
    [user]
  );

  const deleteTransaction = useCallback(
    async (txId: string): Promise<{ error: any }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to delete a transaction.' } };
      }
      try {
        await deleteTransactionDb(txId);
        setTransactions((prev) => prev.filter((tx) => tx.id !== txId));
        return { error: null };
      } catch (error) {
        console.error('Error deleting transaction:', error);
        return { error };
      }
    },
    [user]
  );

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        isLoading,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        refreshTransactions,
      }}
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
