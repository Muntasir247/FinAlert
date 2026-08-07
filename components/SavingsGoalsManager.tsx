import React, { ComponentProps, useEffect, useRef, useState } from 'react';
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSavingsGoals } from '../context/SavingsGoalsContext';
import {
  SAVINGS_GOAL_ICONS,
  SAVINGS_GOAL_COLORS,
  savingsGoalIconName,
  savingsGoalTint,
} from '../lib/savingsGoals';
import type { SavingsGoal } from '../lib/savingsGoals';

const SHEET_MAX_HEIGHT = 640;

type SheetView = 'list' | 'add' | 'create';
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const PRESET_PILLS = [500, 1000, 2000, 5000];

const fmtMoney = (n: number) => `৳${Math.round(n).toLocaleString()}`;

export interface SavingsGoalsPrefill {
  goalId?: string;
  amount?: number;
  goalName?: string;
  targetAmount?: number;
}

export default function SavingsGoalsManager({
  visible,
  initialView = 'list',
  prefill,
  onClose,
}: {
  visible: boolean;
  initialView?: SheetView;
  prefill?: SavingsGoalsPrefill | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { goals, addContribution, createGoal } = useSavingsGoals();

  const [view, setView] = useState<SheetView>(initialView);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  // Add contribution form
  const [amountText, setAmountText] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  // Create goal form
  const [icon, setIcon] = useState<string>(SAVINGS_GOAL_ICONS[0].key);
  const [nameText, setNameText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [alreadyText, setAlreadyText] = useState('');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [color, setColor] = useState<string>(SAVINGS_GOAL_COLORS[0].hex);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const translateY = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Reset forms + animate in whenever the sheet becomes visible.
  useEffect(() => {
    if (visible) {
      setView(initialView);
      setSelectedGoal(null);
      setAmountText('');
      setAddSubmitting(false);
      setAddError(null);
      setAddSuccess(false);
      setIcon(SAVINGS_GOAL_ICONS[0].key);
      setNameText('');
      setTargetText('');
      setAlreadyText('');
      setTargetDate(null);
      setShowPicker(false);
      setColor(SAVINGS_GOAL_COLORS[0].hex);
      setCreateSubmitting(false);
      setCreateError(null);

      if (prefill?.goalId) {
        const goal = goals.find((g) => g.id === prefill.goalId);
        if (goal) {
          setSelectedGoal(goal);
          if (prefill.amount != null) setAmountText(String(prefill.amount));
          setView('add');
        }
      } else if (prefill?.goalName) {
        setNameText(prefill.goalName);
        if (prefill.targetAmount != null) setTargetText(String(prefill.targetAmount));
        setView('create');
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
  }, [visible, initialView, prefill, goals]);

  const handleClose = () => {
    if (addSubmitting || createSubmitting) return;
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

  const formatDisplayDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${mm}/${dd}/${d.getFullYear()}`;
  };

  const toIsoDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        setTargetDate(selectedDate);
      }
    } else if (selectedDate) {
      setTargetDate(selectedDate);
    }
  };

  // ── Add contribution ──
  const addAmount = Number.parseFloat(amountText);
  const canAdd = addAmount > 0;

  const openAdd = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setAmountText('');
    setAddError(null);
    setAddSuccess(false);
    setView('add');
  };

  const handleAddSubmit = async () => {
    if (!selectedGoal || !canAdd || addSubmitting) return;
    setAddSubmitting(true);
    setAddError(null);
    const { error } = await addContribution(
      selectedGoal.id,
      Math.round(addAmount * 100) / 100
    );
    setAddSubmitting(false);

    if (error) {
      setAddError(error?.message || 'Failed to add contribution. Please try again.');
      return;
    }

    // Success feedback, then return to the (updated) goals list.
    setAddSuccess(true);
    setTimeout(() => {
      setAddSuccess(false);
      setAmountText('');
      setSelectedGoal(null);
      setView('list');
    }, 900);
  };

  // ── Create goal ──
  const createName = nameText.trim();
  const createTarget = Number.parseFloat(targetText);
  const canCreate = createName.length > 0 && createTarget > 0;

  const handleCreateSubmit = async () => {
    if (!canCreate || createSubmitting) return;
    setCreateSubmitting(true);
    setCreateError(null);

    const { error } = await createGoal({
      name: createName,
      icon,
      target_amount: Math.round(createTarget * 100) / 100,
      current_amount: Math.round((Number.parseFloat(alreadyText) || 0) * 100) / 100,
      color,
      target_date: targetDate ? toIsoDate(targetDate) : null,
    });

    setCreateSubmitting(false);

    if (error) {
      setCreateError(error?.message || 'Failed to create savings goal. Please try again.');
      return;
    }

    handleClose();
  };

  // ── Shared progress bar ──
  const renderProgressBar = (pct: number, colorHex: string) => {
    const barPct = Math.max(0, Math.min(pct, 100));
    return (
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${barPct}%`, backgroundColor: colorHex }]}
        />
      </View>
    );
  };

  // ── Header ──
  const renderHeader = (title: string, showBack: boolean) => (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {showBack && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setView('list')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Back to savings goals"
          >
            <Ionicons name="arrow-back" size={20} color="#091E15" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.headerCenter}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.headerSide}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleClose}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Close Savings Goals"
        >
          <Ionicons name="close" size={22} color="#091E15" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── List view ──
  const renderList = () => (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {goals.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={styles.emptyTitle}>No savings goals yet</Text>
            <Text style={styles.emptyText}>
              Create your first goal below to start tracking progress.
            </Text>
          </View>
        ) : (
          goals.map((goal) => {
            const pct =
              goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
            const remaining = Math.max(0, goal.target_amount - goal.current_amount);
            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalCardHeader}>
                  <View
                    style={[styles.goalCardIcon, { backgroundColor: savingsGoalTint(goal.color) }]}
                  >
                    <Ionicons
                      name={savingsGoalIconName(goal.icon) as IoniconName}
                      size={18}
                      color={goal.color}
                    />
                  </View>
                  <View style={styles.goalCardInfo}>
                    <Text style={styles.goalCardName} numberOfLines={1}>
                      {goal.name}
                    </Text>
                    <Text style={styles.goalCardRemaining}>
                      Remaining: {fmtMoney(remaining)}
                    </Text>
                  </View>
                  <View style={[styles.pctBadge, { backgroundColor: savingsGoalTint(goal.color) }]}>
                    <Text style={[styles.pctBadgeText, { color: goal.color }]}>
                      {Math.round(pct)}%
                    </Text>
                  </View>
                </View>

                {renderProgressBar(pct, goal.color)}

                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: goal.color }]}
                  onPress={() => openAdd(goal)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add contribution to ${goal.name}`}
                >
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, styles.primaryButtonActive]}
          onPress={() => setView('create')}
          accessibilityRole="button"
          accessibilityLabel="Create new savings goal"
        >
          <Text style={[styles.primaryButtonText, styles.primaryButtonTextActive]}>
            + Create New Savings Goal
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ── Add contribution view ──
  const renderAdd = () => {
    if (!selectedGoal) return null;
    const pct =
      selectedGoal.target_amount > 0
        ? (selectedGoal.current_amount / selectedGoal.target_amount) * 100
        : 0;
    return (
      <>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Goal preview */}
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <View
                style={[
                  styles.goalCardIcon,
                  { backgroundColor: savingsGoalTint(selectedGoal.color) },
                ]}
              >
                <Ionicons
                  name={savingsGoalIconName(selectedGoal.icon) as IoniconName}
                  size={20}
                  color={selectedGoal.color}
                />
              </View>
              <View style={styles.goalCardInfo}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {selectedGoal.name}
                </Text>
                <Text style={styles.previewAmounts}>
                  {fmtMoney(selectedGoal.current_amount)} of {fmtMoney(selectedGoal.target_amount)}
                </Text>
              </View>
              <Text style={[styles.previewPct, { color: selectedGoal.color }]}>
                {Math.round(pct)}%
              </Text>
            </View>
            {renderProgressBar(pct, selectedGoal.color)}
          </View>

          {/* Amount input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Amount to add</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>৳</Text>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#A0ADB6"
                editable={!addSubmitting}
                accessibilityLabel="Contribution amount"
              />
            </View>
          </View>

          {/* Quick presets */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Quick select</Text>
            <View style={styles.pillRow}>
              {PRESET_PILLS.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.pill,
                    addAmount === val && styles.pillActive,
                  ]}
                  onPress={() => setAmountText(String(val))}
                  disabled={addSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick add ${fmtMoney(val)}`}
                >
                  <Text
                    style={[styles.pillText, addAmount === val && styles.pillTextActive]}
                  >
                    {fmtMoney(val)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {addSuccess && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <Text style={styles.successText}>
                Added {fmtMoney(addAmount)} to {selectedGoal.name}
              </Text>
            </View>
          )}

          {addError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{addError}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              canAdd && !addSubmitting ? styles.primaryButtonActive : styles.primaryButtonDisabled,
            ]}
            onPress={handleAddSubmit}
            disabled={!canAdd || addSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Add to Savings"
          >
            {addSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.buttonInner}>
                <Ionicons name="checkmark" size={18} color={canAdd ? '#FFFFFF' : '#9CA3AF'} />
                <Text
                  style={[
                    styles.primaryButtonText,
                    canAdd ? styles.primaryButtonTextActive : styles.primaryButtonTextDisabled,
                  ]}
                >
                  Add to Savings
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // ── Create goal view ──
  const renderCreate = () => (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Choose icon */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Choose Icon</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.iconRow}
          >
            {SAVINGS_GOAL_ICONS.map((item) => {
              const isSelected = icon === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.iconTile,
                    { backgroundColor: isSelected ? savingsGoalTint(color) : '#F1F5F9' },
                    isSelected && { borderColor: color },
                  ]}
                  onPress={() => setIcon(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Icon ${item.label}`}
                >
                  <Ionicons
                    name={item.icon as IoniconName}
                    size={22}
                    color={isSelected ? color : '#64748B'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Goal name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Goal Name</Text>
          <TextInput
            style={styles.textInput}
            value={nameText}
            onChangeText={setNameText}
            placeholder="e.g. Emergency Fund, Trip to Cox's Bazar"
            placeholderTextColor="#A0ADB6"
            editable={!createSubmitting}
            accessibilityLabel="Savings goal name"
          />
        </View>

        {/* Target amount */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Target Amount</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.currencyPrefix}>৳</Text>
            <TextInput
              style={styles.amountInput}
              value={targetText}
              onChangeText={setTargetText}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#A0ADB6"
              editable={!createSubmitting}
              accessibilityLabel="Target amount"
            />
          </View>
        </View>

        {/* Already saved */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Already Saved (Optional)</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.currencyPrefix}>৳</Text>
            <TextInput
              style={styles.amountInput}
              value={alreadyText}
              onChangeText={setAlreadyText}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#A0ADB6"
              editable={!createSubmitting}
              accessibilityLabel="Already saved amount"
            />
          </View>
        </View>

        {/* Target date */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Target Date (Optional)</Text>
          <TouchableOpacity
            style={styles.dateInputWrap}
            onPress={() => setShowPicker(true)}
            disabled={createSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Select target date"
          >
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text style={[styles.dateText, !targetDate && styles.dateTextPlaceholder]}>
              {targetDate ? formatDisplayDate(targetDate) : 'mm/dd/yyyy'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#6B7280" />
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={targetDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          )}
        </View>

        {/* Goal color */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Goal Color</Text>
          <View style={styles.colorRow}>
            {SAVINGS_GOAL_COLORS.map((c) => {
              const isSelected = color === c.hex;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={styles.colorDotWrap}
                  onPress={() => setColor(c.hex)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Color ${c.label}`}
                >
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: c.hex },
                      isSelected && styles.colorDotSelected,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {createError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{createError}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            canCreate && !createSubmitting
              ? styles.primaryButtonActive
              : styles.primaryButtonDisabled,
          ]}
          onPress={handleCreateSubmit}
          disabled={!canCreate || createSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Create Goal"
        >
          {createSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.buttonInner}>
              <Ionicons
                name="checkmark"
                size={18}
                color={canCreate ? '#FFFFFF' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.primaryButtonText,
                  canCreate ? styles.primaryButtonTextActive : styles.primaryButtonTextDisabled,
                ]}
              >
                Create Goal
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

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
            accessibilityLabel="Dismiss Savings Goals"
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

          {renderHeader(
            view === 'list' ? 'Savings Goals' : view === 'add' ? 'Add Contribution' : 'Create New Goal',
            view !== 'list'
          )}

          {view === 'list' && renderList()}
          {view === 'add' && renderAdd()}
          {view === 'create' && renderCreate()}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSide: {
    width: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  footer: {
    paddingTop: 8,
    paddingBottom: 4,
  },

  // ── Shared ──
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
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 52,
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
  },
  dateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    height: 52,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
  },
  dateTextPlaceholder: {
    color: '#A0ADB6',
  },

  // ── Progress bar ──
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── Buttons ──
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
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
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  // ── List view ──
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalCardInfo: {
    flex: 1,
  },
  goalCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  goalCardRemaining: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 2,
  },
  pctBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pctBadgeText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '700',
  },
  addButton: {
    marginTop: 12,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
    textAlign: 'center',
  },

  // ── Add contribution ──
  previewCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  previewAmounts: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 2,
  },
  previewPct: {
    fontSize: 16,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: '#E8F7F1',
    borderColor: '#0FB384',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  pillTextActive: {
    color: '#0FB384',
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#065F46',
  },

  // ── Create goal ──
  iconRow: {
    gap: 10,
    paddingRight: 8,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  colorDotWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#E2E8F0',
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
