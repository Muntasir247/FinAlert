import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useBudgets } from '../context/BudgetsContext';
import { useSavingsGoals } from '../context/SavingsGoalsContext';
import { useTransactions } from '../context/TransactionsContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useMfsTracking } from '../context/MfsTrackingContext';
import {
  getSpendingAnalytics,
  type SpendingAnalyticsSummary,
} from '../services/spendingAnalyticsService';
import {
  sendFinancialChatMessage,
  getQuickPromptSuggestions,
  type ChatMessage,
} from '../services/aiChatService';
import type { FinancialInsight } from '../services/aiInsightService';

interface FinancialInsightModalProps {
  visible: boolean;
  insight: FinancialInsight | null;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}

export default function FinancialInsightModal({
  visible,
  insight,
  onClose,
  onRefresh,
  isRefreshing = false,
}: FinancialInsightModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { categoryBudgets } = useBudgets();
  const { goals } = useSavingsGoals();
  const { transactions } = useTransactions();
  const { colors, isDark } = useTheme();
  const { isBangla, language } = useLanguage();
  const { trackedProviders } = useMfsTracking();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [analytics, setAnalytics] = useState<SpendingAnalyticsSummary | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Load 30-day spending analytics and initialize messages when modal opens
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;

    // Load analytics summary for grounding the AI conversation (0ms using in-memory data)
    getSpendingAnalytics(user?.id, 30, transactions, goals)
      .then((res) => {
        if (isMounted) setAnalytics(res);
      })
      .catch((err) => {
        console.warn('[FinancialInsightModal] Failed to load analytics:', err);
      });

    // Set suggestions (bilingual)
    setSuggestions(getQuickPromptSuggestions(insight, isBangla));

    // Initialize conversation with the pinned insight if empty
    setMessages((prev) => {
      if (prev.length > 0) return prev; // keep active conversation if already chatting

      const initialMessage: ChatMessage = {
        id: 'pinned-insight-0',
        role: 'assistant',
        content: insight
          ? insight.detailed_advice || insight.short_summary
          : isBangla
          ? 'ফিনঅ্যালার্ট এআই অ্যাডভাইজারে স্বাগতম। আপনার খরচ, বাজেট অথবা বিকাশ, নগদ, রকেট ও উপায় এসএমএস ট্র্যাকিং সম্পর্কে যেকোনো প্রশ্ন করুন।'
          : 'Welcome to FinAlert AI Advisor. Ask me about your spending, budgets, or bKash, Nagad, Rocket & Upay SMS tracking.',
        timestamp: insight?.timestamp || Date.now(),
        isInitialInsight: true,
        modelUsed: 'Groq LPU',
      };
      return [initialMessage];
    });

    return () => {
      isMounted = false;
    };
  }, [visible, user?.id, insight, isBangla]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (visible && messages.length > 0) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [messages, isGenerating, visible]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setInternalRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setInternalRefreshing(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputText('');
    setIsGenerating(true);

    try {
      const result = await sendFinancialChatMessage(updatedHistory, {
        analytics,
        budgets: categoryBudgets,
        goals,
        recentTransactions: transactions.slice(0, 5),
        allTransactions: transactions,
        insight,
        trackedProviders,
        language,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        timestamp: Date.now(),
        modelUsed: result.provider === 'groq' ? `Groq (${result.model})` : result.provider === 'gemini' ? `Gemini (${result.model})` : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('[FinancialInsightModal] Chat generation error:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble analyzing your request right now. Please try again in a moment.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    const initialMessage: ChatMessage = {
      id: `pinned-insight-${Date.now()}`,
      role: 'assistant',
      content: insight
        ? insight.detailed_advice || insight.short_summary
        : 'Welcome to FinAlert AI Advisor. Ask me anything about your spending or budgets.',
      timestamp: Date.now(),
      isInitialInsight: true,
      modelUsed: 'Groq LPU',
    };
    setMessages([initialMessage]);
  };

  const isWarning = insight?.severity === 'warning';
  const isPositive = insight?.severity === 'positive';
  const themeColor = isWarning ? '#D97706' : isPositive ? '#0FB384' : '#7C3AED';
  const themeBg = isWarning
    ? (isDark ? '#33230A' : '#FEF3C7')
    : isPositive
    ? (isDark ? '#0B291E' : '#E6FBF5')
    : (isDark ? '#1E1236' : '#F5F3FF');
  const themeBorder = isWarning
    ? (isDark ? '#5C3E14' : '#FDE68A')
    : isPositive
    ? (isDark ? '#164E3A' : '#A7F3D0')
    : (isDark ? '#3B2366' : '#DDD6FE');

  const refreshing = isRefreshing || internalRefreshing;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View
            style={[
              styles.sheetContainer,
              { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {/* Header */}
            <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.badgeRow}>
                <View style={[styles.iconBox, { backgroundColor: themeBg, borderColor: themeBorder }]}>
                  <Ionicons name="sparkles" size={20} color={themeColor} />
                </View>
                <View style={styles.headerTextWrapper}>
                  <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                    {isBangla ? 'ফিনঅ্যালার্ট এআই সহকারী' : 'FinAlert AI Assistant'}
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {isBangla ? 'ব্যক্তিগত খরচের তথ্য এবং তাত্ক্ষণিক পরামর্শ' : 'Personalized spending insights & instant advice'}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                {messages.length > 2 && (
                  <TouchableOpacity
                    style={styles.headerIconButton}
                    onPress={handleClearChat}
                    accessibilityRole="button"
                    accessibilityLabel="Reset chat"
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}

                {onRefresh && (
                  <TouchableOpacity
                    style={styles.headerIconButton}
                    onPress={handleRefresh}
                    disabled={refreshing}
                    accessibilityRole="button"
                    accessibilityLabel="Refresh financial insight"
                  >
                    {refreshing ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <Ionicons name="refresh" size={20} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close financial chat"
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Chat Messages Stream */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((item) => {
                const isUser = item.role === 'user';

                if (item.isInitialInsight && insight) {
                  // Render the pinned opening insight card
                  return (
                    <View key={item.id} style={styles.pinnedInsightWrapper}>
                      <View
                        style={[
                          styles.pinnedInsightCard,
                          { backgroundColor: themeBg, borderColor: themeBorder },
                        ]}
                      >
                        <View style={styles.pinnedBadgeRow}>
                          <Ionicons
                            name={
                              isWarning
                                ? 'alert-circle'
                                : isPositive
                                ? 'trending-up'
                                : 'sparkles'
                            }
                            size={16}
                            color={themeColor}
                          />
                          <Text style={[styles.pinnedBadgeText, { color: themeColor }]}>
                            {isWarning
                              ? (isBangla ? 'মনোযোগ প্রয়োজন' : 'ATTENTION NEEDED')
                              : isPositive
                              ? (isBangla ? 'ইতিবাচক আর্থিক ধারা' : 'HEALTHY PATTERN')
                              : (isBangla ? 'এআই আর্থিক বিশ্লেষণ' : 'AI FINANCIAL INSIGHT')}
                          </Text>
                        </View>

                        <Text style={[styles.headlineText, { color: themeColor }]}>
                          {insight.headline}
                        </Text>
                        <Text style={[styles.summaryText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                          {insight.short_summary}
                        </Text>

                        {insight.detailed_advice ? (
                          <View style={[styles.adviceBox, isDark && { backgroundColor: 'rgba(0, 0, 0, 0.35)' }]}>
                            <Text style={[styles.adviceText, isDark && { color: '#E2E8F0' }]}>
                              {insight.detailed_advice}
                            </Text>
                          </View>
                        ) : null}

                        {insight.actionable_tips && insight.actionable_tips.length > 0 ? (
                          <View style={styles.tipsContainer}>
                            <Text style={[styles.tipsHeader, { color: colors.text }]}>
                              {isBangla ? 'প্রধান সুপারিশসমূহ:' : 'Key Recommendations:'}
                            </Text>
                            {insight.actionable_tips.map((tip, idx) => (
                              <View key={idx} style={styles.tipRow}>
                                <Ionicons name="checkmark-circle" size={15} color="#0FB384" />
                                <Text style={[styles.tipText, isDark && { color: '#E2E8F0' }]}>{tip}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        <View style={[styles.pinnedPromptHint, { borderTopColor: colors.cardBorder }]}>
                          <Ionicons name="chatbubbles-outline" size={14} color={colors.textSecondary} />
                          <Text style={[styles.pinnedPromptHintText, { color: colors.textSecondary }]}>
                            {isBangla
                              ? 'এ বিষয়ে প্রশ্ন আছে? নিচে লিখুন বা প্রশ্ন সিলেক্ট করুন।'
                              : 'Have questions about this? Ask me below or tap a quick question.'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                }

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.messageRow,
                      isUser ? styles.messageRowUser : styles.messageRowAssistant,
                    ]}
                  >
                    {!isUser && (
                      <View style={[styles.assistantAvatar, isDark && { backgroundColor: '#2E1D52', borderColor: '#4C1D95' }]}>
                        <Ionicons name="sparkles" size={14} color="#A78BFA" />
                      </View>
                    )}

                    <View
                      style={[
                        styles.messageBubble,
                        isUser
                          ? styles.messageBubbleUser
                          : [styles.messageBubbleAssistant, isDark && { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          isUser
                            ? styles.messageTextUser
                            : [styles.messageTextAssistant, { color: colors.text }],
                        ]}
                      >
                        {item.content}
                      </Text>

                      <View style={styles.messageMetaRow}>
                        {item.modelUsed ? (
                          <Text style={styles.modelTag}>{item.modelUsed}</Text>
                        ) : null}
                        <Text
                          style={[
                            styles.messageTime,
                            isUser ? styles.messageTimeUser : styles.messageTimeAssistant,
                          ]}
                        >
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Generating / Typing Indicator */}
              {isGenerating && (
                <View style={[styles.messageRow, styles.messageRowAssistant]}>
                  <View style={[styles.assistantAvatar, isDark && { backgroundColor: '#2E1D52', borderColor: '#4C1D95' }]}>
                    <Ionicons name="sparkles" size={14} color="#A78BFA" />
                  </View>
                  <View
                    style={[
                      styles.messageBubble,
                      styles.messageBubbleAssistant,
                      styles.typingBubble,
                      isDark && { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
                    ]}
                  >
                    <ActivityIndicator size="small" color="#A78BFA" />
                    <Text style={[styles.typingText, isDark && { color: '#C4B5FD' }]}>
                      {isBangla ? 'ফিনঅ্যালার্ট এআই ভাবছে...' : 'FinAlert AI is thinking...'}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick Suggestion Chips Carousel */}
            {suggestions.length > 0 && !isGenerating && (
              <View style={styles.suggestionsWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsContent}
                >
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.suggestionChip, isDark && { backgroundColor: '#1E1236', borderColor: '#3B2366' }]}
                      onPress={() => handleSendMessage(suggestion)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Ask suggestion: ${suggestion}`}
                    >
                      <Ionicons name="bulb-outline" size={13} color={isDark ? '#DDD6FE' : '#7C3AED'} />
                      <Text style={[styles.suggestionText, isDark && { color: '#DDD6FE' }]}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Bottom Input Bar */}
            <View style={[styles.inputBarRow, { borderTopColor: colors.cardBorder }]}>
              <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder={isBangla ? 'খরচ বা বাজেট সম্পর্কে যে কোনো কিছু জিজ্ঞাসা করুন...' : 'Ask anything about your expenses...'}
                  placeholderTextColor={colors.textMuted}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                  returnKeyType="default"
                  accessibilityLabel="Chat message input"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isGenerating) && [styles.sendButtonDisabled, isDark && { backgroundColor: colors.surfaceSubtle }],
                ]}
                onPress={() => handleSendMessage()}
                disabled={!inputText.trim() || isGenerating}
                accessibilityRole="button"
                accessibilityLabel="Send chat message"
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 30, 21, 0.55)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    height: '90%',
    maxHeight: '94%',
    display: 'flex',
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 12,
  },
  pinnedInsightWrapper: {
    marginBottom: 4,
  },
  pinnedInsightCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  pinnedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pinnedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headlineText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
    fontWeight: '500',
  },
  adviceBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 10,
  },
  adviceText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#475569',
  },
  tipsContainer: {
    marginTop: 10,
    gap: 6,
  },
  tipsHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#334155',
  },
  pinnedPromptHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  pinnedPromptHintText: {
    fontSize: 11.5,
    color: '#64748B',
    fontStyle: 'italic',
    flex: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 2,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageBubbleUser: {
    backgroundColor: '#0FB384',
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  messageTextUser: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  messageTextAssistant: {
    color: '#0F172A',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  modelTag: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  messageTime: {
    fontSize: 10,
  },
  messageTimeUser: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  messageTimeAssistant: {
    color: '#94A3B8',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  typingText: {
    fontSize: 12,
    color: '#7C3AED',
    fontStyle: 'italic',
  },
  suggestionsWrapper: {
    paddingVertical: 8,
  },
  suggestionsContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B21A8',
  },
  inputBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inputContainer: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
    margin: 0,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
});
