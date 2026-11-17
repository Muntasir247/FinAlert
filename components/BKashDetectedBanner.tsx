import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { BKashTransaction } from '../services/smsReaderService';
import {
  markTrxIdProcessed,
  removePendingTransaction,
  MFS_PROVIDER_CONFIG,
} from '../services/smsReaderService';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface BKashDetectedBannerProps {
  transaction?: BKashTransaction | null;
  transactions?: BKashTransaction[];
  onReview: (tx: BKashTransaction) => void;
  onReviewBatch?: (txs: BKashTransaction[]) => void;
  onDismiss: () => void;
}

export default function BKashDetectedBanner({
  transaction,
  transactions,
  onReview,
  onReviewBatch,
  onDismiss,
}: BKashDetectedBannerProps) {
  const { colors, isDark } = useTheme();
  const { isBangla, formatCurrency } = useLanguage();

  // Normalize items
  const items = transactions && transactions.length > 0 ? transactions : transaction ? [transaction] : [];
  if (items.length === 0) return null;

  const isMultiple = items.length > 1;
  const primaryTx = items[0];

  const provider = primaryTx.provider || 'bkash';
  const providerConfig = MFS_PROVIDER_CONFIG[provider] || MFS_PROVIDER_CONFIG.bkash;
  const providerName = isBangla ? providerConfig.nameBn : providerConfig.name;

  const handleDismissAll = async () => {
    for (const item of items) {
      await markTrxIdProcessed(item.trxId);
      removePendingTransaction(item.trxId);
    }
    onDismiss();
  };

  const handleReview = async () => {
    if (isMultiple && onReviewBatch) {
      onReviewBatch(items);
    } else {
      await markTrxIdProcessed(primaryTx.trxId);
      removePendingTransaction(primaryTx.trxId);
      onReview(primaryTx);
    }
  };

  const isIncome = primaryTx.type === 'income';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? providerConfig.badgeBgDark : colors.card,
            borderColor: isDark ? providerConfig.brandColor : providerConfig.brandColor,
          },
        ]}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={[styles.bkashLogoWrap, { backgroundColor: providerConfig.brandColor }]}>
              <Ionicons name="phone-portrait" size={14} color="#FFFFFF" />
            </View>
            <Text style={[styles.brandTitle, { color: isDark ? '#FFFFFF' : providerConfig.brandColor }]}>
              {isMultiple
                ? (isBangla ? `${items.length}টি লেনদেন শনাক্ত হয়েছে` : `${items.length} Transactions Detected`)
                : (isBangla ? `${providerName} লেনদেন শনাক্ত হয়েছে` : `${providerName} Transaction Detected`)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleDismissAll}
            accessibilityRole="button"
            accessibilityLabel="Dismiss transaction detection"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={18} color={isDark ? colors.textSecondary : '#6B7280'} />
          </TouchableOpacity>
        </View>

        {/* Transaction Content Details */}
        {isMultiple ? (
          <View
            style={[
              styles.batchDetailBox,
              {
                backgroundColor: isDark ? colors.surfaceSubtle : '#F8FAFC',
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <Text style={[styles.batchTitle, { color: colors.text }]}>
              {isBangla ? `${items.length}টি নতুন লেনদেন পাওয়া গেছে।` : `${items.length} new transactions detected since your last visit.`}
            </Text>
            <Text style={[styles.batchSummary, { color: colors.textSecondary }]}>
              {isBangla ? 'সর্বশেষ: ' : 'Latest: '}{primaryTx.counterparty} · {formatCurrency(primaryTx.amount)} (+{items.length - 1} {isBangla ? 'আরও' : 'more'})
            </Text>
          </View>
        ) : (
          <View style={styles.detailRow}>
            <View style={styles.detailTextCol}>
              <Text style={[styles.counterpartyText, { color: colors.textSecondary }]} numberOfLines={1}>
                {isIncome ? (isBangla ? 'প্রেরক: ' : 'Received from: ') : (isBangla ? 'প্রাপক: ' : 'Paid to: ')}
                <Text style={[styles.counterpartyHighlight, { color: colors.text }]}>{primaryTx.counterparty}</Text>
              </Text>
              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.trxPill,
                    {
                      backgroundColor: isDark ? providerConfig.badgeBgDark : providerConfig.badgeBgLight,
                    },
                  ]}
                >
                  <Text style={[styles.trxPillText, { color: providerConfig.brandColor }]}>
                    {providerName}
                  </Text>
                </View>
                <View style={[styles.trxPill, isDark && { backgroundColor: colors.surfaceSubtle }]}>
                  <Text style={[styles.trxPillText, isDark && { color: colors.textSecondary }]}>TrxID: {primaryTx.trxId}</Text>
                </View>
                {primaryTx.reference ? (
                  <View style={[styles.refPill, isDark && { backgroundColor: colors.surfaceSubtle }]}>
                    <Text style={[styles.refPillText, isDark && { color: colors.textSecondary }]}>Ref: {primaryTx.reference}</Text>
                  </View>
                ) : null}
                <View style={[styles.catPill, isDark && { backgroundColor: '#14382A' }]}>
                  <Text style={[styles.catPillText, isDark && { color: '#A7F3D0' }]}>{primaryTx.category}</Text>
                </View>
              </View>
            </View>
            <View style={styles.amountCol}>
              <Text style={[styles.amountText, isIncome ? styles.amountIncome : { color: providerConfig.brandColor }]}>
                {isIncome ? '+' : '-'}{formatCurrency(primaryTx.amount)}
              </Text>
              <Text style={[styles.dateText, { color: colors.textMuted }]}>{primaryTx.date}</Text>
            </View>
          </View>
        )}

        {/* Human-In-The-Loop Action Buttons */}
        <View style={[styles.actionRow, { borderTopColor: isDark ? colors.cardBorder : '#F3F4F6' }]}>
          <TouchableOpacity
            style={[styles.dismissBtn, isDark && { backgroundColor: colors.surfaceSubtle }]}
            onPress={handleDismissAll}
            accessibilityRole="button"
            accessibilityLabel="Ignore transactions"
          >
            <Text style={[styles.dismissBtnText, { color: colors.textSecondary }]}>
              {isBangla ? 'উপেক্ষা করুন' : 'Ignore'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={handleReview}
            accessibilityRole="button"
            accessibilityLabel={isMultiple ? `Review all ${items.length} transactions` : 'Review and add transaction'}
          >
            <Feather name="check" size={16} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.reviewBtnText}>
              {isMultiple
                ? (isBangla ? `সব পর্যালোচনা (${items.length})` : `Review All (${items.length})`)
                : (isBangla ? 'যাচাই ও যোগ' : 'Review & Add')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#E2136E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FCE7F3',
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bkashLogoWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2136E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#BE185D',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  detailTextCol: {
    flex: 1,
  },
  counterpartyText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 6,
  },
  counterpartyHighlight: {
    fontWeight: '700',
    color: '#091E15',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  trxPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trxPillText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#4B5563',
    fontWeight: '600',
  },
  refPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  refPillText: {
    fontSize: 11,
    color: '#4338CA',
    fontWeight: '600',
  },
  catPill: {
    backgroundColor: '#E8F7F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catPillText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  amountExpense: {
    color: '#BE185D',
  },
  amountIncome: {
    color: '#059669',
  },
  dateText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  batchDetailBox: {
    backgroundColor: '#FDF2F8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  batchTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9D174D',
    marginBottom: 2,
  },
  batchSummary: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  dismissBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dismissBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  reviewBtn: {
    minHeight: 48,
    backgroundColor: '#0FB384',
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: {
    marginRight: 6,
  },
  reviewBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
