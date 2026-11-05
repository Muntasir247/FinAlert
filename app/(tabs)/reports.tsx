import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { useTransactions } from '../../context/TransactionsContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import type { Transaction } from '../../lib/transactions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DONUT_COLORS = ['#0FB384', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#64748B'];

const parseDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const niceCeil = (v: number): number => {
  if (v <= 0) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const scaled = v / pow;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * pow;
};

const formatMoney = (n: number) => `৳${Math.round(n).toLocaleString()}`;

const formatTick = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);

interface ChartDatum {
  label: string;
  income: number;
  expense: number;
}

interface CatDatum {
  name: string;
  value: number;
  percentage: number;
  color: string;
  pctValue: number;
}

export default function ReportsScreen() {
  const { transactions, isLoading } = useTransactions();
  const { colors, isDark } = useTheme();
  const { t, isBangla, formatCurrency, translateCategory } = useLanguage();
  const [reportType, setReportType] = useState<'monthly' | 'weekly'>('monthly');

  const report = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    // Current calendar week (Monday → Sunday).
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(currentYear, currentMonth, now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const inPeriod = (tx: Transaction) => {
      if (reportType === 'monthly') return tx.date.startsWith(monthKey);
      const d = parseDate(tx.date);
      return d >= weekStart && d <= weekEnd;
    };

    const periodTxs = transactions.filter(inPeriod);

    // Period totals
    let income = 0;
    let expense = 0;
    for (const tx of periodTxs) {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    const savings = income - expense;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    // Bar chart data
    let chartData: ChartDatum[];
    if (reportType === 'monthly') {
      chartData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let inc = 0;
        let exp = 0;
        for (const tx of transactions) {
          if (!tx.date.startsWith(key)) continue;
          if (tx.type === 'income') inc += tx.amount;
          else exp += tx.amount;
        }
        chartData.push({
          label: d.toLocaleString('en-US', { month: 'short' }),
          income: inc,
          expense: exp,
        });
      }
    } else {
      chartData = [];
      const currentWeek = Math.floor((now.getDate() - 1) / 7) + 1;
      for (let w = 1; w <= currentWeek; w++) {
        const startDay = (w - 1) * 7 + 1;
        const endDay = Math.min(w * 7, now.getDate());
        let inc = 0;
        let exp = 0;
        for (const tx of transactions) {
          if (!tx.date.startsWith(monthKey)) continue;
          const day = parseDate(tx.date).getDate();
          if (day >= startDay && day <= endDay) {
            if (tx.type === 'income') inc += tx.amount;
            else exp += tx.amount;
          }
        }
        chartData.push({ label: `W${w}`, income: inc, expense: exp });
      }
    }

    // Expense by category for the selected period
    const catMap = new Map<string, number>();
    for (const tx of periodTxs) {
      if (tx.type !== 'expense') continue;
      const cat = (tx.category ?? '').trim() || 'Other';
      catMap.set(cat, (catMap.get(cat) ?? 0) + tx.amount);
    }
    let categoryData: CatDatum[] = [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        pctValue: expense > 0 ? value / expense : 0,
        percentage: expense > 0 ? (value / expense) * 100 : 0,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      }));
    if (categoryData.length > 5) {
      const top = categoryData.slice(0, 5);
      const restValue = categoryData.slice(5).reduce((sum, c) => sum + c.value, 0);
      categoryData = [
        ...top,
        {
          name: 'Other',
          value: restValue,
          pctValue: expense > 0 ? restValue / expense : 0,
          percentage: expense > 0 ? (restValue / expense) * 100 : 0,
          color: DONUT_COLORS[5],
        },
      ];
    }

    // Chart scale: round the max up to a "nice" number so axis labels look clean.
    const rawMax = Math.max(...chartData.flatMap((d) => [d.income, d.expense]), 0);
    const niceMax = niceCeil(rawMax);
    const barScale = niceMax > 0 ? niceMax : 1;

    // Insight (handles 0 values)
    const periodLabel = reportType === 'monthly' ? 'month' : 'week';
    let insightText: string;
    if (income === 0 && expense === 0) {
      insightText = `Add transactions this ${periodLabel} to see personalized insights.`;
    } else if (savings < 0) {
      insightText = `You spent ${formatMoney(-savings)} more than you earned this ${periodLabel}. Consider trimming non-essential expenses.`;
    } else if (savingsRate >= 20) {
      insightText = `Great job! You saved ${formatMoney(savings)} (${Math.round(savingsRate)}%) this ${periodLabel}. Keep it up!`;
    } else if (savingsRate > 0) {
      insightText = `You saved ${formatMoney(savings)} (${Math.round(savingsRate)}%) this ${periodLabel}. Aim for a 20% savings rate.`;
    } else {
      insightText = `You saved 0% of your income this ${periodLabel}. Setting a budget can help you save more.`;
    }

    // Pre-compute donut slice offsets.
    const slices = (() => {
      let acc = 0;
      return categoryData.map((item) => {
        const offset = acc;
        acc += item.pctValue;
        return { ...item, offset };
      });
    })();

    return {
      income,
      expense,
      savings,
      savingsRate,
      chartData,
      categoryData,
      slices,
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => formatTick(niceMax * f)),
      barScale,
      insightText,
      periodLabel,
    };
  }, [transactions, reportType]);

  const radius = 70;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const svgSize = 180;
  const center = svgSize / 2;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0FB384" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* --- Header & Timeframe Toggle --- */}
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('reports.title', 'Reports')}</Text>
        <View style={[styles.toggleContainer, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              reportType === 'monthly'
                ? [styles.toggleActiveButton, { backgroundColor: isDark ? '#143D2E' : '#ECFDF5', borderColor: '#0FB384' }]
                : styles.toggleInactiveButton,
            ]}
            onPress={() => setReportType('monthly')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                reportType === 'monthly'
                  ? [styles.toggleActiveText, { color: isDark ? '#A7F3D0' : '#047857' }]
                  : [styles.toggleInactiveText, { color: colors.textSecondary }],
              ]}
            >
              {isBangla ? 'মাসিক রিপোর্ট' : 'Monthly Report'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              reportType === 'weekly'
                ? [styles.toggleActiveButton, { backgroundColor: isDark ? '#143D2E' : '#ECFDF5', borderColor: '#0FB384' }]
                : styles.toggleInactiveButton,
            ]}
            onPress={() => setReportType('weekly')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                reportType === 'weekly'
                  ? [styles.toggleActiveText, { color: isDark ? '#A7F3D0' : '#047857' }]
                  : [styles.toggleInactiveText, { color: colors.textSecondary }],
              ]}
            >
              {isBangla ? 'সাপ্তাহিক রিপোর্ট' : 'Weekly Report'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* --- Summary Metrics 2x2 Grid --- */}
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            {/* Total Income */}
            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                {isBangla ? 'মোট আয়' : 'Total Income'}
              </Text>
              <Text style={[styles.metricValue, styles.incomeText]}>
                {formatCurrency(report.income)}
              </Text>
            </View>
            {/* Total Expense */}
            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                {isBangla ? 'মোট খরচ' : 'Total Expense'}
              </Text>
              <Text style={[styles.metricValue, styles.expenseText]}>
                {formatCurrency(report.expense)}
              </Text>
            </View>
          </View>
          <View style={styles.gridRow}>
            {/* Savings */}
            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                {isBangla ? 'সঞ্চয়' : 'Savings'}
              </Text>
              <Text style={[styles.metricValue, report.savings >= 0 ? styles.incomeText : styles.expenseText]}>
                {formatCurrency(report.savings)}
              </Text>
            </View>
            {/* Savings Rate */}
            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                {isBangla ? 'সঞ্চয়ের হার' : 'Savings Rate'}
              </Text>
              <Text style={[styles.metricValue, styles.savingsRateText]}>
                {Math.round(report.savingsRate)}%
              </Text>
            </View>
          </View>
        </View>

        {/* --- Income vs Expense Chart Card --- */}
        <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('reports.income_vs_expense', 'Income vs Expense')}
          </Text>
          <View style={styles.chartWrapper}>
            {/* Y-Axis Labels */}
            <View style={styles.yAxisContainer}>
              {report.ticks
                .slice()
                .reverse()
                .map((tick, i) => (
                  <Text key={i} style={[styles.yAxisText, { color: colors.textMuted }]}>
                    {tick}
                  </Text>
                ))}
            </View>

            {/* Bar Content */}
            <View style={styles.barChartContainer}>
              {/* Grid Lines */}
              <View style={styles.gridLinesContainer}>
                {report.ticks.map((_, i) => (
                  <View key={i} style={[styles.gridLine, { backgroundColor: colors.divider }]} />
                ))}
              </View>

              <View style={styles.barsRowContainer}>
                {report.chartData.map((data, index) => {
                  const incomeHeight = (data.income / report.barScale) * 100;
                  const expenseHeight = (data.expense / report.barScale) * 100;

                  return (
                    <View key={index} style={styles.barGroup}>
                      <View style={styles.barsPair}>
                        {data.income > 0 && (
                          <View
                            style={[
                              styles.bar,
                              { height: `${incomeHeight}%`, backgroundColor: '#0FB384' },
                            ]}
                          />
                        )}
                        {data.expense > 0 && (
                          <View
                            style={[
                              styles.bar,
                              { height: `${expenseHeight}%`, backgroundColor: '#EF4444' },
                            ]}
                          />
                        )}
                      </View>
                      <Text style={[styles.xAxisText, { color: colors.textSecondary }]}>{data.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#0FB384' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                {t('transactions.filter_income', 'Income')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                {t('transactions.filter_expense', 'Expense')}
              </Text>
            </View>
          </View>
        </View>

        {/* --- Expense by Category Card --- */}
        <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('reports.category_breakdown', 'Expense by Category')}
          </Text>

          {/* Donut Chart */}
          <View style={styles.donutWrapper}>
            {report.expense > 0 ? (
              <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                <G rotation="-90" origin={`${center}, ${center}`}>
                  {report.slices.map((item, index) => {
                    const strokeLength = item.pctValue * circumference;
                    const dashLength = strokeLength > 4 ? strokeLength - 2 : strokeLength;
                    const gapLength = circumference - dashLength;
                    const offset = circumference - item.offset * circumference;

                    return (
                      <Circle
                        key={index}
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={item.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${dashLength} ${gapLength}`}
                        strokeDashoffset={offset}
                        fill="transparent"
                        strokeLinecap="butt"
                      />
                    );
                  })}
                </G>
              </Svg>
            ) : (
              <View style={styles.donutEmpty}>
                <Ionicons name="receipt-outline" size={28} color={colors.textMuted} />
                <Text style={[styles.donutEmptyText, { color: colors.textSecondary }]}>
                  {isBangla ? 'এই সময়ে কোনো খরচ নেই।' : `No expenses this ${report.periodLabel}.`}
                </Text>
              </View>
            )}
          </View>

          {/* Category Legend Breakdown */}
          <View style={styles.categoryList}>
            {report.categoryData.length === 0 ? (
              <Text style={[styles.noCategoriesText, { color: colors.textSecondary }]}>
                {isBangla ? 'কোনো খরচের খাত নেই।' : 'No expense categories yet.'}
              </Text>
            ) : (
              report.categoryData.map((item, index) => (
                <View key={index} style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.categoryName, { color: colors.text }]}>{translateCategory(item.name)}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={[styles.categoryValue, { color: colors.text }]}>{formatCurrency(item.value)}</Text>
                    <Text style={[styles.categoryPercentage, { color: colors.textSecondary }]}>
                      {item.percentage >= 100 ? 100 : item.percentage.toFixed(0)}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* --- AI Financial Insight Banner --- */}
        <View style={[styles.insightBanner, isDark && { backgroundColor: '#1E1236', borderColor: '#3B2366' }]}>
          <View style={styles.insightHeader}>
            <Ionicons name="sparkles" size={16} color={isDark ? '#DDD6FE' : '#7C3AED'} style={styles.insightIcon} />
            <Text style={[styles.insightTitle, isDark && { color: '#DDD6FE' }]}>
              {isBangla ? 'এআই আর্থিক পরামর্শ' : 'AI Financial Insight'}
            </Text>
          </View>
          <Text style={[styles.insightSubtext, isDark && { color: '#C4B5FD' }]}>{report.insightText}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActiveButton: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#0FB384',
  },
  toggleInactiveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '500',
  },
  toggleActiveText: {
    color: '#047857',
  },
  toggleInactiveText: {
    color: '#64748B',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  gridContainer: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#64748B',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  incomeText: {
    color: '#0FB384',
  },
  expenseText: {
    color: '#EF4444',
  },
  savingsRateText: {
    color: '#7C3AED',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  chartWrapper: {
    flexDirection: 'row',
    height: 160,
    alignItems: 'stretch',
  },
  yAxisContainer: {
    justifyContent: 'space-between',
    paddingRight: 8,
    paddingBottom: 20,
    height: '100%',
  },
  yAxisText: {
    fontSize: 13,
    lineHeight: 15,
    color: '#94A3B8',
    textAlign: 'right',
    width: 28,
  },
  barChartContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLinesContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    bottom: 24,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  barsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
    paddingBottom: 20,
  },
  barGroup: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barsPair: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'center',
    marginBottom: 6,
  },
  bar: {
    width: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  xAxisText: {
    fontSize: 13,
    lineHeight: 15,
    color: '#94A3B8',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 13,
    lineHeight: 15,
    color: '#64748B',
  },
  donutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  donutEmpty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  donutEmptyText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#94A3B8',
  },
  categoryList: {
    marginTop: 16,
    gap: 12,
  },
  noCategoriesText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#94A3B8',
    textAlign: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: 13,
    lineHeight: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryValue: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoryPercentage: {
    fontSize: 13,
    lineHeight: 15,
    color: '#94A3B8',
    width: 32,
    textAlign: 'right',
  },
  insightBanner: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightIcon: {
    marginTop: -1,
  },
  insightTitle: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '700',
    color: '#7C3AED',
  },
  insightSubtext: {
    fontSize: 13,
    lineHeight: 17,
    color: '#7C3AED',
  },
});
