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
import { useAuth } from '../../context/AuthContext';
import InviteFamilyModal from '../../components/InviteFamilyModal';
import FamilyJoinScreen from '../../components/FamilyJoinScreen';
import { useFamilyFinance } from '../../components/family/useFamilyFinance';
import FamilyMembersPanel from '../../components/family/FamilyMembersPanel';
import FamilyExpensesPanel from '../../components/family/FamilyExpensesPanel';
import FamilyTransactionsPanel from '../../components/family/FamilyTransactionsPanel';
import { ROLE_BG, ROLE_TEXT_COLOR, initialsOf } from '../../components/family/familyConstants';

const SUB_TABS: { label: string; key: 'overview' | 'members' | 'expenses' | 'transactions' }[] = [
  { label: 'Overview', key: 'overview' },
  { label: 'Members', key: 'members' },
  { label: 'Expenses', key: 'expenses' },
  { label: 'Transactions', key: 'transactions' },
];

export default function FamilyScreen() {
  const { family, members, isLoading } = useFamily();
  const { user } = useAuth();
  const finance = useFamilyFinance(members, user?.id);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'members' | 'expenses' | 'transactions'>('overview');
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

            {/* Contributions Feed */}
            <View style={styles.contributionsCard}>
              <Text style={styles.contributionsTitle}>Contributions</Text>
              {finance.transactions.length === 0 ? (
                <View style={styles.feedEmpty}>
                  <Ionicons name="stats-chart-outline" size={28} color="#94A3B8" />
                  <Text style={styles.feedEmptyText}>No contributions yet.</Text>
                </View>
              ) : (
                finance.transactions.slice(0, 4).map((tx) => (
                  <View key={tx.id} style={styles.feedRow}>
                    <View style={styles.feedAvatar}>
                      <Text style={styles.feedAvatarText}>{initialsOf(tx.memberName)}</Text>
                    </View>
                    <View style={styles.feedInfo}>
                      <Text style={styles.feedTitle} numberOfLines={1}>
                        {tx.memberName} · {tx.note || tx.expenseCategory}
                      </Text>
                      <Text style={styles.feedSubtitle}>{tx.expenseCategory}</Text>
                    </View>
                    <Text style={styles.feedAmount}>
                      {tx.type === 'extra' ? '+' : ''}৳{tx.amount.toFixed(0)}
                    </Text>
                  </View>
                ))
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
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedInfo: {
    flex: 1,
  },
  feedTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
  },
  feedSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 1,
  },
  feedAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0FB384',
  },
});
