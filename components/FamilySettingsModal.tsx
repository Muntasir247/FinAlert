import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { ROLE_BG, ROLE_TEXT_COLOR } from './family/familyConstants';

interface FamilySettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function FamilySettingsModal({ visible, onClose }: FamilySettingsModalProps) {
  const insets = useSafeAreaInsets();
  const { family, members, leaveFamily, deleteFamily } = useFamily();
  const { user } = useAuth();

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!family) return null;

  const myMembership = members.find((m) => m.user_id === user?.id);
  const myRole = myMembership?.role ?? 'Contributor';
  const isAdmin = myRole === 'Admin';
  const isCreator = family.created_by === user?.id;

  const adminCount = members.filter((m) => m.role === 'Admin').length;
  const isSoleAdmin = isAdmin && adminCount <= 1 && members.length > 1;

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(family.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    if (isSoleAdmin) {
      setErrorMsg('You are the only Admin. Please assign another Admin before leaving.');
      return;
    }

    Alert.alert(
      'Leave Family',
      `Are you sure you want to leave ${family.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setErrorMsg(null);
            const { error } = await leaveFamily();
            setLoading(false);
            if (error) {
              setErrorMsg(error.message || 'Failed to leave family.');
            } else {
              onClose();
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Family',
      `Permanently delete ${family.name} and all shared financial records for all members?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setErrorMsg(null);
            const { error } = await deleteFamily();
            setLoading(false);
            if (error) {
              setErrorMsg(error.message || 'Failed to delete family.');
            } else {
              onClose();
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheetCard,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          {/* Top Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalIconCircle}>
                <Ionicons name="settings-outline" size={22} color="#0FB384" />
              </View>
              <View style={styles.headerTextStack}>
                {/* Title token: text-[20px] leading-[22px] font-bold */}
                <Text style={styles.modalTitle}>Family Settings</Text>
                {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                <Text style={styles.modalSubtext}>{family.name}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close family settings"
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {errorMsg && (
            <View style={styles.errorBox}>
              {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Family Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              {/* Subtext token: text-[14px] font-normal */}
              <Text style={styles.infoLabel}>Invite Code</Text>
              <TouchableOpacity
                style={styles.copyPill}
                onPress={handleCopyCode}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Copy invite code"
              >
                {/* Subtext token: text-[14px] font-normal */}
                <Text style={styles.codeText}>{family.invite_code}</Text>
                <Feather
                  name={copied ? 'check' : 'copy'}
                  size={14}
                  color={copied ? '#0FB384' : '#64748B'}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.infoRow, styles.noBorder]}>
              {/* Subtext token: text-[14px] font-normal */}
              <Text style={styles.infoLabel}>Your Role</Text>
              <View style={[styles.rolePill, { backgroundColor: ROLE_BG[myRole] }]}>
                {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                <Text style={[styles.rolePillText, { color: ROLE_TEXT_COLOR[myRole] }]}>
                  {myRole}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons (Danger Zone) */}
          <View style={styles.actionsContainer}>
            {loading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="small" color="#EF4444" />
              </View>
            ) : (
              <>
                {/* Leave Family Action */}
                <TouchableOpacity
                  style={styles.leaveButton}
                  onPress={handleLeave}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Leave Family"
                >
                  <Ionicons name="exit-outline" size={18} color="#EF4444" />
                  {/* Subtitle token: text-[16px] font-medium */}
                  <Text style={styles.leaveButtonText}>Leave Family</Text>
                </TouchableOpacity>

                {/* Delete Family Action (Only for Admin / Creator) */}
                {(isAdmin || isCreator) && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Delete Family Group"
                  >
                    <Feather name="trash-2" size={18} color="#EF4444" />
                    {/* Subtitle token: text-[16px] font-medium */}
                    <Text style={styles.deleteButtonText}>Delete Family Group</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTextStack: {
    flex: 1,
    gap: 2,
  },
  modalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F7F1',
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
  closeButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#DC2626',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
    letterSpacing: 0.5,
  },
  rolePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
  },
  actionsContainer: {
    gap: 10,
  },
  loadingWrapper: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#DC2626',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
});

