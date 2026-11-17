import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  type MfsProvider,
  ALL_MFS_PROVIDERS,
  MFS_PROVIDER_CONFIG,
} from '../services/smsReaderService';

interface MfsProviderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (providers: MfsProvider[]) => void;
  selectedProviders: MfsProvider[];
}

export default function MfsProviderModal({
  visible,
  onClose,
  onSave,
  selectedProviders: initialProviders,
}: MfsProviderModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isBangla, t } = useLanguage();

  const [selected, setSelected] = useState<MfsProvider[]>(initialProviders);

  useEffect(() => {
    if (visible) {
      setSelected(initialProviders);
    }
  }, [visible, initialProviders]);

  const handleToggle = (provider: MfsProvider) => {
    setSelected((prev) =>
      prev.includes(provider) ? prev.filter((p) => p !== provider) : [...prev, provider]
    );
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIconCircle,
                  { backgroundColor: isDark ? '#143D2E' : '#E8F7F1' },
                ]}
              >
                <Ionicons name="phone-portrait-outline" size={20} color="#0FB384" />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {t('profile.select_providers_title', 'Transaction Providers')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {t('profile.select_providers_prompt', 'Choose providers to track expenses:')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? colors.surfaceSubtle : '#F1F5F9' }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Provider Checkbox List */}
          <View style={styles.providerList}>
            {ALL_MFS_PROVIDERS.map((provider) => {
              const config = MFS_PROVIDER_CONFIG[provider];
              const isChecked = selected.includes(provider);

              return (
                <TouchableOpacity
                  key={provider}
                  style={[
                    styles.providerRow,
                    {
                      backgroundColor: isDark ? colors.surfaceSubtle : '#F8FAFC',
                      borderColor: isChecked
                        ? '#0FB384'
                        : isDark
                        ? colors.cardBorder
                        : '#E2E8F0',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleToggle(provider)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  accessibilityLabel={isBangla ? config.nameBn : config.name}
                >
                  <View style={styles.providerLeft}>
                    <View
                      style={[
                        styles.providerBadge,
                        {
                          backgroundColor: isDark ? config.badgeBgDark : config.badgeBgLight,
                        },
                      ]}
                    >
                      <Text style={[styles.providerBadgeText, { color: config.brandColor }]}>
                        {config.name.charAt(0)}
                      </Text>
                    </View>
                    <Text style={[styles.providerName, { color: colors.text }]}>
                      {isBangla ? config.nameBn : config.name}
                    </Text>
                  </View>

                  <View style={styles.checkboxContainer}>
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isChecked ? '#0FB384' : colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel={t('profile.save_selection', 'Save Selection')}
          >
            <Text style={styles.saveBtnText}>
              {t('profile.save_selection', 'Save Selection')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
  },
  providerList: {
    gap: 10,
    marginBottom: 20,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 56,
  },
  providerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerBadgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  checkboxContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
