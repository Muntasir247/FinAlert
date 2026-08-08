import { useMemo, useState } from 'react';
import type { FamilyMember } from '../../lib/families';
import { daysAgo, toISODate } from './familyConstants';
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

// ── Seed builders ──────────────────────────────────────────────────────────
// Deterministic, role-based mock data so every sub-tab is interactive while
// staying grounded in the family's real member roster.

const ROLE_CYCLE: FamilyRole[] = ['Admin', 'Contributor', 'Contributor', 'Dependent'];
const LIMIT_CYCLE = [10000, 8000, 6000];

function buildSeed(members: FamilyMember[]) {
  const finances: MemberFinance[] = members.map((m, i) => {
    const role: FamilyRole = m.role === 'Admin' ? 'Admin' : ROLE_CYCLE[i % ROLE_CYCLE.length];
    const limit = role === 'Dependent' ? 0 : LIMIT_CYCLE[i % LIMIT_CYCLE.length];
    return {
      memberId: m.id,
      userId: m.user_id,
      name: m.full_name || 'Family Member',
      role,
      limit,
      extra: i === 0 ? 500 : 0,
      unable: i === 1 ? 1000 : 0,
    };
  });

  const pool = finances.filter((m) => m.limit > 0);
  const expenses: SharedExpense[] = [];
  const transactions: FamilyTransaction[] = [];

  if (pool.length > 0) {
    const split = (total: number, paidIdx: number[]) =>
      pool.map((m, i) => ({
        memberId: m.memberId,
        amount: Math.round((total / pool.length) * 100) / 100,
        paid: paidIdx.includes(i),
      }));

    const rent = { id: 'exp-rent', category: 'House Rent', total: 8000, contributors: split(8000, [0]) };
    const grocery = { id: 'exp-grocery', category: 'Grocery', total: 2400, contributors: split(2400, [0]) };
    const electricity = { id: 'exp-electricity', category: 'Electricity', total: 1200, contributors: split(1200, [0, 1]) };
    const internet = { id: 'exp-internet', category: 'Internet', total: 800, contributors: split(800, [0, 1]) };
    expenses.push(rent, grocery, electricity, internet);

    let n = 0;
    const pushTx = (
      type: FamilyTransactionType,
      expense: SharedExpense,
      member: MemberFinance,
      amount: number,
      note: string,
      date: string
    ) => {
      transactions.push({
        id: `tx-seed-${n++}`,
        type,
        expenseId: expense.id,
        expenseCategory: expense.category,
        memberId: member.memberId,
        memberName: member.name,
        amount,
        note,
        date,
      });
    };

    pool.forEach((member, i) => {
      [rent, grocery, electricity, internet].forEach((expense, j) => {
        const contributor = expense.contributors.find((c) => c.memberId === member.memberId);
        if (contributor?.paid) {
          pushTx('payment', expense, member, contributor.amount, `${expense.category} share`, daysAgo((i + j) % 3));
        }
      });
    });

    if (finances[0]) {
      pushTx('extra', rent, finances[0], 500, 'Extra — medicine', daysAgo(1));
    }
    if (finances[1]) {
      pushTx('unable', rent, finances[1], 1000, 'Cannot pay this month', daysAgo(0));
    }
  }

  return { finances, expenses, transactions };
}

export function useFamilyFinance(members: FamilyMember[], currentUserId?: string): FamilyFinanceApi {
  const seed = useMemo(() => buildSeed(members), [members]);
  const [finances, setFinances] = useState<MemberFinance[]>(seed.finances);
  const [expenses, setExpenses] = useState<SharedExpense[]>(seed.expenses);
  const [transactions, setTransactions] = useState<FamilyTransaction[]>(seed.transactions);

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
