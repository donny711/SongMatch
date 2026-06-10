import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import SwipeCard, { SwipeCardRef } from './SwipeCard';
import TrackCard from '../cards/TrackCard';
import type { RecommendationCard } from '../../api/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  queue: RecommendationCard[];
  onSwipeLeft: () => void;
  onSwipeRight: (card: RecommendationCard) => void;
}

export interface SwipeDeckRef {
  swipeLeft: () => void;
  swipeRight: () => void;
}

const SwipeDeck = forwardRef<SwipeDeckRef, Props>(({ queue, onSwipeLeft, onSwipeRight }, ref) => {
  const topCardRef = useRef<SwipeCardRef>(null);
  const swipeProgress = useSharedValue(0);

  // Warm the disk cache for upcoming cards so album art is instant when
  // they surface. Only the top 2 render; prefetch the next 3 behind them.
  useEffect(() => {
    const urls = queue
      .slice(2, 5)
      .map((c) => c.track?.album?.cover_xl)
      .filter((u): u is string => !!u);
    if (urls.length > 0) ExpoImage.prefetch(urls, { cachePolicy: 'disk' });
  }, [queue]);

  useImperativeHandle(ref, () => ({
    swipeLeft: () => topCardRef.current?.swipeLeft(),
    swipeRight: () => topCardRef.current?.swipeRight(),
  }));

  const bgCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(swipeProgress.value),
      [0, SCREEN_WIDTH / 2],
      [0.91, 1.0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      Math.abs(swipeProgress.value),
      [0, SCREEN_WIDTH / 2],
      [22, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      Math.abs(swipeProgress.value),
      [0, SCREEN_WIDTH / 3],
      [0.70, 1.0],
      Extrapolation.CLAMP
    );
    return { transform: [{ scale }, { translateY }], opacity };
  });

  if (queue.length === 0) return null;

  return (
    <View style={styles.container}>
      {queue.slice(0, 2).reverse().map((card, reversedIndex) => {
        const index = queue.slice(0, 2).length - 1 - reversedIndex;
        const isTop = index === 0;
        if (isTop) {
          return (
            <SwipeCard
              key={`${card.track?.id}-top`}
              ref={topCardRef}
              isTop
              swipeProgress={swipeProgress}
              onSwipeLeft={onSwipeLeft}
              onSwipeRight={() => onSwipeRight(card)}
            >
              <TrackCard card={card} isTop />
            </SwipeCard>
          );
        }
        return (
          <Animated.View key={`${card.track?.id}-bg`} style={[styles.card, bgCardStyle]}>
            <TrackCard card={card} />
          </Animated.View>
        );
      })}
    </View>
  );
});

SwipeDeck.displayName = 'SwipeDeck';
export default SwipeDeck;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});
