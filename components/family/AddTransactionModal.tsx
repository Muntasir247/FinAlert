import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FamilySheetModal from './FamilySheetModal';
import { expenseCategoryMeta, formatMoney } from './familyConstants';
import type { FamilyTransactionType, FamilyFinanceApi } from './useFamilyFinance';

interface AddTransactionModalProps {
  visible: boolean;
  finance: FamilyFinanceApi;
  onClose: () => void;
}

const TYPES: { value: FamilyTransactionType; label: string; icon: 'card-outline' | 'trending-up' | 'alert-circle-outline' }[] = [
  { value: 'payment', label: 'Payment', icon: 'card-outline' },
  { value: 'extra', label: 'Extra', icon: 'trending-up' },
  { value: 'unable', label: 'Unable', icon: 'alert-circle-outline' },
];

export default function AddTransactionModal({ visible, finance, onClose }: AddTransactionModalProps) {
  const [type, setType] = useState<FamilyTransactionType>('payment');
  const [expenseId, setExpenseId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amount = Number.parseFloat(amountText) || 0;
  const selectedExpense = finance.expenses.find((e) => e.id === expenseId) ?? null;
  const remaining = selectedExpense ? Math.max(selectedExpense.total - finance.expensePaid(selectedExpense), 0) : 0;
  const overpaying = type !== 'unable' && selectedExpense !== null && amount > remaining + 0.01;
  const canSubmit = expenseId !== null && amount > 0 && !overpaying;

  const handleClose = () => {
    if (visible) {
      setType('payment');
      setExpenseId(null);
      setAmountText('');
      setNote('');
      setErrorMsg(null);
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !finance.me) return;
    try {
      await finance.recordTransaction({
        type,
        expenseId: expenseId!,
        memberId: finance.me.memberId,
        amount,
        note: note.trim(),
      });
      handleClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMsg(
        msg.includes('OVERPAY_EXCEEDS_EXPENSE')
          ? 'This payment exceeds the remaining amount for the expense.'
          : 'Failed to record transaction. Please try again.'
      );
    }
  };

  return (
    <FamilySheetModal visible={visible} title="Family Transaction" onClose={handleClose} keyboardAvoiding>
      {/* Transaction type */}
      <Text style={styles.label}>Transaction Type</Text>
      <View style={styles.segmented}>
        {TYPES.map((t) => {
          const selected = type === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              style={[styles.segment, selected && styles.segmentActive]}
              onPress={() => setType(t.value)}
              accessibilityRole="button"
              accessibilityLabel={`Type ${t.label}`}
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={selected ? '#FFFFFF' : '#64748B'}
              />
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Select expense */}
      <Text style={styles.label}>Select Expense</Text>
      {finance.expenses.length === 0 ? (
        <Text style={styles.noExpenses}>No active expenses. Add a shared expense first.</Text>
      ) : (
        finance.expenses.map((expense) => {
          const meta = expenseCategoryMeta(expense.category);
          const share = finance.me ? finance.memberShare(expense, finance.me.memberId) : 0;
          const selected = expenseId === expense.id;
          return (
            <TouchableOpacity
              key={expense.id}
              style={[styles.expenseOption, selected && styles.expenseOptionActive]}
              onPress={() => setExpenseId(expense.id)}
              accessibilityRole="button"
              accessibilityLabel={`Expense ${expense.category}`}
              accessibilityState={{ selected }}
            >
              <View style={[styles.expenseIcon, { backgroundColor: `${meta.tint}1A` }]}>
                <Ionicons name={meta.icon} size={18} color={meta.tint} />
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseName}>{expense.category}</Text>
                <Text style={styles.expenseShare}>
                  Your share: {share > 0 ? formatMoney(share) : '—'}
                </Text>
              </View>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selected ? '#0FB384' : '#CBD5E1'}
              />
            </TouchableOpacity>
          );
        })
      )}

      {/* Amount */}
      <Text style={styles.label}>Amount</Text>
      <View style={styles.amountWrap}>
        <Text style={styles.currencyPrefix}>৳</Text>
        <TextInput
          style={styles.amountInput}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#A0ADB6"
          accessibilityLabel="Transaction amount"
        />
      </View>

      {/* Note */}
      <Text style={styles.label}>Note (Optional)</Text>
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder={type === 'extra' ? 'e.g. Extra — medicine' : 'Add a note...'}
        placeholderTextColor="#A0ADB6"
        accessibilityLabel="Transaction note"
      />

      <Text style={styles.helperText}>
        * Paying beyond your assigned amount increases your contribution
      </Text>

      {type !== 'unable' && selectedExpense && (
        <Text style={[styles.remainingText, overpaying && styles.remainingTextError]}>
          Remaining to pay: {formatMoney(remaining)}
        </Text>
      )}

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Submit transaction"
      >
        <Text style={styles.submitBtnText}>
          {type === 'payment' ? 'Record Payment' : type === 'extra' ? 'Record Extra' : 'Record Unable'}
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
  segmented: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  segmentActive: {
    backgroundColor: '#0FB384',
    borderColor: '#0FB384',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  noExpenses: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 16,
  },
  expenseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  expenseOptionActive: {
    borderColor: '#0FB384',
    backgroundColor: '#F4FBF7',
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#091E15',
  },
  expenseShare: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
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
    marginBottom: 16,
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
  noteInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 16,
  },
  remainingText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: '#0FB384',
    marginBottom: 12,
  },
  remainingTextError: {
    color: '#EF4444',
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0FB384',
    marginTop: 4,
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
