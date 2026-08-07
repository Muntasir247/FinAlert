import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export default function CircularProgress({
  pct,
  label = 'used',
}: {
  pct: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(pct, 1));
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#0FB384"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={styles.center}>
        <Text style={styles.pctText}>{Math.round(clamped * 100)}%</Text>
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    backgroundColor: '#F4FBF7',
    borderRadius: 26,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
  },
  labelText: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: -2,
  },
});
