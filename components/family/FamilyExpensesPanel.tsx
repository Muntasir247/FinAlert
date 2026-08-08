import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AddExpenseModal from './AddExpenseModal';
import { expenseCategoryMeta, formatMoney, initialsOf } from './familyConstants';
import type { FamilyFinanceApi } from './useFamilyFinance';

interface FamilyExpensesPanelProps {
  finance: FamilyFinanceApi;
}

export default function FamilyExpensesPanel({ finance }: FamilyExpensesPanelProps) {
  const [addVisible, setAddVisible] = useState(false);
  const { expenses, finances } = finance;

  return (
    <View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setAddVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add shared expense"
      >
        <Ionicons name="add" size={18} color="#0FB384" />
        <Text style={styles.addBtnLabel}>Add Shared Expense</Text>
      </TouchableOpacity>

      {expenses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No shared expenses yet</Text>
          <Text style={styles.emptyText}>Shared family expenses will appear here once added.</Text>
        </View>
      ) : (
        expenses.map((expense) => {
          const meta = expenseCategoryMeta(expense.category);
          const paid = finance.expensePaid(expense);
          const pct = expense.total > 0 ? Math.round((paid / expense.total) * 100) : 0;
          const status = finance.expenseStatus(expense);
          const isPaid = status === 'Paid';
          return (
            <View key={expense.id} style={styles.card}>
              {/* Card header */}
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: `${meta.tint}1A` }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.tint} />
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle}>{expense.category}</Text>
                  <View
                    style={[styles.statusPill, { backgroundColor: isPaid ? '#E8F7F1' : '#FEF3C7' }]}
                  >
                    <Text style={[styles.statusText, { color: isPaid ? '#0FB384' : '#D97706' }]}>
                      {status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.totalAmount}>{formatMoney(expense.total)}</Text>
              </View>

              {/* Progress */}
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>{formatMoney(paid)} paid</Text>
                <Text style={styles.progressPct}>{pct}%</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
              </View>

              {/* Contributors */}
              <Text style={styles.contributorsTitle}>Contributors</Text>
              {expense.contributors.map((c) => {
                const member = finances.find((m) => m.memberId === c.memberId);
                const name = member?.name ?? 'Member';
                const extra = c.paidAmount - c.amount;
                return (
                  <View key={c.memberId} style={styles.contributorRow}>
                    <View style={styles.contributorAvatar}>
                      <Text style={styles.contributorAvatarText}>{initialsOf(name)}</Text>
                    </View>
                    <Text style={styles.contributorName} numberOfLines={1}>
                      {name}
                    </Text>
                    <View style={styles.contributorAmountWrap}>
                      {extra > 0.01 && (
                        <Text style={styles.contributorExtra}>+{formatMoney(extra)}</Text>
                      )}
                      <Text style={styles.contributorAmount}>{formatMoney(c.paidAmount)}</Text>
                    </View>
                    {c.paid ? (
                      <Ionicons name="checkmark-circle" size={20} color="#0FB384" />
                    ) : (
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    )}
                  </View>
                );
              })}
            </View>
          );
        })
      )}

      <AddExpenseModal
        visible={addVisible}
        finances={finances}
        onClose={() => setAddVisible(false)}
        onSubmit={finance.addExpense}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#0FB384',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  addBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0FB384',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#091E15',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#091E15',
    marginBottom: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0FB384',
  },
  progressBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#0FB384',
  },
  contributorsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  contributorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contributorAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contributorName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  contributorAmountWrap: {
    alignItems: 'flex-end',
  },
  contributorAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#091E15',
  },
  contributorExtra: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 1,
  },
});
