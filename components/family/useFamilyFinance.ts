import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useNotifications } from '../../context/NotificationsContext';
import type { FamilyRole } from './familyConstants';
import {
  fetchFamilyFinance,
  addFamilyExpense,
  recordFamilyTransaction,
  updateFamilyMemberRole,
  updateOwnContribution,
  removeFamilyMember,
  updateFamilyExpense,
  deleteFamilyExpense,
  deleteFamilyTransaction,
  subscribeToFamilyFinance,
} from '../../lib/familyFinance';
import type {
  MemberFinance,
  SharedExpense,
  FamilyTransaction,
  AddExpenseInput,
  AddTransactionInput,
  UpdateExpenseInput,
} from '../../lib/familyFinance';

export type {
  MemberFinance,
  SharedExpense,
  FamilyTransaction,
  FamilyTransactionType,
  AddExpenseInput,
  AddTransactionInput,
  UpdateExpenseInput,
  ExpenseContributor,
} from '../../lib/familyFinance';

export interface FamilyFinanceApi {
  finances: MemberFinance[];
  expenses: SharedExpense[];
  transactions: FamilyTransaction[];
  me: MemberFinance | null;
  isAdmin: boolean;
  isLoading: boolean;
  reload: (silent?: boolean) => Promise<void>;
  memberPaid: (memberId: string) => number;
  expensePaid: (expense: SharedExpense) => number;
  expenseStatus: (expense: SharedExpense) => 'Paid' | 'Partial';
  memberShare: (expense: SharedExpense, memberId: string) => number;
  addExpense: (input: AddExpenseInput) => Promise<void>;
  updateExpense: (expenseId: string, input: UpdateExpenseInput) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  recordTransaction: (input: AddTransactionInput) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;
  changeRole: (memberId: string, role: FamilyRole, limit: number) => Promise<void>;
  updateOwnContribution: (memberId: string, limit: number) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
}

/**
 * Family finance state backed by the backend. Loads a fresh snapshot whenever
 * the family changes and after every mutation, so every member sees the same
 * expenses, transactions, roles and limits.
 */
export function useFamilyFinance(familyId: string | null, currentUserId?: string): FamilyFinanceApi {
  const { notify } = useNotifications();
  const [finances, setFinances] = useState<MemberFinance[]>([]);
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [transactions, setTransactions] = useState<FamilyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    async (silent = false) => {
      if (!familyId) {
        setFinances([]);
        setExpenses([]);
        setTransactions([]);
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      try {
        const snapshot = await fetchFamilyFinance(familyId);
        setFinances(snapshot.finances);
        setExpenses(snapshot.expenses);
        setTransactions(snapshot.transactions);
      } catch (error) {
        console.error('Failed to load family finance:', error);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [familyId]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Realtime: Family Finance Subscription ─────────────────────────────────
  // Instantly syncs when another member adds/edits/deletes expenses, records payments, or updates roles
  useEffect(() => {
    if (!familyId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onFinanceChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        reload(true);
      }, 150);
    };

    const unsubscribe = subscribeToFamilyFinance(familyId, onFinanceChange);
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [familyId, reload]);

  // ── AppState Listener: Resuming from Background ───────────────────────────
  // Immediately syncs finance snapshot when app returns to active state
  useEffect(() => {
    if (!familyId) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        reload(true);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [familyId, reload]);

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
          .filter((c) => c.memberId === memberId)
          .reduce((s, c) => s + c.paidAmount, 0),
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
    notify({
      category: 'family',
      title: 'Family expense added',
      message: `You added a ${input.category} expense of ৳${Math.round(
        input.total
      ).toLocaleString()}.`,
      progress: null,
      accent_color: 'blue',
      action_type: 'view_family',
    });
  };

  const editExpense = async (expenseId: string, input: UpdateExpenseInput) => {
    await updateFamilyExpense(expenseId, input);
    await reload();
  };

  const removeExpense = async (expenseId: string) => {
    await deleteFamilyExpense(expenseId);
    await reload();
  };

  const recordTx = async (input: AddTransactionInput) => {
    await recordFamilyTransaction(input);
    await reload();
    notify({
      category: 'family',
      title: 'Family payment recorded',
      message: `You recorded a ${input.type} of ৳${Math.round(input.amount).toLocaleString()}${
        input.note ? ` (${input.note})` : ''
      }.`,
      progress: null,
      accent_color: 'blue',
      action_type: 'view_family',
    });
  };

  const removeTx = async (txId: string) => {
    await deleteFamilyTransaction(txId);
    await reload();
  };

  const changeRole = async (memberId: string, role: FamilyRole, limit: number) => {
    await updateFamilyMemberRole(memberId, role, limit);
    await reload();
  };

  const changeOwnContribution = async (memberId: string, limit: number) => {
    await updateOwnContribution(memberId, limit);
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
    updateExpense: editExpense,
    deleteExpense: removeExpense,
    recordTransaction: recordTx,
    deleteTransaction: removeTx,
    changeRole,
    updateOwnContribution: changeOwnContribution,
    removeMember,
  };
}
