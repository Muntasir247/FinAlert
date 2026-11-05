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
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
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
  const { colors, isDark } = useTheme();
  const { t, isBangla, formatCurrency } = useLanguage();
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0FB384" />
        </View>
      </SafeAreaView>
    );
  }

  if (!family) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <FamilyJoinScreen />
      </SafeAreaView>
    );
  }

  const memberCount = members.length;
  const totalBudget = finance.finances.reduce((sum, m) => sum + m.limit, 0);
  const totalExpense = finance.expenses.reduce((sum, e) => sum + e.total, 0);
  const totalPaid = finance.expenses.reduce((sum, e) => sum + finance.expensePaid(e), 0);
  const budgetPct = totalBudget > 0 ? Math.min((totalExpense / totalBudget) * 100, 100) : 0;

  const subTabs = [
    { label: t('family.subtab_overview', 'Overview'), key: 'overview' as const },
    { label: t('family.subtab_members', 'Members'), key: 'members' as const },
    { label: t('family.subtab_expenses', 'Expenses'), key: 'expenses' as const },
    { label: t('family.subtab_transactions', 'Transactions'), key: 'transactions' as const },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isBangla ? 'পারিবারিক হিসাব' : 'Family Finance'}
            </Text>
            <Text style={[styles.headerSubtext, { color: colors.textSecondary }]}>
              {isBangla ? `${memberCount} জন সদস্য` : `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.inviteBtn, isDark && { backgroundColor: '#143D2E', borderColor: '#0FB384' }]}
              onPress={() => setInviteModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Invite to family"
            >
              <Feather name="user-plus" size={18} color="#0FB384" />
              <Text style={styles.inviteBtnLabel}>{t('family.invite_member', 'Invite')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => setSettingsModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Family settings"
            >
              <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Summary Metrics ── */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              {isBangla ? 'মোট বাজেট' : 'Total Budget'}
            </Text>
            <Text
              style={styles.metricIncome}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(totalBudget)}
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              {isBangla ? 'মোট খরচ' : 'Total Expense'}
            </Text>
            <Text
              style={styles.metricExpense}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(totalExpense)}
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              {isBangla ? 'পরিশোধিত' : 'Total Paid'}
            </Text>
            <Text
              style={styles.metricPaid}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(totalPaid)}
            </Text>
          </View>
        </View>

        {/* ── Sub-Tab Bar ── */}
        <View style={[styles.subTabBar, { borderBottomColor: colors.divider }]}>
          {subTabs.map((tab) => {
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
                    isActive ? styles.subTabLabelActive : [styles.subTabLabelInactive, { color: colors.textSecondary }],
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
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
            <View style={[styles.avatarCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.avatarRow}>
                {members.map((m) => {
                  const displayName = m.full_name || 'Family Member';
                  return (
                    <View key={m.id} style={styles.avatarItem}>
                      <View style={[styles.avatarCircle, { backgroundColor: '#0FB384' }]}>
                        <Text style={styles.avatarInitials}>{initialsOf(displayName)}</Text>
                      </View>
                      <Text style={[styles.avatarName, { color: colors.text }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <View style={[styles.rolePill, { backgroundColor: isDark ? '#143D2E' : ROLE_BG[m.role] }]}>
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
                <Text style={styles.inviteMemberLabel}>{t('family.invite_member', 'Invite Member')}</Text>
              </TouchableOpacity>
            </View>

            {/* Budget Usage */}
            <View style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.budgetTitle, { color: colors.text }]}>
                {isBangla ? 'বাজেট ব্যবহার' : 'Budget Usage'}
              </Text>
              <View style={[styles.budgetTrack, { backgroundColor: colors.divider }]}>
                <View style={[styles.budgetFill, { width: `${budgetPct}%` }]} />
              </View>
              <View style={styles.budgetFooter}>
                <Text style={styles.budgetSpent}>
                  {formatCurrency(totalExpense)} {isBangla ? 'খরচ হয়েছে' : 'spent'}
                </Text>
                <Text style={[styles.budgetTotal, { color: colors.textSecondary }]}>
                  {formatCurrency(totalBudget)} {isBangla ? 'বাজেট' : 'budget'}
                </Text>
              </View>
            </View>

            {/* Contributions */}
            <View style={[styles.contributionsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.contributionsTitle, { color: colors.text }]}>
                {isBangla ? 'অবদান' : 'Contributions'}
              </Text>
              {finance.finances.length === 0 ? (
                <View style={styles.feedEmpty}>
                  <Ionicons name="people-outline" size={28} color={colors.textMuted} />
                  <Text style={[styles.feedEmptyText, { color: colors.textSecondary }]}>
                    {isBangla ? 'এখনও কোনো সদস্য নেই।' : 'No members yet.'}
                  </Text>
                </View>
              ) : (
                finance.finances.map((m) => {
                  const paid = finance.memberPaid(m.memberId);
                  const pct = m.limit > 0 ? Math.min((paid / m.limit) * 100, 100) : 0;
                  return (
                    <View key={m.memberId} style={styles.contribRow}>
                      <View style={styles.contribAvatar}>
                        <Text style={styles.contribAvatarText}>{initialsOf(m.name)}</Text>
                      </View>
                      <View style={styles.contribInfo}>
                        <View style={styles.contribNameRow}>
                          <Text style={[styles.contribName, { color: colors.text }]} numberOfLines={1}>
                            {m.name}
                          </Text>
                          {m.extra > 0.01 && (
                            <View style={styles.extraPill}>
                              <Text style={styles.extraPillText}>+{formatCurrency(m.extra)}</Text>
                            </View>
                          )}
                          {m.unable > 0.01 && (
                            <View style={styles.unablePill}>
                              <Text style={styles.unablePillText}>-{formatCurrency(m.unable)}</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.contribTrack, { backgroundColor: colors.divider }]}>
                          <View style={[styles.contribFill, { width: `${pct}%` }]} />
                        </View>
                      </View>
                      <Text style={[styles.contribTarget, { color: colors.textSecondary }]}>{formatCurrency(m.limit)}</Text>
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
    gap: 8,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 6,
  },
  metricIncome: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    color: '#0FB384',
  },
  metricExpense: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    color: '#EF4444',
  },
  metricPaid: {
    fontSize: 15,
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
    justifyContent: 'center',
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  subTabLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
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
