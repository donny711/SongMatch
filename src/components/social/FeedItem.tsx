import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AvatarWithFrame } from '../profile/AvatarWithFrame';
import { useDeckStore } from '../../store/deckStore';
import { usePlayerStore } from '../../store/playerStore';
import { getDeezerTrackById, searchDeezer } from '../../api/deezerClient';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import type { FeedItem as FeedItemData } from '../../firebase/socialService';
import type { DeezerTrack } from '../../api/types';
import { COLORS, SPACING, RADIUS } from '../../theme';

interface Props {
  item: FeedItemData;
}

function timeAgo(likedAt: { seconds: number; nanoseconds: number } | null | undefined): string {
  if (!likedAt) return '';
  const diffMs = Date.now() - likedAt.seconds * 1000;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

export function FeedItem({ item }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(item.previewUrl || null);
  const [fetchingPreview, setFetchingPreview] = useState(!item.previewUrl && !!item.trackId);
  const [liked, setLiked] = useState(false);

  const mountedRef = useRef(true);

  const addLikedTrack = useDeckStore((s) => s.addLikedTrack);
  const removeLikedTrack = useDeckStore((s) => s.removeLikedTrack);
  const incrementLiked = useDeckStore((s) => s.incrementLiked);

  // Audio state
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const { activePreviewUri, setActivePreviewUri } = usePlayerStore();
  const progress = duration > 0 ? position / duration : 0;

  const toggle = async () => {
    if (!previewUrl) return;
    setAudioError(false);

    try {
      if (!playerRef.current) {
        await setAudioModeAsync({ playsInSilentMode: true });
        const player = createAudioPlayer({ uri: previewUrl }, { updateInterval: 250 });
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (!mountedRef.current) return;
          setPosition(Math.round(status.currentTime * 1000));
          setDuration(status.duration > 0 ? Math.round(status.duration * 1000) : 30000);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
          }
        });
        if (!mountedRef.current) { sub.remove(); player.remove(); return; }
        player.play();
        playerRef.current = player;
        subscriptionRef.current = sub;
        setIsPlaying(true);
        setActivePreviewUri(previewUrl);
      } else if (isPlaying) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else {
        playerRef.current.play();
        setIsPlaying(true);
        setActivePreviewUri(previewUrl);
      }
    } catch {
      setAudioError(true);
    }
  };

  // Reset player when URL changes (e.g. after fresh Deezer fetch)
  useEffect(() => {
    if (playerRef.current) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      playerRef.current.pause();
      playerRef.current.remove();
      playerRef.current = null;
      setIsPlaying(false);
      setPosition(0);
    }
    setAudioError(false);
  }, [previewUrl]);

  // Stop when another player takes over
  useEffect(() => {
    if (activePreviewUri !== previewUrl && playerRef.current) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      playerRef.current.pause();
      playerRef.current.remove();
      playerRef.current = null;
      setIsPlaying(false);
      setPosition(0);
    }
  }, [activePreviewUri, previewUrl]);

  // Fetch fresh preview URL from Deezer. Falls back to search-by-name if
  // the track ID returns no preview (e.g. old tracks without stored URL).
  useEffect(() => {
    if (!item.trackId) { setFetchingPreview(false); return; }

    const fetchPreview = async () => {
      // Try by track ID first
      const track = await getDeezerTrackById(item.trackId).catch(() => null);
      if (!mountedRef.current) return;

      const fresh = track?.preview || null;
      if (fresh) { setPreviewUrl(fresh); return; }

      // Fallback: search by title + artist name
      if (item.title && item.artistName) {
        const results = await searchDeezer(`${item.title} ${item.artistName}`, 1).catch(() => []);
        if (!mountedRef.current) return;
        const searchUrl = results[0]?.preview || null;
        if (searchUrl) { setPreviewUrl(searchUrl); return; }
      }

      // Last resort: stored URL (may be expired, but let it try)
      if (item.previewUrl && mountedRef.current) {
        setPreviewUrl(item.previewUrl);
      }
    };

    fetchPreview().finally(() => {
      if (mountedRef.current) setFetchingPreview(false);
    });

    return () => {
      mountedRef.current = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      playerRef.current?.pause();
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwipe = () => {
    if (!liked) {
      const track: DeezerTrack = {
        id: item.trackId,
        title: item.title,
        artist: { id: item.artistId, name: item.artistName },
        album: { id: 0, title: '', cover_xl: item.coverUrl },
        preview: previewUrl ?? '',
        duration: 0,
        link: '',
      };
      addLikedTrack(track);
      incrementLiked();
      setLiked(true);
    } else {
      removeLikedTrack(item.trackId);
      setLiked(false);
    }
  };

  const translateX = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-160, 0],
          [-4, 0],
          Extrapolation.CLAMP
        )}deg`,
      },
    ],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-100, -20], [1, 0], Extrapolation.CLAMP),
  }));

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -80) {
        runOnJS(handleSwipe)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle, liked && styles.cardLiked]}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.bgArt} blurRadius={18} />
        ) : null}
        <View style={styles.scrim} />

        {/* Swipe overlay */}
        <Animated.View style={[styles.swipeOverlay, overlayStyle]} pointerEvents="none">
          <Ionicons name={liked ? "heart-dislike" : "heart"} size={36} color={liked ? COLORS.pink : COLORS.green} />
          <Text style={[styles.overlayText, { color: liked ? COLORS.pink : COLORS.green }]}>
            {liked ? "Unlike" : "Like!"}
          </Text>
        </Animated.View>

        <View style={styles.content}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={styles.albumArt} />
          ) : (
            <View style={[styles.albumArt, { backgroundColor: '#1F1F28' }]} />
          )}

          <View style={styles.info}>
            <View style={styles.userRow}>
              <TouchableOpacity
                onPress={() => router.push(`/user/${item.uid}`)}
                activeOpacity={0.8}
                style={styles.avatarBtn}
              >
                <AvatarWithFrame
                  uri={item.avatarUrl}
                  frameId={item.equippedItems?.avatarFrame ?? null}
                  size={22}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/user/${item.uid}`)} activeOpacity={0.8}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName ?? "SongMatch User"}
                </Text>
              </TouchableOpacity>
              {item.isPro && <MaterialCommunityIcons name="crown" size={10} color="#ffd700" />}
              <View style={styles.likedBadge}>
                <Ionicons name="heart" size={9} color={COLORS.green} />
                <Text style={styles.likedText}>liked</Text>
              </View>
              <Text style={styles.time}>{timeAgo(item.likedAt)}</Text>
            </View>

            <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{item.artistName}</Text>

            <View style={styles.playerRow}>
              {fetchingPreview ? (
                <View style={styles.playBtn}>
                  <ActivityIndicator size="small" color={COLORS.purple} />
                </View>
              ) : audioError ? (
                <View style={[styles.playBtn, { opacity: 0.6 }]}>
                  <Ionicons name="alert-circle" size={13} color={COLORS.pink} />
                </View>
              ) : (
                <TouchableOpacity
                  onPress={toggle}
                  activeOpacity={0.75}
                  style={[styles.playBtn, !previewUrl && styles.playBtnDisabled]}
                  disabled={!previewUrl}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={13}
                    color={previewUrl ? COLORS.text : COLORS.textMuted}
                  />
                </TouchableOpacity>
              )}
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              {liked && (
                <View style={styles.likedChip}>
                  <Ionicons name="heart" size={10} color={COLORS.green} />
                  <Text style={styles.likedChipText}>Liked</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.swipeHint}>
          <Ionicons name="chevron-back" size={11} color={liked ? COLORS.green : COLORS.textMuted} />
          <Text style={[styles.swipeHintText, liked && { color: COLORS.green }]}>
            {liked ? "swipe left to unlike" : "swipe left to like"}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  cardLiked: {
    borderColor: 'rgba(167,139,250,0.40)',
  },
  bgArt: { ...StyleSheet.absoluteFillObject, opacity: 0.30 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,13,13,0.75)' },

  swipeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,13,13,0.45)',
    zIndex: 10,
  },
  overlayText: { fontSize: 18, fontWeight: '800' },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  albumArt: {
    width: 62,
    height: 62,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  info: { flex: 1, gap: 3 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    flexWrap: 'nowrap',
  },
  avatarBtn: { flexShrink: 0 },
  name: { color: COLORS.text, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  likedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  likedText: { color: COLORS.purple, fontSize: 10, fontWeight: '700' },
  time: { color: COLORS.textMuted, fontSize: 10, marginLeft: 'auto', flexShrink: 0 },
  trackTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  trackArtist: { color: COLORS.textSub, fontSize: 12 },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 5,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnDisabled: { opacity: 0.4 },
  progressBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.full,
  },
  likedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
  },
  likedChipText: { color: COLORS.purple, fontSize: 10, fontWeight: '700' },

  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  swipeHintText: { color: COLORS.textMuted, fontSize: 10 },
});
