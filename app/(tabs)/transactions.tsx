import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTransactions } from '../../context/TransactionsContext';
import { TRANSACTION_CATEGORIES } from '../../lib/transactionCategories';
import type { Transaction } from '../../lib/transactions';

const FILTERS = ['All', 'Income', 'Expense'] as const;

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(txs: Transaction[]) {
  const groups: { date: string; items: Transaction[]; netDaily: number }[] = [];
  for (const tx of txs) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) {
      last.items.push(tx);
      last.netDaily += tx.type === 'income' ? tx.amount : -tx.amount;
    } else {
      const netDaily = tx.type === 'income' ? tx.amount : -tx.amount;
      groups.push({ date: tx.date, items: [tx], netDaily });
    }
  }
  return groups;
}

export default function TransactionsScreen() {
  const { transactions } = useTransactions();
  const [activeTab, setActiveTab] = useState<'transactions' | 'budget'>('transactions');
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const filtered =
    activeFilter === 'Income'
      ? transactions.filter((t) => t.type === 'income')
      : activeFilter === 'Expense'
        ? transactions.filter((t) => t.type === 'expense')
        : transactions;

  const grouped = groupByDate(filtered);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Transactions</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn}>
              <Feather name="sliders" size={20} color="#091E15" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerBtn, styles.headerBtnPrimary]}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Stats Overview ── */}
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Income</Text>
            <Text style={styles.statsIncome}>৳53,000</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Expense</Text>
            <Text style={styles.statsExpense}>৳17,000</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Remaining</Text>
            <Text style={styles.statsRemaining}>৳36,000</Text>
          </View>
        </View>

        {/* ── Sub-Tab Navigation ── */}
        <View style={styles.subTabBar}>
          <TouchableOpacity
            style={styles.subTabItem}
            onPress={() => setActiveTab('transactions')}
          >
            <Text
              style={[
                styles.subTabLabel,
                activeTab === 'transactions' ? styles.subTabLabelActive : styles.subTabLabelInactive,
              ]}
            >
              Transactions
            </Text>
            {activeTab === 'transactions' && <View style={styles.subTabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.subTabItem}
            onPress={() => setActiveTab('budget')}
          >
            <Text
              style={[
                styles.subTabLabel,
                activeTab === 'budget' ? styles.subTabLabelActive : styles.subTabLabelInactive,
              ]}
            >
              Budget Limits
            </Text>
            {activeTab === 'budget' && <View style={styles.subTabUnderline} />}
          </TouchableOpacity>
        </View>

        {activeTab === 'transactions' ? (
          <>
            {/* ── Search Bar ── */}
            <View style={styles.searchContainer}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search transactions..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* ── Filter Pills ── */}
            <View style={styles.filterRow}>
              {FILTERS.map((f) => {
                const isActive = activeFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filterPill,
                      isActive ? styles.filterPillActive : styles.filterPillInactive,
                    ]}
                    onPress={() => setActiveFilter(f)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        isActive ? styles.filterPillTextActive : styles.filterPillTextInactive,
                      ]}
                    >
                      {f}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Grouped Transaction List ── */}
            {grouped.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No transactions yet.</Text>
              </View>
            ) : (
              grouped.map((group) => (
                <View key={group.date} style={styles.dateGroup}>
                  <View style={styles.dateBanner}>
                    <Text style={styles.dateLabel}>{formatDateLabel(group.date)}</Text>
                    <Text
                      style={[
                        styles.netDaily,
                        { color: group.netDaily >= 0 ? '#0FB384' : '#EF4444' },
                      ]}
                    >
                      {group.netDaily >= 0 ? '+' : ''}৳{Math.abs(group.netDaily).toLocaleString()}
                    </Text>
                  </View>

                  {group.items.map((item, idx) => {
                    const meta =
                      TRANSACTION_CATEGORIES.find((c) => c.label === item.category) ??
                      TRANSACTION_CATEGORIES[TRANSACTION_CATEGORIES.length - 1];
                    return (
                      <View key={item.id} style={styles.txCard}>
                        <View style={[styles.txIconBadge, { backgroundColor: meta.bg }]}>
                          <Text style={styles.txIconEmoji}>{meta.emoji}</Text>
                        </View>
                        <View style={styles.txCenter}>
                          <Text style={styles.txTitle}>{item.description || item.category}</Text>
                          <Text style={styles.txCategory}>{item.category}</Text>
                        </View>
                        <Text
                          style={[
                            styles.txAmount,
                            { color: item.type === 'income' ? '#0FB384' : '#EF4444' },
                          ]}
                        >
                          {item.type === 'income' ? '+' : ''}৳{item.amount.toLocaleString()}
                        </Text>
                        <TouchableOpacity style={styles.txDropdown}>
                          <Feather name="chevron-down" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </>
        ) : (
          <View style={styles.budgetCard}>
            <View style={styles.budgetIconBox}>
              <Ionicons name="bar-chart-sharp" size={36} color="#0FB384" />
            </View>
            <Text style={styles.budgetTitle}>Set Your Budget Limits</Text>
            <Text style={styles.budgetParagraph}>
              Enter your income and savings target to automatically calculate spending limits for each category.
            </Text>
            <TouchableOpacity style={styles.budgetBtn}>
              <Text style={styles.budgetBtnLabel}>+ Set Up Budget</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerBtnPrimary: {
    backgroundColor: '#0FB384',
    borderColor: '#0FB384',
  },

  // ── Stats Overview ──
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 6,
  },
  statsIncome: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0FB384',
  },
  statsExpense: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  statsRemaining: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
  },

  // ── Sub-Tab Navigation ──
  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 20,
  },
  subTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
  },
  subTabLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  subTabLabelActive: {
    color: '#0FB384',
  },
  subTabLabelInactive: {
    color: '#94A3B8',
  },
  subTabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#0FB384',
    borderRadius: 1,
  },

  // ── Search Bar ──
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
    padding: 0,
  },

  // ── Filter Pills ──
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillActive: {
    borderColor: '#0FB384',
    backgroundColor: '#E8F7F1',
  },
  filterPillInactive: {
    borderColor: '#E2E8F0',
    backgroundColor: 'transparent',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#0FB384',
  },
  filterPillTextInactive: {
    color: '#94A3B8',
  },

  // ── Grouped Transaction List ──
  dateGroup: {
    marginBottom: 20,
  },
  dateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#091E15',
  },
  netDaily: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Transaction Card ──
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  txIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconEmoji: {
    fontSize: 18,
  },
  txCenter: {
    flex: 1,
    marginLeft: 12,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  txCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  txDropdown: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  // ── Budget Limits Card ──
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  budgetIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#E8F7F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  budgetTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
    textAlign: 'center',
    marginBottom: 12,
  },
  budgetParagraph: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  budgetBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#0FB384',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  budgetBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0FB384',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
  },
});
