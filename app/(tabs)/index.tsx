import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';

// ── Circular Progress Ring ──────────────────────────────────────────────

function CircularProgress({ pct, label = 'used' }: { pct: number; label?: string }) {
  const angle = pct * 360;
  const rightAngle = Math.min(angle, 180);
  const leftAngle = Math.max(angle - 180, 0);

  return (
    <View style={styles.cpContainer}>
      <View style={styles.cpBgRing} />
      <View style={styles.cpRightHalf}>
        <View
          style={[
            styles.cpArc,
            { transform: [{ rotate: `${rightAngle - 90}deg` }] },
          ]}
        />
      </View>
      {angle > 180 && (
        <View style={styles.cpLeftHalf}>
          <View
            style={[
              styles.cpArc,
              { transform: [{ rotate: `${leftAngle - 90}deg` }] },
            ]}
          />
        </View>
      )}
      <View style={styles.cpCenter}>
        <Text style={styles.cpPctText}>{Math.round(pct * 100)}%</Text>
        <Text style={styles.cpLabelText}>{label}</Text>
      </View>
    </View>
  );
}

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
            <Text style={styles.nameText}>Name 👋</Text>
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
            <CircularProgress pct={0.32} />
            <View style={styles.cardTextStack}>
              <Text style={styles.availableLabel}>Available this month</Text>
              <Text style={styles.balanceAmount}>৳36,000</Text>
              <Text style={styles.balanceDetail}>
                of ৳53,000 · <Text style={styles.spentText}>৳17,000 spent</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.fab}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Budgets Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Budgets</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dashedBox}>
          <Ionicons name="pie-chart-outline" size={32} color="#9CA3AF" />
          <TouchableOpacity>
            <Text style={styles.dashedLink}>Set up budget limits →</Text>
          </TouchableOpacity>
        </View>

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
          {/* Monthly Salary */}
          <View style={styles.transactionRow}>
            <View style={[styles.txIconBase, styles.txIconGreen]}>
              <Feather name="briefcase" size={18} color="#0FB384" />
            </View>
            <View style={styles.txTextArea}>
              <Text style={styles.txName}>Monthly Salary</Text>
              <Text style={styles.txMeta}>salary · 2026-06-01</Text>
            </View>
            <Text style={styles.amountGreen}>+৳45,000</Text>
          </View>

          {/* Lunch at restaurant */}
          <View style={styles.transactionRow}>
            <View style={[styles.txIconBase, styles.txIconRed]}>
              <Ionicons name="restaurant-outline" size={18} color="#EF4444" />
            </View>
            <View style={styles.txTextArea}>
              <Text style={styles.txName}>Lunch at restaurant</Text>
              <Text style={styles.txMeta}>food · 2026-06-10</Text>
            </View>
            <Text style={styles.amountRed}>-৳1,200</Text>
          </View>

          {/* House Rent */}
          <View style={styles.transactionRowLast}>
            <View style={[styles.txIconBase, styles.txIconBlue]}>
              <Ionicons name="home-outline" size={18} color="#3B82F6" />
            </View>
            <View style={styles.txTextArea}>
              <Text style={styles.txName}>House Rent</Text>
              <Text style={styles.txMeta}>rent · 2026-06-05</Text>
            </View>
            <Text style={styles.amountRed}>-৳25,000</Text>
          </View>
        </View>
      </ScrollView>
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

  // Circular Progress
  cpContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cpBgRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 36,
    borderWidth: 5,
    borderColor: '#E5E7EB',
  },
  cpRightHalf: {
    position: 'absolute',
    top: 0,
    left: 36,
    width: 36,
    height: 72,
    overflow: 'hidden',
  },
  cpLeftHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 36,
    height: 72,
    overflow: 'hidden',
  },
  cpArc: {
    position: 'absolute',
    top: 0,
    left: -36,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    borderColor: '#0FB384',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  cpCenter: {
    backgroundColor: '#F4FBF7',
    borderRadius: 26,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cpPctText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
  },
  cpLabelText: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: -2,
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
  txIconGreen: {
    backgroundColor: '#E8F7F1',
  },
  txIconRed: {
    backgroundColor: '#FEE2E2',
  },
  txIconBlue: {
    backgroundColor: '#DBEAFE',
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
});
