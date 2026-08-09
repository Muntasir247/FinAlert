import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import ChangeRoleModal from './ChangeRoleModal';
import ContributionModal from './ContributionModal';
import MemberDetailModal from './MemberDetailModal';
import { ROLE_BG, ROLE_TEXT_COLOR, formatMoney, initialsOf } from './familyConstants';
import type { FamilyFinanceApi, MemberFinance } from './useFamilyFinance';

interface FamilyMembersPanelProps {
  finance: FamilyFinanceApi;
}

export default function FamilyMembersPanel({ finance }: FamilyMembersPanelProps) {
  const [detailMember, setDetailMember] = useState<MemberFinance | null>(null);
  const [roleMember, setRoleMember] = useState<MemberFinance | null>(null);
  const [contribMember, setContribMember] = useState<MemberFinance | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { finances, me, isAdmin } = finance;

  const handleRemove = async (memberId: string) => {
    if (removingId) return;
    setConfirmRemoveId(null);
    setRemoveError(null);
    setRemovingId(memberId);
    try {
      await finance.removeMember(memberId);
    } catch (error) {
      console.error('Failed to remove member:', error);
      setRemoveError('Failed to remove member. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <View style={styles.list}>
      {finances.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No members yet</Text>
          <Text style={styles.emptyText}>Invite family members to start sharing expenses.</Text>
        </View>
      ) : (
        finances.map((m) => {
          const paid = finance.memberPaid(m.memberId);
          const isSelf = me?.memberId === m.memberId;
          const confirmRemove = confirmRemoveId === m.memberId;
          return (
            <View key={m.memberId} style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => setDetailMember(m)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View ${m.name} activity`}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsOf(m.name)}</Text>
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {isSelf && <Text style={styles.selfTag}>You</Text>}
                    <View style={[styles.rolePill, { backgroundColor: ROLE_BG[m.role] }]}>
                      <Text style={[styles.rolePillText, { color: ROLE_TEXT_COLOR[m.role] }]}>
                        {m.role}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.tagsRow}>
                    <View style={[styles.tag, styles.tagNeutral]}>
                      <Text style={styles.tagText}>Limit {formatMoney(m.limit)}</Text>
                    </View>
                    <View style={[styles.tag, styles.tagNeutral]}>
                      <Text style={styles.tagText}>Paid {formatMoney(paid)}</Text>
                    </View>
                    {m.extra > 0 && (
                      <View style={[styles.tag, styles.tagGreen]}>
                        <Text style={styles.tagTextGreen}>+{formatMoney(m.extra)} extra</Text>
                      </View>
                    )}
                    {m.unable > 0 && (
                      <View style={[styles.tag, styles.tagRed]}>
                        <Text style={styles.tagTextRed}>⚠️ Unable {formatMoney(m.unable)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {isSelf && m.role !== 'Dependent' && !confirmRemove && (
                <View style={styles.selfActionRow}>
                  <TouchableOpacity
                    style={styles.selfActionBtn}
                    onPress={() => setContribMember(m)}
                    accessibilityRole="button"
                    accessibilityLabel="Set my contribution"
                  >
                    <Ionicons name="wallet-outline" size={16} color="#0FB384" />
                    <Text style={styles.actionBtnText}>
                      {m.limit > 0 ? 'Edit My Contribution' : 'Add My Contribution'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {isAdmin && !isSelf && !confirmRemove && (
                <>
                  {m.role !== 'Dependent' && (
                    <View style={styles.selfActionRow}>
                      <TouchableOpacity
                        style={styles.selfActionBtn}
                        onPress={() => setContribMember(m)}
                        accessibilityRole="button"
                        accessibilityLabel={`Set contribution for ${m.name}`}
                      >
                        <Ionicons name="wallet-outline" size={16} color="#0FB384" />
                        <Text style={styles.actionBtnText}>
                          {m.limit > 0 ? 'Edit Contribution' : 'Add Contribution'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setRoleMember(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`Change role for ${m.name}`}
                    >
                      <Ionicons name="shield-checkmark-outline" size={16} color="#0FB384" />
                      <Text style={styles.actionBtnText}>Change Role</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.removeBtn]}
                      onPress={() => {
                        setRemoveError(null);
                        setConfirmRemoveId(m.memberId);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${m.name}`}
                    >
                      <Feather name="trash-2" size={16} color="#EF4444" />
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {confirmRemove && (
                <View style={styles.confirmRow}>
                  <View style={styles.confirmRowTop}>
                    <Text style={styles.confirmText}>Remove member?</Text>
                    <View style={styles.confirmActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => setConfirmRemoveId(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel remove"
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.confirmBtn, removingId === m.memberId && styles.removeBtnDisabled]}
                        onPress={() => handleRemove(m.memberId)}
                        disabled={removingId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Yes remove ${m.name}`}
                      >
                        {removingId === m.memberId ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.confirmBtnText}>Yes, Remove</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  {removeError && <Text style={styles.removeErrorText}>{removeError}</Text>}
                </View>
              )}
            </View>
          );
        })
      )}

      <ChangeRoleModal
        visible={roleMember !== null}
        member={roleMember}
        onClose={() => setRoleMember(null)}
        onSave={async (role, limit) => {
          if (!roleMember) return 'Something went wrong. Please try again.';
          const targetId = roleMember.memberId;
          try {
            await finance.changeRole(targetId, role, limit);
            setRoleMember(null);
            return null;
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return msg.includes('NOT_ADMIN')
              ? 'Only the family Admin can change roles.'
              : 'Failed to change role. Please try again.';
          }
        }}
      />
      <ContributionModal
        visible={contribMember !== null}
        member={contribMember}
        onClose={() => setContribMember(null)}
        onSave={async (amount) => {
          if (!contribMember) return 'Something went wrong. Please try again.';
          const isSelf = me?.memberId === contribMember.memberId;
          const targetId = contribMember.memberId;
          const isAdminSelf = isSelf && finance.isAdmin;
          try {
            if (isAdminSelf) {
              await finance.changeRole(targetId, contribMember.role, amount);
            } else if (isSelf) {
              await finance.updateOwnContribution(targetId, amount);
            } else {
              await finance.changeRole(targetId, contribMember.role, amount);
            }
            setContribMember(null);
            return null;
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return msg.includes('NOT_ADMIN')
              ? 'Only the family Admin can change that contribution.'
              : msg.includes('NOT_OWN_MEMBER')
              ? 'You can only update your own contribution.'
              : 'Failed to update contribution. Please try again.';
          }
        }}
      />
      <MemberDetailModal
        visible={detailMember !== null}
        member={detailMember}
        finance={finance}
        onClose={() => setDetailMember(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#091E15',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#091E15',
  },
  selfTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0FB384',
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    flexShrink: 0,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 0,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagNeutral: {
    backgroundColor: '#F1F5F9',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
  },
  tagGreen: {
    backgroundColor: '#E8F7F1',
  },
  tagTextGreen: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0FB384',
  },
  tagRed: {
    backgroundColor: '#FEF2F2',
  },
  tagTextRed: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  selfActionRow: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  selfActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0FB384',
    backgroundColor: '#F4FBF7',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0FB384',
    backgroundColor: '#F4FBF7',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0FB384',
  },
  removeBtn: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  removeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  confirmRow: {
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  confirmRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeErrorText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: '#B91C1C',
  },
  removeBtnDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B91C1C',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  confirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
