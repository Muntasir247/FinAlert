import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AddTransactionModal from './AddTransactionModal';
import { expenseCategoryMeta, formatDateLabel, formatMoney, initialsOf } from './familyConstants';
import type { FamilyFinanceApi, FamilyTransaction, FamilyTransactionType } from './useFamilyFinance';

interface FamilyTransactionsPanelProps {
  finance: FamilyFinanceApi;
}

const TX_META: Record<FamilyTransactionType, { label: string; icon: 'checkmark-circle' | 'trending-up' | 'alert-circle'; tint: string }> = {
  payment: { label: 'Payment', icon: 'checkmark-circle', tint: '#0FB384' },
  extra: { label: 'Extra', icon: 'trending-up', tint: '#3B82F6' },
  unable: { label: 'Unable', icon: 'alert-circle', tint: '#EF4444' },
};

function groupByDate(txs: FamilyTransaction[]) {
  const groups: { date: string; items: FamilyTransaction[] }[] = [];
  for (const tx of txs) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) {
      last.items.push(tx);
    } else {
      groups.push({ date: tx.date, items: [tx] });
    }
  }
  return groups;
}

export default function FamilyTransactionsPanel({ finance }: FamilyTransactionsPanelProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmTx, setConfirmTx] = useState<FamilyTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const groups = groupByDate(finance.transactions);
  const myMemberId = finance.me?.memberId;

  const handleDeleteTx = async () => {
    if (!confirmTx || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await finance.deleteTransaction(confirmTx.id);
      setConfirmTx(null);
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      setDeleteError('Failed to delete the transaction. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add family transaction"
      >
        <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
        <Text style={styles.addBtnText}>Family Transaction</Text>
      </TouchableOpacity>

      {finance.transactions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyText}>Record payments and extra contributions here.</Text>
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.date} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{formatDateLabel(group.date)}</Text>
            {group.items.map((tx) => {
              const meta = TX_META[tx.type];
              const cat = expenseCategoryMeta(tx.expenseCategory);
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View style={styles.txAvatar}>
                    <Text style={styles.txAvatarText}>{initialsOf(tx.memberName)}</Text>
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {tx.memberName}
                      <Text style={styles.txNote}> · {tx.note || meta.label}</Text>
                    </Text>
                    <View style={styles.txMetaRow}>
                      <View style={[styles.txTypePill, { backgroundColor: `${meta.tint}1A` }]}>
                        <Ionicons name={meta.icon} size={10} color={meta.tint} />
                        <Text style={[styles.txTypeText, { color: meta.tint }]}>{meta.label}</Text>
                      </View>
                      <Text style={styles.txCategory}>{tx.expenseCategory}</Text>
                    </View>
                  </View>
                  <View style={styles.txAmountWrap}>
                    <Text style={[styles.txAmount, { color: meta.tint }]}>
                      {tx.type === 'extra' ? '+' : ''}{formatMoney(tx.amount)}
                    </Text>
                    {tx.memberId === myMemberId && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => setConfirmTx(tx)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${meta.label} transaction`}
                      >
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}

      <AddTransactionModal visible={modalVisible} finance={finance} onClose={() => setModalVisible(false)} />

      <Modal
        visible={!!confirmTx}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmTx(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Feather name="alert-triangle" size={24} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Delete this transaction?</Text>
            <Text style={styles.confirmText}>
              {confirmTx?.type === 'payment' ? 'Payment' : confirmTx?.type === 'extra' ? 'Extra' : 'Unable'}{' '}
              of {formatMoney(confirmTx?.amount ?? 0)} will be removed from{' '}
              {confirmTx?.expenseCategory}.
            </Text>
            {deleteError && (
              <Text style={styles.confirmErrorText}>{deleteError}</Text>
            )}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.cancelBtn]}
                onPress={() => setConfirmTx(null)}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.deleteBtnBg]}
                onPress={handleDeleteTx}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.deleteBtnText}>{busy ? 'Deleting…' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0FB384',
    marginBottom: 20,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
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
  dateGroup: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#091E15',
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  txAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#091E15',
  },
  txNote: {
    fontWeight: '400',
    color: '#6B7280',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  txTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  txCategory: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAmountWrap: {
    alignItems: 'flex-end',
    gap: 6,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
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
  deleteBtnBg: {
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
