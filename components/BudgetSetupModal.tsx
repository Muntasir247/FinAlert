import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useBudgets } from '../context/BudgetsContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { TRANSACTION_CATEGORIES } from '../lib/transactionCategories';
import { getSpendingAnalytics } from '../services/spendingAnalyticsService';
import {
  generateSmartBudgetRecommendation,
  type AiBudgetRecommendation,
} from '../services/aiBudgetService';
import { useKeyboard } from '../lib/useKeyboard';

const SHEET_MAX_HEIGHT = 660;

const SAVINGS_MIN = 5;
const SAVINGS_MAX = 50;
const SAVINGS_DEFAULT = 20;

// Default smart-allocation splits (must sum to 100%)
const DEFAULT_SPLITS: { label: string; pct: number }[] = [
  { label: 'Bills & Utilities', pct: 30 },
  { label: 'Food & Dining', pct: 18 },
  { label: 'Grocery', pct: 12 },
  { label: 'Transport', pct: 8 },
  { label: 'Health', pct: 8 },
  { label: 'Shopping', pct: 8 },
  { label: 'Entertainment', pct: 6 },
  { label: 'Other', pct: 10 },
];

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: 'Budget Setup',
  2: 'Category Limits',
  3: 'Summary',
};

export default function BudgetSetupModal() {
  const insets = useSafeAreaInsets();
  const {
    budget,
    categoryBudgets,
    saveBudgetPlan,
    budgetModalVisible,
    closeBudgetModal,
  } = useBudgets();
  const { colors, isDark } = useTheme();
  const { t, isBangla, formatCurrency, translateCategory } = useLanguage();
  const { keyboardPaddingBottom } = useKeyboard();

  // Snapshot the latest plan data so the open effect only depends on
  // visibility (avoids re-seeding the form if transactions/plan re-render
  // while the modal is already open).
  const budgetRef = useRef(budget);
  budgetRef.current = budget;
  const categoryBudgetsRef = useRef(categoryBudgets);
  categoryBudgetsRef.current = categoryBudgets;

  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [incomeText, setIncomeText] = useState('');
  const [savingsPct, setSavingsPct] = useState(SAVINGS_DEFAULT);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [allocationSource, setAllocationSource] = useState<{
    income: number;
    savingsPct: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<AiBudgetRecommendation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const translateY = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const handleGenerateAiBudget = async () => {
    if (!user) {
      setErrorMsg('Please log in to generate an AI budget recommendation.');
      return;
    }
    setLoadingAi(true);
    setErrorMsg(null);

    try {
      // 1. Gather historical spending metrics (last 90 days)
      const analytics = await getSpendingAnalytics(user.id, 90);

      // 2. Query Gemini 1.5 Flash smart budget engine
      const userTypedIncome = Number.parseFloat(incomeText) || undefined;
      const rec = await generateSmartBudgetRecommendation(analytics, userTypedIncome);

      // 3. Populate state with AI recommendations
      setIncomeText(String(rec.monthly_income));
      setSavingsPct(rec.savings_target_percentage);

      const nextAlloc: Record<string, string> = {};
      for (const item of rec.category_allocations) {
        nextAlloc[item.category] = String(item.allocated_amount);
      }
      setAllocations(nextAlloc);
      setAllocationSource({
        income: rec.monthly_income,
        savingsPct: rec.savings_target_percentage,
      });
      setAiRecommendation(rec);

      // 4. Advance to Step 2 so user can review the AI suggested category limits
      setStep(2);
    } catch (err) {
      console.error('[BudgetSetupModal] Error generating AI budget plan:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Could not generate AI budget recommendation. Please try again.');
    } finally {
      setLoadingAi(false);
    }
  };

  // ── Derived values ──
  // `|| 0` guards against empty input (parseFloat('') = NaN), which would
  // otherwise be serialized as null by Supabase and violate the NOT NULL check.
  const income = Number.parseFloat(incomeText) || 0;
  const savingsAmount = income > 0 ? (income * savingsPct) / 100 : 0;
  const spendingBudget = income > 0 ? income - savingsAmount : 0;

  const allocatedTotal = DEFAULT_SPLITS.reduce((sum, { label }) => {
    return sum + (Number.parseFloat(allocations[label]) || 0);
  }, 0);
  const unallocated = spendingBudget - allocatedTotal;

  const fmt = (n: number) =>
    `৳${Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // ── Lifecycle ──
  useEffect(() => {
    if (budgetModalVisible) {
      setStep(1);
      setSubmitting(false);
      setErrorMsg(null);

      const existingBudget = budgetRef.current;
      const existingCategories = categoryBudgetsRef.current;

      if (existingBudget) {
        // Prefill the wizard with the previously saved plan so adjusting it
        // keeps the user's existing values.
        setIncomeText(String(existingBudget.monthly_income));
        setSavingsPct(existingBudget.savings_target_percentage);
        const next: Record<string, string> = {};
        for (const { label } of DEFAULT_SPLITS) {
          const saved = existingCategories.find((cb) => cb.category === label);
          next[label] = saved ? String(saved.limit) : '0';
        }
        setAllocations(next);
        setAllocationSource({
          income: existingBudget.monthly_income,
          savingsPct: existingBudget.savings_target_percentage,
        });
      } else {
        setIncomeText('');
        setSavingsPct(SAVINGS_DEFAULT);
        setAllocations({});
        setAllocationSource(null);
      }

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SHEET_MAX_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [budgetModalVisible]);

  const handleClose = () => {
    if (submitting) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_MAX_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(closeBudgetModal);
  };

  const goToStep = (next: Step) => {
    setErrorMsg(null);
    setStep(next);
  };

  const handleNextFromStep1 = () => {
    if (income <= 0) {
      setErrorMsg('Budget limits cannot be zero. Enter a monthly income greater than 0.');
      return;
    }

    // Re-distribute only when income or savings changed; otherwise keep the
    // user's manual category tweaks.
    const sourceMatches =
      allocationSource?.income === income && allocationSource.savingsPct === savingsPct;

    if (!sourceMatches) {
      const next: Record<string, string> = {};
      let assigned = 0;
      DEFAULT_SPLITS.forEach(({ label, pct }, index) => {
        if (index === DEFAULT_SPLITS.length - 1) {
          next[label] = String(Math.round((spendingBudget - assigned) * 100) / 100);
        } else {
          const val = Math.round(spendingBudget * pct) / 100;
          next[label] = String(val);
          assigned += val;
        }
      });
      setAllocations(next);
      setAllocationSource({ income, savingsPct });
    }

    setErrorMsg(null);
    setStep(2);
  };

  const handleSave = async () => {
    if (submitting) return;

    if (income <= 0) {
      setErrorMsg('Budget limits cannot be zero. Enter a monthly income greater than 0.');
      return;
    }

    if (allocatedTotal <= 0) {
      setErrorMsg('Budget limits cannot be zero. Allocate at least one category.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const categoryBudgets = DEFAULT_SPLITS.map(({ label }) => {
      const allocated = Math.round((Number.parseFloat(allocations[label]) || 0) * 100) / 100;
      const percentage = spendingBudget > 0 ? (allocated / spendingBudget) * 100 : 0;
      return {
        category: label,
        allocated_amount: allocated,
        percentage_of_budget: Math.round(percentage * 100) / 100,
      };
    });

    const { error } = await saveBudgetPlan({
      monthly_income: Math.round(income * 100) / 100,
      savings_target_percentage: savingsPct,
      total_spending_budget: Math.round(spendingBudget * 100) / 100,
      categoryBudgets,
    });

    setSubmitting(false);

    if (error) {
      setErrorMsg(error?.message || 'Failed to save budget plan. Please try again.');
      return;
    }

    handleClose();
  };

  const unallocatedColor =
    unallocated === 0 ? '#0FB384' : unallocated > 0 ? '#D97706' : '#EF4444';

  return (
    <Modal
      visible={budgetModalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss Budget Setup"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Step progress bar */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressSegment,
                  s <= step ? styles.progressSegmentActive : [styles.progressSegmentInactive, { backgroundColor: colors.divider }],
                ]}
              />
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSide}>
              {step > 1 && (
                <TouchableOpacity
                  style={[styles.backButton, { backgroundColor: isDark ? colors.surfaceSubtle : '#F3F4F6' }]}
                  onPress={() => goToStep((step - 1) as Step)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="arrow-back" size={20} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.headerCenter}>
              <Text style={[styles.title, { color: colors.text }]}>
                {isBangla
                  ? (step === 1 ? 'বাজেট সেটআপ' : step === 2 ? 'খাতভিত্তিক বাজেট' : 'সারসংক্ষেপ')
                  : STEP_TITLES[step]}
              </Text>
              <Text style={[styles.stepSubtext, { color: colors.textSecondary }]}>
                {isBangla ? `ধাপ ${step} / ৩` : `Step ${step} of 3`}
              </Text>
            </View>
            <View style={styles.headerSide}>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: isDark ? colors.surfaceSubtle : '#F3F4F6' }]}
                onPress={handleClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Close Budget Setup"
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + keyboardPaddingBottom }]}
          >
            {step === 1 && (
              <>
                {/* Info banner */}
                <View style={[styles.infoBanner, isDark && { backgroundColor: 'rgba(15, 179, 132, 0.15)' }]}>
                  <Ionicons name="bulb-outline" size={18} color="#0FB384" />
                  <Text style={[styles.infoBannerText, isDark && { color: '#A7F3D0' }]}>
                    {isBangla
                      ? 'আপনার মাসিক আয় এবং সঞ্চয় লক্ষ্য দিন। আমরা প্রতিটি ব্যয়ের খাতের জন্য বাজেট প্রস্তাব করব।'
                      : "Enter your monthly income and savings target. We'll automatically suggest spending limits for each expense category."}
                  </Text>
                </View>

                {/* AI Smart Recommendation Action Card */}
                {loadingAi ? (
                  <View style={[styles.aiLoadingCard, isDark && { backgroundColor: '#1E1236', borderColor: '#3B2366' }]}>
                    <View style={styles.aiLoadingHeader}>
                      <ActivityIndicator size="small" color="#A78BFA" />
                      <Text style={[styles.aiLoadingTitle, isDark && { color: '#DDD6FE' }]}>
                        {isBangla ? 'খরচের অভ্যাস বিশ্লেষণ করা হচ্ছে...' : 'Analyzing spending habits...'}
                      </Text>
                    </View>
                    <Text style={[styles.aiLoadingSubtitle, isDark && { color: '#C4B5FD' }]}>
                      {isBangla
                        ? 'জেমিনি ১.৫ ফ্ল্যাশ দিয়ে ৯০ দিনের লেনদেন ও সঞ্চয় লক্ষ্য পর্যালোচনা করা হচ্ছে'
                        : 'Reviewing 90 days of transactions & savings goals with Gemini 1.5 Flash'}
                    </Text>
                    <View style={[styles.aiSkeletonWrap, isDark && { backgroundColor: 'rgba(59, 35, 102, 0.4)' }]}>
                      <View style={[styles.aiSkeletonLine, { width: '85%' }, isDark && { backgroundColor: '#7C3AED' }]} />
                      <View style={[styles.aiSkeletonLine, { width: '60%', marginTop: 8 }, isDark && { backgroundColor: '#7C3AED' }]} />
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.aiGenerateBtn,
                      isDark && { backgroundColor: '#1E1236', borderColor: '#3B2366' },
                    ]}
                    onPress={handleGenerateAiBudget}
                    disabled={submitting || loadingAi}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Generate AI Budget Plan based on my spending"
                  >
                    <View style={[styles.aiGenerateIconBox, isDark && { backgroundColor: '#2E1D52' }]}>
                      <Ionicons name="sparkles" size={20} color={isDark ? '#DDD6FE' : '#7C3AED'} />
                    </View>
                    <View style={styles.aiGenerateContent}>
                      <View style={styles.aiGenerateTitleRow}>
                        <Text style={[styles.aiGenerateTitle, isDark && { color: '#DDD6FE' }]}>
                          {isBangla ? 'এআই বাজেট প্ল্যান তৈরি করুন' : 'Generate AI Budget Plan'}
                        </Text>
                        <View style={[styles.aiGenerateBadge, isDark && { backgroundColor: '#2E1D52' }]}>
                          <Text style={[styles.aiGenerateBadgeText, isDark && { color: '#DDD6FE' }]}>Gemini AI</Text>
                        </View>
                      </View>
                      <Text style={[styles.aiGenerateSubtitle, isDark && { color: '#C4B5FD' }]}>
                        {isBangla
                          ? 'অতীতের খরচের ওপর ভিত্তি করে স্বয়ংক্রিয় স্মার্ট লিমিট হিসাব করে'
                          : 'Auto-calculates smart limits based on your past spending'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={isDark ? '#DDD6FE' : '#7C3AED'} />
                  </TouchableOpacity>
                )}

                <View style={styles.orDividerWrap}>
                  <View style={[styles.orDividerLine, isDark && { backgroundColor: colors.divider }]} />
                  <Text style={[styles.orDividerText, isDark && { color: colors.textSecondary }]}>
                    {isBangla ? 'অথবা নিজে কনফিগার করুন' : 'OR CONFIGURE MANUALLY'}
                  </Text>
                  <View style={[styles.orDividerLine, isDark && { backgroundColor: colors.divider }]} />
                </View>

                {errorMsg && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                {/* Monthly Income */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {isBangla ? 'মাসিক আয়' : 'Monthly Income'}
                  </Text>
                  <View style={[styles.amountInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <Text style={[styles.currencyPrefix, { color: colors.text }]}>৳</Text>
                    <TextInput
                      style={[styles.amountInput, { color: colors.text }]}
                      value={incomeText}
                      onChangeText={setIncomeText}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      editable={!submitting}
                      accessibilityLabel="Monthly income"
                    />
                  </View>
                  {incomeText.trim().length > 0 && income <= 0 && (
                    <Text style={styles.fieldErrorText}>
                      {isBangla ? 'মাসিক আয় ০ এর বেশি হতে হবে।' : 'Monthly income must be greater than 0.'}
                    </Text>
                  )}
                </View>

                {/* Savings Target Slider */}
                <View style={styles.fieldGroup}>
                  <View style={styles.sliderLabelRow}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {isBangla ? 'সঞ্চয় লক্ষ্য' : 'Savings Target'}
                    </Text>
                    <Text style={styles.sliderValue}>{savingsPct}%</Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={SAVINGS_MIN}
                    maximumValue={SAVINGS_MAX}
                    step={1}
                    value={savingsPct}
                    onValueChange={(v) => setSavingsPct(Math.round(v))}
                    minimumTrackTintColor="#0FB384"
                    maximumTrackTintColor={isDark ? colors.divider : '#E5E7EB'}
                    thumbTintColor="#0FB384"
                    disabled={submitting}
                  />
                  <View style={styles.sliderBoundsRow}>
                    <Text style={[styles.sliderBound, { color: colors.textMuted }]}>{SAVINGS_MIN}%</Text>
                    <Text style={[styles.sliderBound, { color: colors.textMuted }]}>{SAVINGS_MAX}%</Text>
                  </View>
                </View>

                {/* Real-Time Calculation Card */}
                {income > 0 && (
                  <View style={[styles.calcCard, { backgroundColor: isDark ? colors.surfaceSubtle : '#F4FBF7', borderColor: colors.cardBorder }]}>
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>
                        {isBangla ? 'মাসিক আয়' : 'Monthly Income'}
                      </Text>
                      <Text style={[styles.calcValue, { color: colors.text }]}>{formatCurrency(income)}</Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcLabel, { color: colors.textSecondary }]}>
                        {isBangla ? `সঞ্চয় (${savingsPct}%)` : `Savings (${savingsPct}%)`}
                      </Text>
                      <Text style={[styles.calcValue, { color: colors.text }]}>{formatCurrency(savingsAmount)}</Text>
                    </View>
                    <View style={[styles.calcDivider, { backgroundColor: colors.cardBorder }]} />
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcBudgetLabel, { color: colors.text }]}>
                        {isBangla ? 'খরচের বাজেট' : 'Spending Budget'}
                      </Text>
                      <Text style={styles.calcBudgetValue}>{formatCurrency(spendingBudget)}</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    income <= 0
                      ? [styles.primaryButtonDisabled, isDark && { backgroundColor: colors.surfaceSubtle }]
                      : styles.primaryButtonActive,
                  ]}
                  onPress={handleNextFromStep1}
                  disabled={income <= 0 || submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Next"
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      income <= 0 ? styles.primaryButtonTextDisabled : styles.primaryButtonTextActive,
                    ]}
                  >
                    {isBangla ? 'পরবর্তী >' : 'Next >'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 2 && (
              <>
                {/* AI Recommendation Insight Card */}
                {aiRecommendation && (
                  <View style={[styles.aiInsightCard, isDark && { backgroundColor: '#1E1236', borderColor: '#3B2366' }]}>
                    <View style={styles.aiInsightHeader}>
                      <View style={[styles.aiInsightBadge, isDark && { backgroundColor: '#2E1D52' }]}>
                        <Ionicons name="sparkles" size={13} color={isDark ? '#DDD6FE' : '#6D28D9'} />
                        <Text style={[styles.aiInsightBadgeText, isDark && { color: '#DDD6FE' }]}>
                          {isBangla ? 'এআই সুপারিশ' : 'AI Recommendation'}
                        </Text>
                      </View>
                      <Text style={[styles.aiInsightConfidence, isDark && { color: '#C4B5FD' }]}>
                        {!aiRecommendation.isFallback ? '🎯 Personalized' : '💡 50/30/20 Rule'}
                      </Text>
                    </View>
                    <Text style={[styles.aiInsightHeadline, { color: isDark ? '#DDD6FE' : '#091E15' }]}>
                      {aiRecommendation.insight.headline}
                    </Text>
                    <Text style={[styles.aiInsightReasoning, { color: isDark ? '#C4B5FD' : '#4B5563' }]}>
                      {aiRecommendation.insight.reasoning}
                    </Text>
                    {aiRecommendation.insight.tips && aiRecommendation.insight.tips.length > 0 && (
                      <View style={styles.aiTipsWrap}>
                        {aiRecommendation.insight.tips.map((tip, idx) => (
                          <View key={idx} style={styles.aiTipRow}>
                            <Ionicons name="bulb-outline" size={13} color={isDark ? '#DDD6FE' : '#7C3AED'} style={styles.aiTipIcon} />
                            <Text style={[styles.aiTipText, isDark && { color: '#DDD6FE' }]}>{tip}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Header summary card */}
                <View
                  style={[
                    styles.summaryHeaderCard,
                    {
                      backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.summaryHeaderItem}>
                    <Text style={[styles.summaryHeaderLabel, { color: colors.textSecondary }]}>
                      {isBangla ? 'খরচের বাজেট' : 'Spending Budget'}
                    </Text>
                    <Text style={[styles.summaryHeaderValue, { color: colors.text }]}>
                      {formatCurrency(spendingBudget)}
                    </Text>
                  </View>
                  <View style={[styles.summaryHeaderDivider, { backgroundColor: colors.cardBorder }]} />
                  <View style={styles.summaryHeaderItem}>
                    <Text style={[styles.summaryHeaderLabel, { color: colors.textSecondary }]}>
                      {isBangla ? 'অবরাদ্দকৃত' : 'Unallocated'}
                    </Text>
                    <Text style={[styles.summaryHeaderValue, { color: unallocatedColor }]}>
                      {formatCurrency(unallocated)}
                    </Text>
                  </View>
                </View>

                {/* Category cards */}
                {DEFAULT_SPLITS.map(({ label }) => {
                  const cat =
                    TRANSACTION_CATEGORIES.find((c) => c.label === label) ??
                    TRANSACTION_CATEGORIES[TRANSACTION_CATEGORIES.length - 1];
                  const allocated = Number.parseFloat(allocations[label]) || 0;
                  const pct = spendingBudget > 0 ? (allocated / spendingBudget) * 100 : 0;
                  const barPct = Math.min(pct, 100);
                  const aiCat = aiRecommendation?.category_allocations?.find((c) => c.category === label);

                  return (
                    <View
                      key={label}
                      style={[
                        styles.catCard,
                        {
                          backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                        <Text style={styles.catEmoji}>{cat.emoji}</Text>
                      </View>
                      <View style={styles.catInfo}>
                        <View style={styles.catNameRow}>
                          <Text style={[styles.catName, { color: colors.text }]}>{translateCategory(label)}</Text>
                          <Text style={[styles.catPct, { color: cat.fg }]}>
                            {Math.round(pct)}%
                          </Text>
                        </View>
                        <View style={[styles.catBar, isDark && { backgroundColor: colors.divider }]}>
                          <View style={[styles.catBarFill, { width: `${barPct}%` }]} />
                        </View>
                        {aiCat?.reasoning ? (
                          <Text style={[styles.catAiReasoning, isDark && { color: '#A78BFA' }]} numberOfLines={1}>
                            {aiCat.reasoning}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.catAmountWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                        <Text style={[styles.catCurrency, { color: colors.text }]}>৳</Text>
                        <TextInput
                          style={[styles.catInput, { color: colors.text }]}
                          value={allocations[label]}
                          onChangeText={(text) =>
                            setAllocations((prev) => ({ ...prev, [label]: text }))
                          }
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          editable={!submitting}
                          accessibilityLabel={`${label} allocated amount`}
                        />
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={[styles.primaryButton, styles.primaryButtonActive]}
                  onPress={() => goToStep(3)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Review budget plan"
                >
                  <Text style={[styles.primaryButtonText, styles.primaryButtonTextActive]}>
                    {isBangla ? 'পর্যালোচনা >' : 'Review >'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 3 && (
              <>
                {aiRecommendation && (
                  <View style={[styles.aiSummaryBadgeCard, isDark && { backgroundColor: '#1E1236', borderColor: '#3B2366' }]}>
                    <View style={styles.aiSummaryBadgeHeader}>
                      <Ionicons name="sparkles" size={15} color={isDark ? '#DDD6FE' : '#7C3AED'} />
                      <Text style={[styles.aiSummaryBadgeTitle, isDark && { color: '#DDD6FE' }]}>
                        {isBangla ? 'এআই-অপ্টিমাইজড বাজেট প্ল্যান' : 'AI-Optimized Budget Plan'}
                      </Text>
                    </View>
                    <Text style={[styles.aiSummaryBadgeText, isDark && { color: '#C4B5FD' }]}>
                      {aiRecommendation.insight.headline}
                    </Text>
                  </View>
                )}

                {/* Overview card */}
                <View
                  style={[
                    styles.overviewCard,
                    {
                      backgroundColor: isDark ? colors.surfaceSubtle : '#F4FBF7',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.overviewRow}>
                    <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                      {isBangla ? 'মাসিক আয়' : 'Monthly Income'}
                    </Text>
                    <Text style={[styles.overviewValue, { color: colors.text }]}>{formatCurrency(income)}</Text>
                  </View>
                  <View style={styles.overviewRow}>
                    <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                      {isBangla ? `সঞ্চয় (${savingsPct}%)` : `Savings (${savingsPct}%)`}
                    </Text>
                    <Text style={[styles.overviewValue, { color: colors.text }]}>{formatCurrency(savingsAmount)}</Text>
                  </View>
                  <View style={styles.overviewRow}>
                    <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                      {isBangla ? 'মোট বাজেটকৃত' : 'Total Budgeted'}
                    </Text>
                    <Text style={[styles.overviewValue, { color: colors.text }]}>{formatCurrency(allocatedTotal)}</Text>
                  </View>
                  <View style={[styles.overviewDivider, { backgroundColor: colors.cardBorder }]} />
                  <View style={styles.overviewRow}>
                    <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                      {isBangla ? 'অবরাদ্দকৃত' : 'Unallocated'}
                    </Text>
                    <Text style={[styles.overviewValue, { color: unallocatedColor }]}>
                      {formatCurrency(unallocated)}
                    </Text>
                  </View>
                </View>

                {/* Category breakdown (read-only) */}
                {DEFAULT_SPLITS.map(({ label }) => {
                  const cat =
                    TRANSACTION_CATEGORIES.find((c) => c.label === label) ??
                    TRANSACTION_CATEGORIES[TRANSACTION_CATEGORIES.length - 1];
                  const allocated = Number.parseFloat(allocations[label]) || 0;
                  const pct = spendingBudget > 0 ? (allocated / spendingBudget) * 100 : 0;
                  return (
                    <View key={label} style={[styles.breakdownRow, { borderBottomColor: colors.cardBorder }]}>
                      <View style={[styles.breakdownIcon, { backgroundColor: cat.bg }]}>
                        <Text style={styles.breakdownEmoji}>{cat.emoji}</Text>
                      </View>
                      <Text style={[styles.breakdownName, { color: colors.text }]}>{translateCategory(label)}</Text>
                      <Text style={[styles.breakdownPct, { color: colors.textSecondary }]}>{Math.round(pct)}%</Text>
                      <Text style={styles.breakdownAmount}>{formatCurrency(allocated)}</Text>
                    </View>
                  );
                })}

                {errorMsg && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, styles.primaryButtonActive]}
                  onPress={handleSave}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Save Budget Plan"
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.saveButtonInner}>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={[styles.primaryButtonText, styles.primaryButtonTextActive]}>
                        {isBangla ? 'বাজেট প্ল্যান সংরক্ষণ করুন' : 'Save Budget Plan'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTouchable: {
    flex: 1,
    backgroundColor: 'rgba(8, 30, 21, 0.55)',
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },

  // ── Progress bar ──
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#0FB384',
  },
  progressSegmentInactive: {
    backgroundColor: '#E5E7EB',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSide: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
  },
  stepSubtext: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Shared labels/inputs ──
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 8,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 52,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: '#091E15',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#091E15',
    padding: 0,
  },
  fieldErrorText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#EF4444',
    marginTop: 6,
  },

  // ── Info banner ──
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#E8F7F1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#0F2C20',
  },

  // ── Slider ──
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0FB384',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderBoundsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderBound: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
  },

  // ── Calculation card ──
  calcCard: {
    backgroundColor: '#F4FBF7',
    borderWidth: 1,
    borderColor: '#E8F7F1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  calcLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
  },
  calcValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  calcDivider: {
    height: 1,
    backgroundColor: '#D1FAE5',
    marginVertical: 8,
  },
  calcBudgetLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#091E15',
  },
  calcBudgetValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0FB384',
  },

  // ── Buttons ──
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonActive: {
    backgroundColor: '#0FB384',
  },
  primaryButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  primaryButtonTextActive: {
    color: '#FFFFFF',
  },
  primaryButtonTextDisabled: {
    color: '#9CA3AF',
  },
  saveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  // ── Step 2 summary card ──
  summaryHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryHeaderItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryHeaderLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryHeaderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
  },
  summaryHeaderDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },

  // ── Category cards ──
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  catEmoji: {
    fontSize: 18,
  },
  catInfo: {
    flex: 1,
  },
  catNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  catPct: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '500',
  },
  catBar: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 2.5,
    backgroundColor: '#0FB384',
  },
  catAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    height: 42,
    marginLeft: 12,
    minWidth: 96,
  },
  catCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
    marginRight: 4,
  },
  catInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
    padding: 0,
  },

  // ── Step 3 overview ──
  overviewCard: {
    backgroundColor: '#F4FBF7',
    borderWidth: 1,
    borderColor: '#E8F7F1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  overviewLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  overviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#091E15',
  },
  overviewDivider: {
    height: 1,
    backgroundColor: '#D1FAE5',
    marginVertical: 8,
  },

  // ── Step 3 breakdown ──
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  breakdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  breakdownEmoji: {
    fontSize: 16,
  },
  breakdownName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
  },
  breakdownPct: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginRight: 16,
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0FB384',
  },

  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#DC2626',
  },

  // ── AI Generator Button & Skeleton ──
  aiGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    minHeight: 52,
  },
  aiGenerateIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiGenerateContent: {
    flex: 1,
    marginRight: 8,
  },
  aiGenerateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  aiGenerateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B21B6',
  },
  aiGenerateBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiGenerateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'uppercase',
  },
  aiGenerateSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
  },
  aiLoadingCard: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  aiLoadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  aiLoadingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B21B6',
  },
  aiLoadingSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  aiSkeletonWrap: {
    backgroundColor: 'rgba(221, 214, 254, 0.4)',
    borderRadius: 8,
    padding: 10,
  },
  aiSkeletonLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C4B5FD',
  },
  orDividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orDividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },

  // ── Step 2 AI Insight Card ──
  aiInsightCard: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  aiInsightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  aiInsightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },
  aiInsightConfidence: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
  },
  aiInsightHeadline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
    marginBottom: 4,
  },
  aiInsightReasoning: {
    fontSize: 12,
    lineHeight: 17,
    color: '#4B5563',
    marginBottom: 8,
  },
  aiTipsWrap: {
    marginTop: 4,
    gap: 4,
  },
  aiTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  aiTipIcon: {
    marginTop: 2,
  },
  aiTipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#5B21B6',
    fontWeight: '500',
  },
  catAiReasoning: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 3,
    fontWeight: '500',
  },

  // ── Step 3 AI Summary ──
  aiSummaryBadgeCard: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  aiSummaryBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  aiSummaryBadgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
  },
  aiSummaryBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#4B5563',
  },
});
