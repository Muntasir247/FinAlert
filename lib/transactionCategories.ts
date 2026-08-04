export interface TransactionCategory {
  label: string;
  emoji: string;
  bg: string;
  fg: string;
}

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  { label: 'Food & Dining', emoji: '🍔', bg: '#FEE2E2', fg: '#DC2626' },
  { label: 'Transport', emoji: '🚗', bg: '#DBEAFE', fg: '#2563EB' },
  { label: 'Shopping', emoji: '🛍️', bg: '#FEF3C7', fg: '#D97706' },
  { label: 'Bills & Utilities', emoji: '💡', bg: '#E0F2FE', fg: '#0284C7' },
  { label: 'Health', emoji: '🏥', bg: '#FCE7F3', fg: '#DB2777' },
  { label: 'Entertainment', emoji: '🎬', bg: '#EDE9FE', fg: '#7C3AED' },
  { label: 'Grocery', emoji: '🛒', bg: '#D1FAE5', fg: '#059669' },
  { label: 'Other', emoji: '📦', bg: '#F1F5F9', fg: '#64748B' },
];
