import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../../theme';

interface Props {
  points: number;
  size?: 'sm' | 'lg';
  onPress?: () => void;
}

function fmtPts(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function MatchPointsDisplay({ points, size = 'sm', onPress }: Props) {
  const isLg = size === 'lg';
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.75} style={[styles.pill, isLg && styles.pillLg]}>
      <Ionicons name="diamond" size={isLg ? 16 : 12} color="#22D3EE" />
      <Text style={[styles.label, isLg && styles.labelLg]}>
        {fmtPts(points)}
      </Text>
      <Text style={[styles.unit, isLg && styles.unitLg]}>MP</Text>
      {onPress && <Ionicons name="chevron-forward" size={10} color="rgba(34,211,238,0.5)" />}
    </Wrap>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  pillLg: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    gap: 6,
  },
  label: {
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '800',
  },
  labelLg: {
    fontSize: 18,
  },
  unit: {
    color: 'rgba(34,211,238,0.6)',
    fontSize: 11,
    fontWeight: '700',
  },
  unitLg: {
    fontSize: 13,
  },
});
