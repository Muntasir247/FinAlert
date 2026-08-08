import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFamily } from '../../context/FamilyContext';
import InviteFamilyModal from '../../components/InviteFamilyModal';
import FamilyJoinScreen from '../../components/FamilyJoinScreen';

const SUB_TABS: { label: string; key: 'overview' | 'members' | 'expenses' | 'goals' }[] = [
  { label: 'Overview', key: 'overview' },
  { label: 'Members', key: 'members' },
  { label: 'Expenses', key: 'expenses' },
  { label: 'Family Goals', key: 'goals' },
];

const MEMBERS = [
  {
    name: 'Muntasir',
    initials: 'M',
    role: 'Admin' as const,
    income: 45000,
    expense: 7400,
    contributionPct: 0.474,
  },
  {
    name: 'Jim',
    initials: 'J',
    role: 'Contributor' as const,
    income: 30000,
    expense: 5200,
    contributionPct: 0.316,
  },
  {
    name: 'Arpa',
    initials: 'A',
    role: 'Contributor' as const,
    income: 20000,
    expense: 3800,
    contributionPct: 0.21,
  },
  {
    name: 'Torsa',
    initials: 'T',
    role: 'Dependent' as const,
    income: 0,
    expense: 2100,
    contributionPct: 0,
  },
];

const ROLE_BG: Record<string, string> = {
  Admin: '#FEF3C7',
  Contributor: '#E8F7F1',
  Dependent: '#F1F5F9',
};

const ROLE_TEXT_COLOR: Record<string, string> = {
  Admin: '#D97706',
  Contributor: '#0FB384',
  Dependent: '#64748B',
};

