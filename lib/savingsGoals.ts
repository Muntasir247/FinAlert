import { supabase } from './supabase';

// ── Icon metadata ─────────────────────────────────────────────────────────
// `icon` maps to an Ionicons name rendered in the UI (string so lib stays
// framework-free); the cast happens at the call site.

export const SAVINGS_GOAL_ICONS = [
  { key: 'shield', label: 'Shield', icon: 'shield-checkmark-outline' },
  { key: 'plane', label: 'Plane', icon: 'airplane-outline' },
  { key: 'phone', label: 'Phone', icon: 'phone-portrait-outline' },
  { key: 'house', label: 'House', icon: 'home-outline' },
  { key: 'graduation', label: 'Graduation Cap', icon: 'school-outline' },
  { key: 'car', label: 'Car', icon: 'car-outline' },
  { key: 'ring', label: 'Ring', icon: 'diamond-outline' },
  { key: 'laptop', label: 'Laptop', icon: 'laptop-outline' },
  { key: 'gym', label: 'Gym', icon: 'barbell-outline' },
  { key: 'vacation', label: 'Vacation', icon: 'sunny-outline' },
  { key: 'savings', label: 'Savings Bag', icon: 'wallet-outline' },
] as const;

export type SavingsGoalIcon = (typeof SAVINGS_GOAL_ICONS)[number]['key'];

// ── Color palette ─────────────────────────────────────────────────────────
// hex is stored in the DB and drives progress/accent colors; tint is the
// light background used behind icons and percentage badges.

export const SAVINGS_GOAL_COLORS = [
  { key: 'green', label: 'Green', hex: '#0FB384', tint: '#E8F7F1' },
  { key: 'darkgreen', label: 'Dark Green', hex: '#059669', tint: '#D1FAE5' },
  { key: 'purple', label: 'Purple', hex: '#8B5CF6', tint: '#EDE9FE' },
  { key: 'orange', label: 'Orange', hex: '#F59E0B', tint: '#FEF3C7' },
  { key: 'red', label: 'Red', hex: '#EF4444', tint: '#FEE2E2' },
  { key: 'lightblue', label: 'Light Blue', hex: '#3B82F6', tint: '#DBEAFE' },
  { key: 'pink', label: 'Pink', hex: '#EC4899', tint: '#FCE7F3' },
  { key: 'teal', label: 'Teal', hex: '#14B8A6', tint: '#CCFBF1' },
] as const;

export type SavingsGoalColorKey = (typeof SAVINGS_GOAL_COLORS)[number]['key'];

export const savingsGoalIconName = (key: string): string =>
  SAVINGS_GOAL_ICONS.find((i) => i.key === key)?.icon ?? 'wallet-outline';

export const savingsGoalTint = (hex: string): string =>
  SAVINGS_GOAL_COLORS.find(
    (c) => c.hex.toLowerCase() === String(hex).toLowerCase()
  )?.tint ?? '#E8F7F1';

// ── Types ─────────────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
  color: string;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewSavingsGoal {
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
  color: string;
  target_date: string | null;
}

// ── Data access (kept behind the context layer) ──────────────────────────

export async function fetchSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SavingsGoal[];
}

export async function insertSavingsGoal(
  userId: string,
  input: NewSavingsGoal
): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: userId,
      name: input.name,
      icon: input.icon,
      target_amount: input.target_amount,
      current_amount: input.current_amount,
      color: input.color,
      target_date: input.target_date,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as SavingsGoal;
}

// Contribution logic lives in the add_savings_contribution SQL function
// (atomic increment + ownership check), called via RPC.
export async function addSavingsContribution(
  goalId: string,
  amount: number
): Promise<SavingsGoal> {
  const { data, error } = await supabase.rpc('add_savings_contribution', {
    p_goal_id: goalId,
    p_amount: amount,
  });

  if (error) {
    throw error;
  }

  return data as SavingsGoal;
}

// Seed a few realistic demo goals for a brand-new user so the Home carousel
// is populated on first open. No-op once the user has rows.
export async function seedDemoSavingsGoalsIfEmpty(userId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('savings_goals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const demo: NewSavingsGoal[] = [
    {
      name: 'Emergency Fund',
      icon: 'shield',
      target_amount: 50000,
      current_amount: 15000,
      color: '#3B82F6',
      target_date: null,
    },
    {
      name: 'Trip Fund',
      icon: 'plane',
      target_amount: 25000,
      current_amount: 8500,
      color: '#0FB384',
      target_date: null,
    },
    {
      name: 'New Phone',
      icon: 'phone',
      target_amount: 20000,
      current_amount: 12000,
      color: '#8B5CF6',
      target_date: null,
    },
  ];

  const { error } = await supabase
    .from('savings_goals')
    .insert(demo.map((row) => ({ user_id: userId, ...row })));

  if (error) {
    throw error;
  }
}
