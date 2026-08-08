import { supabase } from './supabase';
import type { FamilyRole } from './families';

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
  paidAmount: number;
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

export interface FamilyFinanceSnapshot {
  finances: MemberFinance[];
  expenses: SharedExpense[];
  transactions: FamilyTransaction[];
}

const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

// Full finance snapshot for a family via the get_family_finance RPC.
export async function fetchFamilyFinance(familyId: string): Promise<FamilyFinanceSnapshot> {
  const { data, error } = await supabase.rpc('get_family_finance', {
    p_family_id: familyId,
  });

  if (error) {
    throw error;
  }

  const members = (data?.members ?? []) as Record<string, unknown>[];
  const expenses = (data?.expenses ?? []) as Record<string, unknown>[];
  const transactions = (data?.transactions ?? []) as Record<string, unknown>[];

  return {
    finances: members.map((m) => ({
      memberId: String(m.member_id),
      userId: m.user_id ? String(m.user_id) : null,
      name: String(m.name ?? 'Family Member'),
      role: String(m.role ?? 'Contributor') as FamilyRole,
      limit: toNumber(m.limit),
      extra: toNumber(m.extra),
      unable: toNumber(m.unable),
    })),
    expenses: expenses.map((e) => ({
      id: String(e.id),
      category: String(e.category),
      total: toNumber(e.total),
      contributors: ((e.contributors ?? []) as Record<string, unknown>[]).map((c) => ({
        memberId: String(c.member_id),
        amount: toNumber(c.amount),
        paidAmount: toNumber(c.paid_amount),
        paid: Boolean(c.paid),
      })),
    })),
    transactions: transactions.map((t) => ({
      id: String(t.id),
      type: String(t.type) as FamilyTransactionType,
      expenseId: String(t.expense_id),
      expenseCategory: String(t.expense_category),
      memberId: String(t.member_id),
      memberName: String(t.member_name),
      amount: toNumber(t.amount),
      note: String(t.note ?? ''),
      date: String(t.date),
    })),
  };
}

export async function addFamilyExpense(
  familyId: string,
  input: AddExpenseInput
): Promise<string> {
  const { data, error } = await supabase.rpc('add_family_expense', {
    p_family_id: familyId,
    p_category: input.category,
    p_total: Math.round(input.total * 100) / 100,
    p_assignments: input.assignments.map((a) => ({
      memberId: a.memberId,
      amount: Math.round(a.amount * 100) / 100,
    })),
  });

  if (error) {
    throw error;
  }
  return String(data);
}

export async function recordFamilyTransaction(input: AddTransactionInput): Promise<void> {
  const { error } = await supabase.rpc('record_family_transaction', {
    p_expense_id: input.expenseId,
    p_member_id: input.memberId,
    p_type: input.type,
    p_amount: Math.round(input.amount * 100) / 100,
    p_note: input.note,
  });

  if (error) {
    throw error;
  }
}

export async function updateFamilyMemberRole(
  memberId: string,
  role: FamilyRole,
  limit: number
): Promise<void> {
  const { error } = await supabase.rpc('update_family_member_role', {
    p_member_id: memberId,
    p_role: role,
    p_limit: Math.round(limit * 100) / 100,
  });

  if (error) {
    throw error;
  }
}

export async function removeFamilyMember(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_family_member', {
    p_member_id: memberId,
  });

  if (error) {
    throw error;
  }
}
