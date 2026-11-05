import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  requestSmsPermissions,
  checkSmsPermissions,
  isSmsReadingSupported,
  syncRecentSms,
} from '../services/smsReaderService';

interface BKashSimulatorModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BKashSimulatorModal({ visible, onClose }: BKashSimulatorModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isBangla } = useLanguage();
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [isGranted, setIsGranted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check actual Android OS permission state on mount and whenever modal becomes visible
  useEffect(() => {
    checkSmsPermissions().then((granted) => {
      setIsGranted(granted);
      setIsChecking(false);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (visible) {
      checkSmsPermissions()
        .then((granted) => {
          if (!isMounted) return;
          setIsGranted(granted);
          setIsChecking(false);
          if (granted) {
            syncRecentSms();
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [visible]);

  const handleRequestAndroidPermission = async () => {
    if (!isSmsReadingSupported()) {
      setPermissionStatus('SMS detection is only active on Android devices.');
      return;
    }
    const granted = await requestSmsPermissions();
    setIsGranted(granted);
    setPermissionStatus(
      granted
        ? 'Permissions granted successfully! FinAlert is ready to detect bKash transactions.'
        : 'Permission was denied. You can enable it in device Settings.'
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.badge, isDark && { backgroundColor: '#4A1D34' }]}>
                <Ionicons name="phone-portrait-outline" size={18} color="#BE185D" />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {isBangla ? 'বিকাশ এসএমএস ডিটেকশন' : 'bKash SMS Detection'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {isBangla ? 'স্বয়ংক্রিয় লেনদেন শনাক্তকরণ' : 'Automatic transaction detection'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? colors.surfaceSubtle : '#F3F4F6' }]}
              accessibilityRole="button"
              accessibilityLabel="Close bKash detection setup"
            >
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Top Green Box */}
            <View style={[styles.permCard, isDark && { backgroundColor: '#14382A', borderColor: '#1F5A42' }]}>
              <View style={styles.permHeader}>
                <Ionicons
                  name={isGranted ? 'shield-checkmark' : 'shield-outline'}
                  size={20}
                  color="#059669"
                />
                <Text style={[styles.permDesc, isDark && { color: '#A7F3D0' }]}>
                  {isGranted
                    ? (isBangla ? 'অনুমতি সক্রিয় আছে। ফিনঅ্যালার্ট প্রস্তুত।' : 'Permission granted. FinAlert is active.')
                    : (isBangla ? 'প্রয়োজনীয় অনুমতি প্রদান করুন।' : 'Grant access to the permission needed.')}
                </Text>
              </View>

              {isGranted ? (
                <View style={[styles.grantedBadge, isDark && { backgroundColor: '#0D2D20' }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={[styles.grantedBadgeText, isDark && { color: '#6EE7B7' }]}>
                    {isBangla ? 'অনুমতি সক্রিয় (অনুমোদিত)' : 'Permission Active (Granted)'}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.permBtn}
                  onPress={handleRequestAndroidPermission}
                  disabled={isChecking}
                  accessibilityRole="button"
                  accessibilityLabel="Grant Android SMS permission"
                >
                  <Text style={styles.permBtnText}>
                    {isChecking
                      ? (isBangla ? 'যাচাই করা হচ্ছে...' : 'Checking...')
                      : (isBangla ? 'অনুমতি দিন' : 'Grant Permission')}
                  </Text>
                </TouchableOpacity>
              )}

              {permissionStatus && <Text style={styles.permStatusText}>{permissionStatus}</Text>}
            </View>

            {/* How It Works */}
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: isDark ? colors.surfaceSubtle : '#F8FAFC',
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                {isBangla ? 'এটি যেভাবে কাজ করে' : 'How it works'}
              </Text>
              <View style={styles.infoRow}>
                <Ionicons name="notifications-outline" size={18} color="#0FB384" style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  {isBangla
                    ? 'ফিনঅ্যালার্ট আপনার ফোনের বিকাশ অফিসিয়াল ট্রানজ্যাকশন এসএমএস স্বয়ংক্রিয়ভাবে ট্র্যাক করে।'
                    : 'FinAlert automatically listens for official bKash transaction SMS messages on your phone.'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#0FB384" style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  {isBangla
                    ? 'লেনদেন সেভ করার আগে আপনি প্রাপক, পরিমাণ ও খরচের খাত যাচাই করতে পারবেন।'
                    : 'A detection prompt lets you verify the counterparty, amount, and category before anything is saved.'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="lock-closed-outline" size={18} color="#0FB384" style={styles.infoIcon} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  {isBangla
                    ? 'কোনো লেনদেন কখনোই আপনার অনুমতি ছাড়া সংরক্ষণ করা হয় না। আপনার ডাটা আপনার ফোনে নিরাপদ থাকে।'
                    : 'Transactions are never saved automatically. Your financial data stays private on your device.'}
                </Text>
              </View>
            </View>

            {/* Scan Recent SMS Button */}
            {isGranted && (
              <TouchableOpacity
                style={[
                  styles.syncBtn,
                  isDark && { backgroundColor: '#361523', borderColor: '#831843' },
                ]}
                onPress={async () => {
                  await syncRecentSms();
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel="Scan SMS inbox now"
              >
                <Ionicons name="refresh-outline" size={18} color="#BE185D" />
                <Text style={[styles.syncBtnText, isDark && { color: '#F472B6' }]}>
                  {isBangla ? 'এখনই এসএমএস ইনবক্স স্ক্যান করুন' : 'Scan SMS Inbox Now'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Done Action Button */}
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.doneBtnText}>
                {isBangla ? 'সম্পন্ন' : 'Done'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 30, 21, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  permCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  permHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  permDesc: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#065F46',
  },
  permBtn: {
    backgroundColor: '#0FB384',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  permStatusText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '500',
  },
  grantedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  grantedBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FDF2F8',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FCE7F3',
    height: 48,
    marginTop: 4,
  },
  syncBtnText: {
    color: '#BE185D',
    fontSize: 14,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: '#091E15',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
