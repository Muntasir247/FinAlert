import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FamilySheetModal from './FamilySheetModal';
import { EXPENSE_CATEGORIES, formatMoney } from './familyConstants';
import type { MemberFinance, AddExpenseInput } from './useFamilyFinance';

interface AddExpenseModalProps {
  visible: boolean;
  finances: MemberFinance[];
  onClose: () => void;
  onSubmit: (input: AddExpenseInput) => void;
}

export default function AddExpenseModal({ visible, finances, onClose, onSubmit }: AddExpenseModalProps) {
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].label);
  const [totalText, setTotalText] = useState('');
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const total = Number.parseFloat(totalText) || 0;
  const assignedTotal = finances.reduce(
    (sum, m) => sum + (Number.parseFloat(assignments[m.memberId]) || 0),
    0
  );
  const balance = total - assignedTotal;
  const counterColor =
    Math.abs(balance) < 0.01 ? '#0FB384' : balance > 0 ? '#D97706' : '#EF4444';
  const canSubmit = total > 0 && assignedTotal > 0 && Math.abs(balance) < 0.01;

  const handleClose = () => {
    if (visible) {
      setCategory(EXPENSE_CATEGORIES[0].label);
      setTotalText('');
      setAssignments({});
    }
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      category,
      total,
      assignments: finances
        .map((m) => ({
          memberId: m.memberId,
          amount: Number.parseFloat(assignments[m.memberId]) || 0,
        }))
        .filter((a) => a.amount > 0),
    });
    handleClose();
  };

  return (
    <FamilySheetModal visible={visible} title="Add Shared Expense" onClose={handleClose} keyboardAvoiding>
      {/* Category selector */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.grid}>
        {EXPENSE_CATEGORIES.map((c) => {
          const selected = category === c.label;
          return (
            <TouchableOpacity
              key={c.label}
              style={[styles.gridItem, selected && styles.gridItemActive]}
              onPress={() => setCategory(c.label)}
              accessibilityRole="button"
              accessibilityLabel={`Category ${c.label}`}
              accessibilityState={{ selected }}
            >
              <Ionicons name={c.icon} size={20} color={selected ? '#FFFFFF' : c.tint} />
              <Text style={[styles.gridItemLabel, selected && styles.gridItemLabelActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Total amount */}
      <Text style={styles.label}>Total Amount</Text>
      <View style={styles.amountWrap}>
        <Text style={styles.currencyPrefix}>৳</Text>
        <TextInput
          style={styles.amountInput}
          value={totalText}
          onChangeText={setTotalText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#A0ADB6"
          accessibilityLabel="Total expense amount"
        />
      </View>

      {/* Assign to members */}
      <Text style={styles.label}>Assign to Members</Text>
      {finances.length === 0 ? (
        <Text style={styles.noMembers}>No family members yet.</Text>
      ) : (
        finances.map((m) => {
          const isDependent = m.role === 'Dependent';
          const value = assignments[m.memberId] ?? '';
          return (
            <View key={m.memberId} style={styles.assignRow}>
              <View style={[styles.assignAvatar, { backgroundColor: isDependent ? '#F1F5F9' : '#0FB384' }]}>
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
                <Text style={styles.assignName}>{m.name}</Text>
                <Text style={[styles.assignLimit, isDependent && styles.assignLimitZero]}>
                  {isDependent ? 'No contribution' : m.limit > 0 ? `Max: ${formatMoney(m.limit)}` : 'No limit set'}
                </Text>
              </View>
              <View style={[styles.assignInputWrap, isDependent && styles.assignInputWrapDisabled]}>
                <Text style={styles.assignCurrency}>৳</Text>
                <TextInput
                  style={styles.assignInput}
                  value={value}
                  onChangeText={(text) =>
                    setAssignments((prev) => ({ ...prev, [m.memberId]: text }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#A0ADB6"
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
        <Text style={styles.counterLabel}>Total Assigned</Text>
        <Text style={[styles.counterValue, { color: counterColor }]}>
          {formatMoney(assignedTotal)} / {formatMoney(total)}
        </Text>
      </View>
      {total > 0 && assignedTotal > 0 && balance > 0.01 && (
        <Text style={styles.counterHint}>Assign the full {formatMoney(total)} to add this expense.</Text>
      )}
      {balance < -0.01 && (
        <Text style={styles.counterError}>Assigned amount exceeds the total.</Text>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Add Expense"
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
        <Text style={styles.submitBtnText}>Add Expense</Text>
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
