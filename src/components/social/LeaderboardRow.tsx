import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AvatarWithFrame } from '../profile/AvatarWithFrame';
import type { PublicUser, LeaderboardField } from '../../firebase/socialService';
import { FollowButton } from './FollowButton';
import { COLORS, SPACING, RADIUS } from '../../theme';

interface Props {
  user: PublicUser;
  rank: number;
  field: LeaderboardField;
}

const RANK_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

const FIELD_LABELS: Record<LeaderboardField, string> = {
  points: 'pts',
  currentStreak: 'day streak',
  likedCount: 'liked',
};

function fmtN(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function LeaderboardRow({ user, rank, field }: Props) {
  const rankColor = RANK_COLORS[rank] ?? COLORS.textMuted;
  const value = field === 'points' ? user.points
    : field === 'currentStreak' ? user.currentStreak
    : user.likedCount;

  return (
    <TouchableOpacity
      style={[styles.row, rank <= 3 && styles.rowTop]}
      onPress={() => router.push(`/user/${user.uid}`)}
      activeOpacity={0.8}
    >
      <Text style={[styles.rank, { color: rankColor }]}>{rank}</Text>
      <AvatarWithFrame uri={user.avatarUrl} frameId={user.equippedItems?.avatarFrame ?? null} size={40} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {user.displayName ?? 'SongMatch User'}
          </Text>
          {user.isPro && <MaterialCommunityIcons name="crown" size={11} color="#ffd700" />}
        </View>
        <Text style={styles.score}>
          {fmtN(value)} {FIELD_LABELS[field]}
        </Text>
      </View>
      <FollowButton theirUid={user.uid} isPrivate={user.isPrivate} size="sm" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  rowTop: {
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },
  rank: {
    width: 28,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  score: { color: COLORS.textMuted, fontSize: 12 },
});
