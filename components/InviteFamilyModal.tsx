import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SHEET_MAX_HEIGHT = 560;

interface InviteFamilyModalProps {
  visible: boolean;
  code: string;
  familyName: string;
  onClose: () => void;
}

export default function InviteFamilyModal({ visible, code, familyName, onClose }: InviteFamilyModalProps) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const translateY = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const inviteMessage = `Join my family group on FinAlert! Use my invite code: ${code} to connect.`;

  useEffect(() => {
    if (visible) {
      setCopied(false);
      setSharing(false);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(SHEET_MAX_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_MAX_HEIGHT, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(inviteMessage)}`;
    try {
      if (await Linking.canOpenURL(url)) {
        Linking.openURL(url);
      } else {
        // WhatsApp isn't installed — fall back to the native share sheet.
        await Share.share({ message: inviteMessage });
      }
    } catch (e) {
      Alert.alert('Sharing unavailable', 'Could not open WhatsApp. Try the copy or share options.');
    }
  };

  const handleSMS = async () => {
    const body = encodeURIComponent(inviteMessage);
    const url = Platform.OS === 'ios' ? `sms:&body=${body}` : `sms:?body=${body}`;
    try {
      if (await Linking.canOpenURL(url)) {
        Linking.openURL(url);
      } else {
        Alert.alert('SMS unavailable', 'No SMS app is available on this device.');
      }
    } catch (e) {
      Alert.alert('SMS unavailable', 'Could not open the SMS app on this device.');
    }
  };

  const handleFacebook = async () => {
    setSharing(true);
    try {
      await Share.share({ message: inviteMessage });
    } catch (e) {
      // User dismissed the share sheet — nothing to show.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss Invite to Family"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSide} />
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Invite to Family</Text>
            </View>
            <View style={styles.headerSide}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close Invite to Family"
              >
                <Ionicons name="close" size={22} color="#091E15" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Share this code with family members. Anyone with this code can join your family group.
          </Text>

          {/* Code display box */}
          <View style={styles.codeBox}>
            <Text style={styles.codeBoxLabel}>{familyName} · Invite Code</Text>
            <Text style={styles.codeText} selectable>
              {code}
            </Text>
            <TouchableOpacity
              style={[styles.copyButton, copied && styles.copyButtonCopied]}
              onPress={handleCopy}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Copy invite code"
            >
              {copied ? (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>Code copied!</Text>
                </>
              ) : (
                <>
                  <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>Copy Code</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Share actions */}
          <Text style={styles.shareTitle}>Share Invite</Text>
          <View style={styles.shareRow}>
            <TouchableOpacity
              style={styles.shareItem}
              onPress={handleWhatsApp}
              accessibilityRole="button"
              accessibilityLabel="Share invite on WhatsApp"
            >
              <View style={[styles.shareIconCircle, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.shareLabel}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareItem}
              onPress={handleSMS}
              accessibilityRole="button"
              accessibilityLabel="Share invite via SMS"
            >
              <View style={[styles.shareIconCircle, { backgroundColor: '#3B82F6' }]}>
                <Ionicons name="chatbubbles" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.shareLabel}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareItem}
              onPress={handleFacebook}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel="Share invite on Facebook"
            >
              <View style={[styles.shareIconCircle, { backgroundColor: '#1877F2' }]}>
                {sharing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="logo-facebook" size={22} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.shareLabel}>Facebook</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTouchable: {
    flex: 1,
    backgroundColor: 'rgba(8, 30, 21, 0.55)',
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerSide: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Description ──
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 16,
  },

  // ── Code box ──
  codeBox: {
    backgroundColor: '#F4FBF7',
    borderWidth: 1,
    borderColor: '#E8F7F1',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  codeBoxLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#091E15',
    letterSpacing: 2,
    marginBottom: 14,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#0FB384',
  },
  copyButtonCopied: {
    backgroundColor: '#0D8A67',
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // ── Share actions ──
  shareTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#091E15',
    marginBottom: 14,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shareItem: {
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
    paddingVertical: 4,
  },
  shareIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#091E15',
  },
});
