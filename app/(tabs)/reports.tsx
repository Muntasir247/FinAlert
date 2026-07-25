import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Data for Income vs Expense Bar Chart
const MONTHLY_CHART_DATA = [
  { label: 'Jan', income: 45000, expense: 32000 },
  { label: 'Feb', income: 48000, expense: 35000 },
  { label: 'Mar', income: 50000, expense: 29000 },
  { label: 'Apr', income: 47000, expense: 38000 },
  { label: 'May', income: 52000, expense: 31000 },
  { label: 'Jun', income: 53000, expense: 17000 },
];

const WEEKLY_CHART_DATA = [
  { label: 'W1', income: 12000, expense: 4500 },
  { label: 'W2', income: 13000, expense: 4200 },
  { label: 'W3', income: 14000, expense: 3800 },
  { label: 'W4', income: 14000, expense: 4500 },
];

// Data for Expense by Category
const CATEGORY_DATA = [
  { name: 'Food & Dining', value: '৳1,650', percentage: 11, color: '#10B981', pctValue: 0.11 },
  { name: 'Bills & Utilities', value: '৳9,200', percentage: 63, color: '#046A38', pctValue: 0.63 },
  { name: 'Transport', value: '৳650', percentage: 4, color: '#8B5CF6', pctValue: 0.04 },
  { name: 'Shopping', value: '৳1,500', percentage: 10, color: '#F59E0B', pctValue: 0.10 },
  { name: 'Health', value: '৳900', percentage: 6, color: '#EF4444', pctValue: 0.06 },
  { name: 'Other', value: '৳700', percentage: 5, color: '#64748B', pctValue: 0.05 },
];

export default function ReportsScreen() {
  const [reportType, setReportType] = useState<'monthly' | 'weekly'>('monthly');

  const chartData = reportType === 'monthly' ? MONTHLY_CHART_DATA : WEEKLY_CHART_DATA;

  // Donut chart parameters
  const radius = 70;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const svgSize = 180;
  const center = svgSize / 2;

  // Calculate cumulative offsets for donut slices
  let accumulatedPercentage = 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* --- Header & Timeframe Toggle --- */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              reportType === 'monthly' ? styles.toggleActiveButton : styles.toggleInactiveButton,
            ]}
            onPress={() => setReportType('monthly')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                reportType === 'monthly' ? styles.toggleActiveText : styles.toggleInactiveText,
              ]}
            >
              Monthly Report
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              reportType === 'weekly' ? styles.toggleActiveButton : styles.toggleInactiveButton,
            ]}
            onPress={() => setReportType('weekly')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                reportType === 'weekly' ? styles.toggleActiveText : styles.toggleInactiveText,
              ]}
            >
              Weekly Report
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
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Income</Text>
              <Text style={[styles.metricValue, styles.incomeText]}>
                ৳{reportType === 'monthly' ? '53,000' : '53,000'}
              </Text>
            </View>
            {/* Total Expense */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Expense</Text>
              <Text style={[styles.metricValue, styles.expenseText]}>
                ৳{reportType === 'monthly' ? '17,000' : '17,000'}
              </Text>
            </View>
          </View>
          <View style={styles.gridRow}>
            {/* Savings */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Savings</Text>
              <Text style={[styles.metricValue, styles.incomeText]}>
                ৳{reportType === 'monthly' ? '36,000' : '36,000'}
              </Text>
            </View>
            {/* Savings Rate */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Savings Rate</Text>
              <Text style={[styles.metricValue, styles.savingsRateText]}>68%</Text>
            </View>
          </View>
        </View>

        {/* --- Income vs Expense Chart Card --- */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardTitle}>Income vs Expense</Text>
          <View style={styles.chartWrapper}>
            {/* Y-Axis Labels */}
            <View style={styles.yAxisContainer}>
              <Text style={styles.yAxisText}>60k</Text>
              <Text style={styles.yAxisText}>45k</Text>
              <Text style={styles.yAxisText}>30k</Text>
              <Text style={styles.yAxisText}>15k</Text>
              <Text style={styles.yAxisText}>0k</Text>
            </View>

            {/* Bar Content */}
            <View style={styles.barChartContainer}>
              {/* Grid Lines */}
              <View style={styles.gridLinesContainer}>
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
              </View>

              <View style={styles.barsRowContainer}>
                {chartData.map((data, index) => {
                  const maxVal = 60000;
                  const incomeHeight = (data.income / maxVal) * 100;
                  const expenseHeight = (data.expense / maxVal) * 100;

                  return (
                    <View key={index} style={styles.barGroup}>
                      <View style={styles.barsPair}>
                        {/* Income Bar (Green) */}
                        <View
                          style={[
                            styles.bar,
                            { height: `${incomeHeight}%`, backgroundColor: '#0FB384' },
                          ]}
                        />
                        {/* Expense Bar (Red) */}
                        <View
                          style={[
                            styles.bar,
                            { height: `${expenseHeight}%`, backgroundColor: '#EF4444' },
                          ]}
                        />
                      </View>
                      <Text style={styles.xAxisText}>{data.label}</Text>
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
              <Text style={styles.legendText}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Expense</Text>
            </View>
          </View>
        </View>

        {/* --- Expense by Category Card --- */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardTitle}>Expense by Category</Text>

          {/* Donut Chart */}
          <View style={styles.donutWrapper}>
            <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
              <G rotation="-90" origin={`${center}, ${center}`}>
                {CATEGORY_DATA.map((item, index) => {
                  const strokeLength = item.pctValue * circumference;
                  // Add a tiny gap (2 units) if it's not a single 100% slice
                  const dashLength = strokeLength > 4 ? strokeLength - 2 : strokeLength;
                  const gapLength = circumference - dashLength;
                  const offset = circumference - (accumulatedPercentage * circumference);
                  accumulatedPercentage += item.pctValue;

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
          </View>

          {/* Category Legend Breakdown */}
          <View style={styles.categoryList}>
            {CATEGORY_DATA.map((item, index) => (
              <View key={index} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                  <Text style={styles.categoryName}>{item.name}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categoryValue}>{item.value}</Text>
                  <Text style={styles.categoryPercentage}>{item.percentage}%</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* --- AI Financial Insight Banner --- */}
        <View style={styles.insightBanner}>
          <View style={styles.insightHeader}>
            <Ionicons name="sparkles" size={16} color="#7C3AED" style={styles.insightIcon} />
            <Text style={styles.insightTitle}>AI Financial Insight</Text>
          </View>
          <Text style={styles.insightSubtext}>
            Reduce dining out by 30% to save ৳2,000 more.
          </Text>
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
    minHeight: 2,
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
  categoryList: {
    marginTop: 16,
    gap: 12,
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
