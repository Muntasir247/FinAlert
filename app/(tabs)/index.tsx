import React, { ComponentProps, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../context/TransactionsContext';
import { useBudgets } from '../../context/BudgetsContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useSavingsGoals } from '../../context/SavingsGoalsContext';
import AddTransactionModal from '../../components/AddTransactionModal';
import CircularProgress from '../../components/CircularProgress';
import SavingsGoalsManager from '../../components/SavingsGoalsManager';
import VoiceEntryModal from '../../components/VoiceEntryModal';
import ScanInvoiceModal from '../../components/ScanInvoiceModal';
import BKashDetectedBanner from '../../components/BKashDetectedBanner';
import BKashSimulatorModal from '../../components/BKashSimulatorModal';
import BKashBatchReviewModal from '../../components/BKashBatchReviewModal';
import BankStatementReviewModal from '../../components/BankStatementReviewModal';
import {
  subscribeToBkashTransactions,
  subscribeToPendingTransactions,
  clearPendingTransactions,
  removePendingTransaction,
  markTrxIdProcessed,
  syncRecentSms,
} from '../../services/smsReaderService';
import type { BKashTransaction } from '../../services/smsReaderService';
import type { AddTransactionPrefill } from '../../components/AddTransactionModal';
import type { SavingsGoalsPrefill } from '../../components/SavingsGoalsManager';
import type { VoiceIntent } from '../../services/voiceIntentService';
import { TRANSACTION_CATEGORIES } from '../../lib/transactionCategories';
import { savingsGoalIconName, savingsGoalTint } from '../../lib/savingsGoals';
import type { SavingsGoal } from '../../lib/savingsGoals';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type SavingsSheetView = 'list' | 'add' | 'create';

// ── Horizontal Progress Bar ─────────────────────────────────────────────

function ProgressBar({ pct, color = '#0FB384' }: { pct: number; color?: string }) {
  return (
    <View style={styles.pbBg}>
      <View style={[styles.pbFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── Savings Goal Card ───────────────────────────────────────────────────

function SavingsGoalCard({ goal }: { goal: SavingsGoal }) {
  const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
  const barPct = Math.min(pct, 100) / 100;
  const color = goal.color;
  return (
    <View style={styles.savingsCard}>
      <View style={[styles.savingsIconBox, { backgroundColor: savingsGoalTint(color) }]}>
        <Ionicons name={savingsGoalIconName(goal.icon) as IoniconName} size={20} color={color} />
      </View>
      <Text style={styles.savingsTitle} numberOfLines={1}>
        {goal.name}
      </Text>
      <View style={styles.savingsPctRow}>
        <Text style={[styles.savingsPct, { color }]}>{Math.round(pct)}%</Text>
        <Text style={styles.savingsPctLabel}>saved</Text>
      </View>
      <ProgressBar pct={barPct} color={color} />
      <Text style={styles.savingsAmount}>
        ৳{Math.round(goal.current_amount).toLocaleString()} of ৳
        {Math.round(goal.target_amount).toLocaleString()}
      </Text>
    </View>
  );
}

// ── Home Screen ─────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { profile } = useAuth();
  const { transactions, requestTransactionsTab } = useTransactions();
  const { budget, categoryBudgets, openBudgetModal, requestBudgetTab } = useBudgets();
  const { unreadCount } = useNotifications();
  const { goals: savingsGoals } = useSavingsGoals();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [savingsSheetVisible, setSavingsSheetVisible] = useState(false);
  const [savingsSheetView, setSavingsSheetView] = useState<SavingsSheetView>('list');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isBkashSimModalOpen, setIsBkashSimModalOpen] = useState(false);
  const [detectedBkashTx, setDetectedBkashTx] = useState<BKashTransaction | null>(null);
  const [pendingBkashTxs, setPendingBkashTxs] = useState<BKashTransaction[]>([]);
  const [isBkashBatchModalOpen, setIsBkashBatchModalOpen] = useState(false);
  const [txPrefill, setTxPrefill] = useState<AddTransactionPrefill | null>(null);
  const [savingsPrefill, setSavingsPrefill] = useState<SavingsGoalsPrefill | null>(null);

  useEffect(() => {
    const unsub = subscribeToPendingTransactions((txs) => {
      setPendingBkashTxs(txs);
      if (txs.length === 1) {
        setDetectedBkashTx(txs[0]);
      } else if (txs.length === 0) {
        setDetectedBkashTx(null);
      }
    });

    // Automatically scan recent SMS inbox on mount
    syncRecentSms();

    // Automatically scan recent SMS whenever user returns to the app from background/sleep
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        syncRecentSms();
      }
    });

    return () => {
      unsub();
      appStateSub.remove();
    };
  }, []);

  const handleReviewBkashTx = (tx: BKashTransaction) => {
    markTrxIdProcessed(tx.trxId);
    removePendingTransaction(tx.trxId);
    setDetectedBkashTx(null);
    setPendingBkashTxs((prev) => prev.filter((t) => t.trxId !== tx.trxId));
    setTxPrefill({
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: `${tx.type === 'expense' ? 'Payment to' : 'Received from'} ${tx.counterparty} (TrxID: ${tx.trxId})`,
      date: tx.date,
      source: 'bkash',
      trxId: tx.trxId,
    });
    setModalVisible(true);
  };

  const openSavingsSheet = (view: SavingsSheetView) => {
    setSavingsPrefill(null);
    setSavingsSheetView(view);
    setSavingsSheetVisible(true);
  };

  // Route a parsed voice intent to the right pre-filled modal. The voice sheet
  // closes first; the target modal opens a beat later to avoid Modal overlap.
  const handleVoiceIntent = (intent: VoiceIntent) => {
    setIsVoiceModalOpen(false);
    setTimeout(() => {
      switch (intent.action) {
        case 'ADD_EXPENSE':
        case 'ADD_INCOME':
          setTxPrefill({
            type: intent.action === 'ADD_EXPENSE' ? 'expense' : 'income',
            amount: intent.amount,
            category: intent.category,
            description: intent.description,
          });
          setModalVisible(true);
          break;
        case 'CREATE_SAVINGS_GOAL':
          setSavingsPrefill({
            goalName: intent.goal_name,
            targetAmount: intent.target_amount,
          });
          setSavingsSheetView('create');
          setSavingsSheetVisible(true);
          break;
        case 'ADD_SAVINGS_CONTRIBUTION': {
          const goal = intent.goal_name
            ? savingsGoals.find((g) =>
                g.name.toLowerCase().includes(intent.goal_name!.toLowerCase())
              )
            : undefined;
          if (goal) {
            setSavingsPrefill({ goalId: goal.id, amount: intent.amount });
            setSavingsSheetVisible(true);
          } else {
            setSavingsPrefill({
              goalName: intent.goal_name,
              targetAmount: intent.target_amount,
            });
            setSavingsSheetView('create');
            setSavingsSheetVisible(true);
          }
          break;
        }
        case 'SET_BUDGET_LIMIT':
          openBudgetModal();
          break;
        default:
          break;
      }
    }, 150);
  };

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

  const handleSeeAllTransactions = () => {
    requestTransactionsTab();
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
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setIsVoiceModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Voice entry"
            >
              <Feather name="mic" size={20} color="#091E15" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setIsScanModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Scan invoice"
            >
              <Feather name="aperture" size={20} color="#091E15" />
            </TouchableOpacity>
            <View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push('/notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color="#091E15" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── bKash SMS Detection Prompt Banner (Human-in-the-loop) ── */}
        <BKashDetectedBanner
          transaction={detectedBkashTx}
          transactions={pendingBkashTxs}
          onReview={handleReviewBkashTx}
          onReviewBatch={() => setIsBkashBatchModalOpen(true)}
          onDismiss={() => {
            if (detectedBkashTx) {
              markTrxIdProcessed(detectedBkashTx.trxId);
              removePendingTransaction(detectedBkashTx.trxId);
            }
            clearPendingTransactions();
            setDetectedBkashTx(null);
            setPendingBkashTxs([]);
          }}
        />

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

        {/* ── Quick Actions ── */}
        <View style={styles.ingestionBar}>
          <TouchableOpacity
            style={styles.ingestionCardBkash}
            onPress={() => setIsBkashSimModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="bKash SMS Detection"
          >
            <View style={styles.ingestionIconBkash}>
              <Ionicons name="phone-portrait-outline" size={18} color="#BE185D" />
            </View>
            <View style={styles.ingestionTextCol}>
              <Text style={styles.ingestionTitleBkash}>bKash Detection</Text>
              <Text style={styles.ingestionSubtitle}>Auto SMS reader</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#BE185D" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ingestionCardPdf}
            onPress={() => setIsPdfModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Bank Statement PDF Import"
          >
            <View style={styles.ingestionIconPdf}>
              <Ionicons name="document-text-outline" size={18} color="#059669" />
            </View>
            <View style={styles.ingestionTextCol}>
              <Text style={styles.ingestionTitlePdf}>Bank Statement</Text>
              <Text style={styles.ingestionSubtitle}>PDF statement parser</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#059669" />
          </TouchableOpacity>
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
          <Text style={styles.sectionTitle}>Savings Goals</Text>
          <TouchableOpacity
            onPress={() => openSavingsSheet('list')}
            accessibilityRole="button"
            accessibilityLabel="See all savings goals"
          >
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
        >
          {savingsGoals.map((goal) => (
            <SavingsGoalCard key={goal.id} goal={goal} />
          ))}
          <TouchableOpacity
            style={styles.newGoalCard}
            onPress={() => openSavingsSheet('create')}
            accessibilityRole="button"
            accessibilityLabel="Create new savings goal"
          >
            <View style={styles.newGoalIconBox}>
              <Text style={styles.newGoalEmoji}>🎯</Text>
            </View>
            <Text style={styles.newGoalText}>New Goal</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Recent Transactions Feed ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity
            onPress={handleSeeAllTransactions}
            accessibilityRole="button"
            accessibilityLabel="See all transactions"
          >
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

      <AddTransactionModal
        visible={modalVisible}
        prefill={txPrefill}
        onClose={() => {
          setModalVisible(false);
          setTxPrefill(null);
        }}
      />
      <SavingsGoalsManager
        visible={savingsSheetVisible}
        initialView={savingsSheetView}
        prefill={savingsPrefill}
        onClose={() => {
          setSavingsSheetVisible(false);
          setSavingsPrefill(null);
        }}
      />
      <VoiceEntryModal
        visible={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onIntent={handleVoiceIntent}
      />
      <ScanInvoiceModal
        visible={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
      />
      <BKashSimulatorModal
        visible={isBkashSimModalOpen}
        onClose={() => setIsBkashSimModalOpen(false)}
      />
      <BKashBatchReviewModal
        visible={isBkashBatchModalOpen}
        transactions={pendingBkashTxs}
        onClose={() => setIsBkashBatchModalOpen(false)}
        onSuccess={() => {
          clearPendingTransactions();
          setDetectedBkashTx(null);
          setPendingBkashTxs([]);
        }}
      />
      <BankStatementReviewModal
        visible={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />
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

  // Automated Ingestion Quick Actions
  ingestionBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  ingestionCardBkash: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  ingestionIconBkash: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ingestionTitleBkash: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BE185D',
  },
  ingestionCardPdf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  ingestionIconPdf: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E8F7F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ingestionTitlePdf: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  ingestionTextCol: {
    flex: 1,
  },
  ingestionSubtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
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
  savingsPctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  savingsPct: {
    fontSize: 12,
    fontWeight: '700',
  },
  savingsPctLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
  },
  savingsAmount: {
    fontSize: 12,
    color: '#64748B',
  },
  newGoalCard: {
    width: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  newGoalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  newGoalEmoji: {
    fontSize: 18,
  },
  newGoalText: {
    fontSize: 14,
    fontWeight: '600',
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
