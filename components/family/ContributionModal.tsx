import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import FamilySheetModal from './FamilySheetModal';
import { formatMoney } from './familyConstants';
import type { MemberFinance } from './useFamilyFinance';

interface ContributionModalProps {
  visible: boolean;
  member: MemberFinance | null;
  onClose: () => void;
  onSave: (amount: number) => void;
}

export default function ContributionModal({ visible, member, onClose, onSave }: ContributionModalProps) {
  const [amountText, setAmountText] = useState('');

  const amount = Number.parseFloat(amountText) || 0;
  const hasExisting = (member?.limit ?? 0) > 0;
  const canSave = amount > 0;

  useEffect(() => {
    if (visible && member) {
      setAmountText(member.limit > 0 ? String(member.limit) : '');
    }
  }, [visible, member]);

  const handleClose = () => {
    if (visible) {
      setAmountText('');
    }
    onClose();
  };

  return (
    <FamilySheetModal
      visible={visible}
      title="Contribution Amount"
      onClose={handleClose}
      keyboardAvoiding
    >
      {member && (
        <View style={styles.memberBanner}>
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
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberMeta}>
              {member.role} · Currently {formatMoney(member.limit)}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.label}>Monthly Contribution</Text>
      <View style={styles.amountWrap}>
        <Text style={styles.currencyPrefix}>৳</Text>
        <TextInput
          style={styles.amountInput}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#A0ADB6"
          accessibilityLabel="Monthly contribution amount"
        />
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="wallet-outline" size={18} color="#64748B" />
        <Text style={styles.infoBannerText}>
          The family budget is the sum of all members' contributions.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={() => canSave && onSave(amount)}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel="Save contribution amount"
      >
        <Feather name="check" size={18} color="#FFFFFF" />
        <Text style={styles.saveBtnText}>Save Contribution</Text>
      </TouchableOpacity>

      {hasExisting && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onSave(0)}
          accessibilityRole="button"
          accessibilityLabel="Delete contribution"
        >
          <Feather name="trash-2" size={18} color="#EF4444" />
          <Text style={styles.deleteBtnText}>Delete Contribution</Text>
        </TouchableOpacity>
      )}
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
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#091E15',
  },
  memberMeta: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#091E15',
    marginBottom: 10,
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0FB384',
    marginBottom: 10,
  },
  saveBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#EF4444',
  },
});
