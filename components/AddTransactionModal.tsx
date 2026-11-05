import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTransactions } from '../context/TransactionsContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { TRANSACTION_CATEGORIES, INCOME_CATEGORIES } from '../lib/transactionCategories';
import type { Transaction, TransactionType } from '../lib/transactions';
import { markTrxIdProcessed, removePendingTransaction } from '../services/smsReaderService';

const SHEET_MAX_HEIGHT = 620;

export interface AddTransactionPrefill {
  type?: TransactionType;
  amount?: number;
  category?: string;
  description?: string;
  date?: string | Date;
  source?: 'bkash' | 'statement' | 'voice' | 'receipt' | string;
  trxId?: string;
}

export default function AddTransactionModal({
  visible,
  onClose,
  editing = null,
  prefill,
}: {
  visible: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  prefill?: AddTransactionPrefill | null;
}) {
  const insets = useSafeAreaInsets();
  const { addTransaction, updateTransaction } = useTransactions();
  const { colors, isDark } = useTheme();
  const { t, isBangla, translateCategory } = useLanguage();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const translateY = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (editing) {
        const [y, m, d] = editing.date.split('-').map(Number);
        setType(editing.type);
        setAmount(String(editing.amount));
        setCategory(editing.category);
        setDescription(editing.description ?? '');
        setDate(new Date(y, m - 1, d));
      } else if (prefill) {
        setType(prefill.type ?? 'expense');
        setAmount(prefill.amount != null ? String(prefill.amount) : '');
        setCategory(prefill.category ?? null);
        setDescription(prefill.description ?? '');
        if (prefill.date) {
          if (typeof prefill.date === 'string') {
            const parts = prefill.date.split('-').map(Number);
            if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
              setDate(new Date(parts[0], parts[1] - 1, parts[2]));
            } else {
              setDate(new Date());
            }
          } else {
            setDate(prefill.date);
          }
        } else {
          setDate(new Date());
        }
      } else {
        setType('expense');
        setAmount('');
        setCategory(null);
        setDescription('');
        setDate(new Date());
      }
      setShowPicker(false);
      setSubmitting(false);
      setErrorMsg(null);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SHEET_MAX_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible, editing, prefill]);

  const handleClose = () => {
    if (submitting) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_MAX_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(onClose);
  };

  const numericAmount = Number.parseFloat(amount);
  const isValid = numericAmount > 0 && category !== null;

  const categoryOptions = type === 'expense' ? TRANSACTION_CATEGORIES : INCOME_CATEGORIES;

  const handleTypeChange = (nextType: TransactionType) => {
    if (nextType === type) return;
    setType(nextType);
    setCategory(nextType === 'expense' ? TRANSACTION_CATEGORIES[0].label : INCOME_CATEGORIES[0].label);
  };

  const formatDisplayDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        setDate(selectedDate);
      }
    } else if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;

    const payload = {
      type,
      amount: Math.round(numericAmount * 100) / 100,
      category: category as string,
      description: description.trim() ? description.trim() : null,
      date: isoDate,
    };

    const { error } = editing
      ? await updateTransaction(editing.id, payload)
      : await addTransaction(payload);

    setSubmitting(false);

    if (error) {
      setErrorMsg(error?.message || 'Failed to save transaction. Please try again.');
      return;
    }

    if (prefill?.trxId) {
      await markTrxIdProcessed(prefill.trxId);
      removePendingTransaction(prefill.trxId);
    }

    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss Add Transaction"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {editing
                ? (isBangla ? 'লেনদেন সম্পাদনা' : 'Edit Transaction')
                : (isBangla ? 'নতুন লেনদেন' : 'Add Transaction')}
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: isDark ? colors.surfaceSubtle : '#F3F4F6' }]}
              onPress={handleClose}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Close Add Transaction"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {prefill?.source === 'bkash' && (
              <View style={[styles.bkashNoticeBox, isDark && { backgroundColor: '#3B1828', borderColor: '#BE185D' }]}>
                <View style={styles.bkashNoticeIcon}>
                  <Ionicons name="phone-portrait-outline" size={16} color="#E2136E" />
                </View>
                <View style={styles.bkashNoticeContent}>
                  <Text style={styles.bkashNoticeTitle}>
                    {isBangla ? 'বিকাশ লেনদেন শনাক্ত হয়েছে' : 'bKash Transaction Detected'}
                  </Text>
                  <Text style={[styles.bkashNoticeDesc, isDark && { color: '#FBCFE8' }]}>
                    {isBangla ? 'এসএমএস থেকে পূরণ করা হয়েছে। নিশ্চিত করার আগে বিবরণ পর্যালোচনা করুন।' : 'Pre-filled from SMS. Please review details before confirming.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Type toggle */}
            <View style={[styles.typeToggle, { backgroundColor: colors.surfaceSubtle }]}>
              {(['expense', 'income'] as const).map((t) => {
                const isActive = type === t;
                const typeLabel = t === 'expense' ? (isBangla ? 'ব্যয়' : 'Expense') : (isBangla ? 'আয়' : 'Income');
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeChip,
                      isActive
                        ? t === 'expense'
                          ? [styles.typeChipExpenseActive, isDark && { backgroundColor: 'rgba(239, 68, 68, 0.25)' }]
                          : [styles.typeChipIncomeActive, isDark && { backgroundColor: 'rgba(15, 179, 132, 0.25)' }]
                        : [styles.typeChipInactive, { backgroundColor: colors.surfaceSubtle }],
                    ]}
                    onPress={() => handleTypeChange(t)}
                    disabled={submitting}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={typeLabel}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        isActive
                          ? [styles.typeChipTextActive, { color: isDark ? (t === 'expense' ? '#FCA5A5' : '#6EE7B7') : '#091E15' }]
                          : [styles.typeChipTextInactive, { color: colors.textSecondary }],
                      ]}
                    >
                      {typeLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {isBangla ? 'পরিমাণ' : 'Amount'}
              </Text>
              <View style={[styles.amountInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <Text style={[styles.currencyPrefix, { color: colors.text }]}>৳</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  editable={!submitting}
                  accessibilityLabel="Transaction amount"
                />
              </View>
            </View>

            {/* Category grid */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {isBangla ? 'খাত' : 'Category'}
              </Text>
              <View style={styles.categoryGrid}>
                {categoryOptions.map((cat) => {
                  const isSelected = category === cat.label;
                  return (
                    <TouchableOpacity
                      key={cat.label}
                      style={[
                        styles.categoryTile,
                        { backgroundColor: isDark ? '#14382A' : cat.bg },
                        isSelected && styles.categoryTileSelected,
                      ]}
                      onPress={() => setCategory(cat.label)}
                      disabled={submitting}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Category ${cat.label}`}
                    >
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[styles.categoryLabel, { color: isDark ? '#A7F3D0' : cat.fg }]}
                        numberOfLines={2}
                      >
                        {translateCategory(cat.label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {isBangla ? 'বিবরণ (ঐচ্ছিক)' : 'Description (Optional)'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder={isBangla ? 'এটি কী উদ্দেশ্যে ছিল?' : 'What was this for?'}
                placeholderTextColor={colors.textMuted}
                editable={!submitting}
                accessibilityLabel="Transaction description"
              />
            </View>

            {/* Date */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {isBangla ? 'তারিখ' : 'Date'}
              </Text>
              <TouchableOpacity
                style={[styles.dateInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                onPress={() => setShowPicker(true)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Select transaction date"
              >
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.dateText, { color: colors.text }]}>{formatDisplayDate(date)}</Text>
                <Feather name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              {showPicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                />
              )}
            </View>

            {/* Error */}
            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                !isValid && [styles.submitButtonDisabled, isDark && { backgroundColor: colors.surfaceSubtle }],
              ]}
              onPress={handleSubmit}
              disabled={!isValid || submitting}
              accessibilityRole="button"
              accessibilityLabel={
                editing
                  ? 'Save Changes'
                  : prefill?.source === 'bkash'
                  ? 'Confirm & Add Transaction'
                  : 'Add Transaction'
              }
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.submitButtonText,
                    !isValid && styles.submitButtonTextDisabled,
                  ]}
                >
                  {editing
                    ? (isBangla ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes')
                    : prefill?.source === 'bkash'
                    ? (isBangla ? 'নিশ্চিত করুন ও লেনদেন যোগ করুন' : 'Confirm & Add Transaction')
                    : (isBangla ? 'লেনদেন যোগ করুন' : 'Add Transaction')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  scrollContent: {
    paddingBottom: 8,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  typeChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipExpenseActive: {
    backgroundColor: '#FEE2E2',
  },
  typeChipIncomeActive: {
    backgroundColor: '#E8F7F1',
  },
  typeChipInactive: {
    backgroundColor: 'transparent',
  },
  typeChipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: '#091E15',
  },
  typeChipTextInactive: {
    color: '#6B7280',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 8,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 52,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryTile: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryTileSelected: {
    borderColor: '#0FB384',
    borderWidth: 2,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 52,
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
  },
  dateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    height: 52,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#DC2626',
  },
  submitButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  submitButtonTextDisabled: {
    color: '#9CA3AF',
  },
  bkashNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  bkashNoticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bkashNoticeContent: {
    flex: 1,
  },
  bkashNoticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#BE185D',
    marginBottom: 2,
  },
  bkashNoticeDesc: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '400',
    color: '#9D174D',
  },
});
