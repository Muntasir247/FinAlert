import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type FamilyRole = 'Admin' | 'Contributor' | 'Dependent';

export const ROLE_BG: Record<FamilyRole, string> = {
  Admin: '#FEF3C7',
  Contributor: '#E8F7F1',
  Dependent: '#F1F5F9',
};

export const ROLE_TEXT_COLOR: Record<FamilyRole, string> = {
  Admin: '#D97706',
  Contributor: '#0FB384',
  Dependent: '#64748B',
};

export interface ExpenseCategoryMeta {
  label: string;
  icon: IoniconName;
  tint: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  { label: 'House Rent', icon: 'home-outline', tint: '#0FB384' },
  { label: 'Grocery', icon: 'cart-outline', tint: '#F59E0B' },
  { label: 'Electricity', icon: 'flash-outline', tint: '#F97316' },
  { label: 'Internet', icon: 'globe-outline', tint: '#3B82F6' },
  { label: 'Medicine', icon: 'medkit-outline', tint: '#EF4444' },
  { label: 'Others', icon: 'apps-outline', tint: '#8B5CF6' },
];

export const expenseCategoryMeta = (label: string): ExpenseCategoryMeta =>
  EXPENSE_CATEGORIES.find((c) => c.label === label) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

export const formatMoney = (n: number) => `৳${Math.round(n).toLocaleString()}`;

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
