import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { DeezerTrack } from '../../api/types';
import type { ShowcaseArtist } from '../../firebase/profileService';
import AppleArtistArtwork from '../AppleArtistArtwork';
import { COLORS, SPACING, RADIUS } from '../../theme';

const SCREEN_W = Dimensions.get('window').width;
// sections has paddingHorizontal 24, card has padding 16 on each side
const INNER_W = SCREEN_W - SPACING.lg * 2 - SPACING.md * 2;
const SONG_GAP = 6;
const SONG_CARD_W = Math.floor((INNER_W - SONG_GAP * 2) / 3);
const SONG_CARD_H = Math.floor(SONG_CARD_W * 1.38);
const ARTIST_SIZE = 58;

interface Props {
  songs: DeezerTrack[];
  artists: ShowcaseArtist[];
  accentColor: string;
  readOnly?: boolean;
}

function SongCard({ track }: { track: DeezerTrack }) {
  return (
    <View style={[styles.songCard, { width: SONG_CARD_W, height: SONG_CARD_H }]}>
      {/* Licensed Apple Music artwork only; backfill populates artworkUrl on
          pre-migration showcase entries. */}
      {track.artworkUrl ? (
        <Image
          source={{ uri: track.artworkUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1F1F28' }]} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.95)']}
        locations={[0.35, 1]}
        style={styles.songGradient}
      >
        <Text style={styles.songTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{track.artist.name}</Text>
      </LinearGradient>
    </View>
  );
}

function EmptySongCard() {
  return (
    <View style={[styles.songCard, styles.songCardEmpty, { width: SONG_CARD_W, height: SONG_CARD_H }]}>
      <Ionicons name="musical-note" size={22} color={COLORS.textMuted} />
    </View>
  );
}

function ArtistBubble({ artist }: { artist: ShowcaseArtist }) {
  return (
    <View style={styles.artistBubble}>
      <View style={styles.artistRing}>
        <AppleArtistArtwork name={artist.name} style={styles.artistCircle} initialSize={22} />
      </View>
      <Text style={styles.artistName} numberOfLines={2}>{artist.name}</Text>
    </View>
  );
}

export function ShowcaseSection({ songs, artists, accentColor, readOnly = false }: Props) {
  const slots = [0, 1, 2];
  const hasArtists = artists.length > 0;
  const hasSongs = songs.length > 0;
  const isEmpty = !hasSongs && !hasArtists;

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>Showcase</Text>
        {!readOnly && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/edit-showcase')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="pencil-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        {isEmpty ? (
          /* ── Empty state ── */
          <TouchableOpacity
            style={styles.emptyState}
            onPress={() => router.push('/edit-showcase')}
            activeOpacity={0.75}
          >
            <Ionicons name="albums-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Build your showcase</Text>
            <Text style={styles.emptySubtitle}>Pin your favourite songs & artists</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* ── Songs ── */}
            <Text style={styles.subLabel}>SONGS</Text>
            <View style={styles.songsRow}>
              {slots.map((i) =>
                songs[i]
                  ? <SongCard key={songs[i].id} track={songs[i]} />
                  : <EmptySongCard key={`empty-${i}`} />
              )}
            </View>

            {/* ── Divider ── */}
            <View style={styles.divider} />

            {/* ── Artists ── */}
            <Text style={styles.subLabel}>ARTISTS</Text>
            {hasArtists ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.artistsScroll}
              >
                {artists.map((a) => (
                  <ArtistBubble key={a.id} artist={a} />
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity
                style={styles.addArtistsRow}
                onPress={() => router.push('/edit-showcase')}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.addArtistsText}>Add artists</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
    overflow: 'hidden',
  },

  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
  },

  // Songs
  songsRow: {
    flexDirection: 'row',
    gap: SONG_GAP,
  },
  songCard: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  songCardEmpty: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 7,
    paddingBottom: 7,
    paddingTop: 24,
    gap: 1,
  },
  songTitle: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },
  songArtist: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    lineHeight: 12,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },

  // Artists
  artistsScroll: {
    gap: SPACING.lg,
    paddingVertical: 4,
  },
  artistBubble: {
    alignItems: 'center',
    gap: 6,
    width: ARTIST_SIZE + 12,
  },
  artistRing: {
    width: ARTIST_SIZE + 4,
    height: ARTIST_SIZE + 4,
    borderRadius: (ARTIST_SIZE + 4) / 2,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 2,
  },
  artistCircle: {
    width: ARTIST_SIZE,
    height: ARTIST_SIZE,
    borderRadius: ARTIST_SIZE / 2,
  },
  artistName: {
    color: COLORS.textSub,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },

  addArtistsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs,
  },
  addArtistsText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.lg,
  },
  emptyTitle: {
    color: COLORS.textSub,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
