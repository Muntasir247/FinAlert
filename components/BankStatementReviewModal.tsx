import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useTransactions } from '../context/TransactionsContext';
import {
  parseBankStatementPdf,
  readPdfAsBase64,
  isPdfEncrypted,
  PdfStatementError,
  PdfPasswordRequiredError,
  PdfInvalidPasswordError,
} from '../services/pdfStatementService';
import type {
  ExtractedStatementTransaction,
  StatementExtractionResult,
} from '../services/pdfStatementService';
import { TRANSACTION_CATEGORIES, INCOME_CATEGORIES } from '../lib/transactionCategories';
import type { NewTransaction } from '../lib/transactions';

interface BankStatementReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

type Stage = 'pick' | 'parsing' | 'review' | 'importing';

export default function BankStatementReviewModal({
  visible,
  onClose,
  onSuccess,
}: BankStatementReviewModalProps) {
  const insets = useSafeAreaInsets();
  const { addTransactions } = useTransactions();

  const [stage, setStage] = useState<Stage>('pick');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    uri: string;
    size?: number;
    base64?: string;
  } | null>(null);

  const [extractionResult, setExtractionResult] = useState<StatementExtractionResult | null>(null);
  const [transactions, setTransactions] = useState<ExtractedStatementTransaction[]>([]);
  const [categoryPickerTxId, setCategoryPickerTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // PDF Encryption & Password state
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingFile, setIsCheckingFile] = useState(false);

  const handlePickDocument = async () => {
    setErrorMsg(null);
    setPassword('');
    setIsPasswordProtected(false);
    setShowPassword(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setSelectedFile({
        name: asset.name,
        uri: asset.uri,
        size: asset.size,
        base64: asset.base64,
      });

      // Proactively check if the selected PDF requires a password
      setIsCheckingFile(true);
      try {
        const base64 = await readPdfAsBase64(asset.uri, asset.base64);
        const encrypted = await isPdfEncrypted(base64);
        setIsPasswordProtected(encrypted);
      } catch (checkErr) {
        console.warn('[BankStatementReviewModal] Encryption check notice:', checkErr);
      } finally {
        setIsCheckingFile(false);
      }
    } catch (err) {
      console.error('[BankStatementReviewModal] Error picking document:', err);
      setErrorMsg('Could not open document picker. Please try again.');
    }
  };

  const handleStartExtraction = async () => {
    if (!selectedFile) return;

    if (isPasswordProtected && !password.trim()) {
      setErrorMsg('Please enter the password for this encrypted bank statement.');
      return;
    }

    setErrorMsg(null);
    setStage('parsing');

    try {
      const base64 = await readPdfAsBase64(selectedFile.uri, selectedFile.base64);
      const res = await parseBankStatementPdf(base64, password.trim() || undefined);
      setExtractionResult(res);
      setTransactions(res.transactions);
      setStage('review');
    } catch (err: unknown) {
      setStage('pick');
      if (err instanceof PdfPasswordRequiredError) {
        setIsPasswordProtected(true);
        setErrorMsg(err.message);
      } else if (err instanceof PdfInvalidPasswordError) {
        setIsPasswordProtected(true);
        setErrorMsg(err.message);
      } else if (err instanceof PdfStatementError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to process PDF. Please check your network and Gemini API key.');
      }
    }
  };

  const handleToggleSelect = (id: string) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, selected: !tx.selected } : tx))
    );
  };

  const handleSelectAll = (selectAll: boolean) => {
    setTransactions((prev) => prev.map((tx) => ({ ...tx, selected: selectAll })));
  };

  const handleChangeCategory = (id: string, newCategory: string) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, category: newCategory } : tx))
    );
    setCategoryPickerTxId(null);
  };

  const handleRemoveTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  const selectedCount = transactions.filter((t) => t.selected).length;

  const handleImportSelected = async () => {
    const chosen = transactions.filter((t) => t.selected);
    if (chosen.length === 0) {
      Alert.alert('No Transactions Selected', 'Please select at least one transaction to import.');
      return;
    }

    setStage('importing');
    setErrorMsg(null);

    const payload: NewTransaction[] = chosen.map((tx) => ({
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      date: tx.date,
    }));

    const { error, data } = await addTransactions(payload);

    if (error) {
      setStage('review');
      setErrorMsg(error.message || 'Failed to save transactions to database.');
      return;
    }

    const insertedCount = data ? data.length : chosen.length;
    Alert.alert(
      'Import Successful! 🎉',
      `Successfully added ${insertedCount} transactions from ${extractionResult?.bankName || 'bank statement'}.`,
      [
        {
          text: 'Done',
          onPress: () => {
            handleReset();
            onSuccess?.(insertedCount);
            onClose();
          },
        },
      ]
    );
  };

    const handleReset = () => {
    setStage('pick');
    setSelectedFile(null);
    setExtractionResult(null);
    setTransactions([]);
    setCategoryPickerTxId(null);
    setErrorMsg(null);
    setPassword('');
    setIsPasswordProtected(false);
    setShowPassword(false);
    setIsCheckingFile(false);
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  // Currently opened item for category change
  const activeTxForCategory = transactions.find((t) => t.id === categoryPickerTxId);
  const categoryOptions =
    activeTxForCategory?.type === 'income' ? INCOME_CATEGORIES : TRANSACTION_CATEGORIES;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleModalClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBox}>
                <Ionicons name="document-text" size={20} color="#0FB384" />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {stage === 'review'
                    ? 'Review Statement Transactions'
                    : 'Bank Statement Import'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {stage === 'review'
                    ? `${selectedCount} of ${transactions.length} items selected`
                    : 'PDF statement parsing'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleModalClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close statement parser"
            >
              <Feather name="x" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Stage 1: Document Picker View */}
          {stage === 'pick' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pickContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.uploadArea}>
                <Ionicons name="cloud-upload-outline" size={48} color="#0FB384" />
                <Text style={styles.uploadTitle}>Select Bank Statement PDF</Text>
                <Text style={styles.uploadSubtitle}>
                  Supports standard checking, savings, or credit card PDF statements.
                </Text>

                <TouchableOpacity
                  style={styles.chooseFileBtn}
                  onPress={handlePickDocument}
                  accessibilityRole="button"
                  accessibilityLabel="Choose PDF File"
                >
                  <Feather name="file" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.chooseFileText}>
                    {selectedFile ? 'Choose Different PDF' : 'Browse Files'}
                  </Text>
                </TouchableOpacity>
              </View>

              {isCheckingFile && (
                <View style={styles.checkingFileCard}>
                  <ActivityIndicator size="small" color="#0FB384" />
                  <Text style={styles.checkingFileText}>Checking PDF protection status...</Text>
                </View>
              )}

              {selectedFile && (
                <View style={styles.selectedFileCard}>
                  <View style={styles.fileIcon}>
                    <Ionicons name="document-attach" size={24} color="#BE185D" />
                  </View>
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    {selectedFile.size && (
                      <Text style={styles.fileSize}>
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={isPasswordProtected ? 'lock-closed' : 'checkmark-circle'}
                    size={22}
                    color={isPasswordProtected ? '#D97706' : '#0FB384'}
                  />
                </View>
              )}

              {/* Password Protection Input Card */}
              {selectedFile && isPasswordProtected && (
                <View style={styles.passwordCard}>
                  <View style={styles.passwordHeader}>
                    <View style={styles.passwordLockCircle}>
                      <Ionicons name="lock-closed" size={16} color="#B45309" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.passwordTitle}>Password Protected Statement</Text>
                      <Text style={styles.passwordSubtitle}>
                        Enter the PDF password to unlock transactions
                      </Text>
                    </View>
                  </View>

                  <View style={styles.passwordInputWrapper}>
                    <Ionicons name="key-outline" size={18} color="#6B7280" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter PDF password (e.g. DDMMYYYY)"
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.passwordHintRow}>
                    <Ionicons name="information-circle-outline" size={16} color="#92400E" style={{ marginTop: 1 }} />
                    <Text style={styles.passwordHintText}>
                      Common passwords in Bangladesh: Date of Birth (DDMMYYYY) or your National ID (NID).
                    </Text>
                  </View>
                </View>
              )}

              {errorMsg && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              <View style={styles.noticeBox}>
                <Ionicons name="shield-checkmark" size={18} color="#059669" />
                <Text style={styles.noticeText}>
                  Transactions are never saved automatically. You will review and confirm each entry before anything is written and saved.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.extractBtn, !selectedFile && styles.btnDisabled]}
                onPress={handleStartExtraction}
                disabled={!selectedFile}
                accessibilityRole="button"
                accessibilityLabel="Extract transactions"
              >
                <Ionicons
                  name={isPasswordProtected ? 'lock-open-outline' : 'sparkles'}
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.extractBtnText}>
                  {isPasswordProtected ? 'Unlock & Extract Transactions' : 'Extract Transactions'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Stage 2 & 4: Loading / Parsing / Importing */}
          {(stage === 'parsing' || stage === 'importing') && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0FB384" />
              <Text style={styles.loadingTitle}>
                {stage === 'parsing'
                  ? isPasswordProtected
                    ? 'Decrypting & Analyzing Statement...'
                    : 'Analyzing Statement...'
                  : 'Importing Transactions to Database...'}
              </Text>
              <Text style={styles.loadingSubtitle}>
                {stage === 'parsing'
                  ? isPasswordProtected
                    ? 'Unlocking PDF with your password and extracting transaction line items.'
                    : 'Extracting transaction dates, descriptions, amounts, and inferred categories.'
                  : 'Writing selected records to Supabase transactions table.'}
              </Text>
            </View>
          )}

          {/* Stage 3: Review Statement Transactions */}
          {stage === 'review' && (
            <View style={styles.reviewContainer}>
              {/* Statement Summary Banner */}
              <View style={styles.statementSummaryBanner}>
                <View>
                  <Text style={styles.statementBankName}>{extractionResult?.bankName}</Text>
                  {extractionResult?.period && (
                    <Text style={styles.statementPeriod}>Period: {extractionResult.period}</Text>
                  )}
                </View>
                <View style={styles.summaryTotalsRow}>
                  <Text style={styles.summaryDebits}>
                    -৳{extractionResult?.totalDebit.toLocaleString()}
                  </Text>
                  <Text style={styles.summaryCredits}>
                    +৳{extractionResult?.totalCredit.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Bulk Toggle Bar */}
              <View style={styles.bulkActionBar}>
                <TouchableOpacity
                  style={styles.toggleTextBtn}
                  onPress={() => handleSelectAll(selectedCount !== transactions.length)}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle select all transactions"
                >
                  <Ionicons
                    name={
                      selectedCount === transactions.length
                        ? 'checkbox'
                        : selectedCount > 0
                        ? 'remove-circle-outline'
                        : 'square-outline'
                    }
                    size={20}
                    color="#0FB384"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.toggleText}>
                    {selectedCount === transactions.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.selectedCountBadge}>
                  {selectedCount} selected of {transactions.length}
                </Text>
              </View>

              {errorMsg && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              {/* Transaction List */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              >
                {transactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  return (
                    <View
                      key={tx.id}
                      style={[styles.transactionCard, !tx.selected && styles.transactionCardUnchecked]}
                    >
                      {/* Checkbox */}
                      <TouchableOpacity
                        style={styles.checkboxTouch}
                        onPress={() => handleToggleSelect(tx.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: tx.selected }}
                        accessibilityLabel={`Toggle ${tx.description}`}
                      >
                        <Ionicons
                          name={tx.selected ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={tx.selected ? '#0FB384' : '#9CA3AF'}
                        />
                      </TouchableOpacity>

                      {/* Content */}
                      <View style={styles.txMainInfo}>
                        <View style={styles.txTopRow}>
                          <Text style={styles.txDescription} numberOfLines={2}>
                            {tx.description}
                          </Text>
                          <Text
                            style={[
                              styles.txAmount,
                              isExpense ? styles.amountExpense : styles.amountIncome,
                            ]}
                          >
                            {isExpense ? '-' : '+'}৳{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>

                        <View style={styles.txBottomRow}>
                          <Text style={styles.txDate}>{tx.date}</Text>

                          {/* Editable Category Tag */}
                          <TouchableOpacity
                            style={styles.categoryBadge}
                            onPress={() => setCategoryPickerTxId(tx.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Change category from ${tx.category}`}
                          >
                            <Text style={styles.categoryBadgeText}>{tx.category}</Text>
                            <Feather name="chevron-down" size={12} color="#059669" />
                          </TouchableOpacity>

                          {/* Remove Row Option */}
                          <TouchableOpacity
                            style={styles.deleteRowBtn}
                            onPress={() => handleRemoveTransaction(tx.id)}
                            accessibilityRole="button"
                            accessibilityLabel="Remove transaction"
                          >
                            <Feather name="trash-2" size={14} color="#9CA3AF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Bottom Action Footer */}
              <View style={styles.reviewFooter}>
                <TouchableOpacity
                  style={[styles.importBtn, selectedCount === 0 && styles.btnDisabled]}
                  onPress={handleImportSelected}
                  disabled={selectedCount === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Import selected transactions"
                >
                  <Ionicons name="checkmark-done" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.importBtnText}>
                    Import Selected Transactions ({selectedCount})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Category Picker Sub-Modal */}
          {categoryPickerTxId && (
            <Modal
              visible={!!categoryPickerTxId}
              transparent
              animationType="fade"
              onRequestClose={() => setCategoryPickerTxId(null)}
            >
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerCard}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Choose Category</Text>
                    <TouchableOpacity onPress={() => setCategoryPickerTxId(null)}>
                      <Feather name="x" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={{ maxHeight: 320 }}>
                    {categoryOptions.map((cat) => (
                      <TouchableOpacity
                        key={cat.label}
                        style={styles.categoryOptionRow}
                        onPress={() => handleChangeCategory(categoryPickerTxId, cat.label)}
                      >
                        <Text style={{ fontSize: 20, marginRight: 12 }}>{cat.emoji}</Text>
                        <Text style={styles.categoryOptionLabel}>{cat.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '94%',
    height: '92%',
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
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E8F7F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickContent: {
    padding: 20,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#D1FAE5',
    borderStyle: 'dashed',
    borderRadius: 18,
    backgroundColor: '#F4FBF7',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
    marginTop: 12,
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  chooseFileBtn: {
    minHeight: 48,
    backgroundColor: '#0FB384',
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseFileText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 13,
  },
  extractBtn: {
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
  extractBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091E15',
    marginTop: 18,
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  reviewContainer: {
    flex: 1,
  },
  statementSummaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statementBankName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
  },
  statementPeriod: {
    fontSize: 11,
    color: '#6B7280',
  },
  summaryTotalsRow: {
    alignItems: 'flex-end',
  },
  summaryDebits: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  summaryCredits: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  bulkActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  toggleTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0FB384',
  },
  selectedCountBadge: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  transactionCardUnchecked: {
    opacity: 0.5,
    backgroundColor: '#F9FAFB',
  },
  checkboxTouch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  txMainInfo: {
    flex: 1,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  txDescription: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  amountExpense: {
    color: '#DC2626',
  },
  amountIncome: {
    color: '#059669',
  },
  txBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F7F1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  deleteRowBtn: {
    marginLeft: 'auto',
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  importBtn: {
    minHeight: 52,
    backgroundColor: '#0FB384',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  checkingFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
  },
  checkingFileText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  passwordCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passwordLockCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  passwordSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 1,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#091E15',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  passwordHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  passwordHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#92400E',
    fontWeight: '500',
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
  categoryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryOptionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
});
