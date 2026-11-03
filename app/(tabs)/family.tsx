import React, { useState, useCallback } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import InviteFamilyModal from '../../components/InviteFamilyModal';
import FamilySettingsModal from '../../components/FamilySettingsModal';
import FamilyJoinScreen from '../../components/FamilyJoinScreen';
import { useFamilyFinance } from '../../components/family/useFamilyFinance';
import FamilyMembersPanel from '../../components/family/FamilyMembersPanel';
import FamilyExpensesPanel from '../../components/family/FamilyExpensesPanel';
import FamilyTransactionsPanel from '../../components/family/FamilyTransactionsPanel';
import { ROLE_BG, ROLE_TEXT_COLOR, formatMoney, initialsOf } from '../../components/family/familyConstants';

const SUB_TABS: { label: string; key: 'overview' | 'members' | 'expenses' | 'transactions' }[] = [
  { label: 'Overview', key: 'overview' },
  { label: 'Members', key: 'members' },
  { label: 'Expenses', key: 'expenses' },
  { label: 'Transactions', key: 'transactions' },
];

export default function FamilyScreen() {
  const { family, members, isLoading } = useFamily();
  const { user } = useAuth();
  const finance = useFamilyFinance(family?.id ?? null, user?.id);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'members' | 'expenses' | 'transactions'>('overview');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Re-fetch finance data every time the screen gains focus so changes made by
  // other members (expenses, transactions, roles) show up without an app relaunch.
  useFocusEffect(
    useCallback(() => {
      finance.reload();
    }, [finance.reload])
  );

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
  const totalBudget = finance.finances.reduce((sum, m) => sum + m.limit, 0);
  const totalExpense = finance.expenses.reduce((sum, e) => sum + e.total, 0);
  const totalPaid = finance.expenses.reduce((sum, e) => sum + finance.expensePaid(e), 0);
  const budgetPct = totalBudget > 0 ? Math.min((totalExpense / totalBudget) * 100, 100) : 0;

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
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={() => setInviteModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Invite to family"
            >
              <Feather name="user-plus" size={18} color="#0FB384" />
              <Text style={styles.inviteBtnLabel}>Invite</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => setSettingsModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Family settings"
            >
              <Ionicons name="settings-outline" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Summary Metrics ── */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Budget</Text>
            <Text style={styles.metricIncome}>{formatMoney(totalBudget)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Expense</Text>
            <Text style={styles.metricExpense}>{formatMoney(totalExpense)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Paid</Text>
            <Text style={styles.metricPaid}>{formatMoney(totalPaid)}</Text>
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
                {members.map((m) => {
                  const displayName = m.full_name || 'Family Member';
                  return (
                    <View key={m.id} style={styles.avatarItem}>
                      <View style={[styles.avatarCircle, { backgroundColor: '#0FB384' }]}>
                        <Text style={styles.avatarInitials}>{initialsOf(displayName)}</Text>
                      </View>
                      <Text style={styles.avatarName} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <View style={[styles.rolePill, { backgroundColor: ROLE_BG[m.role] }]}>
                        <Text style={[styles.rolePillText, { color: ROLE_TEXT_COLOR[m.role] }]}>
                          {m.role}
                        </Text>
                      </View>
                    </View>
                  );
                })}
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

            {/* Budget Usage */}
            <View style={styles.budgetCard}>
              <Text style={styles.budgetTitle}>Budget Usage</Text>
              <View style={styles.budgetTrack}>
                <View style={[styles.budgetFill, { width: `${budgetPct}%` }]} />
              </View>
              <View style={styles.budgetFooter}>
                <Text style={styles.budgetSpent}>{formatMoney(totalExpense)} spent</Text>
                <Text style={styles.budgetTotal}>{formatMoney(totalBudget)} budget</Text>
              </View>
            </View>

            {/* Contributions */}
            <View style={styles.contributionsCard}>
              <Text style={styles.contributionsTitle}>Contributions</Text>
              {finance.finances.length === 0 ? (
                <View style={styles.feedEmpty}>
                  <Ionicons name="people-outline" size={28} color="#94A3B8" />
                  <Text style={styles.feedEmptyText}>No members yet.</Text>
                </View>
              ) : (
                finance.finances.map((m) => {
                  const paid = finance.memberPaid(m.memberId);
                  const pct = m.limit > 0 ? Math.min((paid / m.limit) * 100, 100) : 0;
                  return (
                    <View key={m.memberId} style={styles.contribRow}>
                      <View style={styles.contribHeader}>
                        <View style={styles.contribAvatar}>
                          <Text style={styles.contribAvatarText}>{initialsOf(m.name)}</Text>
                        </View>
                        <View style={styles.contribInfo}>
                          <View style={styles.contribNameRow}>
                            <Text style={styles.contribName} numberOfLines={1}>
                              {m.name}
                            </Text>
                            {m.extra > 0.01 && (
                              <View style={styles.extraPill}>
                                <Text style={styles.extraPillText}>+৳{Math.round(m.extra)}</Text>
                              </View>
                            )}
                            {m.unable > 0.01 && (
                              <View style={styles.unablePill}>
                                <Text style={styles.unablePillText}>-৳{Math.round(m.unable)}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.contribTrack}>
                            <View style={[styles.contribFill, { width: `${pct}%` }]} />
                          </View>
                        </View>
                        <Text style={styles.contribTarget}>{formatMoney(m.limit)}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ── Members Panel ── */}
        {activeSubTab === 'members' && <FamilyMembersPanel finance={finance} />}

        {/* ── Expenses Panel ── */}
        {activeSubTab === 'expenses' && <FamilyExpensesPanel finance={finance} />}

        {/* ── Transactions Panel ── */}
        {activeSubTab === 'transactions' && <FamilyTransactionsPanel finance={finance} />}
      </ScrollView>

      <InviteFamilyModal
        visible={inviteModalVisible}
        code={family.invite_code}
        familyName={family.name}
        onClose={() => setInviteModalVisible(false)}
      />

      <FamilySettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 8,
  },
  metricIncome: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
    color: '#0FB384',
  },
  metricExpense: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
    color: '#EF4444',
  },
  metricPaid: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
    color: '#02C78E',
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
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: 16,
    rowGap: 16,
    marginBottom: 20,
  },
  avatarItem: {
    alignItems: 'center',
    minWidth: 64,
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
    maxWidth: 96,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    flexShrink: 0,
    alignSelf: 'center',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 0,
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
  feedEmpty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  feedEmptyText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
  },

  // ── Overview: Budget Usage ──
  budgetCard: {
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
  budgetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
    marginBottom: 14,
  },
  budgetTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 10,
  },
  budgetFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#02C78E',
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetSpent: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
    color: '#6B7280',
  },
  budgetTotal: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: '#091E15',
  },

  // ── Overview: Contributions ──
  contribRow: {
    marginBottom: 4,
  },
  contribHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  contribAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contribAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contribInfo: {
    flex: 1,
  },
  contribNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  contribName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
    flexShrink: 1,
  },
  extraPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
  },
  extraPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  unablePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  unablePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  contribTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  contribFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#02C78E',
  },
  contribTarget: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
  },
});
