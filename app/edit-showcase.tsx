import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDeckStore } from '../src/store/deckStore';
import { useProfileStore } from '../src/store/profileStore';
import type { DeezerTrack } from '../src/api/types';
import type { ShowcaseArtist } from '../src/firebase/profileService';
import AppleArtwork from '../src/components/AppleArtwork';
import AppleArtistArtwork from '../src/components/AppleArtistArtwork';
import { COLORS, SPACING, RADIUS } from '../src/theme';

const MAX_SONGS = 3;
const MAX_ARTISTS = 5;

type Tab = 'songs' | 'artists';

// ── Derive unique artists from liked tracks ──────────────────────────────────

function buildArtistList(likedTracks: DeezerTrack[]): ShowcaseArtist[] {
  const seen = new Map<number, ShowcaseArtist>();
  for (const track of likedTracks) {
    if (!seen.has(track.artist.id)) {
      seen.set(track.artist.id, {
        id: track.artist.id,
        name: track.artist.name,
        // Vestigial (avatars now resolve Apple artist art by name); keep it
        // non-Deezer so nothing unlicensed is ever persisted.
        coverUrl: track.artworkUrl ?? '',
      });
    }
  }
  return Array.from(seen.values());
}

// ── Song row ─────────────────────────────────────────────────────────────────

function SongRow({
  track,
  selected,
  disabled,
  onToggle,
}: {
  track: DeezerTrack;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected, disabled && !selected && styles.rowDisabled]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <AppleArtwork track={track} style={styles.rowArt} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{track.artist.name}</Text>
      </View>
      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

// ── Artist row ───────────────────────────────────────────────────────────────

function ArtistRow({
  artist,
  selected,
  disabled,
  onToggle,
}: {
  artist: ShowcaseArtist;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected, disabled && !selected && styles.rowDisabled]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <AppleArtistArtwork name={artist.name} style={styles.rowArtCircle} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{artist.name}</Text>
      </View>
      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function EditShowcaseScreen() {
  const insets = useSafeAreaInsets();
  const likedTracks = useDeckStore((s) => s.likedTracks);
  const currentSongs = useProfileStore((s) => s.showcaseTracks);
  const currentArtists = useProfileStore((s) => s.showcaseArtists);
  const setShowcase = useProfileStore((s) => s.setShowcase);

  const [tab, setTab] = useState<Tab>('songs');
  const [selectedSongs, setSelectedSongs] = useState<DeezerTrack[]>(currentSongs);
  const [selectedArtists, setSelectedArtists] = useState<ShowcaseArtist[]>(currentArtists);
  const [saving, setSaving] = useState(false);

  const artistList = useMemo(() => buildArtistList(likedTracks), [likedTracks]);

  const isDirty =
    JSON.stringify(selectedSongs.map((t) => t.id)) !== JSON.stringify(currentSongs.map((t) => t.id)) ||
    JSON.stringify(selectedArtists.map((a) => a.id)) !== JSON.stringify(currentArtists.map((a) => a.id));

  const toggleSong = (track: DeezerTrack) => {
    setSelectedSongs((prev) => {
      const isSelected = prev.some((t) => t.id === track.id);
      if (isSelected) return prev.filter((t) => t.id !== track.id);
      if (prev.length >= MAX_SONGS) {
        Alert.alert('Max reached', `You can pin up to ${MAX_SONGS} songs.`);
        return prev;
      }
      return [...prev, track];
    });
  };

  const toggleArtist = (artist: ShowcaseArtist) => {
    setSelectedArtists((prev) => {
      const isSelected = prev.some((a) => a.id === artist.id);
      if (isSelected) return prev.filter((a) => a.id !== artist.id);
      if (prev.length >= MAX_ARTISTS) {
        Alert.alert('Max reached', `You can pin up to ${MAX_ARTISTS} artists.`);
        return prev;
      }
      return [...prev, artist];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setShowcase(selectedSongs, selectedArtists);
      router.back();
    } catch {
      Alert.alert('Save failed', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Showcase</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isDirty || saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'songs' && styles.tabActive]}
          onPress={() => setTab('songs')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="musical-notes"
            size={14}
            color={tab === 'songs' ? '#fff' : COLORS.textMuted}
          />
          <Text style={[styles.tabText, tab === 'songs' && styles.tabTextActive]}>
            Songs
          </Text>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{selectedSongs.length}/{MAX_SONGS}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === 'artists' && styles.tabActive]}
          onPress={() => setTab('artists')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="people"
            size={14}
            color={tab === 'artists' ? '#fff' : COLORS.textMuted}
          />
          <Text style={[styles.tabText, tab === 'artists' && styles.tabTextActive]}>
            Artists
          </Text>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{selectedArtists.length}/{MAX_ARTISTS}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'songs' ? (
        likedTracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No liked songs yet</Text>
            <Text style={styles.emptySubtitle}>Like some songs first to feature them here</Text>
          </View>
        ) : (
          <FlatList
            data={likedTracks}
            keyExtractor={(t) => String(t.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <SongRow
                track={item}
                selected={selectedSongs.some((t) => t.id === item.id)}
                disabled={selectedSongs.length >= MAX_SONGS}
                onToggle={() => toggleSong(item)}
              />
            )}
          />
        )
      ) : (
        artistList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No artists yet</Text>
            <Text style={styles.emptySubtitle}>Like some songs first to see artists here</Text>
          </View>
        ) : (
          <FlatList
            data={artistList}
            keyExtractor={(a) => String(a.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <ArtistRow
                artist={item}
                selected={selectedArtists.some((a) => a.id === item.id)}
                disabled={selectedArtists.length >= MAX_ARTISTS}
                onToggle={() => toggleArtist(item)}
              />
            )}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

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
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  saveBtn: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '700',
  },

  // List
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
    gap: 2,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  rowSelected: {
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowArt: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.sm,
  },
  rowArtCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xxl,
  },
  emptyTitle: {
    color: COLORS.textSub,
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
