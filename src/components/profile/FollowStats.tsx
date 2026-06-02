import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../theme';

interface Props {
  uid: string;
  followerCount: number;
  followingCount: number;
}

function fmtN(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function FollowStats({ uid, followerCount, followingCount }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.pill}
        onPress={() => router.push(`/followers?uid=${uid}`)}
        activeOpacity={0.75}
      >
        <Text style={styles.count}>{fmtN(followerCount)}</Text>
        <Text style={styles.label}>Followers</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity
        style={styles.pill}
        onPress={() => router.push(`/following?uid=${uid}`)}
        activeOpacity={0.75}
      >
        <Text style={styles.count}>{fmtN(followingCount)}</Text>
        <Text style={styles.label}>Following</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  count: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.border,
  },
});
