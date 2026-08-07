import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotifications } from '../context/NotificationsContext';
import { useBudgets } from '../context/BudgetsContext';
import type {
  AppNotification,
  NotificationAccent,
  NotificationActionType,
  NotificationCategory,
} from '../lib/notifications';

// ── Category metadata ─────────────────────────────────────────────────────

const FILTERS = ['All', 'Budget', 'Bills', 'Savings', 'Family'] as const;
type Filter = (typeof FILTERS)[number];

const CATEGORY_META: Record<NotificationCategory, { emoji: string }> = {
  budget: { emoji: '📊' },
  bills: { emoji: '💸' },
  savings: { emoji: '🎯' },
  family: { emoji: '👨‍👩‍👧‍👦' },
};

const ACCENT_META: Record<NotificationAccent, { line: string; bg: string; text: string }> = {
  red: { line: '#EF4444', bg: '#FEF2F2', text: '#DC2626' },
  orange: { line: '#F59E0B', bg: '#FFFBEB', text: '#D97706' },
  green: { line: '#0FB384', bg: '#D1FAE5', text: '#0FB384' },
  blue: { line: '#3B82F6', bg: '#DBEAFE', text: '#3B82F6' },
};

const ACTION_LABELS: Record<NotificationActionType, string> = {
  review_spending: 'Review spending ↗',
  review_budget: 'Review budget ↗',
  view_goal: 'View goal ↗',
  view_family: 'View family ↗',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Notification Card ─────────────────────────────────────────────────────

function NotificationCard({
  notif,
  onDismiss,
  onCta,
}: {
  notif: AppNotification;
  onDismiss: (id: string) => void;
  onCta: (notif: AppNotification) => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const accent = ACCENT_META[notif.accent_color];
  const meta = CATEGORY_META[notif.category];
  const progress = notif.progress == null ? null : Math.max(0, Math.min(notif.progress, 1));
  const ctaLabel = ACTION_LABELS[notif.action_type];

  const handleDismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismiss(notif.id));
  };

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={[styles.accentLine, { backgroundColor: accent.line }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={[styles.categoryIcon, { backgroundColor: accent.bg }]}>
            <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
          </View>
          <View style={styles.cardTextStack}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {notif.title}
            </Text>
            <Text style={styles.cardMessage} numberOfLines={2}>
              {notif.message}
            </Text>
          </View>
          {!notif.is_read && <View style={styles.unreadDot} />}
        </View>

        {progress != null && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: accent.text },
              ]}
            />
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.timestamp}>{timeAgo(notif.created_at)}</Text>
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.footerButton}
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
            >
              <Feather name="x-circle" size={14} color="#94A3B8" />
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerButton}
              onPress={() => onCta(notif)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
            >
              <Text style={[styles.ctaText, { color: accent.text }]}>{ctaLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Alerts Screen ─────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { notifications, unreadCount, markAllRead, dismissNotification } = useNotifications();
  const { requestBudgetTab } = useBudgets();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Filter>('All');

  const filtered = useMemo(
    () =>
      activeFilter === 'All'
        ? notifications
        : notifications.filter((n) => n.category === activeFilter.toLowerCase()),
    [notifications, activeFilter]
  );

  const grouped = useMemo(() => {
    const today: AppNotification[] = [];
    const earlier: AppNotification[] = [];
    for (const n of filtered) {
      if (isToday(n.created_at)) today.push(n);
      else earlier.push(n);
    }
    return { today, earlier };
  }, [filtered]);

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    const { error } = await markAllRead();
    if (error) console.error('Failed to mark all as read:', error);
  };

  const handleDismiss = async (id: string) => {
    const { error } = await dismissNotification(id);
    if (error) console.error('Failed to dismiss notification:', error);
  };

  const handleCta = (notif: AppNotification) => {
    switch (notif.action_type) {
      case 'review_budget':
        requestBudgetTab();
        router.navigate('/(tabs)/transactions');
        break;
      case 'review_spending':
        router.navigate('/(tabs)/transactions');
        break;
      case 'view_family':
        router.navigate('/(tabs)/family');
        break;
      case 'view_goal':
        router.navigate('/(tabs)');
        break;
    }
  };

  const renderSection = (label: string, items: AppNotification[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {items.map((n) => (
          <NotificationCard
            key={n.id}
            notif={n}
            onDismiss={handleDismiss}
            onCta={handleCta}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Alerts</Text>
          {unreadCount > 0 && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.markAllBtn}
          onPress={handleMarkAll}
          disabled={unreadCount === 0}
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
        >
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>
            ✓ Mark all
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.navigate('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="settings-outline" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* ── Category Filter Bar ── */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((filter) => {
            const active = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={styles.filterChip}
                onPress={() => setActiveFilter(filter)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${filter}`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {active ? `${filter} •` : filter}
                </Text>
                {active && <View style={styles.filterUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── List ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No alerts</Text>
            <Text style={styles.emptyText}>
              You're all caught up. New alerts will show up here.
            </Text>
          </View>
        ) : (
          <>
            {renderSection('TODAY', grouped.today)}
            {renderSection('EARLIER', grouped.earlier)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  headerBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  newBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  markAllBtn: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '500',
    color: '#0FB384',
  },
  markAllTextDisabled: {
    color: '#A7F3D0',
  },

  // Filter bar
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 20,
  },
  filterChip: {
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
  },
  filterLabelActive: {
    color: '#0FB384',
    fontWeight: '600',
  },
  filterUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 4,
    right: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0FB384',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  accentLine: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 18,
  },
  cardTextStack: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0FB384',
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    minHeight: 28,
  },
  dismissText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#94A3B8',
  },
  ctaText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
    textAlign: 'center',
  },
});
