import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { useProfileStore } from '../../store/profileStore';

const NUM_H = 16;

interface Props {
  streak: number;
  /** Pass true only for the logged-in user's own profile indicator */
  animate?: boolean;
}

export function StreakIndicator({ streak, animate = false }: Props) {
  const streakAnimFrom = useProfileStore((s) => (animate ? s.streakAnimFrom : null));
  const clearStreakAnim = useProfileStore((s) => s.clearStreakAnim);

  const [displayed, setDisplayed] = useState(streak);
  const animatingRef = useRef(false);
  const slideY = useSharedValue(0);

  const slideIn = useCallback(
    (newStreak: number) => {
      setDisplayed(newStreak);
      slideY.value = NUM_H;
      slideY.value = withTiming(0, { duration: 200 });
      animatingRef.current = false;
    },
    [slideY],
  );

  // Animate when the store signals a streak increment
  useEffect(() => {
    if (!animate || streakAnimFrom === null || streak <= streakAnimFrom) return;

    clearStreakAnim();
    animatingRef.current = true;
    setDisplayed(streakAnimFrom); // show old number first

    slideY.value = 0;
    slideY.value = withTiming(-NUM_H, { duration: 200 }, (finished) => {
      if (finished) runOnJS(slideIn)(streak);
    });
  }, [animate, streakAnimFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep displayed in sync when not animating
  useEffect(() => {
    if (!animatingRef.current) {
      setDisplayed(streak);
    }
  }, [streak]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  if (streak < 1) return null;

  return (
    <View style={styles.pill}>
      <Ionicons name="flame" size={13} color={COLORS.orange} />
      <View style={styles.row}>
        <View style={styles.numClip}>
          <Animated.Text style={[styles.numText, animStyle]}>
            {displayed}
          </Animated.Text>
        </View>
        <Text style={styles.label}> day streak</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(253,186,116,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(253,186,116,0.22)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numClip: {
    height: NUM_H,
    minWidth: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  numText: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: NUM_H,
  },
  label: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: '700',
  },
});
