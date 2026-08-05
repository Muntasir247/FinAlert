import { supabase } from './supabase';

export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  created_at: string;
}

export interface NewTransaction {
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
  date: string;
}

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Transaction[];
}

export async function insertTransaction(
  userId: string,
  tx: NewTransaction
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      date: tx.date,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Transaction;
}

export async function updateTransaction(
  txId: string,
  updates: NewTransaction
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      type: updates.type,
      amount: updates.amount,
      category: updates.category,
      description: updates.description,
      date: updates.date,
    })
    .eq('id', txId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Transaction;
}

export async function deleteTransaction(txId: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', txId);

  if (error) {
    throw error;
  }
}
