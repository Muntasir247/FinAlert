import { supabase } from './supabase';

export interface Budget {
  id: string;
  user_id: string;
  monthly_income: number;
  savings_target_percentage: number;
  total_spending_budget: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryBudget {
  id: string;
  budget_id: string;
  user_id: string;
  category: string;
  allocated_amount: number;
  percentage_of_budget: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetPlan {
  budget: Budget;
  categoryBudgets: CategoryBudget[];
}

export interface SaveBudgetInput {
  monthly_income: number;
  savings_target_percentage: number;
  total_spending_budget: number;
  categoryBudgets: {
    category: string;
    allocated_amount: number;
    percentage_of_budget: number;
  }[];
}

// Fetch the user's most recent budget plan (budget + its category limits).
// Returns null when the user has not set up a budget yet.
export async function fetchBudgetPlan(userId: string): Promise<BudgetPlan | null> {
  const { data: budget, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!budget) {
    return null;
  }

  const { data: categoryBudgets, error: catError } = await supabase
    .from('category_budgets')
    .select('*')
    .eq('budget_id', budget.id)
    .order('created_at', { ascending: true });

  if (catError) {
    throw catError;
  }

  return {
    budget: budget as Budget,
    categoryBudgets: (categoryBudgets ?? []) as CategoryBudget[],
  };
}

// Create or update the user's active budget plan. If a plan already exists it
// is updated in place (and its category limits replaced), otherwise a new plan
// is inserted — keeping exactly one active plan per user.
export async function saveBudgetPlan(
  userId: string,
  input: SaveBudgetInput
): Promise<BudgetPlan> {
  const existing = await fetchBudgetPlan(userId);

  let budgetId: string;

  if (existing) {
    const { data, error } = await supabase
      .from('budgets')
      .update({
        monthly_income: input.monthly_income,
        savings_target_percentage: input.savings_target_percentage,
        total_spending_budget: input.total_spending_budget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.budget.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    budgetId = (data as Budget).id;

    const { error: delError } = await supabase
      .from('category_budgets')
      .delete()
      .eq('budget_id', budgetId);

    if (delError) {
      throw delError;
    }
  } else {
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id: userId,
        monthly_income: input.monthly_income,
        savings_target_percentage: input.savings_target_percentage,
        total_spending_budget: input.total_spending_budget,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    budgetId = (data as Budget).id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('category_budgets')
    .insert(
      input.categoryBudgets.map((cb) => ({
        budget_id: budgetId,
        user_id: userId,
        category: cb.category,
        allocated_amount: cb.allocated_amount,
        percentage_of_budget: cb.percentage_of_budget,
      }))
    )
    .select();

  if (insertError) {
    throw insertError;
  }

  return {
    budget: {
      id: budgetId,
      user_id: userId,
      monthly_income: input.monthly_income,
      savings_target_percentage: input.savings_target_percentage,
      total_spending_budget: input.total_spending_budget,
      created_at: existing?.budget.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    categoryBudgets: (inserted ?? []) as CategoryBudget[],
  };
}
