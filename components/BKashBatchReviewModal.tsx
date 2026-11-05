import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTransactions } from '../context/TransactionsContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  markTrxIdProcessed,
  removePendingTransaction,
  clearPendingTransactions,
  type BKashTransaction,
} from '../services/smsReaderService';
import { TRANSACTION_CATEGORIES, INCOME_CATEGORIES } from '../lib/transactionCategories';
import type { NewTransaction } from '../lib/transactions';

interface BKashBatchReviewModalProps {
  visible: boolean;
  transactions: BKashTransaction[];
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export default function BKashBatchReviewModal({
  visible,
  transactions: initialTransactions,
  onClose,
  onSuccess,
}: BKashBatchReviewModalProps) {
  const insets = useSafeAreaInsets();
  const { addTransactions } = useTransactions();
  const { colors, isDark } = useTheme();
  const { isBangla, formatCurrency, translateCategory } = useLanguage();

  // Local state for items and selections
  const [items, setItems] = useState<Array<BKashTransaction & { selected: boolean }>>([]);
  const [categoryPickerTrxId, setCategoryPickerTrxId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Sync state whenever modal opens or new transactions arrive
  React.useEffect(() => {
    if (visible) {
      setItems(
        initialTransactions.map((tx) => ({
          ...tx,
          selected: true, // Default checked
        }))
      );
    }
  }, [visible, initialTransactions]);

  const handleToggle = (trxId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.trxId === trxId ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleToggleAll = (selectAll: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: selectAll })));
  };

  const handleChangeCategory = (trxId: string, newCategory: string) => {
    setItems((prev) =>
      prev.map((item) => (item.trxId === trxId ? { ...item, category: newCategory } : item))
    );
    setCategoryPickerTrxId(null);
  };

  const handleRemove = async (trxId: string) => {
    await markTrxIdProcessed(trxId);
    removePendingTransaction(trxId);
    setItems((prev) => prev.filter((item) => item.trxId !== trxId));
  };

  const selectedItems = items.filter((i) => i.selected);

  const handleImportSelected = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Transactions Selected', 'Please check at least one transaction to import.');
      return;
    }

    setImporting(true);

    const payload: NewTransaction[] = selectedItems.map((tx) => ({
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: `${tx.type === 'expense' ? 'Payment to' : 'Received from'} ${tx.counterparty}${tx.reference ? ` - ${tx.reference}` : ''} (TrxID: ${tx.trxId})`,
      date: tx.date,
    }));

    const { error, data } = await addTransactions(payload);

    if (error) {
      setImporting(false);
      Alert.alert('Import Failed', error.message || 'Could not save transactions.');
      return;
    }

    // Mark imported items as processed so they don't appear in pending queue
    for (const item of selectedItems) {
      await markTrxIdProcessed(item.trxId);
      removePendingTransaction(item.trxId);
    }

    if (selectedItems.length === items.length) {
      clearPendingTransactions();
    }

    const count = data ? data.length : selectedItems.length;
    setImporting(false);
    onSuccess?.(count);
    onClose();

    Alert.alert(
      'Transactions Added! 🎉',
      `Successfully imported ${count} bKash transactions into your account.`
    );
  };

  const activeItemForCat = items.find((i) => i.trxId === categoryPickerTrxId);
  const categoryOptions =
    activeItemForCat?.type === 'income' ? INCOME_CATEGORIES : TRANSACTION_CATEGORIES;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="phone-portrait" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {isBangla ? 'শনাক্তকৃত বিকাশ এসএমএস পর্যালোচনা' : 'Review Detected bKash SMS'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {isBangla
                    ? `${items.length}টির মধ্যে ${selectedItems.length}টি লেনদেন নির্বাচিত`
                    : `${selectedItems.length} of ${items.length} transactions selected`}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close batch review"
            >
              <Feather name="x" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Quick Select Bar */}
          <View
            style={[
              styles.bulkBar,
              {
                backgroundColor: isDark ? colors.surfaceSubtle : '#F9FAFB',
                borderBottomColor: colors.cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => handleToggleAll(selectedItems.length !== items.length)}
              accessibilityRole="button"
              accessibilityLabel="Toggle select all"
            >
              <Ionicons
                name={
                  selectedItems.length === items.length
                    ? 'checkbox'
                    : selectedItems.length > 0
                    ? 'remove-circle-outline'
                    : 'square-outline'
                }
                size={20}
                color="#0FB384"
              />
              <Text style={styles.toggleText}>
                {selectedItems.length === items.length
                  ? (isBangla ? 'সব অনির্বাচন' : 'Deselect All')
                  : (isBangla ? 'সব নির্বাচন' : 'Select All')}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.bulkNote, { color: colors.textSecondary }]}>
              {isBangla ? 'বাদ দিতে আনচেক করুন' : 'Human-in-the-loop: Uncheck any to ignore'}
            </Text>
          </View>

          {/* Transaction List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {items.map((tx) => {
              const isIncome = tx.type === 'income';
              return (
                <View
                  key={tx.trxId}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
                      borderColor: colors.cardBorder,
                    },
                    !tx.selected && (isDark ? { backgroundColor: '#0B2219', opacity: 0.5 } : styles.cardUnselected),
                  ]}
                >
                  {/* Checkbox */}
                  <TouchableOpacity
                    style={styles.checkboxTouch}
                    onPress={() => handleToggle(tx.trxId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: tx.selected }}
                  >
                    <Ionicons
                      name={tx.selected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={tx.selected ? '#0FB384' : colors.textMuted}
                    />
                  </TouchableOpacity>

                  {/* Body */}
                  <View style={styles.cardBody}>
                    <View style={styles.topRow}>
                      <Text style={[styles.counterparty, { color: colors.text }]} numberOfLines={1}>
                        {tx.counterparty}
                      </Text>
                      <Text
                        style={[
                          styles.amount,
                          isIncome ? styles.amountIncome : styles.amountExpense,
                        ]}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                      </Text>
                    </View>

                    <View style={styles.bottomRow}>
                      <Text style={[styles.trxPill, isDark && { backgroundColor: '#14382A', color: '#A7F3D0' }]}>
                        TrxID: {tx.trxId}
                      </Text>
                      {tx.reference && (
                        <Text style={[styles.refPill, isDark && { backgroundColor: '#2E1D52', color: '#DDD6FE' }]}>
                          Ref: {tx.reference}
                        </Text>
                      )}
                      <Text style={[styles.dateText, { color: colors.textSecondary }]}>{tx.date}</Text>

                      {/* Category tag */}
                      <TouchableOpacity
                        style={[styles.catBadge, isDark && { backgroundColor: '#14382A' }]}
                        onPress={() => setCategoryPickerTrxId(tx.trxId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Change category ${tx.category}`}
                      >
                        <Text style={[styles.catText, isDark && { color: '#A7F3D0' }]}>
                          {translateCategory(tx.category)}
                        </Text>
                        <Feather name="chevron-down" size={12} color={isDark ? '#A7F3D0' : '#059669'} />
                      </TouchableOpacity>

                      {/* Remove */}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleRemove(tx.trxId)}
                        accessibilityRole="button"
                        accessibilityLabel="Ignore transaction"
                      >
                        <Feather name="trash-2" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <TouchableOpacity
              style={[
                styles.importBtn,
                (selectedItems.length === 0 || importing) && [styles.btnDisabled, isDark && { backgroundColor: colors.surfaceSubtle }],
              ]}
              onPress={handleImportSelected}
              disabled={selectedItems.length === 0 || importing}
              accessibilityRole="button"
              accessibilityLabel="Confirm and add selected transactions"
            >
              <Feather name="check-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.importBtnText}>
                {importing
                  ? (isBangla ? 'সংরক্ষণ করা হচ্ছে...' : 'Saving...')
                  : (isBangla
                    ? `নিশ্চিত করুন এবং যুক্ত করুন (${selectedItems.length})`
                    : `Confirm & Add Selected (${selectedItems.length})`)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category Picker Sub-Modal */}
          {categoryPickerTrxId && (
            <Modal
              visible={!!categoryPickerTrxId}
              transparent
              animationType="fade"
              onRequestClose={() => setCategoryPickerTrxId(null)}
            >
              <View style={styles.pickerOverlay}>
                <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                  <View style={styles.pickerHeader}>
                    <Text style={[styles.pickerTitle, { color: colors.text }]}>
                      {isBangla ? 'খাত নির্বাচন করুন' : 'Select Category'}
                    </Text>
                    <TouchableOpacity onPress={() => setCategoryPickerTrxId(null)}>
                      <Feather name="x" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={{ maxHeight: 300 }}>
                    {categoryOptions.map((cat) => (
                      <TouchableOpacity
                        key={cat.label}
                        style={[styles.categoryOption, { borderBottomColor: colors.cardBorder }]}
                        onPress={() => handleChangeCategory(categoryPickerTrxId, cat.label)}
                      >
                        <Text style={{ fontSize: 20, marginRight: 10 }}>{cat.emoji}</Text>
                        <Text style={[styles.categoryOptionText, { color: colors.text }]}>
                          {translateCategory(cat.label)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    height: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2136E',
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
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0FB384',
  },
  bulkNote: {
    fontSize: 11,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  cardUnselected: {
    opacity: 0.5,
    backgroundColor: '#F9FAFB',
  },
  checkboxTouch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardBody: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  counterparty: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  amountExpense: {
    color: '#BE185D',
  },
  amountIncome: {
    color: '#059669',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  trxPill: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  refPill: {
    fontSize: 11,
    color: '#4338CA',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F7F1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  catText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  deleteBtn: {
    marginLeft: 'auto',
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  importBtn: {
    minHeight: 52,
    backgroundColor: '#0FB384',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
});
