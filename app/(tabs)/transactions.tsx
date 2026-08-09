import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTransactions } from '../../context/TransactionsContext';
import { useBudgets } from '../../context/BudgetsContext';
import { TRANSACTION_CATEGORIES } from '../../lib/transactionCategories';
import type { Transaction } from '../../lib/transactions';
import AddTransactionModal from '../../components/AddTransactionModal';
import CircularProgress from '../../components/CircularProgress';

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
  const { transactions, deleteTransaction, transactionsTabRequested, clearTransactionsTabRequest } =
    useTransactions();
  const { budget, categoryBudgets, monthlySpent, openBudgetModal, budgetTabRequested, clearBudgetTabRequest } =
    useBudgets();
  const [activeTab, setActiveTab] = useState<'transactions' | 'budget'>('transactions');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (budgetTabRequested) {
      setActiveTab('budget');
      clearBudgetTabRequest();
    }
  }, [budgetTabRequested, clearBudgetTabRequest]);

  useEffect(() => {
    if (transactionsTabRequested) {
      setActiveTab('transactions');
      clearTransactionsTabRequest();
    }
  }, [transactionsTabRequested, clearTransactionsTabRequest]);

  const query = searchQuery.trim().toLowerCase();
  const filtered = transactions.filter((t) => {
    if (activeFilter === 'Income' && t.type !== 'income') return false;
    if (activeFilter === 'Expense' && t.type !== 'expense') return false;
    if (query) {
      const haystack = `${t.description ?? ''} ${t.category}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const grouped = groupByDate(filtered);

  // ── Stats: derived from all transactions ──
  let totalIncome = 0;
  let totalExpense = 0;
  for (const tx of transactions) {
    if (tx.type === 'income') totalIncome += tx.amount;
    else totalExpense += tx.amount;
  }
  const formatMoney = (n: number) => `৳${Math.round(n).toLocaleString()}`;

  // ── Budget overview (bound to shared budget state) ──
  const monthlyBudgetTotal = budget?.total_spending_budget ?? 0;
  const monthlyBudgetUsedPct =
    monthlyBudgetTotal > 0 ? (monthlySpent / monthlyBudgetTotal) * 100 : 0;
  const monthlyRemaining = monthlyBudgetTotal - monthlySpent;

  const budgetUsedColor =
    monthlyBudgetUsedPct >= 100 ? '#EF4444' : monthlyBudgetUsedPct >= 75 ? '#D97706' : '#0FB384';

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleEdit = (item: Transaction) => {
    setExpandedId(null);
    setEditingTx(item);
    setModalVisible(true);
  };

  const handleDelete = (item: Transaction) => {
    Alert.alert(
      'Delete transaction?',
      `This will remove ${item.type === 'income' ? '+' : '-'}৳${item.amount.toLocaleString()} and update your balance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteTransaction(item.id);
            if (error) {
              console.error('Failed to delete transaction:', error);
            }
            setExpandedId(null);
          },
        },
      ]
    );
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingTx(null);
  };

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
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={openBudgetModal}
              accessibilityRole="button"
              accessibilityLabel="Set up or edit budget limits"
            >
              <Feather name="sliders" size={20} color="#091E15" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, styles.headerBtnPrimary]}
              onPress={() => {
                setEditingTx(null);
                setModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Add transaction"
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Stats Overview ── */}
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Income</Text>
            <Text style={styles.statsIncome}>{formatMoney(totalIncome)}</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Expense</Text>
            <Text style={styles.statsExpense}>{formatMoney(totalExpense)}</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Remaining</Text>
            <Text style={styles.statsRemaining}>{formatMoney(totalIncome - totalExpense)}</Text>
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
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search transactions"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Feather name="x" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
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
                <Text style={styles.emptyStateText}>
                  {activeFilter !== 'All' || query
                    ? 'No transactions match your search.'
                    : 'No transactions yet.'}
                </Text>
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
                    const isExpanded = expandedId === item.id;
                    return (
                      <View key={item.id}>
                        <TouchableOpacity
                          style={styles.txCard}
                          activeOpacity={0.7}
                          onPress={() => toggleExpanded(item.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.description || item.category} transaction`}
                          accessibilityState={{ expanded: isExpanded }}
                        >
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
                          <TouchableOpacity
                            style={styles.txDropdown}
                            onPress={() => toggleExpanded(item.id)}
                            accessibilityRole="button"
                            accessibilityLabel={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            <Feather
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color="#94A3B8"
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.txActionsRow}>
                            <TouchableOpacity
                              style={styles.txActionEdit}
                              onPress={() => handleEdit(item)}
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${item.description || item.category} transaction`}
                            >
                              <Feather name="edit-2" size={16} color="#0FB384" />
                              <Text style={styles.txActionEditText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.txActionDelete}
                              onPress={() => handleDelete(item)}
                              accessibilityRole="button"
                              accessibilityLabel={`Delete ${item.description || item.category} transaction`}
                            >
                              <Feather name="trash-2" size={16} color="#EF4444" />
                              <Text style={styles.txActionDeleteText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </>
        ) : budget ? (
          <>
            {/* ── Monthly Budget Used Overview ── */}
            <View style={styles.budgetOverviewCard}>
              <CircularProgress pct={Math.min(monthlyBudgetUsedPct / 100, 1)} label="used" />
              <View style={styles.budgetOverviewText}>
                <Text style={styles.budgetOverviewLabel}>Monthly Budget Used</Text>
                <Text style={[styles.budgetOverviewSpent, { color: budgetUsedColor }]}>
                  Spent: {formatMoney(monthlySpent)}
                </Text>
                <Text style={styles.budgetOverviewRemaining}>
                  Remaining: {formatMoney(monthlyRemaining)}
                </Text>
              </View>
            </View>

            {/* ── By Category ── */}
            <Text style={styles.budgetSectionHeader}>BY CATEGORY</Text>
            {categoryBudgets.map((cb) => {
              const cat =
                TRANSACTION_CATEGORIES.find((c) => c.label === cb.category) ??
                TRANSACTION_CATEGORIES[TRANSACTION_CATEGORIES.length - 1];
              const overLimit = cb.percentage_used > 100;
              const barColor = overLimit ? '#EF4444' : '#0FB384';
              return (
                <View key={cb.category} style={styles.catBudgetCard}>
                  <View style={[styles.catBudgetIcon, { backgroundColor: cat.bg }]}>
                    <Text style={styles.catBudgetEmoji}>{cat.emoji}</Text>
                  </View>
                  <View style={styles.catBudgetInfo}>
                    <View style={styles.catBudgetHeader}>
                      <Text style={styles.catBudgetName}>{cb.category}</Text>
                      <Text style={[styles.catBudgetPct, { color: barColor }]}>
                        {Math.round(cb.percentage_used)}%
                      </Text>
                    </View>
                    <Text style={styles.catBudgetAmounts}>
                      {formatMoney(cb.spent)} / {formatMoney(cb.limit)}
                    </Text>
                    <View style={styles.catBudgetBar}>
                      <View
                        style={[
                          styles.catBudgetBarFill,
                          { width: `${Math.min(cb.percentage_used, 100)}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}

            {/* ── Edit Budget Plan ── */}
            <TouchableOpacity
              style={styles.budgetBtn}
              onPress={openBudgetModal}
              accessibilityRole="button"
              accessibilityLabel="Edit Budget Plan"
            >
              <Text style={styles.budgetBtnLabel}>Edit Budget Plan</Text>
            </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.budgetBtn}
              onPress={openBudgetModal}
              accessibilityRole="button"
              accessibilityLabel="Set Up Budget"
            >
              <Text style={styles.budgetBtnLabel}>+ Set Up Budget</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <AddTransactionModal
        visible={modalVisible}
        onClose={handleModalClose}
        editing={editingTx}
      />
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

  // ── Expandable Action Row (Edit / Delete) ──
  txActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  txActionEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#E8F7F1',
    borderWidth: 1,
    borderColor: '#0FB384',
  },
  txActionEditText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0FB384',
  },
  txActionDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  txActionDeleteText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
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
  budgetOverviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  budgetOverviewText: {
    flex: 1,
  },
  budgetOverviewLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 6,
  },
  budgetOverviewSpent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0FB384',
  },
  budgetOverviewRemaining: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 4,
  },
  budgetSectionHeader: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  catBudgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  catBudgetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  catBudgetEmoji: {
    fontSize: 18,
  },
  catBudgetInfo: {
    flex: 1,
  },
  catBudgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catBudgetName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  catBudgetPct: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '500',
  },
  catBudgetAmounts: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  catBudgetBar: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  catBudgetBarFill: {
    height: '100%',
    borderRadius: 2.5,
    backgroundColor: '#0FB384',
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
