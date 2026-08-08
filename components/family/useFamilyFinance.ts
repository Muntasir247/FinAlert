import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FamilyRole } from './familyConstants';
import {
  fetchFamilyFinance,
  addFamilyExpense,
  recordFamilyTransaction,
  updateFamilyMemberRole,
  removeFamilyMember,
} from '../../lib/familyFinance';
import type {
  MemberFinance,
  SharedExpense,
  FamilyTransaction,
  AddExpenseInput,
  AddTransactionInput,
} from '../../lib/familyFinance';

export type {
  MemberFinance,
  SharedExpense,
  FamilyTransaction,
  FamilyTransactionType,
  AddExpenseInput,
  AddTransactionInput,
  ExpenseContributor,
} from '../../lib/familyFinance';

export interface FamilyFinanceApi {
  finances: MemberFinance[];
  expenses: SharedExpense[];
  transactions: FamilyTransaction[];
  me: MemberFinance | null;
  isAdmin: boolean;
  isLoading: boolean;
  reload: () => Promise<void>;
  memberPaid: (memberId: string) => number;
  expensePaid: (expense: SharedExpense) => number;
  expenseStatus: (expense: SharedExpense) => 'Paid' | 'Partial';
  memberShare: (expense: SharedExpense, memberId: string) => number;
  addExpense: (input: AddExpenseInput) => Promise<void>;
  recordTransaction: (input: AddTransactionInput) => Promise<void>;
  changeRole: (memberId: string, role: FamilyRole, limit: number) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
}

/**
 * Family finance state backed by the backend. Loads a fresh snapshot whenever
 * the family changes and after every mutation, so every member sees the same
 * expenses, transactions, roles and limits.
 */
export function useFamilyFinance(familyId: string | null, currentUserId?: string): FamilyFinanceApi {
  const [finances, setFinances] = useState<MemberFinance[]>([]);
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [transactions, setTransactions] = useState<FamilyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!familyId) {
      setFinances([]);
      setExpenses([]);
      setTransactions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const snapshot = await fetchFamilyFinance(familyId);
      setFinances(snapshot.finances);
      setExpenses(snapshot.expenses);
      setTransactions(snapshot.transactions);
    } catch (error) {
      console.error('Failed to load family finance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const me = useMemo(
    () => finances.find((m) => m.userId === currentUserId) ?? finances[0] ?? null,
    [finances, currentUserId]
  );
  const isAdmin = me?.role === 'Admin';

  const memberPaid = (memberId: string) =>
    expenses.reduce(
      (sum, e) =>
        sum +
        e.contributors
          .filter((c) => c.memberId === memberId && c.paid)
          .reduce((s, c) => s + c.amount, 0),
      0
    );

  const expensePaid = (expense: SharedExpense) =>
    expense.contributors.reduce((sum, c) => sum + c.paidAmount, 0);

  const expenseStatus = (expense: SharedExpense): 'Paid' | 'Partial' =>
    expensePaid(expense) >= expense.total - 0.01 ? 'Paid' : 'Partial';

  const memberShare = (expense: SharedExpense, memberId: string) =>
    expense.contributors.find((c) => c.memberId === memberId)?.amount ?? 0;

  const addExpense = async (input: AddExpenseInput) => {
    if (!familyId) return;
    await addFamilyExpense(familyId, input);
    await reload();
  };

  const recordTx = async (input: AddTransactionInput) => {
    await recordFamilyTransaction(input);
    await reload();
  };

  const changeRole = async (memberId: string, role: FamilyRole, limit: number) => {
    await updateFamilyMemberRole(memberId, role, limit);
    await reload();
  };

  const removeMember = async (memberId: string) => {
    await removeFamilyMember(memberId);
    await reload();
  };

  return {
    finances,
    expenses,
    transactions,
    me,
    isAdmin,
    isLoading,
    reload,
    memberPaid,
    expensePaid,
    expenseStatus,
    memberShare,
    addExpense,
    recordTransaction: recordTx,
    changeRole,
    removeMember,
  };
}
