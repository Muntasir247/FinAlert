import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { BKashTransaction } from '../services/smsReaderService';
import { markTrxIdProcessed, removePendingTransaction } from '../services/smsReaderService';

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
  // Normalize items
  const items = transactions && transactions.length > 0 ? transactions : transaction ? [transaction] : [];
  if (items.length === 0) return null;

  const isMultiple = items.length > 1;
  const primaryTx = items[0];

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
      <View style={styles.card}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.bkashLogoWrap}>
              <Ionicons name="phone-portrait" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.brandTitle}>
              {isMultiple
                ? `${items.length} bKash Transactions Detected`
                : 'bKash Transaction Detected'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleDismissAll}
            accessibilityRole="button"
            accessibilityLabel="Dismiss bKash detection"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Transaction Content Details */}
        {isMultiple ? (
          <View style={styles.batchDetailBox}>
            <Text style={styles.batchTitle}>
              {items.length} new transactions detected since your last visit.
            </Text>
            <Text style={styles.batchSummary}>
              Latest: {primaryTx.counterparty} · ৳{primaryTx.amount.toFixed(2)} (+{items.length - 1} more)
            </Text>
          </View>
        ) : (
          <View style={styles.detailRow}>
            <View style={styles.detailTextCol}>
              <Text style={styles.counterpartyText} numberOfLines={1}>
                {isIncome ? 'Received from: ' : 'Paid to: '}
                <Text style={styles.counterpartyHighlight}>{primaryTx.counterparty}</Text>
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.trxPill}>
                  <Text style={styles.trxPillText}>TrxID: {primaryTx.trxId}</Text>
                </View>
                <View style={styles.catPill}>
                  <Text style={styles.catPillText}>{primaryTx.category}</Text>
                </View>
              </View>
            </View>
            <View style={styles.amountCol}>
              <Text style={[styles.amountText, isIncome ? styles.amountIncome : styles.amountExpense]}>
                {isIncome ? '+' : '-'}৳{primaryTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={styles.dateText}>{primaryTx.date}</Text>
            </View>
          </View>
        )}

        {/* Human-In-The-Loop Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={handleDismissAll}
            accessibilityRole="button"
            accessibilityLabel="Ignore transactions"
          >
            <Text style={styles.dismissBtnText}>Ignore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={handleReview}
            accessibilityRole="button"
            accessibilityLabel={isMultiple ? `Review all ${items.length} transactions` : 'Review and add transaction'}
          >
            <Feather name="check" size={16} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.reviewBtnText}>
              {isMultiple ? `Review All (${items.length})` : 'Review & Add'}
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
