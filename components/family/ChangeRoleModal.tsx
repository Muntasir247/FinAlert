import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FamilySheetModal from './FamilySheetModal';
import { formatMoney } from './familyConstants';
import type { FamilyRole } from './familyConstants';
import type { MemberFinance } from './useFamilyFinance';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface ChangeRoleModalProps {
  visible: boolean;
  member: MemberFinance | null;
  onClose: () => void;
  onSave: (role: FamilyRole, limit: number) => Promise<string | null>;
}

const ROLE_OPTIONS: { value: Exclude<FamilyRole, 'Admin'>; label: string; description: string }[] = [
  { value: 'Contributor', label: 'Contributor', description: 'Pays a fixed monthly amount' },
  { value: 'Dependent', label: 'Dependent', description: 'No contribution' },
];

export default function ChangeRoleModal({ visible, member, onClose, onSave }: ChangeRoleModalProps) {
  const { colors, isDark } = useTheme();
  const { isBangla } = useLanguage();
  const [role, setRole] = useState<Exclude<FamilyRole, 'Admin'>>('Contributor');
  const [limitText, setLimitText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const limit = Number.parseFloat(limitText) || 0;
  const canSave = (role === 'Dependent' || limit > 0) && !saving;

  useEffect(() => {
    if (visible && member) {
      setRole(member.role === 'Dependent' ? 'Dependent' : 'Contributor');
      setLimitText(member.role === 'Dependent' ? '' : String(member.limit));
      setErrorMsg(null);
      setSaving(false);
    }
  }, [visible, member]);

  const handleClose = () => {
    if (visible) {
      setRole('Contributor');
      setLimitText('');
      setErrorMsg(null);
      setSaving(false);
    }
    onClose();
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const error = await onSave(role, role === 'Dependent' ? 0 : limit);
      if (error) {
        setErrorMsg(error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <FamilySheetModal
      visible={visible}
      title={isBangla ? 'ভূমিকা পরিবর্তন করুন' : 'Change Role'}
      onClose={handleClose}
      keyboardAvoiding
    >
      {member && (
        <View style={[styles.memberBanner, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {member.name
                .split(/\s+/)
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.memberName, { color: colors.text }]}>{member.name}</Text>
        </View>
      )}

      <Text style={[styles.label, { color: colors.textSecondary }]}>{isBangla ? 'ভূমিকা' : 'Role'}</Text>
      <View style={styles.roleList}>
        {ROLE_OPTIONS.map((opt) => {
          const selected = role === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.roleOption,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                selected && [styles.roleOptionActive, isDark && { backgroundColor: '#14382A', borderColor: '#0FB384' }],
              ]}
              onPress={() => {
                setRole(opt.value);
                if (opt.value === 'Dependent') setLimitText('');
              }}
              accessibilityRole="button"
              accessibilityLabel={`Role ${opt.label}`}
              accessibilityState={{ selected }}
            >
              <View style={styles.roleOptionTextWrap}>
                <Text style={[styles.roleOptionTitle, { color: colors.text }, selected && [styles.roleOptionTitleActive, isDark && { color: '#6EE7B7' }]]}>
                  {isBangla ? (opt.value === 'Contributor' ? 'অবদানকারী' : 'নির্ভরশীল') : opt.label}
                </Text>
                <Text style={[styles.roleOptionDesc, { color: colors.textSecondary }, selected && [styles.roleOptionDescActive, isDark && { color: '#A7F3D0' }]]}>
                  {isBangla ? (opt.value === 'Contributor' ? 'নির্দিষ্ট মাসিক অর্থ প্রদান করে' : 'কোনো অবদান নেই') : opt.description}
                </Text>
              </View>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selected ? '#0FB384' : isDark ? '#4B5563' : '#CBD5E1'}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {role === 'Contributor' && (
        <>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {isBangla ? 'মাসিক অবদানের পরিমাণ' : 'Monthly Contribution Amount'}
          </Text>
          <View style={[styles.amountWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Text style={[styles.currencyPrefix, { color: colors.text }]}>৳</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              value={limitText}
              onChangeText={setLimitText}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Monthly contribution amount"
            />
          </View>
        </>
      )}

      {role === 'Dependent' && (
        <View style={[styles.infoBanner, isDark && { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
            {isBangla
              ? 'নির্ভরশীলরা অর্থ প্রদান করেন না। তাদের খরচ অন্য সদস্যরা বহন করেন।'
              : 'Dependents do not contribute. Their share is covered by other members.'}
          </Text>
        </View>
      )}

      {member && member.role === 'Admin' && (
        <Text style={[styles.adminNote, { color: colors.textSecondary }]}>
          {isBangla ? 'পারিবারিক অ্যাডমিনের সম্পূর্ণ নিয়ন্ত্রণ থাকে।' : 'The family Admin keeps full control and cannot be demoted.'}
        </Text>
      )}

      {errorMsg && (
        <View style={[styles.errorBox, isDark && { backgroundColor: '#38161A', borderColor: '#7F1D1D' }]}>
          <Text style={[styles.errorText, isDark && { color: '#FCA5A5' }]}>{errorMsg}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel="Save role change"
      >
        <Text style={styles.saveBtnText}>
          {saving ? (isBangla ? 'সংরক্ষণ করা হচ্ছে…' : 'Saving…') : (isBangla ? 'সংরক্ষণ করুন' : 'Save')}
        </Text>
      </TouchableOpacity>
    </FamilySheetModal>
  );
}

const styles = StyleSheet.create({
  memberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 20,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#091E15',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
    marginBottom: 10,
  },
  roleList: {
    gap: 10,
    marginBottom: 20,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  roleOptionActive: {
    borderColor: '#0FB384',
    backgroundColor: '#F4FBF7',
  },
  roleOptionTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  roleOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#091E15',
    marginBottom: 2,
  },
  roleOptionTitleActive: {
    color: '#0F2C20',
  },
  roleOptionDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
  },
  roleOptionDescActive: {
    color: '#0FB384',
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 20,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: '#091E15',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#091E15',
    padding: 0,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#475569',
  },
  adminNote: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#DC2626',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0FB384',
    marginTop: 8,
  },
  saveBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
