import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
  Keyboard,
  Image,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { searchDeezer } from '../../src/api/deezerClient';
import { recognizeSong } from '../../src/api/auddClient';
import { getSongSimilarRecs } from '../../src/api/endpoints';
import { useDeckStore } from '../../src/store/deckStore';
import { useSubscriptionStore } from '../../src/store/subscriptionStore';
import SwipeDeck, { SwipeDeckRef } from '../../src/components/SwipeDeck/SwipeDeck';
import SnippetPlayer from '../../src/components/cards/SnippetPlayer';
import GradientText from '../../src/components/GradientText';
import { COLORS, SPACING, RADIUS, GLOW } from '../../src/theme';
import type { DeezerTrack, RecommendationCard } from '../../src/api/types';

type Stage = 'idle' | 'recording' | 'recognizing' | 'searching' | 'result' | 'error' | 'limitReached';

function ActionButton({
  onPress,
  style,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  style: object;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.85, { damping: 8, stiffness: 420 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 8, stiffness: 420 }); }}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <Animated.View style={[style, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}


// ── Seed track card — full screen modal ────────────────────────────────────────────
const { width: SEED_W, height: SEED_H } = Dimensions.get('window');
const SEED_CARD_W = SEED_W - 32;
const SEED_CARD_H = SEED_H * 0.64;

function SeedTrackCard({
  track,
  onSimilar,
  onBack,
}: {
  track: DeezerTrack;
  onSimilar: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { addLikedTrack, removeLikedTrack, likedTracks, incrementLiked } = useDeckStore();
  const isLiked = likedTracks.some((t) => t.id === track.id);
  const duration = track.duration ?? 0;
  const mins = Math.floor(duration / 60);
  const secs = String(duration % 60).padStart(2, '0');

  const handleLike = () => {
    if (isLiked) removeLikedTrack(track.id);
    else { addLikedTrack(track); incrementLiked(); }
  };

  return (
    <View style={[seedStyles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.md }]}>
      {/* Header row */}
      <View style={seedStyles.header}>
        <TouchableOpacity onPress={onBack} style={seedStyles.backBtn} activeOpacity={0.7}>
          <Ionicons name='chevron-back' size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={seedStyles.headerTitle} numberOfLines={1}>Recognized Song</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Card */}
      <View style={seedStyles.cardArea}>
        <View style={seedStyles.card}>
          {track.album.cover_xl ? (
            <Image source={{ uri: track.album.cover_xl }} style={seedStyles.albumArt} />
          ) : (
            <View style={[seedStyles.albumArt, seedStyles.albumArtFallback]} />
          )}
          <Svg style={StyleSheet.absoluteFill} width={SEED_CARD_W} height={SEED_CARD_H}>
            <Defs>
              <SvgGradient id='seedGrad' x1='0' y1='0' x2='0' y2='1'>
                <Stop offset='0.25' stopColor='#000' stopOpacity='0' />
                <Stop offset='0.60' stopColor='#1F1F28' stopOpacity='0.55' />
                <Stop offset='0.80' stopColor='#0D0D0D' stopOpacity='0.82' />
                <Stop offset='1'   stopColor='#0D0D0D' stopOpacity='0.97' />
              </SvgGradient>
            </Defs>
            <Rect x='0' y='0' width={SEED_CARD_W} height={SEED_CARD_H} fill='url(#seedGrad)' />
          </Svg>
          <View style={seedStyles.info}>
            <Text style={seedStyles.title} numberOfLines={2}>{track.title}</Text>
            <Text style={seedStyles.artist} numberOfLines={1}>{track.artist.name}</Text>
            {duration > 0 && (
              <Text style={seedStyles.album} numberOfLines={1}>
                {track.album.title} · {mins}:{secs}
              </Text>
            )}
            {track.preview ? <SnippetPlayer previewUrl={track.preview} /> : null}
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={seedStyles.actions}>
        <TouchableOpacity
          onPress={handleLike}
          style={[seedStyles.heartBtn, isLiked && seedStyles.heartBtnActive]}
          activeOpacity={0.75}
        >
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={28} color={isLiked ? COLORS.pink : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSimilar} style={seedStyles.simBtn} activeOpacity={0.85}>
          <Ionicons name='sparkles' size={17} color='#fff' />
          <Text style={seedStyles.simText}>Similar to this song</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const seedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SEED_CARD_W,
    height: SEED_CARD_H,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  albumArt: {
    ...StyleSheet.absoluteFillObject,
    width: SEED_CARD_W,
    height: SEED_CARD_H,
  },
  albumArtFallback: {
    backgroundColor: '#1F1F28',
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 18,
    gap: 5,
    backgroundColor: 'rgba(13,13,13,0.65)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.14)',
  },
  title: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  artist: {
    color: COLORS.cyan,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  album: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  heartBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  heartBtnActive: {
    backgroundColor: 'rgba(236,72,153,0.12)',
    borderColor: 'rgba(236,72,153,0.35)',
  },
  simBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.full,
    height: 64,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  simText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default function HearScreen() {
  const [stage, setStage] = useState<Stage>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<DeezerTrack[]>([]);
  const [seedTrack, setSeedTrack] = useState<DeezerTrack | null>(null);
  const [recQueue, setRecQueue] = useState<RecommendationCard[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsVisible, setRecsVisible] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<DeezerTrack | null>(null);
  const recognizedRef = useRef<{ title: string; artist: string } | null>(null);
  const deckRef = useRef<SwipeDeckRef>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const searchInputRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { addLikedTrack, addSkippedTrack, incrementLiked, incrementSkipped, likedTracks, artistSkipCounts } = useDeckStore();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const searchesRemaining = useSubscriptionStore((s) => s.searchesRemaining);
  const recordSearch = useSubscriptionStore((s) => s.recordSearch);
  const refreshDaily = useSubscriptionStore((s) => s.refreshDaily);

  // Pulse ring animation values
  const scale1 = useSharedValue(1);
  const opacity1 = useSharedValue(0);
  const scale2 = useSharedValue(1);
  const opacity2 = useSharedValue(0);

  // Reset state when leaving the tab; show limit modal on return if limit already hit
  useFocusEffect(
    useCallback(() => {
      // Refresh daily count — resets to 5 if it's a new day
      useSubscriptionStore.getState().refreshDaily().then(() => {
        const { searchesRemaining, isPro } = useSubscriptionStore.getState();
        if (searchesRemaining === 0 && !isPro) {
          setLimitModalVisible(true);
        }
      });
      return () => {
        setStage('idle');
        setResults([]);
        setSeedTrack(null);
        setSelectedTrack(null);
        setSearchQuery('');
        recognizedRef.current = null;
      };
    }, [])
  );

  // Close limit modal once bonus searches are granted
  useEffect(() => {
    if (searchesRemaining > 0) {
      setLimitModalVisible(false);
      setStage((s) => s === 'limitReached' ? 'idle' : s);
    }
  }, [searchesRemaining]);

  const isRecording = stage === 'recording';

  useEffect(() => {
    if (isRecording) {
      scale1.value = 1;
      opacity1.value = 0.7;
      scale1.value = withRepeat(withTiming(1.75, { duration: 1050 }), -1, false);
      opacity1.value = withRepeat(withTiming(0, { duration: 1050 }), -1, false);

      const t = setTimeout(() => {
        scale2.value = 1;
        opacity2.value = 0.45;
        scale2.value = withRepeat(withTiming(2.15, { duration: 1050 }), -1, false);
        opacity2.value = withRepeat(withTiming(0, { duration: 1050 }), -1, false);
      }, 525);
      return () => clearTimeout(t);
    } else {
      cancelAnimation(scale1);
      cancelAnimation(opacity1);
      cancelAnimation(scale2);
      cancelAnimation(opacity2);
      scale1.value = withTiming(1, { duration: 200 });
      opacity1.value = withTiming(0, { duration: 200 });
      scale2.value = withTiming(1, { duration: 200 });
      opacity2.value = withTiming(0, { duration: 200 });
    }
  }, [isRecording]);

  const pulse1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: opacity1.value,
  }));
  const pulse2Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: opacity2.value,
  }));

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setStage('error'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStage('recording');
    } catch {
      setStage('error');
    }
  };

  const stopRecording = async () => {
    Keyboard.dismiss();
    await recorder.stop();
    const uri = recorder.uri;
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!uri) { setStage('error'); return; }

    const { searchesRemaining: remaining, isPro: pro } = useSubscriptionStore.getState();
    if (!pro && remaining === 0) { setStage('limitReached'); return; }
    setStage('recognizing');
    try {
      const match = await recognizeSong(uri);
      if (!match) { setStage('error'); return; }
      const allowed = await recordSearch();
      if (!allowed) { setStage('limitReached'); return; }
      recognizedRef.current = match;
      setStage('searching');
      const tracks = await searchDeezer(`${match.title} ${match.artist}`, 5);
      if (tracks.length > 0) { setResults(tracks); setStage('result'); }
      else setStage('error');
    } catch {
      setStage('error');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || isBusy) return;
    Keyboard.dismiss();
    // Check limit before searching (without consuming the credit yet)
    const { searchesRemaining: remaining, isPro: pro } = useSubscriptionStore.getState();
    if (!pro && remaining === 0) { setStage('limitReached'); return; }
    recognizedRef.current = null;
    setStage('searching');
    try {
      const tracks = await searchDeezer(searchQuery, 5);
      if (tracks.length > 0) {
        // Only burn the credit once we have real results
        const allowed = await recordSearch();
        if (!allowed) { setStage('limitReached'); return; }
        setResults(tracks);
        setStage('result');
      } else {
        setStage('error');
      }
    } catch {
      setStage('error');
    }
  };

  const openRecs = async (track: DeezerTrack) => {
    setSeedTrack(track);
    const seed = recognizedRef.current ?? { title: track.title, artist: track.artist.name };
    setRecsLoading(true);
    setRecQueue([]);
    setRecsVisible(true);
    try {
      // Hear tab: only block tracks already in library, not all 500 seen-in-deck IDs.
      // seenTrackIds from the main deck over-filters and causes empty results.
      const seenIds = new Set<number>(likedTracks.map((t) => t.id));
      // Only filter artists the user has actively skipped 2+ times.
      // Liked artists should still appear — user wants similarity, not novelty.
      const skipFilteredKeys = new Set(
        Object.entries(artistSkipCounts)
          .filter(([, entry]) => entry.count >= 2)
          .map(([artist]) => artist)
      );
      const cards = await getSongSimilarRecs(seed.artist, seed.title, 15, seenIds, skipFilteredKeys, track.id);
      setRecQueue(cards);
    } catch (e) {
      console.log('[Recs] error:', e);
    } finally {
      setRecsLoading(false);
    }
  };

  const handleSwipeRight = useCallback((card: RecommendationCard) => {
    setRecQueue((q) => q.slice(1));
    addLikedTrack(card.track);
    incrementLiked();
  }, [addLikedTrack, incrementLiked]);

  const handleSwipeLeft = useCallback(() => {
    const track = recQueue[0]?.track;
    setRecQueue((q) => q.slice(1));
    incrementSkipped();
    if (track) addSkippedTrack(track);
  }, [recQueue, incrementSkipped, addSkippedTrack]);

  const closeRecs = () => {
    setRecsVisible(false);
    setRecQueue([]);
  };

  const isBusy = stage === 'searching' || stage === 'recognizing';
  const recsDone = !recsLoading && recQueue.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.titleBlock}>
        <View style={styles.eyebrow}>
          <Ionicons name="radio-outline" size={12} color={COLORS.cyan} />
          <Text style={styles.eyebrowText}>AUDIO RADAR</Text>
        </View>
        <GradientText fontSize={34} hPad={24}>Hear a Song</GradientText>
      </View>
      <Text style={styles.subtitle}>
        Record or type a song name to get recommendations
      </Text>


      {/* Record button with pulse rings */}
      <View style={styles.recordContainer}>
        <Animated.View style={[styles.pulseRing, pulse1Style]} />
        <Animated.View style={[styles.pulseRing, pulse2Style]} />
        <TouchableOpacity
          style={[styles.recordBtn, isRecording && styles.recordingActive]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isBusy}
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={46}
            color={isRecording ? COLORS.pink : COLORS.purple}
          />
          <Text style={[styles.recordLabel, isRecording && styles.recordLabelActive]}>
            {isRecording ? 'Tap to stop' : 'Tap to record'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or search manually</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Search row */}
      <View style={styles.searchRow}>
        <View style={styles.inputWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.input}
            placeholder="Song name or artist…"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            keyboardAppearance="dark"
          />
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, (!searchQuery.trim() || isBusy) && styles.searchBtnDisabled]}
          onPress={handleSearch}
          disabled={!searchQuery.trim() || isBusy}
          accessibilityLabel="Search"
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {isBusy && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.purple} size="small" />
          <Text style={styles.loadingText}>
            {stage === 'recognizing' ? 'Recognizing song…' : 'Searching…'}
          </Text>
        </View>
      )}

      {/* Results list */}
      {stage === 'result' && results.length > 0 && !selectedTrack && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsLabel}>Pick a song</Text>
          <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
            {results.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={styles.resultRow}
                onPress={() => setSelectedTrack(track)}
                activeOpacity={0.85}
              >
                <View style={styles.resultIconWrap}>
                  <Ionicons name="musical-note" size={16} color={COLORS.purple} />
                </View>
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.resultArtist} numberOfLines={1}>{track.artist.name}</Text>
                </View>
                <Ionicons name="sparkles" size={18} color={COLORS.purple} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Seed track card — full screen modal */}
      <Modal visible={!!selectedTrack} animationType="slide" statusBarTranslucent onRequestClose={() => setSelectedTrack(null)}>
        {selectedTrack && (
          <SeedTrackCard
            track={selectedTrack}
            onSimilar={() => { const t = selectedTrack; setSelectedTrack(null); openRecs(t); }}
            onBack={() => setSelectedTrack(null)}
          />
        )}
      </Modal>

      {/* Error */}
      {stage === 'error' && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.pink} />
          <Text style={styles.errorText}>Nothing found. Try a different search.</Text>
        </View>
      )}

      {/* Daily limit reached */}
      {stage === 'limitReached' && (
        <View style={styles.limitCard}>
          <View style={styles.limitIconWrap}>
            <Ionicons name="time-outline" size={28} color={COLORS.pink} />
          </View>
          <Text style={styles.limitTitle}>Daily limit reached</Text>
          <Text style={styles.limitSub}>You've used all your free searches for today.</Text>

          <TouchableOpacity
            style={styles.limitProBtn}
            onPress={() => router.push('/upgrade')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#A78BFA', '#E879F9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.limitProBtnGrad}
            >
              <Ionicons name="flash" size={15} color="#fff" />
              <Text style={styles.limitProBtnText}>Go Pro — Unlimited Searches</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.limitFooter}>Come back tomorrow for more free searches.</Text>
        </View>
      )}

      {/* Limit reached overlay (shown on re-focus, sits above screen content but below tab bar) */}
      {limitModalVisible && (
        <View style={styles.limitModalOverlay}>
          <View style={styles.limitModalCard}>
            <View style={styles.limitModalIconWrap}>
              <Ionicons name="time-outline" size={32} color={COLORS.pink} />
            </View>
            <Text style={styles.limitModalTitle}>No searches left</Text>
            <Text style={styles.limitModalSub}>
              You've used all your free searches for today.
            </Text>

            <TouchableOpacity
              style={styles.limitModalProBtn}
              onPress={() => { setLimitModalVisible(false); router.push('/upgrade'); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#A78BFA', '#E879F9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.limitModalProBtnGrad}
              >
                <Ionicons name="flash" size={15} color="#fff" />
                <Text style={styles.limitModalProBtnText}>Upgrade to Pro</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.limitModalFooter}>Come back tomorrow for more free searches.</Text>
          </View>
        </View>
      )}

      {/* Recommendations modal */}
      <Modal visible={recsVisible} animationType="slide" statusBarTranslucent onRequestClose={closeRecs}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              Similar to{' '}
              <Text style={{ color: COLORS.cyan }}>
                {recognizedRef.current?.title ?? seedTrack?.title}
              </Text>
            </Text>
            <TouchableOpacity onPress={closeRecs} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {recsLoading && (
            <View style={styles.modalCenter}>
              <ActivityIndicator color={COLORS.purple} size="large" />
              <Text style={styles.modalSubtext}>Finding similar songs…</Text>
            </View>
          )}

          {recsDone && (
            <View style={styles.modalCenter}>
              <View style={styles.doneIconWrap}>
                <Ionicons name="checkmark" size={36} color="#fff" />
              </View>
              <Text style={styles.modalDoneTitle}>That's all!</Text>
              <Text style={styles.modalSubtext}>Liked songs were saved to your library</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={closeRecs} activeOpacity={0.85}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {!recsLoading && recQueue.length > 0 && (
            <>
              <SwipeDeck
                ref={deckRef}
                queue={recQueue}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
              />
              <View style={[styles.actions, { paddingBottom: insets.bottom + SPACING.md }]}>
                <ActionButton
                  style={[styles.actionBtn, styles.skipBtn]}
                  onPress={() => deckRef.current?.swipeLeft()}
                  accessibilityLabel="Skip"
                >
                  <Ionicons name="close" size={30} color="#fff" />
                </ActionButton>
                <ActionButton
                  style={[styles.actionBtn, styles.likeBtn]}
                  onPress={() => deckRef.current?.swipeRight()}
                  accessibilityLabel="Like"
                >
                  <Ionicons name="heart" size={27} color="#000" />
                </ActionButton>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  titleBlock: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
    gap: 4,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eyebrowText: {
    color: COLORS.cyan,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  subtitle: {
    color: COLORS.textSub,
    fontSize: 15,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },

  recordContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 148,
    height: 148,
    marginBottom: SPACING.xl,
  },
  pulseRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2.5,
    borderColor: COLORS.pink,
  },
  recordBtn: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 2.5,
    borderColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  recordingActive: {
    borderColor: COLORS.pink,
    backgroundColor: COLORS.pinkBg,
    shadowColor: COLORS.pink,
  },
  recordLabel: { color: COLORS.textSub, fontSize: 13, fontWeight: '700' },
  recordLabelActive: { color: COLORS.pink },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, fontSize: 13 },

  searchRow: {
    flexDirection: 'row',
    width: '100%',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: { marginRight: SPACING.sm },
  input: {
    flex: 1,
    color: COLORS.text,
    paddingVertical: 14,
    fontSize: 15,
  },
  searchBtn: {
    width: 52,
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.purple,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  searchBtnDisabled: { opacity: 0.4 },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  loadingText: { color: COLORS.textSub, fontSize: 14 },

  resultsSection: {
    marginTop: SPACING.lg,
    width: '100%',
    flex: 1,
  },
  resultsLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  resultsList: {
    flex: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.20)',
    gap: SPACING.md,
  },
  resultIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { flex: 1, gap: 2 },
  resultTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  resultArtist: { color: COLORS.cyan, fontSize: 13, fontWeight: '600' },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  errorText: { color: COLORS.pink, fontSize: 15 },

  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: SPACING.md,
  },
  modalCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  doneIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.green,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  modalDoneTitle: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  modalSubtext: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center' },
  doneBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.purple,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    backgroundColor: COLORS.pink,
    ...GLOW.pink,
  },
  likeBtn: {
    backgroundColor: COLORS.green,
    ...GLOW.green,
  },

  // Search counter
  searchCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  searchCounterText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  // Limit reached card
  limitCard: {
    marginTop: SPACING.lg,
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.25)',
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.md,
  },
  limitIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(236,72,153,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  limitSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  limitAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.purple,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  limitAdBtnDisabled: {
    opacity: 0.5,
  },
  limitAdBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  limitProBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    width: '100%',
  },
  limitProBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  limitProBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  limitFooter: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },

  // Limit modal
  limitModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    zIndex: 99,
  },
  limitModalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.25)',
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  limitModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(236,72,153,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitModalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  limitModalSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  limitModalAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.purple,
    paddingVertical: 13,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    alignSelf: 'stretch',
    justifyContent: 'center',
    shadowColor: COLORS.purple,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  limitModalAdBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  limitModalProBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  limitModalProBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  limitModalProBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  limitModalFooter: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