export default function FamilyScreen() {
  const { family, members, isLoading } = useFamily();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'members' | 'expenses' | 'goals'>('overview');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0FB384" />
        </View>
      </SafeAreaView>
    );
  }

  if (!family) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <FamilyJoinScreen />
      </SafeAreaView>
    );
  }

  const memberCount = members.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Family Finance</Text>
            <Text style={styles.headerSubtext}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => setInviteModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Invite to family"
          >
            <Feather name="user-plus" size={18} color="#0FB384" />
            <Text style={styles.inviteBtnLabel}>Invite</Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary Metrics ── */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Family Income</Text>
            <Text style={styles.metricIncome}>৳95,000</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Family Expense</Text>
            <Text style={styles.metricExpense}>৳18,500</Text>
          </View>
        </View>

        {/* ── Sub-Tab Bar ── */}
        <View style={styles.subTabBar}>
          {SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.subTabItem}
                onPress={() => setActiveSubTab(tab.key)}
              >
                <Text
                  style={[
                    styles.subTabLabel,
                    isActive ? styles.subTabLabelActive : styles.subTabLabelInactive,
                  ]}
                >
                  {tab.label}
                </Text>
                {isActive && <View style={styles.subTabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Overview Panel ── */}
        {activeSubTab === 'overview' && (
          <>
            {/* Member Avatars Grid */}
            <View style={styles.avatarCard}>
              <View style={styles.avatarRow}>
                {MEMBERS.map((m) => (
                  <View key={m.name} style={styles.avatarItem}>
                    <View style={[styles.avatarCircle, { backgroundColor: '#0FB384' }]}>
                      <Text style={styles.avatarInitials}>{m.initials}</Text>
                    </View>
                    <Text style={styles.avatarName}>{m.name}</Text>
                    <View style={[styles.rolePill, { backgroundColor: ROLE_BG[m.role] }]}>
                      <Text style={[styles.rolePillText, { color: ROLE_TEXT_COLOR[m.role] }]}>
                        {m.role}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.inviteMemberBtn}
                onPress={() => setInviteModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Invite member"
              >
                <View style={styles.inviteMemberCircle}>
                  <Text style={styles.inviteMemberPlus}>+</Text>
                </View>
                <Text style={styles.inviteMemberLabel}>Invite Member</Text>
              </TouchableOpacity>
            </View>

            {/* Contributions Feed */}
            <View style={styles.contributionsCard}>
              <Text style={styles.contributionsTitle}>Contributions</Text>
              {MEMBERS.filter((m) => m.contributionPct > 0).map((m) => (
                <View key={m.name} style={styles.contributionRow}>
                  <View style={styles.contributionHeader}>
                    <Text style={styles.contributionName}>{m.name}</Text>
                    <Text style={styles.contributionAmount}>
                      ৳{m.income.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.round(m.contributionPct * 100)}%`,
                          backgroundColor: '#0FB384',
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Members Panel ── */}
        {activeSubTab === 'members' && (
          <View style={styles.rosterCard}>
            {MEMBERS.map((m, idx) => (
              <TouchableOpacity
                key={m.name}
                style={[styles.rosterRow, idx < MEMBERS.length - 1 && styles.rosterRowBorder]}
              >
                <View style={[styles.rosterAvatar, { backgroundColor: '#0FB384' }]}>
                  <Text style={styles.rosterAvatarText}>{m.initials}</Text>
                </View>
                <View style={styles.rosterInfo}>
                  <View style={styles.rosterNameRow}>
                    <Text style={styles.rosterName}>{m.name}</Text>
                    <View style={[styles.rosterRoleBadge, { backgroundColor: ROLE_BG[m.role] }]}>
                      {m.role === 'Admin' && (
                        <Feather name="award" size={12} color="#D97706" style={{ marginRight: 3 }} />
                      )}
                      <Text style={[styles.rosterRoleText, { color: ROLE_TEXT_COLOR[m.role] }]}>
                        {m.role}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rosterMetrics}>
                    <Text style={styles.rosterIncome}>+৳{m.income.toLocaleString()}</Text>
                    <Text style={styles.rosterExpense}>  -৳{m.expense.toLocaleString()}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Expenses Panel ── */}
        {activeSubTab === 'expenses' && (
          <View>
            <TouchableOpacity style={styles.addExpenseBtn}>
              <Text style={styles.addExpenseLabel}>+ Add Shared Expense</Text>
            </TouchableOpacity>

            {[
              { icon: 'home-outline' as const, title: 'House Rent', amount: 8000, paid: true },
              { icon: 'cart-outline' as const, title: 'Grocery', amount: 2400, paid: false },
              { icon: 'flash-outline' as const, title: 'Electricity', amount: 1200, paid: true },
              { icon: 'globe-outline' as const, title: 'Internet', amount: 800, paid: false },
            ].map((item) => (
              <View key={item.title} style={styles.expenseCard}>
                <View style={[styles.expenseIconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name={item.icon} size={20} color="#64748B" />
                </View>
                <View style={styles.expenseCenter}>
                  <Text style={styles.expenseTitle}>{item.title}</Text>
                  <Text style={styles.expenseSubtitle}>Shared expense</Text>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>৳{item.amount.toLocaleString()}</Text>
                  <View
                    style={[
                      styles.expenseStatusPill,
                      { backgroundColor: item.paid ? '#E8F7F1' : '#FEE2E2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.expenseStatusText,
                        { color: item.paid ? '#0FB384' : '#EF4444' },
                      ]}
                    >
                      {item.paid ? 'Paid' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Goals Panel ── */}
        {activeSubTab === 'goals' && (
          <View>
            {[
              {
                icon: 'airplane-outline' as const,
                title: 'Family Vacation',
                current: 18500,
                target: 50000,
                pct: 0.37,
              },
              {
                icon: 'layers-outline' as const,
                title: 'Education Fund',
                current: 35000,
                target: 100000,
                pct: 0.35,
              },
            ].map((goal) => (
              <View key={goal.title} style={styles.goalCard}>
                <View style={styles.goalTopRow}>
                  <View style={[styles.goalIconBox, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name={goal.icon} size={22} color="#64748B" />
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalProgress}>
                      ৳{goal.current.toLocaleString()} / ৳{goal.target.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.goalPct}>{Math.round(goal.pct * 100)}%</Text>
                </View>

                <View style={styles.goalBarBg}>
                  <View
                    style={[
                      styles.goalBarFill,
                      { width: `${Math.round(goal.pct * 100)}%` },
                    ]}
                  />
                </View>

                <View style={styles.goalFooter}>
                  <Text style={styles.goalRemaining}>
                    Remaining: ৳{(goal.target - goal.current).toLocaleString()}
                  </Text>
                  <TouchableOpacity>
                    <Text style={styles.goalContribute}>Contribute</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <InviteFamilyModal
        visible={inviteModalVisible}
        code={family.invite_code}
        familyName={family.name}
        onClose={() => setInviteModalVisible(false)}
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
  headerSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0FB384',
    backgroundColor: '#FFFFFF',
  },
  inviteBtnLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0FB384',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Summary Metrics ──
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 8,
  },
  metricIncome: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0FB384',
  },
  metricExpense: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
  },

  // ── Sub-Tab Bar ──
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
    fontSize: 13,
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

  // ── Overview: Member Avatars ──
  avatarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  avatarItem: {
    alignItems: 'center',
    width: 64,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#091E15',
    marginBottom: 4,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  inviteMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingVertical: 10,
    gap: 8,
  },
  inviteMemberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteMemberPlus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0FB384',
    lineHeight: 18,
  },
  inviteMemberLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0FB384',
  },

  // ── Overview: Contributions ──
  contributionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  contributionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#091E15',
    marginBottom: 16,
  },
  contributionRow: {
    marginBottom: 16,
  },
  contributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  contributionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  contributionAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0FB384',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // ── Members: Roster ──
  rosterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rosterRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rosterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rosterInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rosterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rosterName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#091E15',
  },
  rosterRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rosterRoleText: {
    fontSize: 11,
    fontWeight: '500',
  },
  rosterMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rosterIncome: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0FB384',
  },
  rosterExpense: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },

  // ── Expenses ──
  addExpenseBtn: {
    backgroundColor: '#ECFDF5',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#0FB384',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addExpenseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0FB384',
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCenter: {
    flex: 1,
    marginLeft: 12,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#091E15',
  },
  expenseSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  expenseStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  expenseStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Goals ──
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  goalIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#091E15',
  },
  goalProgress: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  goalPct: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0FB384',
  },
  goalBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  goalBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#0FB384',
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalRemaining: {
    fontSize: 13,
    fontWeight: '400',
    color: '#64748B',
  },
  goalContribute: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0FB384',
  },
});
