import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDeckStore } from '../../src/store/deckStore';
import { openTrackInAppleMusic } from '../../src/utils/platformLinks';
import { getSongLikerCount } from '../../src/firebase/socialService';
import GradientText from '../../src/components/GradientText';
import AppleArtwork from '../../src/components/AppleArtwork';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import type { DeezerTrack } from '../../src/api/types';
import { lightTap } from '../../src/utils/haptics';
import LottieEmptyState from '../../src/components/LottieEmptyState';
const emptyLikedAnim = require('../../assets/lottie/empty-liked.json');


function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function LikedTrackRow({ item, index, onRemove }: { item: DeezerTrack; index: number; onRemove: () => void }) {
  const [likerCount, setLikerCount] = useState(0);

  useEffect(() => {
    getSongLikerCount(item.id)
      .then(({ count }) => { if (count > 0) setLikerCount(count); })
      .catch(() => {});
  }, [item.id]);

  return (
    <View style={styles.row}>
      <Text style={styles.rowIndex}>{index + 1}</Text>
      <AppleArtwork track={item} style={styles.cover} />
      <View style={styles.info}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.artist.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.duration}>{formatDuration(item.duration ?? 0)}</Text>
          {likerCount > 1 && (
            <TouchableOpacity
              style={styles.likerPill}
              onPress={() => router.push(`/who-liked/${item.id}`)}
              activeOpacity={0.75}
            >
              <Ionicons name="heart" size={10} color={COLORS.pink} />
              <Text style={styles.likerCount}>{likerCount}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          style={styles.spotifyBtn}
          onPress={() => { lightTap(); openTrackInAppleMusic(item); }}
          accessibilityLabel={`Open ${item.title} in Apple Music`}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Ionicons name="musical-note" size={13} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => { lightTap(); onRemove(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Remove ${item.title}`}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={17} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LikedScreen() {
  const { likedTracks, removeLikedTrack } = useDeckStore();
  const insets = useSafeAreaInsets();

  async function openExport() {
    lightTap();
    const trackLines = likedTracks.map(t => t.title + ' - ' + t.artist.name).join('\n');
    await Share.share({ message: trackLines, title: 'My Liked Songs' }).catch(() => {});
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.header}>
        <GradientText fontSize={34} hPad={16}>Liked Songs</GradientText>
        {likedTracks.length > 0 && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={openExport}
            accessibilityLabel="Share liked songs"
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={28}
              color={COLORS.green}
            />
          </TouchableOpacity>
        )}
        <View style={styles.countPill}>
          <Ionicons name="heart" size={12} color={COLORS.green} />
          <Text style={styles.countText}>
            {likedTracks.length} {likedTracks.length === 1 ? 'track' : 'tracks'}
          </Text>
        </View>
      </View>

      {likedTracks.length === 0 ? (
        <LottieEmptyState
          animationSource={emptyLikedAnim}
          title="No liked songs yet"
          subtitle="Swipe right on songs you love"
        />
      ) : (
        <FlatList
          data={likedTracks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <LikedTrackRow
              item={item}
              index={index}
              onRemove={() => removeLikedTrack(item.id)}
            />
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
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: 8,
  },
  saveBtn: {
    position: 'absolute',
    top: 0,
    right: SPACING.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  countText: { color: COLORS.green, fontSize: 12, fontWeight: '700' },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  rowIndex: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  separator: { height: 1, backgroundColor: COLORS.border },

  cover: { width: 52, height: 52, borderRadius: RADIUS.sm },
  info: { flex: 1, gap: 3 },
  trackTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  artist: { color: COLORS.cyan, fontSize: 13, fontWeight: '500' },
  duration: { color: COLORS.textMuted, fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  likerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
  },
  likerCount: { color: COLORS.pink, fontSize: 10, fontWeight: '700' },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  spotifyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purple,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  removeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: SPACING.md,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },



  exportingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  exportingLabel: { color: COLORS.textSub, fontSize: 14, fontWeight: '500' },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.green,
    borderRadius: 2,
  },

  doneContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  doneNotFound: { color: COLORS.textSub, fontSize: 12, textAlign: 'center', paddingHorizontal: SPACING.md },
  doneNotFound2: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
  doneBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingVertical: 13,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  doneBtnText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
});
