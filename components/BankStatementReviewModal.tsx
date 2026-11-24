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
import * as Clipboard from 'expo-clipboard';
import { useTransactions } from '../context/TransactionsContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  parseBankStatementPdf,
  readPdfAsBase64,
  isPdfEncrypted,
  runGeminiStatementDiagnostics,
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
import { isDuplicateTransactionMatch } from '../services/smsReaderService';

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
  const { addTransactions, transactions: existingTransactions } = useTransactions();
  const { colors, isDark } = useTheme();
  const { isBangla, formatCurrency, translateCategory } = useLanguage();

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
  const [debugReport, setDebugReport] = useState<string | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [copiedDebug, setCopiedDebug] = useState(false);

  const handleCopyDebug = async () => {
    if (!debugReport) return;
    try {
      await Clipboard.setStringAsync(debugReport);
      setCopiedDebug(true);
      setTimeout(() => setCopiedDebug(false), 2500);
    } catch {
      Alert.alert('Copy failed', 'Unable to copy text to clipboard.');
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiag(true);
    setCopiedDebug(false);
    try {
      const report = await runGeminiStatementDiagnostics();
      setDebugReport(report.formattedText);
      setShowDebugModal(true);
    } catch (e: unknown) {
      const errTxt = (e as Error)?.message || 'Diagnostics failed to run';
      setDebugReport(`Diagnostics error: ${errTxt}`);
      setShowDebugModal(true);
    } finally {
      setIsRunningDiag(false);
    }
  };

  // PDF Encryption & Password state
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingFile, setIsCheckingFile] = useState(false);

  const handlePickDocument = async () => {
    setErrorMsg(null);
    setDebugReport(null);
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
    setDebugReport(null);
    setStage('parsing');

    try {
      const base64 = await readPdfAsBase64(selectedFile.uri, selectedFile.base64);
      const res = await parseBankStatementPdf(base64, password.trim() || undefined);

      // Deduplication check: cross-reference against user's existing account transactions (MFS & Card SMS)
      const annotatedTransactions: ExtractedStatementTransaction[] = res.transactions.map((tx) => {
        const match = existingTransactions.find((existing) => {
          return isDuplicateTransactionMatch(existing, tx);
        });

        if (match) {
          return {
            ...tx,
            alreadyExists: true,
            existingMatchId: match.id,
            selected: false, // Automatically unselected so user doesn't double-import!
          };
        }

        return {
          ...tx,
          alreadyExists: false,
          selected: true, // New transaction defaults to selected
        };
      });

      setExtractionResult({
        ...res,
        transactions: annotatedTransactions,
      });
      setTransactions(annotatedTransactions);
      setStage('review');
    } catch (err: unknown) {
      setStage('pick');
      if (err instanceof PdfPasswordRequiredError) {
        setIsPasswordProtected(true);
        setErrorMsg(err.message);
        if (err.debugReport) setDebugReport(err.debugReport);
      } else if (err instanceof PdfInvalidPasswordError) {
        setIsPasswordProtected(true);
        setErrorMsg(err.message);
        if (err.debugReport) setDebugReport(err.debugReport);
      } else if (err instanceof PdfStatementError) {
        setErrorMsg(err.message);
        if (err.debugReport) setDebugReport(err.debugReport);
      } else {
        const fallback = (err as Error)?.message || 'Failed to process PDF.';
        setErrorMsg('Failed to process PDF. Please check your network and Gemini API key.');
        setDebugReport(`Error details: ${fallback}`);
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

  // Duplicate detection summary metrics
  const duplicateCount = transactions.filter((t) => t.alreadyExists).length;
  const newCount = transactions.length - duplicateCount;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleModalClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? '#14382A' : '#E8F7F1' }]}>
                <Ionicons name="document-text" size={20} color="#0FB384" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {stage === 'review'
                    ? (isBangla ? 'স্টেটমেন্ট লেনদেন পর্যালোচনা' : 'Review Statement Transactions')
                    : (isBangla ? 'ব্যাংক স্টেটমেন্ট ইমপোর্ট' : 'Bank Statement Import')}
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  {stage === 'review'
                    ? duplicateCount > 0
                      ? (isBangla
                        ? `${selectedCount}টি নির্বাচিত • ${newCount}টি নতুন, ${duplicateCount}টি ইতিমধ্যে যুক্ত`
                        : `${selectedCount} selected • ${newCount} new, ${duplicateCount} already added`)
                      : (isBangla
                        ? `${transactions.length}টির মধ্যে ${selectedCount}টি নির্বাচিত`
                        : `${selectedCount} of ${transactions.length} items selected`)
                    : (isBangla ? 'পিডিএফ স্টেটমেন্ট পার্সিং' : 'PDF statement parsing')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleModalClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close statement parser"
            >
              <Feather name="x" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Stage 1: Document Picker View */}
          {stage === 'pick' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pickContent}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={[
                  styles.uploadArea,
                  {
                    backgroundColor: isDark ? colors.surfaceSubtle : '#F4FBF7',
                    borderColor: isDark ? '#144633' : '#D1FAE5',
                  },
                ]}
              >
                <Ionicons name="cloud-upload-outline" size={48} color="#0FB384" />
                <Text style={[styles.uploadTitle, { color: colors.text }]}>
                  {isBangla ? 'ব্যাংক স্টেটমেন্ট পিডিএফ নির্বাচন করুন' : 'Select Bank Statement PDF'}
                </Text>
                <Text style={[styles.uploadSubtitle, { color: colors.textSecondary }]}>
                  {isBangla
                    ? 'চেকিং, সেভিংস বা ক্রেডিট কার্ডের স্ট্যান্ডার্ড পিডিএফ স্টেটমেন্ট সমর্থন করে।'
                    : 'Supports standard checking, savings, or credit card PDF statements.'}
                </Text>

                <TouchableOpacity
                  style={styles.chooseFileBtn}
                  onPress={handlePickDocument}
                  accessibilityRole="button"
                  accessibilityLabel="Choose PDF File"
                >
                  <Feather name="file" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.chooseFileText}>
                    {selectedFile
                      ? (isBangla ? 'ভিন্ন পিডিএফ নির্বাচন করুন' : 'Choose Different PDF')
                      : (isBangla ? 'ফাইল ব্রাউজ করুন' : 'Browse Files')}
                  </Text>
                </TouchableOpacity>
              </View>

              {isCheckingFile && (
                <View style={[styles.checkingFileCard, { backgroundColor: colors.surfaceSubtle }]}>
                  <ActivityIndicator size="small" color="#0FB384" />
                  <Text style={[styles.checkingFileText, { color: colors.text }]}>
                    {isBangla ? 'পিডিএফ পাসওয়ার্ড যাচাই করা হচ্ছে...' : 'Checking PDF protection status...'}
                  </Text>
                </View>
              )}

              {selectedFile && (
                <View
                  style={[
                    styles.selectedFileCard,
                    {
                      backgroundColor: isDark ? colors.surfaceSubtle : '#F8FAFC',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.fileIcon}>
                    <Ionicons name="document-attach" size={24} color="#BE185D" />
                  </View>
                  <View style={styles.fileDetails}>
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    {selectedFile.size && (
                      <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
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
                <View
                  style={[
                    styles.passwordCard,
                    isDark && { backgroundColor: '#2D2010', borderColor: '#78350F' },
                  ]}
                >
                  <View style={styles.passwordHeader}>
                    <View style={styles.passwordLockCircle}>
                      <Ionicons name="lock-closed" size={16} color="#B45309" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.passwordTitle, isDark && { color: '#FDE68A' }]}>
                        {isBangla ? 'পাসওয়ার্ড সুরক্ষিত স্টেটমেন্ট' : 'Password Protected Statement'}
                      </Text>
                      <Text style={[styles.passwordSubtitle, isDark && { color: '#FCD34D' }]}>
                        {isBangla ? 'লেনদেন আনলক করতে পিডিএফ পাসওয়ার্ড দিন' : 'Enter the PDF password to unlock transactions'}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.passwordInputWrapper,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: isDark ? '#B45309' : '#FCD34D',
                      },
                    ]}
                  >
                    <Ionicons name="key-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.passwordInput, { color: colors.text }]}
                      placeholder={isBangla ? 'পিডিএফ পাসওয়ার্ড দিন (যেমন: দিন/মাস/বছর)' : 'Enter PDF password (e.g. DDMMYYYY)'}
                      placeholderTextColor={colors.textMuted}
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
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.passwordHintRow}>
                    <Ionicons name="information-circle-outline" size={16} color="#92400E" style={{ marginTop: 1 }} />
                    <Text style={[styles.passwordHintText, isDark && { color: '#FDE68A' }]}>
                      {isBangla
                        ? 'সাধারণ পাসওয়ার্ড: জন্ম তারিখ (DDMMYYYY) অথবা জাতীয় পরিচয়পত্র নম্বর (NID)।'
                        : 'Common passwords in Bangladesh: Date of Birth (DDMMYYYY) or your National ID (NID).'}
                    </Text>
                  </View>
                </View>
              )}

              {errorMsg && (
                <View style={styles.errorContainer}>
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  </View>

                  {debugReport && (
                    <View style={styles.debugButtonsRow}>
                      <TouchableOpacity
                        style={styles.debugActionButton}
                        onPress={() => setShowDebugModal(true)}
                        accessibilityRole="button"
                        accessibilityLabel="View diagnostic details"
                      >
                        <Feather name="terminal" size={14} color="#1D4ED8" style={{ marginRight: 6 }} />
                        <Text style={styles.debugActionButtonText}>View Diagnostics</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.debugCopyButton}
                        onPress={handleCopyDebug}
                        accessibilityRole="button"
                        accessibilityLabel="Copy debug log"
                      >
                        <Feather
                          name={copiedDebug ? 'check' : 'copy'}
                          size={14}
                          color="#047857"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.debugCopyButtonText}>
                          {copiedDebug ? 'Copied!' : 'Copy Debug Log'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <View
                style={[
                  styles.noticeBox,
                  isDark && { backgroundColor: 'rgba(5, 150, 105, 0.15)', borderColor: 'rgba(5, 150, 105, 0.3)' },
                ]}
              >
                <Ionicons name="shield-checkmark" size={18} color="#059669" />
                <Text style={[styles.noticeText, isDark && { color: '#A7F3D0' }]}>
                  {isBangla
                    ? 'লেনদেন কখনও স্বয়ংক্রিয়ভাবে সংরক্ষিত হয় না। সংরক্ষণ করার আগে আপনি প্রতিটি লেনদেন পর্যালোচনা ও নিশ্চিত করতে পারবেন।'
                    : 'Transactions are never saved automatically. You will review and confirm each entry before anything is written and saved.'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.extractBtn, !selectedFile && [styles.btnDisabled, isDark && { backgroundColor: colors.surfaceSubtle }]]}
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
                  {isPasswordProtected
                    ? (isBangla ? 'আনলক করুন এবং লেনদেন এক্সট্রাক্ট করুন' : 'Unlock & Extract Transactions')
                    : (isBangla ? 'লেনদেন এক্সট্রাক্ট করুন' : 'Extract Transactions')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Stage 2 & 4: Loading / Parsing / Importing */}
          {(stage === 'parsing' || stage === 'importing') && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0FB384" />
              <Text style={[styles.loadingTitle, { color: colors.text }]}>
                {stage === 'parsing'
                  ? isPasswordProtected
                    ? (isBangla ? 'স্টেটমেন্ট ডিক্রিপ্ট এবং বিশ্লেষণ করা হচ্ছে...' : 'Decrypting & Analyzing Statement...')
                    : (isBangla ? 'স্টেটমেন্ট বিশ্লেষণ করা হচ্ছে...' : 'Analyzing Statement...')
                  : (isBangla ? 'লেনদেন ডাটাবেসে ইমপোর্ট করা হচ্ছে...' : 'Importing Transactions to Database...')}
              </Text>
              <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
                {stage === 'parsing'
                  ? isPasswordProtected
                    ? (isBangla ? 'পাসওয়ার্ড দিয়ে পিডিএফ আনলক করা হচ্ছে এবং লেনদেন বের করা হচ্ছে।' : 'Unlocking PDF with your password and extracting transaction line items.')
                    : (isBangla ? 'তারিখ, বিবরণ, পরিমাণ এবং খরচের খাত বিশ্লেষণ করা হচ্ছে।' : 'Extracting transaction dates, descriptions, amounts, and inferred categories.')
                  : (isBangla ? 'নির্বাচিত রেকর্ডগুলো সেভ করা হচ্ছে।' : 'Writing selected records to Supabase transactions table.')}
              </Text>
            </View>
          )}

          {/* Stage 3: Review Statement Transactions */}
          {stage === 'review' && (
            <View style={styles.reviewContainer}>
              {/* Statement Summary Banner */}
              <View
                style={[
                  styles.statementSummaryBanner,
                  {
                    backgroundColor: isDark ? colors.surfaceSubtle : '#F8FAFC',
                    borderBottomColor: colors.cardBorder,
                  },
                ]}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.statementBankName, { color: colors.text }]}>{extractionResult?.bankName}</Text>
                  {extractionResult?.period && (
                    <Text style={[styles.statementPeriod, { color: colors.textSecondary }]}>
                      {isBangla ? `সময়কাল: ${extractionResult.period}` : `Period: ${extractionResult.period}`}
                    </Text>
                  )}
                </View>
                <View style={styles.summaryTotalsRow}>
                  <Text style={styles.summaryDebits}>
                    -{formatCurrency(extractionResult?.totalDebit || 0)}
                  </Text>
                  <Text style={styles.summaryCredits}>
                    +{formatCurrency(extractionResult?.totalCredit || 0)}
                  </Text>
                </View>
              </View>

              {/* Duplicate Notice Banner */}
              {duplicateCount > 0 && (
                <View
                  style={[
                    styles.duplicateNoticeBanner,
                    isDark && { backgroundColor: '#33230A', borderColor: '#78350F' },
                  ]}
                >
                  <Ionicons name="information-circle" size={16} color="#B45309" style={{ marginTop: 1 }} />
                  <Text style={[styles.duplicateNoticeText, isDark && { color: '#FDE68A' }]}>
                    {isBangla
                      ? `${duplicateCount}টি লেনদেন ইতিমধ্যে আপনার অ্যাকাউন্টে রয়েছে এবং ডুপ্লিকেট এড়াতে আনচেক করা হয়েছে।`
                      : `${duplicateCount} ${duplicateCount === 1 ? 'transaction was' : 'transactions were'} already found in your account and unselected to avoid duplicates.`}
                  </Text>
                </View>
              )}

              {/* Bulk Toggle Bar */}
              <View
                style={[
                  styles.bulkActionBar,
                  {
                    backgroundColor: colors.card,
                    borderBottomColor: colors.cardBorder,
                  },
                ]}
              >
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
                    {selectedCount === transactions.length
                      ? (isBangla ? 'সব অনির্বাচন' : 'Deselect All')
                      : (isBangla ? 'সব নির্বাচন' : 'Select All')}
                  </Text>
                </TouchableOpacity>

                {duplicateCount > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.selectNewOnlyBtn,
                      isDark && { backgroundColor: '#14382A' },
                    ]}
                    onPress={() => {
                      setTransactions((prev) =>
                        prev.map((tx) => ({ ...tx, selected: !tx.alreadyExists }))
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Select only new transactions"
                  >
                    <Text style={styles.selectNewOnlyBtnText}>
                      {isBangla ? `শুধু নতুনগুলো (${newCount})` : `Select New Only (${newCount})`}
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.selectedCountBadge, { color: colors.textSecondary }]}>
                  {isBangla
                    ? `${transactions.length}টির মধ্যে ${selectedCount}টি নির্বাচিত`
                    : `${selectedCount} selected of ${transactions.length}`}
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
                      style={[
                        styles.transactionCard,
                        {
                          backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
                          borderColor: colors.cardBorder,
                        },
                        !tx.selected && (isDark ? { backgroundColor: '#0B2219', opacity: 0.5 } : styles.transactionCardUnchecked),
                      ]}
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
                          color={tx.selected ? '#0FB384' : colors.textMuted}
                        />
                      </TouchableOpacity>

                      {/* Content */}
                      <View style={styles.txMainInfo}>
                        <View style={styles.txTopRow}>
                          <Text style={[styles.txDescription, { color: colors.text }]} numberOfLines={2}>
                            {tx.description}
                          </Text>
                          <Text
                            style={[
                              styles.txAmount,
                              isExpense ? styles.amountExpense : styles.amountIncome,
                            ]}
                          >
                            {isExpense ? '-' : '+'}{formatCurrency(tx.amount)}
                          </Text>
                        </View>

                        <View style={styles.txBottomRow}>
                          <Text style={[styles.txDate, { color: colors.textSecondary }]}>{tx.date}</Text>

                          {/* Editable Category Tag */}
                          <TouchableOpacity
                            style={[
                              styles.categoryBadge,
                              isDark && { backgroundColor: '#14382A' },
                            ]}
                            onPress={() => setCategoryPickerTxId(tx.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Change category from ${tx.category}`}
                          >
                            <Text style={[styles.categoryBadgeText, isDark && { color: '#A7F3D0' }]}>
                              {translateCategory(tx.category)}
                            </Text>
                            <Feather name="chevron-down" size={12} color={isDark ? '#A7F3D0' : '#059669'} />
                          </TouchableOpacity>

                          {/* Already Added / Duplicate Indicator */}
                          {tx.alreadyExists && (
                            <View style={[styles.alreadyAddedBadge, isDark && { backgroundColor: '#33230A' }]}>
                              <Ionicons name="copy-outline" size={12} color="#D97706" />
                              <Text style={[styles.alreadyAddedBadgeText, isDark && { color: '#FDE68A' }]}>
                                {isBangla ? 'ডুপ্লিকেট (কার্ড এসএমএস/পূর্বের লেনদেন)' : 'Duplicate (Tracked from Card SMS)'}
                              </Text>
                            </View>
                          )}

                          {/* Remove Row Option */}
                          <TouchableOpacity
                            style={styles.deleteRowBtn}
                            onPress={() => handleRemoveTransaction(tx.id)}
                            accessibilityRole="button"
                            accessibilityLabel="Remove transaction"
                          >
                            <Feather name="trash-2" size={14} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Bottom Action Footer */}
              <View style={[styles.reviewFooter, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
                <TouchableOpacity
                  style={[styles.importBtn, selectedCount === 0 && [styles.btnDisabled, isDark && { backgroundColor: colors.surfaceSubtle }]]}
                  onPress={handleImportSelected}
                  disabled={selectedCount === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Import selected transactions"
                >
                  <Ionicons name="checkmark-done" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.importBtnText}>
                    {isBangla
                      ? `নির্বাচিত লেনদেন ইমপোর্ট করুন (${selectedCount})`
                      : `Import Selected Transactions (${selectedCount})`}
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
                <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                  <View style={styles.pickerHeader}>
                    <Text style={[styles.pickerTitle, { color: colors.text }]}>
                      {isBangla ? 'খাত নির্বাচন করুন' : 'Choose Category'}
                    </Text>
                    <TouchableOpacity onPress={() => setCategoryPickerTxId(null)}>
                      <Feather name="x" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={{ maxHeight: 320 }}>
                    {categoryOptions.map((cat) => (
                      <TouchableOpacity
                        key={cat.label}
                        style={[styles.categoryOptionRow, { borderBottomColor: colors.cardBorder }]}
                        onPress={() => handleChangeCategory(categoryPickerTxId, cat.label)}
                      >
                        <Text style={{ fontSize: 20, marginRight: 12 }}>{cat.emoji}</Text>
                        <Text style={[styles.categoryOptionLabel, { color: colors.text }]}>
                          {translateCategory(cat.label)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}

          {/* Diagnostics & Debug Details Modal */}
          <Modal
            visible={showDebugModal}
            animationType="fade"
            transparent
            onRequestClose={() => setShowDebugModal(false)}
          >
            <View style={styles.debugOverlay}>
              <View style={[styles.debugModalCard, { backgroundColor: colors.card }]}>
                <View style={styles.debugHeader}>
                  <View style={styles.debugHeaderLeft}>
                    <View style={styles.debugIconBubble}>
                      <Ionicons name="bug" size={18} color="#2563EB" />
                    </View>
                    <View>
                      <Text style={[styles.debugHeaderTitle, { color: colors.text }]}>AI Diagnostic Report</Text>
                      <Text style={[styles.debugHeaderSub, { color: colors.textSecondary }]}>Gemini model responses & logs</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowDebugModal(false)}
                    style={styles.debugCloseBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close diagnostics"
                  >
                    <Feather name="x" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={[styles.debugScrollBox, { backgroundColor: colors.inputBg }]} showsVerticalScrollIndicator={true}>
                  <Text style={[styles.debugCodeText, { color: colors.text }]} selectable>
                    {debugReport || 'No diagnostic output available.'}
                  </Text>
                </ScrollView>

                <View style={styles.debugModalFooter}>
                  <TouchableOpacity
                    style={styles.debugCopyFooterBtn}
                    onPress={handleCopyDebug}
                    accessibilityRole="button"
                    accessibilityLabel="Copy full log"
                  >
                    <Feather
                      name={copiedDebug ? 'check' : 'copy'}
                      size={15}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.debugCopyFooterBtnText}>
                      {copiedDebug ? 'Copied to Clipboard!' : 'Copy Full Report'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.debugRerunFooterBtn}
                    onPress={handleRunDiagnostics}
                    disabled={isRunningDiag}
                    accessibilityRole="button"
                    accessibilityLabel="Re-run diagnostic test"
                  >
                    {isRunningDiag ? (
                      <ActivityIndicator size="small" color="#374151" />
                    ) : (
                      <Ionicons name="refresh" size={16} color="#374151" style={{ marginRight: 4 }} />
                    )}
                    <Text style={styles.debugRerunFooterBtnText}>Re-test</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  debugButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    paddingTop: 8,
  },
  debugActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minHeight: 48,
  },
  debugActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  debugCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minHeight: 48,
  },
  debugCopyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  duplicateNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 20,
    paddingVertical: 9,
    gap: 8,
  },
  duplicateNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#92400E',
    fontWeight: '500',
  },
  selectNewOnlyBtn: {
    backgroundColor: '#E8F7F1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectNewOnlyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0FB384',
  },
  alreadyAddedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  alreadyAddedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  debugOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  debugModalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  debugHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  debugIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  debugHeaderSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  debugCloseBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugScrollBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    marginVertical: 12,
    padding: 12,
    maxHeight: 380,
  },
  debugCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#E2E8F0',
  },
  debugModalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  debugCopyFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0FB384',
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  debugCopyFooterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  debugRerunFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  debugRerunFooterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
});
