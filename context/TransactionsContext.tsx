import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchTransactions,
  insertTransaction,
  insertTransactions,
  updateTransaction as updateTransactionDb,
  deleteTransaction as deleteTransactionDb,
} from '../lib/transactions';
import type { Transaction, NewTransaction } from '../lib/transactions';

interface TransactionsContextType {
  transactions: Transaction[];
  isLoading: boolean;
  hasLoaded: boolean;
  addTransaction: (input: NewTransaction) => Promise<{ error: any }>;
  addTransactions: (inputs: NewTransaction[]) => Promise<{ error: any; data?: Transaction[] }>;
  updateTransaction: (txId: string, input: NewTransaction) => Promise<{ error: any }>;
  deleteTransaction: (txId: string) => Promise<{ error: any }>;
  refreshTransactions: () => Promise<void>;
  transactionsTabRequested: boolean;
  requestTransactionsTab: () => void;
  clearTransactionsTabRequest: () => void;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);

export const TransactionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadTransactions = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const data = await fetchTransactions(userId);
      const seen = new Set<string>();
      const deduped = (data ?? []).filter((tx) => {
        if (seen.has(tx.id)) return false;
        seen.add(tx.id);
        return true;
      });
      setTransactions(deduped);
      setHasLoaded(true);
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
      setHasLoaded(false);
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
      setHasLoaded(false);
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

  const addTransactions = useCallback(
    async (inputs: NewTransaction[]): Promise<{ error: any; data?: Transaction[] }> => {
      if (!user) {
        return { error: { message: 'You must be signed in to add transactions.' } };
      }
      if (inputs.length === 0) {
        return { error: null, data: [] };
      }
      try {
        const created = await insertTransactions(user.id, inputs);
        setTransactions((prev) => [...created, ...prev]);
        return { error: null, data: created };
      } catch (error) {
        console.error('Error batch inserting transactions:', error);
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

  const [transactionsTabRequested, setTransactionsTabRequested] = useState(false);
  const requestTransactionsTab = useCallback(() => setTransactionsTabRequested(true), []);
  const clearTransactionsTabRequest = useCallback(() => setTransactionsTabRequested(false), []);

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        isLoading,
        hasLoaded,
        addTransaction,
        addTransactions,
        updateTransaction,
        deleteTransaction,
        refreshTransactions,
        transactionsTabRequested,
        requestTransactionsTab,
        clearTransactionsTabRequest,
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
