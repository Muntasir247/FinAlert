import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../context/TransactionsContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage, type Language } from '../../context/LanguageContext';
import { useMfsTracking } from '../../context/MfsTrackingContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const { transactions } = useTransactions();
  const { notificationsEnabled, setNotificationsEnabled } = useNotifications();
  const { isDark, setTheme, colors } = useTheme();
  const { language, setLanguage, t, formatCompactCurrency, isBangla } = useLanguage();
  const { openModal: openMfsModal } = useMfsTracking();

  // Bottom sheet modal state ('security' | 'support' | null)
  const [activeModal, setActiveModal] = useState<'security' | 'support' | null>(null);
  // Language selection modal
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const handleToggleNotifications = async (value: boolean) => {
    const success = await setNotificationsEnabled(value);
    if (!success && value) {
      Alert.alert(
        t('profile.permission_required', 'Permission Required'),
        t(
          'profile.notif_permission_msg',
          'FinAlert needs notification permission to show alerts on your phone dashboard. Please enable notifications in your device Settings.'
        )
      );
    }
  };

  const handleSelectLanguage = async (newLang: Language) => {
    await setLanguage(newLang);
    setLanguageModalVisible(false);
  };

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── User Header Profile Block ── */}
        <View style={[styles.headerBlock, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.badgeBg }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfoStack}>
            <Text style={[styles.userName, { color: colors.text }]}>{profile?.full_name || 'FinAlert User'}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{profile?.email || 'No email associated'}</Text>
          </View>
        </View>

        {/* ── Summary Activity Stats Cards ── */}
        <View style={styles.statsContainer}>
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statsValue, { color: colors.text }]}>
              {formatCompactCurrency(totalCount).replace('৳', '')}
            </Text>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>
              {t('profile.transactions_stat', 'Transactions')}
            </Text>
          </View>
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statsValue, { color: colors.text }]}>
              {formatCompactCurrency(monthExpense)}
            </Text>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>
              {t('profile.this_month_stat', 'This Month')}
            </Text>
          </View>
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statsValue, { color: colors.text }]}>
              {formatCompactCurrency(monthSavings)}
            </Text>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>
              {t('profile.saved_stat', 'Saved')}
            </Text>
          </View>
        </View>

        {/* ── Preferences Group Card ── */}
        <View style={styles.groupContainer}>
          <Text style={[styles.groupHeader, { color: colors.textMuted }]}>
            {t('profile.preferences', 'PREFERENCES')}
          </Text>
          <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Language Row */}
            <TouchableOpacity
              style={[styles.rowItem, { borderBottomColor: colors.divider }]}
              activeOpacity={0.6}
              onPress={() => setLanguageModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Change app language"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' }]}>
                  <Ionicons name="globe-outline" size={18} color="#10B981" />
                </View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {t('profile.language', 'Language')}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowRightText, { color: colors.textSecondary }]}>
                  {language === 'bn' ? 'বাংলা' : 'English'}
                </Text>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Tracked Providers Row */}
            <TouchableOpacity
              style={[styles.rowItem, { borderBottomColor: colors.divider }]}
              activeOpacity={0.6}
              onPress={openMfsModal}
              accessibilityRole="button"
              accessibilityLabel="Select transaction providers"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#0FB384" />
                </View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {t('profile.tracked_providers', 'Tracked Providers')}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Notifications Row */}
            <View style={[styles.rowItem, { borderBottomColor: colors.divider }]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#142E47' : '#EFF6FF' }]}>
                  <Ionicons name="notifications-outline" size={18} color="#3B82F6" />
                </View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {t('profile.notifications', 'Notifications')}
                </Text>
              </View>
              <Switch
                trackColor={{ false: isDark ? '#1E3E31' : '#E2E8F0', true: isDark ? '#0FB384' : '#A7F3D0' }}
                thumbColor={notificationsEnabled ? '#0FB384' : isDark ? '#334155' : '#F1F5F9'}
                ios_backgroundColor={isDark ? '#1E3E31' : '#E2E8F0'}
                onValueChange={handleToggleNotifications}
                value={notificationsEnabled}
              />
            </View>

            {/* Dark Mode Row */}
            <View style={[styles.rowItem, styles.lastRowItem]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#2D1B4E' : '#F5F3FF' }]}>
                  <Ionicons name="moon-outline" size={18} color="#8B5CF6" />
                </View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {t('profile.dark_mode', 'Dark Mode')}
                </Text>
              </View>
              <Switch
                trackColor={{ false: isDark ? '#1E3E31' : '#E2E8F0', true: '#DDD6FE' }}
                thumbColor={isDark ? '#8B5CF6' : isDark ? '#334155' : '#F1F5F9'}
                ios_backgroundColor={isDark ? '#1E3E31' : '#E2E8F0'}
                onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
                value={isDark}
              />
            </View>
          </View>
        </View>

        {/* ── Account Group Card ── */}
        <View style={styles.groupContainer}>
          <Text style={[styles.groupHeader, { color: colors.textMuted }]}>
            {t('profile.account', 'ACCOUNT')}
          </Text>
          <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Security Row */}
            <TouchableOpacity
              style={[styles.rowItem, { borderBottomColor: colors.divider }]}
              activeOpacity={0.6}
              onPress={() => setActiveModal('security')}
              accessibilityRole="button"
              accessibilityLabel="View security information"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
                </View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {t('profile.security', 'Security')}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
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
                <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#3B2F14' : '#FEF3C7' }]}>
                  <Ionicons name="help-circle-outline" size={18} color="#F59E0B" />
                </View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {t('profile.help_support', 'Help & Support')}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Logout Action & Footer ── */}
        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: colors.dangerBg,
              borderColor: colors.dangerBorder,
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={18} color="#EF4444" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>{t('profile.logout', 'Logout')}</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: colors.textMuted }]}>
          {t('profile.version', 'Version')} 1.0.0
        </Text>
      </ScrollView>

      {/* ── Language Selection Modal ── */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setLanguageModalVisible(false)}
          />
          <View
            style={[
              styles.sheetCard,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              },
            ]}
          >
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalIconCircle, { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' }]}>
                  <Ionicons name="globe-outline" size={22} color="#0FB384" />
                </View>
                <View style={styles.modalHeaderTextStack}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {t('profile.select_language', 'Select Language')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setLanguageModalVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.langListContainer}>
              {/* English Option */}
              <TouchableOpacity
                style={[
                  styles.langOptionCard,
                  {
                    backgroundColor: language === 'en' ? (isDark ? '#143D2E' : '#E8F7F1') : colors.surfaceSubtle,
                    borderColor: language === 'en' ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelectLanguage('en')}
              >
                <View style={styles.langOptionLeft}>
                  <Text style={[styles.langOptionName, { color: colors.text }]}>
                    English
                  </Text>
                  <Text style={[styles.langOptionSub, { color: colors.textSecondary }]}>
                    Default
                  </Text>
                </View>
                {language === 'en' && (
                  <Ionicons name="checkmark-circle" size={22} color="#0FB384" />
                )}
              </TouchableOpacity>

              {/* Bangla Option */}
              <TouchableOpacity
                style={[
                  styles.langOptionCard,
                  {
                    backgroundColor: language === 'bn' ? (isDark ? '#143D2E' : '#E8F7F1') : colors.surfaceSubtle,
                    borderColor: language === 'bn' ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelectLanguage('bn')}
              >
                <View style={styles.langOptionLeft}>
                  <Text style={[styles.langOptionName, { color: colors.text }]}>
                    বাংলা (Bangla)
                  </Text>
                  <Text style={[styles.langOptionSub, { color: colors.textSecondary }]}>
                    সম্পূর্ণ অ্যাপ বাংলায়
                  </Text>
                </View>
                {language === 'bn' && (
                  <Ionicons name="checkmark-circle" size={22} color="#0FB384" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sleek Bottom Sheet Modal (Security / Help & Support) ── */}
      <Modal
        visible={activeModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
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
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              },
            ]}
          >
            {/* Drag Handle Indicator */}
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

            {/* Sheet Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalIconCircle,
                    {
                      backgroundColor:
                        activeModal === 'security'
                          ? isDark ? '#143D2E' : '#E8F7F1'
                          : isDark ? '#3B2F14' : '#FEF3C7',
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
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {activeModal === 'security'
                      ? t('profile.security_title', 'Security & Privacy')
                      : t('profile.support_title', 'Help & Support')}
                  </Text>
                  <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
                    {activeModal === 'security'
                      ? t('profile.security_sub', 'How we protect your financial data')
                      : t('profile.support_sub', 'Helpful tips & app guidance')}
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
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Bullet Points List */}
            <View style={styles.modalBulletList}>
              {activeModal === 'security' ? (
                <>
                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' }]}>
                      <Ionicons name="lock-closed" size={15} color="#0FB384" />
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletTitle, { color: colors.text }]}>
                        {t('profile.e2e_title', 'End-to-End Encryption')}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: colors.textSecondary }]}>
                        {t(
                          'profile.e2e_desc',
                          'Transactions and user credentials are encrypted with TLS protocols and cryptographic hashing.'
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' }]}>
                      <Ionicons name="key" size={15} color="#0FB384" />
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletTitle, { color: colors.text }]}>
                        {t('profile.rls_title', 'Row-Level Isolation (RLS)')}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: colors.textSecondary }]}>
                        {t(
                          'profile.rls_desc',
                          'Financial data and budgets are strictly isolated in Postgres — accessible only to you and confirmed family members.'
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' }]}>
                      <Ionicons name="mail" size={15} color="#0FB384" />
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletTitle, { color: colors.text }]}>
                        {t('profile.otp_title', 'OTP Recovery Protection')}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: colors.textSecondary }]}>
                        {t(
                          'profile.otp_desc',
                          'Password resets are secured with temporary 6-digit verification codes sent directly to your email.'
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' }]}>
                      <Ionicons name="phone-portrait" size={15} color="#0FB384" />
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletTitle, { color: colors.text }]}>
                        {t('profile.device_hygiene_title', 'Device Hygiene')}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: colors.textSecondary }]}>
                        {t(
                          'profile.device_hygiene_desc',
                          'We recommend using biometric lock (Fingerprint or Face ID) or a PIN on your device for enhanced local protection.'
                        )}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: isDark ? '#3B2F14' : '#FEF3C7' }]}>
                      <Ionicons name="add-circle" size={15} color="#F59E0B" />
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletTitle, { color: colors.text }]}>
                        {t('profile.expense_logging_title', 'Quick Expense Logging')}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: colors.textSecondary }]}>
                        {t(
                          'profile.expense_logging_desc',
                          'Tap the central (+) action button or use Voice Input to log expenses instantly with automatic AI classification.'
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: isDark ? '#3B2F14' : '#FEF3C7' }]}>
                      <Ionicons name="people" size={15} color="#F59E0B" />
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletTitle, { color: colors.text }]}>
                        {t('profile.family_sharing_title', 'Family Sharing')}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: colors.textSecondary }]}>
                        {t(
                          'profile.family_sharing_desc',
                          'Create or join a family circle to monitor joint budgets, split expenses, and view household analytics.'
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: isDark ? '#3B2F14' : '#FEF3C7' }]}>
                      <Ionicons name="pie-chart" size={15} color="#F59E0B" />
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletTitle, { color: colors.text }]}>
                        {t('profile.budget_tracking_title', 'Budget Tracking & Alerts')}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: colors.textSecondary }]}>
                        {t(
                          'profile.budget_tracking_desc',
                          'Set category spending thresholds to receive real-time notifications before exceeding monthly caps.'
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <View style={[styles.bulletIconWrapper, { backgroundColor: isDark ? '#3B2F14' : '#FEF3C7' }]}>
                      <Ionicons name="chatbubbles" size={15} color="#F59E0B" />
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletTitle, { color: colors.text }]}>
                        {t('profile.support_contact_title', 'Direct Support')}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: colors.textSecondary }]}>
                        {t(
                          'profile.support_contact_desc',
                          'Need assistance or have feedback? Reach out to our dedicated support team at adormuntasir@gmail.com.'
                        )}
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
                  <Text style={styles.modalActionText}>
                    {t('profile.got_it', 'Got It')}
                  </Text>
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  avatarContainer: {
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
  },
  userInfoStack: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statsCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statsValue: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
  },
  groupContainer: {
    gap: 8,
  },
  groupHeader: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    paddingLeft: 4,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
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
  },
  logoutButton: {
    borderWidth: 1,
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
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetCard: {
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
  },
  modalSubtext: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
  },
  modalCloseButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langListContainer: {
    gap: 12,
    marginBottom: 16,
  },
  langOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  langOptionLeft: {
    gap: 2,
  },
  langOptionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  langOptionSub: {
    fontSize: 12,
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
  },
  bulletDesc: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
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
