import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CircularProgress({
  pct,
  label = 'used',
}: {
  pct: number;
  label?: string;
}) {
  const angle = pct * 360;
  const rightAngle = Math.min(angle, 180);
  const leftAngle = Math.max(angle - 180, 0);

  return (
    <View style={styles.container}>
      <View style={styles.bgRing} />
      <View style={styles.rightHalf}>
        <View
          style={[styles.arc, { transform: [{ rotate: `${rightAngle - 90}deg` }] }]}
        />
      </View>
      {angle > 180 && (
        <View style={styles.leftHalf}>
          <View
            style={[styles.arc, { transform: [{ rotate: `${leftAngle - 90}deg` }] }]}
          />
        </View>
      )}
      <View style={styles.center}>
        <Text style={styles.pctText}>{Math.round(pct * 100)}%</Text>
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 36,
    borderWidth: 5,
    borderColor: '#E5E7EB',
  },
  rightHalf: {
    position: 'absolute',
    top: 0,
    left: 36,
    width: 36,
    height: 72,
    overflow: 'hidden',
  },
  leftHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 36,
    height: 72,
    overflow: 'hidden',
  },
  arc: {
    position: 'absolute',
    top: 0,
    left: -36,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    borderColor: '#0FB384',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  center: {
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
