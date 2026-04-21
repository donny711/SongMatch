import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFollow } from '../../hooks/useFollow';
import { COLORS, RADIUS, SPACING } from '../../theme';

interface Props {
  theirUid: string;
  isPrivate?: boolean;
  size?: 'sm' | 'md';
}

export function FollowButton({ theirUid, isPrivate, size = 'md' }: Props) {
  const { isFollowing, loading, follow, unfollow, isOwnProfile } = useFollow(theirUid);

  if (isOwnProfile) return null;

  if (isPrivate) {
    return (
      <TouchableOpacity style={[styles.btn, styles.btnPrivate, size === 'sm' && styles.btnSm]} disabled activeOpacity={1}>
        <Ionicons name="lock-closed" size={12} color={COLORS.textMuted} />
        <Text style={[styles.text, styles.textMuted, size === 'sm' && styles.textSm]}>Private</Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <TouchableOpacity style={[styles.btn, styles.btnLoading, size === 'sm' && styles.btnSm]} disabled activeOpacity={1}>
        <ActivityIndicator size="small" color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  }

  if (isFollowing) {
    return (
      <TouchableOpacity
        style={[styles.btn, styles.btnFollowing, size === 'sm' && styles.btnSm]}
        onPress={unfollow}
        activeOpacity={0.75}
      >
        <Ionicons name="checkmark" size={13} color={COLORS.textSub} />
        <Text style={[styles.text, styles.textFollowing, size === 'sm' && styles.textSm]}>Following</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.btn, styles.btnFollow, size === 'sm' && styles.btnSm]}
      onPress={follow}
      activeOpacity={0.8}
    >
      <Text style={[styles.text, styles.textFollow, size === 'sm' && styles.textSm]}>Follow</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
  },
  btnSm: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  btnFollow: {
    backgroundColor: COLORS.purple,
  },
  btnFollowing: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  btnPrivate: {
    borderWidth: 1,
    borderColor: COLORS.border,
    opacity: 0.5,
  },
  btnLoading: {
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 80,
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
  textSm: {
    fontSize: 11,
  },
  textFollow: { color: '#fff' },
  textFollowing: { color: COLORS.textSub },
  textMuted: { color: COLORS.textMuted },
});
