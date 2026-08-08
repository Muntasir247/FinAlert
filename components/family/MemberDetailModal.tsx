import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FamilySheetModal from './FamilySheetModal';
import { ROLE_BG, ROLE_TEXT_COLOR, expenseCategoryMeta, formatDateLabel, formatMoney, initialsOf } from './familyConstants';
import type { FamilyFinanceApi, FamilyTransaction, FamilyTransactionType, MemberFinance } from './useFamilyFinance';

interface MemberDetailModalProps {
  visible: boolean;
  member: MemberFinance | null;
  finance: FamilyFinanceApi;
  onClose: () => void;
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

export default function MemberDetailModal({ visible, member, finance, onClose }: MemberDetailModalProps) {
  if (!member) {
    return (
      <FamilySheetModal visible={visible} title="Member Activity" onClose={onClose}>
        <Text style={styles.emptyText}>Select a member to view their activity.</Text>
      </FamilySheetModal>
    );
  }

  const paid = finance.memberPaid(member.memberId);
  const logs = finance.transactions.filter((t) => t.memberId === member.memberId);
  const grouped = groupByDate(logs);

  return (
    <FamilySheetModal visible={visible} title="Member Activity" onClose={onClose}>
      {/* Member banner */}
      <View style={styles.banner}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(member.name)}</Text>
        </View>
        <View style={styles.bannerInfo}>
          <Text style={styles.name}>{member.name}</Text>
          <View style={[styles.rolePill, { backgroundColor: ROLE_BG[member.role] }]}>
            <Text style={[styles.rolePillText, { color: ROLE_TEXT_COLOR[member.role] }]}>
              {member.role}
            </Text>
          </View>
        </View>
      </View>

      {/* Totals */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Limit</Text>
          <Text style={styles.statValue}>{formatMoney(member.limit)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={[styles.statValue, { color: '#0FB384' }]}>{formatMoney(paid)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Extra</Text>
          <Text style={[styles.statValue, { color: '#3B82F6' }]}>{formatMoney(member.extra)}</Text>
        </View>
      </View>

      {/* Expense logs */}
      <Text style={styles.sectionTitle}>Activity Log</Text>
      {grouped.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={26} color="#94A3B8" />
          <Text style={styles.emptyText}>No activity yet.</Text>
        </View>
      ) : (
        grouped.map((group) => (
          <View key={group.date} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{formatDateLabel(group.date)}</Text>
            {group.items.map((tx) => {
              const meta = TX_META[tx.type];
              const cat = expenseCategoryMeta(tx.expenseCategory);
              return (
                <View key={tx.id} style={styles.logRow}>
                  <View style={[styles.logIcon, { backgroundColor: `${meta.tint}1A` }]}>
                    <Ionicons name={meta.icon} size={16} color={meta.tint} />
                  </View>
                  <View style={styles.logInfo}>
                    <Text style={styles.logTitle}>{tx.note || meta.label}</Text>
                    <Text style={styles.logSubtitle}>{tx.expenseCategory}</Text>
                  </View>
                  <Text style={[styles.logAmount, { color: meta.tint }]}>
                    {tx.type === 'extra' ? '+' : ''}{formatMoney(tx.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))
      )}
    </FamilySheetModal>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bannerInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#091E15',
    marginBottom: 4,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    flexShrink: 0,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
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
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  logSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 1,
  },
  logAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
