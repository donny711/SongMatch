import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getWhoLikedSong, type SongLikerUser } from '../../src/firebase/socialService';
import { AvatarWithFrame } from '../../src/components/profile/AvatarWithFrame';
import { FollowButton } from '../../src/components/social/FollowButton';
import { COLORS, SPACING, RADIUS } from '../../src/theme';

export default function WhoLikedScreen() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<SongLikerUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackId) return;
    getWhoLikedSong(Number(trackId))
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trackId]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="heart" size={14} color={COLORS.pink} />
          <Text style={styles.title}>Who liked this</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.purple} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={36} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No one yet</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/user/${item.uid}`)}
              activeOpacity={0.8}
            >
              <AvatarWithFrame
                uri={item.avatarUrl}
                frameId={item.equippedItems?.avatarFrame ?? null}
                size={44}
              />
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName ?? 'SongMatch User'}
              </Text>
              <FollowButton theirUid={item.uid} isPrivate={item.isPrivate} size="sm" />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  list: { padding: SPACING.lg, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
  },
  name: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
  separator: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
