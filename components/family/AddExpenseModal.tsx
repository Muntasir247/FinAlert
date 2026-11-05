import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FamilySheetModal from './FamilySheetModal';
import { EXPENSE_CATEGORIES, formatMoney } from './familyConstants';
import type { MemberFinance, SharedExpense, AddExpenseInput } from './useFamilyFinance';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface AddExpenseModalProps {
  visible: boolean;
  finances: MemberFinance[];
  onClose: () => void;
  onSubmit: (input: AddExpenseInput) => void;
  editing?: SharedExpense | null;
}

export default function AddExpenseModal({
  visible,
  finances,
  onClose,
  onSubmit,
  editing = null,
}: AddExpenseModalProps) {
  const { colors, isDark } = useTheme();
  const { isBangla, translateCategory } = useLanguage();
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].label);
  const [customCategory, setCustomCategory] = useState('');
  const [totalText, setTotalText] = useState('');
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = Number.parseFloat(totalText) || 0;
  const assignedTotal = finances.reduce(
    (sum, m) => sum + (Number.parseFloat(assignments[m.memberId]) || 0),
    0
  );
  const balance = total - assignedTotal;
  const counterColor =
    balance < -0.01 ? '#EF4444' : Math.abs(balance) < 0.01 ? '#0FB384' : '#D97706';
  const canSubmit = total > 0 && balance >= -0.01 && !saving;

  useEffect(() => {
    if (visible) {
      if (editing) {
        const known = EXPENSE_CATEGORIES.find((c) => c.label === editing.category);
        if (known) {
          setCategory(editing.category);
          setCustomCategory('');
        } else {
          setCategory('Others');
          setCustomCategory(editing.category);
        }
        setTotalText(String(editing.total));
        setAssignments(
          Object.fromEntries(
            editing.contributors.map((c) => [c.memberId, c.amount > 0 ? String(c.amount) : ''])
          )
        );
      } else {
        setCategory(EXPENSE_CATEGORIES[0].label);
        setCustomCategory('');
        setTotalText('');
        setAssignments({});
      }
      setErrorMsg(null);
      setSaving(false);
    }
  }, [visible, editing]);

  const handleClose = () => {
    if (visible) {
      setCategory(EXPENSE_CATEGORIES[0].label);
      setCustomCategory('');
      setTotalText('');
      setAssignments({});
      setErrorMsg(null);
      setSaving(false);
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const effectiveCategory =
        category === 'Others' && customCategory.trim() ? customCategory.trim() : category;
      await onSubmit({
        category: effectiveCategory,
        total,
        assignments: finances
          .map((m) => ({
            memberId: m.memberId,
            amount: Number.parseFloat(assignments[m.memberId]) || 0,
          }))
          .filter((a) => a.amount > 0),
      });
      handleClose();
    } catch (error) {
      console.error('Failed to save expense:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMsg(
        msg.includes('TOTAL_BELOW_PAID')
          ? "The new total can't be lower than what members have already paid."
          : 'Failed to save expense. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <FamilySheetModal
      visible={visible}
      title={editing ? (isBangla ? 'যৌথ খরচ সম্পাদনা' : 'Edit Shared Expense') : (isBangla ? 'যৌথ খরচ যোগ করুন' : 'Add Shared Expense')}
      onClose={handleClose}
      keyboardAvoiding
    >
      {/* Category selector */}
      <Text style={[styles.label, { color: colors.textSecondary }]}>{isBangla ? 'খাত' : 'Category'}</Text>
      <View style={styles.grid}>
        {EXPENSE_CATEGORIES.map((c) => {
          const selected = category === c.label;
          return (
            <TouchableOpacity
              key={c.label}
              style={[
                styles.gridItem,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                selected && styles.gridItemActive,
              ]}
              onPress={() => setCategory(c.label)}
              accessibilityRole="button"
              accessibilityLabel={`Category ${c.label}`}
              accessibilityState={{ selected }}
            >
              <Ionicons name={c.icon} size={20} color={selected ? '#FFFFFF' : c.tint} />
              <Text style={[styles.gridItemLabel, { color: colors.text }, selected && styles.gridItemLabelActive]}>
                {translateCategory(c.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom name when Others is selected */}
      {category === 'Others' && (
        <>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {isBangla ? 'এই খরচটি কী উদ্দেশ্যে?' : 'What is this expense for?'}
          </Text>
          <View style={[styles.amountWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Ionicons name="pricetag-outline" size={18} color="#8B5CF6" style={styles.customIcon} />
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              value={customCategory}
              onChangeText={setCustomCategory}
              placeholder={isBangla ? 'যেমন: স্কুলের বেতন' : 'e.g. School fees'}
              placeholderTextColor={colors.textMuted}
              maxLength={40}
              accessibilityLabel="Expense description"
            />
          </View>
        </>
      )}

      {/* Total amount */}
      <Text style={[styles.label, { color: colors.textSecondary }]}>{isBangla ? 'মোট পরিমাণ' : 'Total Amount'}</Text>
      <View style={[styles.amountWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
        <Text style={[styles.currencyPrefix, { color: colors.text }]}>৳</Text>
        <TextInput
          style={[styles.amountInput, { color: colors.text }]}
          value={totalText}
          onChangeText={setTotalText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Total expense amount"
        />
      </View>

      {/* Assign to members */}
      <Text style={[styles.label, { color: colors.textSecondary }]}>{isBangla ? 'সদস্যদের বরাদ্দ করুন' : 'Assign to Members'}</Text>
      {finances.length === 0 ? (
        <Text style={[styles.noMembers, { color: colors.textSecondary }]}>
          {isBangla ? 'এখনও কোনো পরিবারের সদস্য নেই।' : 'No family members yet.'}
        </Text>
      ) : (
        finances.map((m) => {
          const isDependent = m.role === 'Dependent';
          const value = assignments[m.memberId] ?? '';
          return (
            <View key={m.memberId} style={[styles.assignRow, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}>
              <View style={[styles.assignAvatar, { backgroundColor: isDependent ? (isDark ? colors.card : '#F1F5F9') : '#0FB384' }]}>
                <Text style={styles.assignAvatarText}>
                  {m.name
                    .split(/\s+/)
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.assignInfo}>
                <Text style={[styles.assignName, { color: colors.text }]}>{m.name}</Text>
                <Text style={[styles.assignLimit, { color: colors.textSecondary }, isDependent && styles.assignLimitZero]}>
                  {isDependent
                    ? (isBangla ? 'কোনো অবদান নেই' : 'No contribution')
                    : m.limit > 0
                    ? `${isBangla ? 'সর্বোচ্চ:' : 'Max:'} ${formatMoney(m.limit)}`
                    : (isBangla ? 'কোনো সীমা নেই' : 'No limit set')}
                </Text>
              </View>
              <View style={[styles.assignInputWrap, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isDependent && [styles.assignInputWrapDisabled, isDark && { backgroundColor: colors.surfaceSubtle }]]}>
                <Text style={[styles.assignCurrency, { color: colors.text }]}>৳</Text>
                <TextInput
                  style={[styles.assignInput, { color: colors.text }]}
                  value={value}
                  onChangeText={(text) =>
                    setAssignments((prev) => ({ ...prev, [m.memberId]: text }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  editable={!isDependent}
                  accessibilityLabel={`Assigned amount for ${m.name}`}
                />
              </View>
            </View>
          );
        })
      )}

      {/* Total assigned counter */}
      <View style={styles.counterRow}>
        <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>
          {isBangla ? 'মোট বরাদ্দ' : 'Total Assigned'}
        </Text>
        <Text style={[styles.counterValue, { color: counterColor }]}>
          {formatMoney(assignedTotal)} / {formatMoney(total)}
        </Text>
      </View>
      {balance > 0.01 && (
        <Text style={[styles.counterHint, { color: colors.textSecondary }]}>
          {isBangla ? 'অবশিষ্ট:' : 'Unassigned:'} {formatMoney(balance)}
        </Text>
      )}
      {balance < -0.01 && (
        <Text style={styles.counterError}>
          {isBangla ? 'বরাদ্দকৃত পরিমাণ মোট খরচের চেয়ে বেশি।' : 'Assigned amount exceeds the total.'}
        </Text>
      )}

      {errorMsg && (
        <View style={[styles.errorBox, isDark && { backgroundColor: '#38161A', borderColor: '#7F1D1D' }]}>
          <Text style={[styles.errorText, isDark && { color: '#FCA5A5' }]}>{errorMsg}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel={editing ? 'Save Changes' : 'Add Expense'}
      >
        <Ionicons name={editing ? 'checkmark' : 'add'} size={18} color="#FFFFFF" />
        <Text style={styles.submitBtnText}>
          {editing
            ? (isBangla ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes')
            : (isBangla ? 'খরচ যোগ করুন' : 'Add Expense')}
        </Text>
      </TouchableOpacity>
    </FamilySheetModal>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
    marginBottom: 10,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  gridItem: {
    width: '31%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  gridItemActive: {
    backgroundColor: '#0FB384',
    borderColor: '#0FB384',
  },
  gridItemLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    textAlign: 'center',
  },
  gridItemLabelActive: {
    color: '#FFFFFF',
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 20,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: '#091E15',
    marginRight: 8,
  },
  customIcon: {
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#091E15',
    padding: 0,
  },
  noMembers: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  assignAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  assignInfo: {
    flex: 1,
  },
  assignName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  assignLimit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  assignLimitZero: {
    color: '#94A3B8',
  },
  assignInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    height: 40,
    width: 104,
  },
  assignInputWrapDisabled: {
    backgroundColor: '#F1F5F9',
  },
  assignCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
    marginRight: 4,
  },
  assignInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#091E15',
    padding: 0,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  counterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  counterValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  counterHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#D97706',
    marginBottom: 12,
  },
  counterError: {
    fontSize: 12,
    fontWeight: '400',
    color: '#EF4444',
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#DC2626',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0FB384',
    marginTop: 12,
  },
  submitBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
