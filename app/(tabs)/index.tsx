import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../context/TransactionsContext';
import { useBudgets } from '../../context/BudgetsContext';
import AddTransactionModal from '../../components/AddTransactionModal';
import CircularProgress from '../../components/CircularProgress';
import { TRANSACTION_CATEGORIES } from '../../lib/transactionCategories';

// ── Horizontal Progress Bar ─────────────────────────────────────────────

function ProgressBar({ pct, color = '#0FB384' }: { pct: number; color?: string }) {
  return (
    <View style={styles.pbBg}>
      <View style={[styles.pbFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── Savings Goal Card ───────────────────────────────────────────────────

function SavingsCard({
  icon,
  iconBg,
  title,
  progress,
  progressColor,
  amount,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  progress: number;
  progressColor: string;
  amount: string;
}) {
  return (
    <View style={styles.savingsCard}>
      <View style={[styles.savingsIconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.savingsTitle}>{title}</Text>
      <ProgressBar pct={progress} color={progressColor} />
      <Text style={styles.savingsAmount}>{amount}</Text>
    </View>
  );
}

// ── Home Screen ─────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { profile } = useAuth();
  const { transactions } = useTransactions();
  const { budget, categoryBudgets, openBudgetModal, requestBudgetTab } = useBudgets();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);

  const recentTransactions = transactions.slice(0, 3);
  const topCategoryBudgets = categoryBudgets.slice(0, 3);

  const categoryMeta = (label: string) =>
    TRANSACTION_CATEGORIES.find((c) => c.label === label) ?? TRANSACTION_CATEGORIES[TRANSACTION_CATEGORIES.length - 1];

  // ── Budget card: derived from saved plan + this month's transactions ──
  const now = new Date();
  const currentMonthKey = now.getFullYear() * 100 + (now.getMonth() + 1);

  let monthIncome = 0;
  let monthSpent = 0;
  for (const tx of transactions) {
    const [y, m] = tx.date.split('-').map(Number);
    if (y * 100 + m !== currentMonthKey) continue;
    if (tx.type === 'income') monthIncome += tx.amount;
    else monthSpent += tx.amount;
  }
  // Preferred source of the "total" is the saved budget's spending budget;
  // fall back to this month's income when no plan has been set up yet.
  const budgetTotal = budget?.total_spending_budget ?? monthIncome;
  const spent = monthSpent;
  const available = budgetTotal - spent;
  const spentPct = budgetTotal > 0 ? Math.min(spent / budgetTotal, 1) : 0;

  const formatMoney = (n: number) => `৳${Math.round(n).toLocaleString()}`;

  const handleSeeAllBudgets = () => {
    requestBudgetTab();
    router.navigate('/(tabs)/transactions');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header Row ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingText}>Good morning,</Text>
            <Text style={styles.nameText}>{profile?.full_name || 'Name'} 👋</Text>
          </View>
          <View style={styles.iconRow}>
            <TouchableOpacity style={styles.iconButton}>
              <Feather name="mic" size={20} color="#091E15" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Feather name="aperture" size={20} color="#091E15" />
            </TouchableOpacity>
            <View>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="notifications-outline" size={20} color="#091E15" />
              </TouchableOpacity>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>3</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Available Balance Card ── */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <CircularProgress pct={spentPct} />
            <View style={styles.cardTextStack}>
              <Text style={styles.availableLabel}>Available this month</Text>
              <Text style={styles.balanceAmount}>{formatMoney(available)}</Text>
              <Text style={styles.balanceDetail}>
                of {formatMoney(budgetTotal)} · <Text style={styles.spentText}>{formatMoney(spent)} spent</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} accessibilityRole="button" accessibilityLabel="Add transaction">
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Budgets Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Budgets</Text>
          <TouchableOpacity
            onPress={handleSeeAllBudgets}
            accessibilityRole="button"
            accessibilityLabel="See all budgets"
          >
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        {budget ? (
          <View style={styles.budgetCardList}>
            {topCategoryBudgets.map((cb) => {
              const meta = categoryMeta(cb.category);
              const over = cb.percentage_used > 100;
              const barColor = over ? '#EF4444' : '#0FB384';
              return (
                <TouchableOpacity
                  key={cb.category}
                  style={styles.budgetCard}
                  onPress={openBudgetModal}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit budget for ${cb.category}`}
                >
                  <View style={[styles.budgetCardIcon, { backgroundColor: meta.bg }]}>
                    <Text style={styles.budgetCardEmoji}>{meta.emoji}</Text>
                  </View>
                  <View style={styles.budgetCardInfo}>
                    <View style={styles.budgetCardHeader}>
                      <Text style={styles.budgetCardName} numberOfLines={1}>
                        {cb.category}
                      </Text>
                      <Text style={[styles.budgetCardPct, { color: barColor }]}>
                        {Math.round(cb.percentage_used)}%
                      </Text>
                    </View>
                    <Text style={styles.budgetCardAmounts}>
                      {formatMoney(cb.spent)} / {formatMoney(cb.limit)}
                    </Text>
                    <View style={styles.budgetCardBar}>
                      <View
                        style={[
                          styles.budgetCardBarFill,
                          {
                            width: `${Math.min(cb.percentage_used, 100)}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.dashedBox}>
            <Ionicons name="pie-chart-outline" size={32} color="#9CA3AF" />
            <TouchableOpacity
              onPress={openBudgetModal}
              accessibilityRole="button"
              accessibilityLabel="Set up budget limits"
            >
              <Text style={styles.dashedLink}>Set up budget limits →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── AI Financial Insight Banner ── */}
        <View style={styles.aiBanner}>
          <View style={styles.aiHeaderRow}>
            <Ionicons name="sparkles" size={18} color="#7C3AED" />
            <Text style={styles.aiHeaderText}>AI financial insight</Text>
          </View>
          <Text style={styles.aiBodyText}>
            Spending up 23% on food this week. Tap for advice.
          </Text>
        </View>

        {/* ── Savings Goals Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Savings Goal</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
        >
          <SavingsCard
            icon={<Ionicons name="shield-checkmark-outline" size={20} color="#3B82F6" />}
            iconBg="#DBEAFE"
            title="Emergency Fund"
            progress={0.3}
            progressColor="#3B82F6"
            amount="৳15,000 of ৳50,000"
          />
          <SavingsCard
            icon={<Ionicons name="airplane-outline" size={20} color="#0FB384" />}
            iconBg="#D1FAE5"
            title="Trip Fund"
            progress={0.34}
            progressColor="#0FB384"
            amount="৳8,500 of ৳25,000"
          />
          <SavingsCard
            icon={<Ionicons name="phone-portrait-outline" size={20} color="#8B5CF6" />}
            iconBg="#EDE9FE"
            title="New Phone"
            progress={0.6}
            progressColor="#8B5CF6"
            amount="৳12,000 of ৳20,000"
          />
        </ScrollView>

        {/* ── Recent Transactions Feed ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See all &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionSection}>
          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions yet. Tap + to add one.</Text>
            </View>
          ) : (
            recentTransactions.map((tx, index) => {
              const meta = categoryMeta(tx.category);
              const isLast = index === recentTransactions.length - 1;
              const isIncome = tx.type === 'income';
              return (
                <View
                  key={tx.id}
                  style={[styles.transactionRow, isLast && styles.transactionRowLast]}
                >
                  <View style={[styles.txIconBase, { backgroundColor: meta.bg }]}>
                    <Text style={styles.txIconEmoji}>{meta.emoji}</Text>
                  </View>
                  <View style={styles.txTextArea}>
                    <Text style={styles.txName}>{tx.description || tx.category}</Text>
                    <Text style={styles.txMeta}>
                      {tx.category.toLowerCase()} · {tx.date}
                    </Text>
                  </View>
                  <Text style={isIncome ? styles.amountGreen : styles.amountRed}>
                    {isIncome ? '+' : '-'}৳{tx.amount.toLocaleString()}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <AddTransactionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout Shell
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  greetingText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  nameText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Balance Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardTextStack: {
    flex: 1,
  },
  availableLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#091E15',
    lineHeight: 32,
    marginTop: 4,
  },
  balanceDetail: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 4,
  },
  spentText: {
    color: '#DC2626',
    fontWeight: '500',
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0FB384',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  // Progress Bar
  pbBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginVertical: 8,
  },
  pbFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#091E15',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0FB384',
  },

  // Budgets Dashed Box
  dashedBox: {
    width: '100%',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dashedLink: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0FB384',
    marginTop: 8,
  },

  // Budget Category Cards (when a plan exists)
  budgetCardList: {
    gap: 10,
    marginBottom: 24,
  },
  budgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 12,
  },
  budgetCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetCardEmoji: {
    fontSize: 18,
  },
  budgetCardInfo: {
    flex: 1,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetCardName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
    flex: 1,
    marginRight: 8,
  },
  budgetCardPct: {
    fontSize: 12,
    fontWeight: '700',
  },
  budgetCardAmounts: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  budgetCardBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginTop: 8,
  },
  budgetCardBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // AI Banner
  aiBanner: {
    width: '100%',
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  aiHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C3AED',
  },
  aiBodyText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#7C3AED',
    marginLeft: 28,
  },

  // Savings Carousel
  carouselContent: {
    paddingRight: 16,
    gap: 12,
    marginBottom: 24,
  },
  savingsCard: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  savingsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  savingsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
    marginBottom: 2,
  },
  savingsAmount: {
    fontSize: 12,
    color: '#64748B',
  },

  // Transaction Feed
  transactionSection: {
    paddingBottom: 12,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  txIconBase: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconEmoji: {
    fontSize: 18,
  },
  txTextArea: {
    flex: 1,
    marginLeft: 12,
  },
  txName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  txMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  amountGreen: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0FB384',
  },
  amountRed: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
  },
});
