import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const groups = groupByDate(finance.transactions);

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
                  <Text style={[styles.txAmount, { color: meta.tint }]}>
                    {tx.type === 'extra' ? '+' : ''}{formatMoney(tx.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))
      )}

      <AddTransactionModal visible={modalVisible} finance={finance} onClose={() => setModalVisible(false)} />
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
});
