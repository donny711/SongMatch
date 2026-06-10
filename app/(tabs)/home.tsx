import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, Pressable, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import SwipeDeck, { SwipeDeckRef } from '../../src/components/SwipeDeck/SwipeDeck';
import SkeletonCard from '../../src/components/cards/SkeletonCard';
import { FeedSegment } from './people';
import { usePlayerStore } from '../../src/store/playerStore';
import { useDeckStore } from '../../src/store/deckStore';
import { useRecommendations } from '../../src/hooks/useRecommendations';
import { useSubscriptionStore } from '../../src/store/subscriptionStore';
import { useInterstitialAd } from '../../src/hooks/useInterstitialAd';
import { COLORS, SPACING, RADIUS, GLOW } from '../../src/theme';
import type { RecommendationCard } from '../../src/api/types';
import { lightTap } from '../../src/utils/haptics';
import { useTutorialMeasure } from '../../src/components/tutorial/TutorialMeasureContext';
import { useTutorialStore } from '../../src/store/tutorialStore';


type Tab = 'foryou' | 'friends';

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
      onPress={() => { lightTap(); onPress(); }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <Animated.View style={[style, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ── Search Limit Wall ─────────────────────────────────────────────────────────


// ── HomeScreen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const deckRef = useRef<SwipeDeckRef>(null);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('foryou');

  const {
    queue,
    shiftQueue,
    incrementLiked,
    incrementSkipped,
    addLikedTrack,
    addSkippedTrack,
    sourcePlaylist,
    recordSwipe,
    undoLastSwipe,
    lastSwipedCard,
  } = useDeckStore();
  const { isFetching, isShifting } = useRecommendations();
  const stopAudio = useCallback(() => usePlayerStore.getState().setActivePreviewUri(null), []);

  // Subscription
  const isPro = useSubscriptionStore((s) => s.isPro);

  // Interstitial
  const { status: interstitialStatus, show: showInterstitial } = useInterstitialAd();
  const prevFetchingRef = useRef(false);
  const batchCountRef = useRef(0); // skip interstitial on first load

  // Show interstitial each time a new batch loads
  useEffect(() => {
    if (prevFetchingRef.current && !isFetching && activeTab === 'foryou') {
      batchCountRef.current += 1;
      if (batchCountRef.current > 1 && !isPro && interstitialStatus === 'ready') {
        showInterstitial();
      }
    }
    prevFetchingRef.current = isFetching;
  }, [isFetching]);

  // ── Toast (liked feedback) ─────────────────────────────────
  const toastOpacity = useSharedValue(0);
  const toastY = useSharedValue(14);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLikedToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastOpacity.value = 0;
    toastY.value = 14;
    toastOpacity.value = withTiming(1, { duration: 170 });
    toastY.value = withSpring(0, { damping: 12, stiffness: 320 });
    toastTimeoutRef.current = setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 310 });
      toastY.value = withTiming(-12, { duration: 310 });
    }, 1050);
  }, []);

  const toastAnimStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastY.value }],
  }));

  // ── Undo button animation ─────────────────────────────────
  const undoOpacity = useSharedValue(0);
  const undoScale = useSharedValue(0.7);

  useEffect(() => {
    if (lastSwipedCard) {
      undoOpacity.value = withTiming(1, { duration: 240 });
      undoScale.value = withSpring(1, { damping: 13, stiffness: 260 });
    } else {
      undoOpacity.value = withTiming(0, { duration: 180 });
      undoScale.value = withTiming(0.7, { duration: 180 });
    }
  }, [lastSwipedCard]);

  const undoAnimStyle = useAnimatedStyle(() => ({
    opacity: undoOpacity.value,
    transform: [{ scale: undoScale.value }],
  }));

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };
  }, []);

  // ── Audio management ──────────────────────────────────────
  useFocusEffect(useCallback(() => () => stopAudio(), [stopAudio]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopAudio();
    });
    return () => sub.remove();
  }, [stopAudio]);

  // ── Swipe handlers ────────────────────────────────────────
  const handleSwipeRight = useCallback(
    (card: RecommendationCard) => {
      recordSwipe(card, 'like');
      shiftQueue();
      incrementLiked();
      addLikedTrack(card.track);
      showLikedToast();
    },
    [addLikedTrack, recordSwipe, showLikedToast]
  );

  const handleSwipeLeft = useCallback(() => {
    const card = useDeckStore.getState().queue[0];
    if (card) recordSwipe(card, 'skip');
    const track = card?.track;
    shiftQueue();
    incrementSkipped();
    if (track) addSkippedTrack(track);
  }, [addSkippedTrack, recordSwipe]);

  // Tutorial measurement refs
  const tabSwitcherRef = useRef<View>(null);
  const actionBtnRef = useRef<View>(null);
  const { register } = useTutorialMeasure();
  const tutorialActive = useTutorialStore((s) => s.isActive);
  const tutorialComplete = useTutorialStore((s) => s.isComplete);

  useEffect(() => {
    register('tab-switcher', tabSwitcherRef);
    register('action-buttons', actionBtnRef);
  }, [register]);

  useEffect(() => {
    if (tutorialComplete || tutorialActive || queue.length === 0) return;
    // Delay start so native layout has time to settle — prevents measureInWindow returning 0,0.
    const timer = setTimeout(() => useTutorialStore.getState().start(), 600);
    return () => clearTimeout(timer);
  }, [tutorialComplete, queue.length, tutorialActive]);

  const isEmpty = !isFetching && queue.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* TikTok-style tab switcher */}
      <View style={styles.tabSwitcher} ref={tabSwitcherRef}>

        {(['foryou', 'friends'] as Tab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'foryou' ? 'For You' : 'Friends';
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabBtn}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                {label}
              </Text>
              {isActive && (
                <LinearGradient
                  colors={['#A78BFA', '#E879F9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabUnderline}
                />
              )}
            </TouchableOpacity>
          );
        })}

      </View>

      {/* Friends feed */}
      {activeTab === 'friends' && (
        <View style={styles.feedContainer}>
          <FeedSegment />
        </View>
      )}

      {/* For You content */}
      {activeTab === 'foryou' && (
        <>
          <>
              {/* Source playlist pill */}
              {sourcePlaylist && (
                <View style={styles.header}>
                  <View style={styles.seedPill}>
                    <Ionicons name="musical-notes" size={12} color={COLORS.purple} />
                    <Text style={styles.seedText}>{sourcePlaylist.name}</Text>
                  </View>
                </View>
              )}

              {/* Loading — skeleton card */}
              {isFetching && queue.length === 0 && (
                <View style={styles.centeredState}>
                  <SkeletonCard />
                  <Text style={styles.stateText}>
                    {isShifting ? 'Exploring new sounds…' : 'Finding your next favourites…'}
                  </Text>
                </View>
              )}

              {/* Empty */}
              {isEmpty && (
                <View style={styles.centeredState}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="musical-notes-outline" size={36} color={COLORS.purple} />
                  </View>
                  <Text style={styles.stateTitle}>All caught up!</Text>
                  <Text style={styles.stateText}>More picks are on their way…</Text>
                </View>
              )}

              {/* Swipe deck */}
              {queue.length > 0 && (
                <SwipeDeck
                  ref={deckRef}
                  queue={queue}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                />
              )}

              {/* Liked toast */}
              <Animated.View
                style={[styles.toastContainer, toastAnimStyle, { bottom: 132 + insets.bottom }]}
                pointerEvents="none"
              >
                <View style={styles.toast}>
                  <Ionicons name="heart" size={14} color="#000" />
                  <Text style={styles.toastText}>Liked!</Text>
                </View>
              </Animated.View>

              {/* Action buttons */}
              {queue.length > 0 && (
                <View ref={actionBtnRef} style={[styles.actions, { paddingBottom: SPACING.lg }]}>
                  <ActionButton
                    style={[styles.actionBtn, styles.skipBtn]}
                    onPress={() => deckRef.current?.swipeLeft()}
                    accessibilityLabel="Skip song"
                  >
                    <Ionicons name="close" size={30} color="#0D0D0D" />
                  </ActionButton>

                  <Animated.View style={[styles.undoBtnWrap, undoAnimStyle]}>
                    <Pressable
                      onPress={lastSwipedCard ? undoLastSwipe : undefined}
                      disabled={!lastSwipedCard}
                      style={styles.undoBtn}
                      accessibilityLabel="Undo last swipe"
                      accessibilityRole="button"
                    >
                      <Ionicons name="arrow-undo-circle" size={30} color={COLORS.cyan} />
                    </Pressable>
                  </Animated.View>

                  <ActionButton
                    style={[styles.actionBtn, styles.likeBtn]}
                    onPress={() => deckRef.current?.swipeRight()}
                    accessibilityLabel="Like song"
                  >
                    <Ionicons name="heart" size={27} color="#000" />
                  </ActionButton>
                </View>
              )}
          </>

        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // TikTok tab switcher
  tabSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: 2,
    gap: SPACING.xl,
    alignItems: 'center',
  },
  tabBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: 6,
  },
  tabBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: -0.3,
  },
  tabBtnTextActive: {
    color: COLORS.text,
  },
  tabUnderline: {
    height: 2.5,
    width: '80%',
    borderRadius: RADIUS.full,
  },

  // Search pill
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'absolute',
    right: SPACING.lg,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  searchPillText: {
    color: COLORS.purple,
    fontSize: 11,
    fontWeight: '700',
  },

  feedContainer: { flex: 1 },

  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: 6,
  },
  seedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  seedText: { color: COLORS.purple, fontSize: 12, fontWeight: '700' },

  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.30)',
  },
  stateTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  stateText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Toast
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowColor: COLORS.green,
    shadowOpacity: 0.50,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  toastText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
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
    backgroundColor: '#EDEDF2',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  likeBtn: {
    backgroundColor: COLORS.green,
    ...GLOW.green,
  },

  // Undo button
  undoBtnWrap: {
    width: 52,
    height: 52,
  },
  undoBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.30)',
  },

});
