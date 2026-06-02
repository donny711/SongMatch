import React, { useImperativeHandle, forwardRef, useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SWIPE_THRESHOLD, SWIPE_VELOCITY_THRESHOLD } from '../../utils/constants';
import SwipeIndicators from './SwipeIndicators';
import { swipeConfirm } from '../../utils/haptics';
import { usePlayerStore } from '../../store/playerStore';

function stopCurrentAudio() {
  usePlayerStore.getState().setActivePreviewUri(null);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SwipeCardRef {
  swipeLeft: () => void;
  swipeRight: () => void;
}

interface Props {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isTop: boolean;
  swipeProgress?: SharedValue<number>;
}

const SwipeCard = forwardRef<SwipeCardRef, Props>(
  ({ children, onSwipeLeft, onSwipeRight, isTop, swipeProgress }, ref) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    // Entry animation: start from background card's resting position
    // (matches bgCardStyle values in SwipeDeck at swipeProgress=0)
    const entryScale = useSharedValue(0.91);
    const entryTranslateY = useSharedValue(22);
    const entryOpacity = useSharedValue(0.70);

    useEffect(() => {
      const cfg = { damping: 14, stiffness: 200, mass: 0.85 };
      entryScale.value = withSpring(1, cfg);
      entryTranslateY.value = withSpring(0, cfg);
      entryOpacity.value = withTiming(1, { duration: 220 });
    }, []);

    const flyOut = (direction: 'left' | 'right', callback: () => void) => {
      'worklet';
      runOnJS(swipeConfirm)();
      runOnJS(stopCurrentAudio)();
      translateX.value = withSpring(
        direction === 'right' ? SCREEN_WIDTH * 1.6 : -SCREEN_WIDTH * 1.6,
        { damping: 22, stiffness: 200, mass: 0.9 },
        () => runOnJS(callback)()
      );
    };

    useImperativeHandle(ref, () => ({
      swipeLeft: () => { stopCurrentAudio(); flyOut('left', onSwipeLeft); },
      swipeRight: () => { stopCurrentAudio(); flyOut('right', onSwipeRight); },
    }));

    const pan = Gesture.Pan()
      .enabled(isTop)
      .onChange((e) => {
        translateX.value = e.translationX;
        translateY.value = e.translationY * 0.12;
        if (swipeProgress !== undefined) {
          swipeProgress.value = e.translationX;
        }
      })
      .onEnd((e) => {
        const shouldSwipeRight =
          e.translationX > SWIPE_THRESHOLD || e.velocityX > SWIPE_VELOCITY_THRESHOLD;
        const shouldSwipeLeft =
          e.translationX < -SWIPE_THRESHOLD || e.velocityX < -SWIPE_VELOCITY_THRESHOLD;

        if (shouldSwipeRight) {
          flyOut('right', onSwipeRight);
        } else if (shouldSwipeLeft) {
          flyOut('left', onSwipeLeft);
        } else {
          // Bouncy snap-back
          translateX.value = withSpring(0, { damping: 10, stiffness: 220, mass: 0.8 });
          translateY.value = withSpring(0, { damping: 10, stiffness: 220, mass: 0.8 });
          if (swipeProgress !== undefined) {
            swipeProgress.value = withSpring(0, { damping: 10, stiffness: 220, mass: 0.8 });
          }
        }
      });

    const animatedStyle = useAnimatedStyle(() => {
      const rotate = interpolate(
        translateX.value,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-20, 0, 20],
        Extrapolation.CLAMP
      );
      const gestureScale = interpolate(
        Math.abs(translateX.value),
        [0, SCREEN_WIDTH / 3],
        [1, 1.05],
        Extrapolation.CLAMP
      );
      return {
        opacity: entryOpacity.value,
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value + entryTranslateY.value },
          { rotate: `${rotate}deg` },
          { scale: gestureScale * entryScale.value },
        ],
      };
    });

    const likeOpacity = useAnimatedStyle(() => ({
      opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    }));

    const nopeOpacity = useAnimatedStyle(() => ({
      opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    }));

    return (
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, animatedStyle]}>
          <SwipeIndicators likeStyle={likeOpacity} nopeStyle={nopeOpacity} />
          {children}
        </Animated.View>
      </GestureDetector>
    );
  }
);

SwipeCard.displayName = 'SwipeCard';
export default SwipeCard;

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});
