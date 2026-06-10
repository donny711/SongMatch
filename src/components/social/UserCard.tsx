import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AvatarWithFrame } from '../profile/AvatarWithFrame';
import { FollowButton } from './FollowButton';
import type { PublicUser } from '../../firebase/socialService';
import { COLORS, SPACING, RADIUS } from '../../theme';

interface Props {
  user: PublicUser;
  rank?: number;
  scoreLabel?: string;
  onPress?: () => void;
}

export function UserCard({ user, rank, scoreLabel, onPress }: Props) {
  const handlePress = () => {
    if (onPress) { onPress(); return; }
    router.push(`/user/${user.uid}`);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      {rank !== undefined && (
        <Text style={[styles.rank, rank <= 3 && styles.rankTop]}>{rank}</Text>
      )}
      <AvatarWithFrame uri={user.avatarUrl} frameId={user.equippedItems?.avatarFrame ?? null} size={44} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {user.displayName ?? 'SongMatch User'}
          </Text>
          {user.isPro && <MaterialCommunityIcons name="crown" size={11} color="#ffd700" />}
        </View>
        <View style={styles.meta}>
          {scoreLabel ? (
            <Text style={styles.metaText}>{scoreLabel}</Text>
          ) : (
            <>
              <Ionicons name="heart" size={11} color={COLORS.green} />
              <Text style={styles.metaText}>{user.likedCount}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons name="flame" size={11} color={COLORS.orange} />
              <Text style={styles.metaText}>{user.currentStreak}d</Text>
            </>
          )}
        </View>
      </View>
      <FollowButton theirUid={user.uid} isPrivate={user.isPrivate} size="sm" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rank: {
    width: 24,
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  rankTop: { color: COLORS.purple },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.textMuted, fontSize: 11 },
  metaDot: { color: COLORS.textMuted, fontSize: 11 },
});
