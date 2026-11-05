import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AddExpenseModal from './AddExpenseModal';
import { expenseCategoryMeta, formatMoney, initialsOf } from './familyConstants';
import type { FamilyFinanceApi, SharedExpense } from './useFamilyFinance';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface FamilyExpensesPanelProps {
  finance: FamilyFinanceApi;
}

export default function FamilyExpensesPanel({ finance }: FamilyExpensesPanelProps) {
  const { colors, isDark } = useTheme();
  const { isBangla, translateCategory } = useLanguage();
  const [addVisible, setAddVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<SharedExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SharedExpense | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { expenses, finances, isAdmin } = finance;

  const handleDelete = async () => {
    if (!confirmDelete || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await finance.deleteExpense(confirmDelete.id);
      setConfirmDelete(null);
    } catch (error) {
      console.error('Failed to delete expense:', error);
      setDeleteError('Failed to delete the expense. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.addBtn, isDark && { backgroundColor: '#143D2E', borderColor: '#0FB384' }]}
        onPress={() => setAddVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add shared expense"
      >
        <Ionicons name="add" size={18} color="#0FB384" />
        <Text style={styles.addBtnLabel}>{isBangla ? 'যৌথ খরচ যোগ করুন' : 'Add Shared Expense'}</Text>
      </TouchableOpacity>

      {expenses.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {isBangla ? 'এখনও কোনো যৌথ খরচ নেই' : 'No shared expenses yet'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {isBangla ? 'যৌথ পারিবারিক খরচ যোগ করা হলে এখানে প্রদর্শিত হবে।' : 'Shared family expenses will appear here once added.'}
          </Text>
        </View>
      ) : (
        expenses.map((expense) => {
          const meta = expenseCategoryMeta(expense.category);
          const paid = finance.expensePaid(expense);
          const pct = expense.total > 0 ? Math.round((paid / expense.total) * 100) : 0;
          const status = finance.expenseStatus(expense);
          const isPaid = status === 'Paid';
          return (
            <View key={expense.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {/* Card header */}
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: `${meta.tint}1A` }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.tint} />
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{translateCategory(expense.category)}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: isPaid ? (isDark ? '#143D2E' : '#E8F7F1') : (isDark ? '#38280B' : '#FEF3C7') },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: isPaid ? '#0FB384' : '#D97706' }]}>
                      {isBangla ? (isPaid ? 'পরিশোধিত' : 'বকেয়া') : status}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardHeaderRight}>
                  {isAdmin && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => setEditingExpense(expense)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${expense.category}`}
                      >
                        <Feather name="edit-2" size={16} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => setConfirmDelete(expense)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${expense.category}`}
                      >
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={[styles.totalAmount, { color: colors.text }]}>{formatMoney(expense.total)}</Text>
                </View>
              </View>

              {/* Progress */}
              <View style={styles.progressRow}>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  {formatMoney(paid)} {isBangla ? 'পরিশোধিত' : 'paid'}
                </Text>
                <Text style={[styles.progressPct, { color: colors.textSecondary }]}>{pct}%</Text>
              </View>
              <View style={[styles.progressBg, { backgroundColor: colors.divider }]}>
                <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
              </View>

              {/* Contributors */}
              <Text style={[styles.contributorsTitle, { color: colors.textSecondary }]}>
                {isBangla ? 'অবদানকারীগণ' : 'Contributors'}
              </Text>
              {expense.contributors.map((c) => {
                const member = finances.find((m) => m.memberId === c.memberId);
                const name = member?.name ?? 'Member';
                const extra = c.paidAmount - c.amount;
                return (
                  <View key={c.memberId} style={styles.contributorRow}>
                    <View style={styles.contributorAvatar}>
                      <Text style={styles.contributorAvatarText}>{initialsOf(name)}</Text>
                    </View>
                    <Text style={[styles.contributorName, { color: colors.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <View style={styles.contributorAmountWrap}>
                      {extra > 0.01 && (
                        <Text style={styles.contributorExtra}>+{formatMoney(extra)}</Text>
                      )}
                      <Text style={[styles.contributorAmount, { color: colors.text }]}>{formatMoney(c.paidAmount)}</Text>
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
        visible={addVisible || !!editingExpense}
        finances={finances}
        editing={editingExpense}
        onClose={() => {
          setAddVisible(false);
          setEditingExpense(null);
        }}
        onSubmit={(input) => {
          if (editingExpense) {
            return finance.updateExpense(editingExpense.id, input);
          }
          return finance.addExpense(input);
        }}
      />

      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.confirmIconWrap}>
              <Feather name="alert-triangle" size={24} color="#EF4444" />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              {isBangla ? 'যৌথ খরচ মুছবেন?' : 'Delete shared expense?'}
            </Text>
            <Text style={[styles.confirmText, { color: colors.textSecondary }]}>
              {isBangla
                ? `এটি "${confirmDelete?.category}" (${formatMoney(confirmDelete?.total ?? 0)}) এবং এর সমস্ত অর্থপ্রদানের রেকর্ড মুছে ফেলবে।`
                : `This will remove "${confirmDelete?.category}" (${formatMoney(confirmDelete?.total ?? 0)}) and all its payment records.`}
            </Text>
            {deleteError && (
              <Text style={styles.confirmErrorText}>{deleteError}</Text>
            )}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.cancelBtn, isDark && { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}
                onPress={() => setConfirmDelete(null)}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={[styles.cancelBtnText, isDark && { color: colors.text }]}>
                  {isBangla ? 'বাতিল' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.deleteBtn]}
                onPress={handleDelete}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.deleteBtnText}>
                  {busy ? (isBangla ? 'মুছছি…' : 'Deleting…') : (isBangla ? 'মুছুন' : 'Delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  cardHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#091E15',
    marginBottom: 6,
  },
  confirmText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmErrorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 14,
  },
});
