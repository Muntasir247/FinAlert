import { useMemo, useState } from 'react';
import type { FamilyMember } from '../../lib/families';
import { toISODate } from './familyConstants';
import type { FamilyRole } from './familyConstants';

export interface MemberFinance {
  memberId: string;
  userId: string | null;
  name: string;
  role: FamilyRole;
  limit: number;
  extra: number;
  unable: number;
}

export interface ExpenseContributor {
  memberId: string;
  amount: number;
  paid: boolean;
}

export interface SharedExpense {
  id: string;
  category: string;
  total: number;
  contributors: ExpenseContributor[];
}

export type FamilyTransactionType = 'payment' | 'extra' | 'unable';

export interface FamilyTransaction {
  id: string;
  type: FamilyTransactionType;
  expenseId: string;
  expenseCategory: string;
  memberId: string;
  memberName: string;
  amount: number;
  note: string;
  date: string;
}

export interface AddExpenseInput {
  category: string;
  total: number;
  assignments: { memberId: string; amount: number }[];
}

export interface AddTransactionInput {
  type: FamilyTransactionType;
  expenseId: string;
  memberId: string;
  amount: number;
  note: string;
}

export interface FamilyFinanceApi {
  finances: MemberFinance[];
  expenses: SharedExpense[];
  transactions: FamilyTransaction[];
  me: MemberFinance | null;
  isAdmin: boolean;
  memberPaid: (memberId: string) => number;
  expensePaid: (expense: SharedExpense) => number;
  expenseStatus: (expense: SharedExpense) => 'Paid' | 'Partial';
  memberShare: (expense: SharedExpense, memberId: string) => number;
  addExpense: (input: AddExpenseInput) => void;
  recordTransaction: (input: AddTransactionInput) => void;
  changeRole: (memberId: string, role: FamilyRole, limit: number) => void;
  removeMember: (memberId: string) => void;
}

// A brand-new family always starts with real members but zero financial data:
// no budgets, no expenses, no transactions. Values appear only once the Admin
// creates them, so empty states (৳0 metrics, empty lists) are the default.
function buildInitialState(members: FamilyMember[]) {
  const finances: MemberFinance[] = members.map((m) => ({
    memberId: m.id,
    userId: m.user_id,
    name: m.full_name || 'Family Member',
    role: m.role,
    limit: 0,
    extra: 0,
    unable: 0,
  }));

  return { finances, expenses: [] as SharedExpense[], transactions: [] as FamilyTransaction[] };
}

export function useFamilyFinance(members: FamilyMember[], currentUserId?: string): FamilyFinanceApi {
  const initial = useMemo(() => buildInitialState(members), [members]);
  const [finances, setFinances] = useState<MemberFinance[]>(initial.finances);
  const [expenses, setExpenses] = useState<SharedExpense[]>(initial.expenses);
  const [transactions, setTransactions] = useState<FamilyTransaction[]>(initial.transactions);

  const me = finances.find((m) => m.userId === currentUserId) ?? finances[0] ?? null;
  const isAdmin = me?.role === 'Admin';

  const memberPaid = (memberId: string) =>
    expenses.reduce(
      (sum, e) =>
        sum + e.contributors.filter((c) => c.memberId === memberId && c.paid).reduce((s, c) => s + c.amount, 0),
      0
    );

  const expensePaid = (expense: SharedExpense) =>
    expense.contributors.reduce((sum, c) => (c.paid ? sum + c.amount : sum), 0);

  const expenseStatus = (expense: SharedExpense): 'Paid' | 'Partial' =>
    expensePaid(expense) >= expense.total - 0.01 ? 'Paid' : 'Partial';

  const memberShare = (expense: SharedExpense, memberId: string) =>
    expense.contributors.find((c) => c.memberId === memberId)?.amount ?? 0;

  const addExpense = (input: AddExpenseInput) => {
    const expense: SharedExpense = {
      id: `exp-${Date.now()}`,
      category: input.category,
      total: Math.round(input.total * 100) / 100,
      contributors: input.assignments.map((a) => ({
        memberId: a.memberId,
        amount: Math.round(a.amount * 100) / 100,
        paid: false,
      })),
    };
    setExpenses((prev) => [expense, ...prev]);
  };

  const recordTransaction = (input: AddTransactionInput) => {
    const expense = expenses.find((e) => e.id === input.expenseId);
    const member = finances.find((m) => m.memberId === input.memberId);
    const tx: FamilyTransaction = {
      id: `tx-${Date.now()}`,
      type: input.type,
      expenseId: input.expenseId,
      expenseCategory: expense?.category ?? 'Others',
      memberId: input.memberId,
      memberName: member?.name ?? 'Member',
      amount: input.amount,
      note: input.note,
      date: toISODate(new Date()),
    };
    setTransactions((prev) => [tx, ...prev]);

    if (input.type === 'extra') {
      setFinances((prev) =>
        prev.map((m) => (m.memberId === input.memberId ? { ...m, extra: m.extra + input.amount } : m))
      );
    }
    if (input.type === 'unable') {
      setFinances((prev) =>
        prev.map((m) => (m.memberId === input.memberId ? { ...m, unable: m.unable + input.amount } : m))
      );
    }
    if (input.type === 'payment' || input.type === 'extra') {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === input.expenseId
            ? {
                ...e,
                contributors: e.contributors.map((c) =>
                  c.memberId === input.memberId ? { ...c, paid: true } : c
                ),
              }
            : e
        )
      );
    }
  };

  const changeRole = (memberId: string, role: FamilyRole, limit: number) => {
    setFinances((prev) =>
      prev.map((m) => (m.memberId === memberId ? { ...m, role, limit } : m))
    );
  };

  const removeMember = (memberId: string) => {
    setFinances((prev) => prev.filter((m) => m.memberId !== memberId));
    setExpenses((prev) =>
      prev.map((e) => ({
        ...e,
        contributors: e.contributors.filter((c) => c.memberId !== memberId),
      }))
    );
    setTransactions((prev) => prev.filter((t) => t.memberId !== memberId));
  };

  return {
    finances,
    expenses,
    transactions,
    me,
    isAdmin,
    memberPaid,
    expensePaid,
    expenseStatus,
    memberShare,
    addExpense,
    recordTransaction,
    changeRole,
    removeMember,
  };
}
