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
import { useBudgets } from '../context/BudgetsContext';
import { TRANSACTION_CATEGORIES } from '../lib/transactionCategories';

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

export default function BudgetSetupModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { saveBudgetPlan } = useBudgets();

  const [step, setStep] = useState<Step>(1);
  const [incomeText, setIncomeText] = useState('');
  const [savingsPct, setSavingsPct] = useState(SAVINGS_DEFAULT);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const translateY = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // ── Derived values ──
  const income = Number.parseFloat(incomeText);
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
    if (visible) {
      setStep(1);
      setIncomeText('');
      setSavingsPct(SAVINGS_DEFAULT);
      setAllocations({});
      setSubmitting(false);
      setErrorMsg(null);

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
  }, [visible]);

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
    ]).start(onClose);
  };

  const goToStep = (next: Step) => {
    setErrorMsg(null);
    setStep(next);
  };

  const handleNextFromStep1 = () => {
    if (income <= 0) return;
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
    setStep(2);
  };

  const handleSave = async () => {
    if (submitting) return;

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
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Step progress bar */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressSegment,
                  s <= step ? styles.progressSegmentActive : styles.progressSegmentInactive,
                ]}
              />
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSide}>
              {step > 1 && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => goToStep((step - 1) as Step)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="arrow-back" size={20} color="#091E15" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>{STEP_TITLES[step]}</Text>
              <Text style={styles.stepSubtext}>Step {step} of 3</Text>
            </View>
            <View style={styles.headerSide}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Close Budget Setup"
              >
                <Ionicons name="close" size={22} color="#091E15" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {step === 1 && (
              <>
                {/* Info banner */}
                <View style={styles.infoBanner}>
                  <Ionicons name="bulb-outline" size={18} color="#0FB384" />
                  <Text style={styles.infoBannerText}>
                    Enter your monthly income and savings target. We'll automatically suggest
                    spending limits for each expense category.
                  </Text>
                </View>

                {/* Monthly Income */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Monthly Income</Text>
                  <View style={styles.amountInputWrap}>
                    <Text style={styles.currencyPrefix}>৳</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={incomeText}
                      onChangeText={setIncomeText}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#A0ADB6"
                      editable={!submitting}
                      accessibilityLabel="Monthly income"
                    />
                  </View>
                </View>

                {/* Savings Target Slider */}
                <View style={styles.fieldGroup}>
                  <View style={styles.sliderLabelRow}>
                    <Text style={styles.label}>Savings Target</Text>
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
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor="#0FB384"
                    disabled={submitting}
                  />
                  <View style={styles.sliderBoundsRow}>
                    <Text style={styles.sliderBound}>{SAVINGS_MIN}%</Text>
                    <Text style={styles.sliderBound}>{SAVINGS_MAX}%</Text>
                  </View>
                </View>

                {/* Real-Time Calculation Card */}
                {income > 0 && (
                  <View style={styles.calcCard}>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Monthly Income</Text>
                      <Text style={styles.calcValue}>{fmt(income)}</Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Savings ({savingsPct}%)</Text>
                      <Text style={styles.calcValue}>{fmt(savingsAmount)}</Text>
                    </View>
                    <View style={styles.calcDivider} />
                    <View style={styles.calcRow}>
                      <Text style={styles.calcBudgetLabel}>Spending Budget</Text>
                      <Text style={styles.calcBudgetValue}>{fmt(spendingBudget)}</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    income <= 0 ? styles.primaryButtonDisabled : styles.primaryButtonActive,
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
                    Next &gt;
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 2 && (
              <>
                {/* Header summary card */}
                <View style={styles.summaryHeaderCard}>
                  <View style={styles.summaryHeaderItem}>
                    <Text style={styles.summaryHeaderLabel}>Spending Budget</Text>
                    <Text style={styles.summaryHeaderValue}>{fmt(spendingBudget)}</Text>
                  </View>
                  <View style={styles.summaryHeaderDivider} />
                  <View style={styles.summaryHeaderItem}>
                    <Text style={styles.summaryHeaderLabel}>Unallocated</Text>
                    <Text style={[styles.summaryHeaderValue, { color: unallocatedColor }]}>
                      {fmt(unallocated)}
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
                  return (
                    <View key={label} style={styles.catCard}>
                      <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                        <Text style={styles.catEmoji}>{cat.emoji}</Text>
                      </View>
                      <View style={styles.catInfo}>
                        <View style={styles.catNameRow}>
                          <Text style={styles.catName}>{label}</Text>
                          <Text style={[styles.catPct, { color: cat.fg }]}>
                            {Math.round(pct)}%
                          </Text>
                        </View>
                        <View style={styles.catBar}>
                          <View style={[styles.catBarFill, { width: `${barPct}%` }]} />
                        </View>
                      </View>
                      <View style={styles.catAmountWrap}>
                        <Text style={styles.catCurrency}>৳</Text>
                        <TextInput
                          style={styles.catInput}
                          value={allocations[label]}
                          onChangeText={(text) =>
                            setAllocations((prev) => ({ ...prev, [label]: text }))
                          }
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#A0ADB6"
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
                    Review &gt;
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 3 && (
              <>
                {/* Overview card */}
                <View style={styles.overviewCard}>
                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewLabel}>Monthly Income</Text>
                    <Text style={styles.overviewValue}>{fmt(income)}</Text>
                  </View>
                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewLabel}>Savings ({savingsPct}%)</Text>
                    <Text style={styles.overviewValue}>{fmt(savingsAmount)}</Text>
                  </View>
                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewLabel}>Total Budgeted</Text>
                    <Text style={styles.overviewValue}>{fmt(allocatedTotal)}</Text>
                  </View>
                  <View style={styles.overviewDivider} />
                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewLabel}>Unallocated</Text>
                    <Text style={[styles.overviewValue, { color: unallocatedColor }]}>
                      {fmt(unallocated)}
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
                    <View key={label} style={styles.breakdownRow}>
                      <View style={[styles.breakdownIcon, { backgroundColor: cat.bg }]}>
                        <Text style={styles.breakdownEmoji}>{cat.emoji}</Text>
                      </View>
                      <Text style={styles.breakdownName}>{label}</Text>
                      <Text style={styles.breakdownPct}>{Math.round(pct)}%</Text>
                      <Text style={styles.breakdownAmount}>{fmt(allocated)}</Text>
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
                        Save Budget Plan
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
    paddingBottom: 8,
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
});
