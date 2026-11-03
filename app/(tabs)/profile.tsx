import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../context/TransactionsContext';

const formatCompact = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  if (abs >= 10000) return `${sign}৳${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}৳${(abs / 1000).toFixed(1)}k`;
  return `${sign}৳${abs}`;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const { transactions } = useTransactions();

  // Local state for preferences toggles
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  // Bottom sheet modal state ('security' | 'support' | null)
  const [activeModal, setActiveModal] = useState<'security' | 'support' | null>(null);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let totalCount = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  for (const tx of transactions) {
    totalCount += 1;
    if (!tx.date.startsWith(monthKey)) continue;
    if (tx.type === 'income') monthIncome += tx.amount;
    else monthExpense += tx.amount;
  }
  const monthSavings = monthIncome - monthExpense;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error('Error signing out:', e);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── User Header Profile Block ── */}
        <View style={styles.headerBlock}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfoStack}>
            <Text style={styles.userName}>{profile?.full_name || 'FinAlert User'}</Text>
            <Text style={styles.userEmail}>{profile?.email || 'No email associated'}</Text>
          </View>
        </View>


        {/* ── Summary Activity Stats Cards ── */}
        <View style={styles.statsContainer}>
          <View style={styles.statsCard}>
            <Text style={styles.statsValue}>{totalCount}</Text>
            <Text style={styles.statsLabel}>Transactions</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsValue}>{formatCompact(monthExpense)}</Text>
            <Text style={styles.statsLabel}>This Month</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsValue}>{formatCompact(monthSavings)}</Text>
            <Text style={styles.statsLabel}>Saved</Text>
          </View>
        </View>

        {/* ── Preferences Group Card ── */}
        <View style={styles.groupContainer}>
          <Text style={styles.groupHeader}>PREFERENCES</Text>
          <View style={styles.groupCard}>
            {/* Language Row */}
            <TouchableOpacity style={styles.rowItem} activeOpacity={0.6}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: '#E8F7F1' }]}>
                  <Ionicons name="globe-outline" size={18} color="#10B981" />
                </View>
                <Text style={styles.rowTitle}>Language</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowRightText}>English</Text>
                <Feather name="chevron-right" size={16} color="#94A3B8" />
              </View>
            </TouchableOpacity>

            {/* Notifications Row */}
            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="notifications-outline" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.rowTitle}>Notifications</Text>
              </View>
              <Switch
                trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
                thumbColor={notificationsEnabled ? '#0FB384' : '#F1F5F9'}
                ios_backgroundColor="#E2E8F0"
                onValueChange={setNotificationsEnabled}
                value={notificationsEnabled}
              />
            </View>

            {/* Dark Mode Row */}
            <View style={[styles.rowItem, styles.lastRowItem]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="moon-outline" size={18} color="#8B5CF6" />
                </View>
                <Text style={styles.rowTitle}>Dark Mode</Text>
              </View>
              <Switch
                trackColor={{ false: '#E2E8F0', true: '#DDD6FE' }}
                thumbColor={darkModeEnabled ? '#7C3AED' : '#F1F5F9'}
                ios_backgroundColor="#E2E8F0"
                onValueChange={setDarkModeEnabled}
                value={darkModeEnabled}
              />
            </View>
          </View>
        </View>

        {/* ── Account Group Card ── */}
        <View style={styles.groupContainer}>
          <Text style={styles.groupHeader}>ACCOUNT</Text>
          <View style={styles.groupCard}>
            {/* Security Row */}
            <TouchableOpacity
              style={styles.rowItem}
              activeOpacity={0.6}
              onPress={() => setActiveModal('security')}
              accessibilityRole="button"
              accessibilityLabel="View security information"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: '#E8F7F1' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
                </View>
                <Text style={styles.rowTitle}>Security</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Help & Support Row */}
            <TouchableOpacity
              style={[styles.rowItem, styles.lastRowItem]}
              activeOpacity={0.6}
              onPress={() => setActiveModal('support')}
              accessibilityRole="button"
              accessibilityLabel="View help and support information"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="help-circle-outline" size={18} color="#F59E0B" />
                </View>
                <Text style={styles.rowTitle}>Help & Support</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Logout Action & Footer ── */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={18} color="#EF4444" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>

      {/* ── Sleek Bottom Sheet Modal (Security / Help & Support) ── */}
      <Modal
        visible={activeModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop dismissal */}
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />

          {/* Bottom Sheet Card */}
          <View
            style={[
              styles.sheetCard,
              { paddingBottom: Math.max(insets.bottom, 16) + 16 },
            ]}
          >
            {/* Drag Handle Indicator */}
            <View style={styles.dragHandle} />

            {/* Sheet Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalIconCircle,
                    {
                      backgroundColor:
                        activeModal === 'security' ? '#E8F7F1' : '#FEF3C7',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      activeModal === 'security'
                        ? 'shield-checkmark-outline'
                        : 'help-circle-outline'
                    }
                    size={22}
                    color={activeModal === 'security' ? '#0FB384' : '#F59E0B'}
                  />
                </View>
                <View style={styles.modalHeaderTextStack}>
                  {/* Title token: text-[20px] leading-[22px] font-bold */}
                  <Text style={styles.modalTitle}>
                    {activeModal === 'security'
                      ? 'Security & Privacy'
                      : 'Help & Support'}
                  </Text>
                  {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                  <Text style={styles.modalSubtext}>
                    {activeModal === 'security'
                      ? 'How we protect your financial data'
                      : 'Helpful tips & app guidance'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setActiveModal(null)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Bullet Points List */}
            <View style={styles.modalBulletList}>
              {activeModal === 'security' ? (
                <>
                  <View style={styles.bulletItem}>
                    <View style={styles.bulletIconWrapper}>
                      <Ionicons name="lock-closed" size={15} color="#0FB384" />
                    </View>
                    <View style={styles.bulletContent}>
                      {/* Subtitle token: text-[16px] font-medium */}
                      <Text style={styles.bulletTitle}>End-to-End Encryption</Text>
                      {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                      <Text style={styles.bulletDesc}>
                        Transactions and user credentials are encrypted with TLS protocols and cryptographic hashing.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={styles.bulletIconWrapper}>
                      <Ionicons name="key" size={15} color="#0FB384" />
                    </View>
                    <View style={styles.bulletContent}>
                      {/* Subtitle token: text-[16px] font-medium */}
                      <Text style={styles.bulletTitle}>Row-Level Isolation (RLS)</Text>
                      {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                      <Text style={styles.bulletDesc}>
                        Financial data and budgets are strictly isolated in Postgres — accessible only to you and confirmed family members.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={styles.bulletIconWrapper}>
                      <Ionicons name="mail" size={15} color="#0FB384" />
                    </View>
                    <View style={styles.bulletContent}>
                      {/* Subtitle token: text-[16px] font-medium */}
                      <Text style={styles.bulletTitle}>OTP Recovery Protection</Text>
                      {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                      <Text style={styles.bulletDesc}>
                        Password resets are secured with temporary 6-digit verification codes sent directly to your email.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={styles.bulletIconWrapper}>
                      <Ionicons name="phone-portrait" size={15} color="#0FB384" />
                    </View>
                    <View style={styles.bulletContent}>
                      {/* Subtitle token: text-[16px] font-medium */}
                      <Text style={styles.bulletTitle}>Device Hygiene</Text>
                      {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                      <Text style={styles.bulletDesc}>
                        We recommend using biometric lock (Fingerprint or Face ID) or a PIN on your device for enhanced local protection.
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="add-circle" size={15} color="#F59E0B" />
                    </View>
                    <View style={styles.bulletContent}>
                      {/* Subtitle token: text-[16px] font-medium */}
                      <Text style={styles.bulletTitle}>Quick Expense Logging</Text>
                      {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                      <Text style={styles.bulletDesc}>
                        Tap the central (+) action button or use Voice Input to log expenses instantly with automatic AI classification.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="people" size={15} color="#F59E0B" />
                    </View>
                    <View style={styles.bulletContent}>
                      {/* Subtitle token: text-[16px] font-medium */}
                      <Text style={styles.bulletTitle}>Family Sharing</Text>
                      {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                      <Text style={styles.bulletDesc}>
                        Create or join a family circle to monitor joint budgets, split expenses, and view household analytics.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="pie-chart" size={15} color="#F59E0B" />
                    </View>
                    <View style={styles.bulletContent}>
                      {/* Subtitle token: text-[16px] font-medium */}
                      <Text style={styles.bulletTitle}>Budget Tracking & Alerts</Text>
                      {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                      <Text style={styles.bulletDesc}>
                        Set category spending thresholds to receive real-time notifications before exceeding monthly caps.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="chatbubbles" size={15} color="#F59E0B" />
                    </View>
                    <View style={styles.bulletContent}>
                      {/* Subtitle token: text-[16px] font-medium */}
                      <Text style={styles.bulletTitle}>Direct Support</Text>
                      {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                      <Text style={styles.bulletDesc}>
                        Need assistance or have feedback? Reach out to our dedicated support team at adormuntasir@gmail.com.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Got It Button */}
            <View style={styles.modalActionWrapper}>
              <LinearGradient
                colors={['#02C78E', '#0FB384']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalActionGradient}
              >
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => setActiveModal(null)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  {/* Subtitle token: text-[16px] font-medium */}
                  <Text style={styles.modalActionText}>Got It</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  avatarContainer: {
    backgroundColor: '#E6F4EA',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0FB384',
  },
  userInfoStack: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statsValue: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  statsLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
  },
  groupContainer: {
    gap: 8,
  },
  groupHeader: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#94A3B8',
    paddingLeft: 4,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastRowItem: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0F172A',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowRightText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  logoutIcon: {
    marginRight: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
  versionText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalHeaderTextStack: {
    flex: 1,
    gap: 2,
  },
  modalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
  },
  modalSubtext: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
  },
  modalCloseButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBulletList: {
    gap: 14,
    marginBottom: 20,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bulletIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F7F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bulletContent: {
    flex: 1,
    gap: 2,
  },
  bulletTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#091E15',
  },
  bulletDesc: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
  },
  modalActionWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalActionGradient: {
    borderRadius: 24,
  },
  modalActionButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
