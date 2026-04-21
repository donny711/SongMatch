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
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { searchDeezer } from '../../src/api/deezerClient';
import { recognizeSong } from '../../src/api/auddClient';
import { getSongSimilarRecs } from '../../src/api/endpoints';
import { useDeckStore } from '../../src/store/deckStore';
import { useSubscriptionStore } from '../../src/store/subscriptionStore';
import { useSearchBonusAd } from '../../src/hooks/useSearchBonusAd';
import SwipeDeck, { SwipeDeckRef } from '../../src/components/SwipeDeck/SwipeDeck';
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

export default function HearScreen() {
  const [stage, setStage] = useState<Stage>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<DeezerTrack[]>([]);
  const [seedTrack, setSeedTrack] = useState<DeezerTrack | null>(null);
  const [recQueue, setRecQueue] = useState<RecommendationCard[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsVisible, setRecsVisible] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const recognizedRef = useRef<{ title: string; artist: string } | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const deckRef = useRef<SwipeDeckRef>(null);
  const searchInputRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { addLikedTrack, addSkippedTrack, incrementLiked, incrementSkipped, likedTracks, seenTrackIds, artistSkipCounts } = useDeckStore();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const searchesRemaining = useSubscriptionStore((s) => s.searchesRemaining);
  const dailyBonusGranted = useSubscriptionStore((s) => s.dailyBonusGranted);
  const recordSearch = useSubscriptionStore((s) => s.recordSearch);
  const refreshDaily = useSubscriptionStore((s) => s.refreshDaily);
  const { status: adStatus, show: showAd } = useSearchBonusAd();

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
        setSearchQuery('');
        recognizedRef.current = null;
      };
    }, [])
  );

  // Close limit modal once bonus searches are granted
  useEffect(() => {
    if (limitModalVisible && searchesRemaining > 0) {
      setLimitModalVisible(false);
    }
  }, [searchesRemaining, limitModalVisible]);

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
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setStage('error'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setStage('recording');
    } catch {
      setStage('error');
    }
  };

  const stopRecording = async () => {
    Keyboard.dismiss();
    const recording = recordingRef.current;
    recordingRef.current = null;
    const uri = recording?.getURI();
    await recording?.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    if (!uri) { setStage('error'); return; }

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
    const allowed = await recordSearch();
    if (!allowed) { setStage('limitReached'); return; }
    recognizedRef.current = null;
    setStage('searching');
    try {
      const tracks = await searchDeezer(searchQuery, 5);
      if (tracks.length > 0) { setResults(tracks); setStage('result'); }
      else setStage('error');
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
      const seenIds = new Set<number>([
        ...likedTracks.map((t) => t.id),
        ...seenTrackIds,
      ]);
      const likedArtistKeys = new Set(likedTracks.map((t) => t.artist.name.toLowerCase()));
      const skipFilteredKeys = new Set(
        Object.entries(artistSkipCounts)
          .filter(([, count]) => count >= 2)
          .map(([artist]) => artist)
      );
      const filteredArtistKeys = new Set([...likedArtistKeys, ...skipFilteredKeys]);
      const cards = await getSongSimilarRecs(seed.artist, seed.title, 15, seenIds, filteredArtistKeys);
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

      {!isPro && (
        <View style={styles.searchCounterRow}>
          <Ionicons name="search" size={13} color={searchesRemaining === 0 ? COLORS.pink : COLORS.textMuted} />
          <Text style={[styles.searchCounterText, searchesRemaining === 0 && { color: COLORS.pink }]}>
            {searchesRemaining} search{searchesRemaining !== 1 ? 'es' : ''} left today
          </Text>
        </View>
      )}

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
      {stage === 'result' && results.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsLabel}>Pick a song</Text>
          <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
            {results.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={styles.resultRow}
                onPress={() => openRecs(track)}
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
          <Text style={styles.limitSub}>You've used all 5 free searches for today.</Text>

          {!isPro && !dailyBonusGranted && (
            <TouchableOpacity
              style={[styles.limitAdBtn, adStatus !== 'ready' && styles.limitAdBtnDisabled]}
              onPress={showAd}
              disabled={adStatus !== 'ready'}
              activeOpacity={0.85}
            >
              <Ionicons name="play-circle-outline" size={18} color="#fff" />
              <Text style={styles.limitAdBtnText}>
                {adStatus === 'ready' ? 'Watch ad for +2 searches' : 'Loading ad…'}
              </Text>
            </TouchableOpacity>
          )}

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

          {dailyBonusGranted && (
            <Text style={styles.limitFooter}>Come back tomorrow for 5 more free searches.</Text>
          )}
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

            {!isPro && !dailyBonusGranted && (
              <TouchableOpacity
                style={[styles.limitModalAdBtn, adStatus !== 'ready' && styles.limitAdBtnDisabled]}
                onPress={() => { setLimitModalVisible(false); showAd(); }}
                disabled={adStatus !== 'ready'}
                activeOpacity={0.85}
              >
                <Ionicons name="play-circle-outline" size={18} color="#fff" />
                <Text style={styles.limitModalAdBtnText}>
                  {adStatus === 'ready' ? 'Watch a short ad for +2 searches' : 'Loading ad…'}
                </Text>
              </TouchableOpacity>
            )}

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

            {dailyBonusGranted && (
              <Text style={styles.limitModalFooter}>Come back tomorrow for more free searches.</Text>
            )}
          </View>
        </View>
      )}

      {/* Recommendations modal */}
      <Modal visible={recsVisible} animationType="slide" statusBarTranslucent>
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
