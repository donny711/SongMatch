import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileStore } from '../../store/profileStore';
import { COLORS, RADIUS, SPACING } from '../../theme';

const { width: W, height: H } = Dimensions.get('window');

// ── Confetti (deterministic pseudo-random from index) ────────────────────────
const C_COLORS = [
  '#A78BFA', '#C4B5FD', '#E879F9', '#7C3AED',
  '#EDE9FE', '#4C1D95', '#FDBA74', '#A78BFA',
  '#C4B5FD', '#E879F9', '#7C3AED', '#EDE9FE',
];

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  color: C_COLORS[i % C_COLORS.length],
  w: 5 + (i * 2.3) % 9,
  h: 3 + (i * 1.9) % 7,
  x: (W / 40) * i + ((i % 5) - 2) * 18,
  delay: (i * 55) % 750,
  dur: 1600 + (i * 127) % 800,
  driftX: ((i % 9) - 4) * 22,
  rot: ((i % 11) - 5) * 140,
  round: i % 5 === 0,
}));

const Particle = memo(({ p }: { p: (typeof PARTICLES)[0] }) => {
  const y = useSharedValue(-p.h - 10);
  const x = useSharedValue(p.x);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      p.delay,
      withSequence(
        withTiming(0.88, { duration: 80 }),
        withTiming(0.88, { duration: p.dur - 280 }),
        withTiming(0, { duration: 200 }),
      ),
    );
    y.value = withDelay(p.delay, withTiming(H + 50, {
      duration: p.dur,
      easing: Easing.in(Easing.poly(1.4)),
    }));
    x.value = withDelay(p.delay, withTiming(p.x + p.driftX, { duration: p.dur }));
    rotate.value = withDelay(p.delay, withTiming(p.rot, { duration: p.dur }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: p.w,
          height: p.round ? p.w : p.h,
          backgroundColor: p.color,
          borderRadius: p.round ? p.w / 2 : 2,
        },
        style,
      ]}
    />
  );
});

// ── Tagline ───────────────────────────────────────────────────────────────────
function tagline(streak: number): string {
  if (streak <= 1) return 'Your streak begins!';
  if (streak < 7) return 'Keep it up!';
  if (streak === 7) return 'One week strong!';
  if (streak < 14) return "You're on fire!";
  if (streak === 14) return 'Two weeks devoted!';
  if (streak < 30) return 'Unstoppable!';
  return 'A whole month of music!';
}

// ── Daily flame variant ───────────────────────────────────────────────────────
type FlameVariant = 'A' | 'B' | 'C' | 'D';

function getDailyVariant(): FlameVariant {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const variants: FlameVariant[] = ['A', 'B', 'C', 'D'];
  return variants[seed % 4];
}

const DAILY_VARIANT = getDailyVariant();

// ── Main component ────────────────────────────────────────────────────────────
const NUM_H = 90;

export function StreakCelebration() {
  const streakAnimFrom = useProfileStore((s) => s.streakAnimFrom);
  const currentStreak = useProfileStore((s) => s.currentStreak);
  const clearStreakAnim = useProfileStore((s) => s.clearStreakAnim);
  const insets = useSafeAreaInsets();

  const fromRef = useRef(streakAnimFrom ?? currentStreak);
  const [displayed, setDisplayed] = useState(fromRef.current);

  const visible = streakAnimFrom !== null && currentStreak > streakAnimFrom;
  if (visible) console.log('[StreakCelebration] visible=true', { streakAnimFrom, currentStreak });

  // Shared values
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.86);
  const flameScale = useSharedValue(1);
  const flameRotate = useSharedValue(0);
  const flameTranslateY = useSharedValue(0);
  const numY = useSharedValue(0);

  const rollIn = useCallback(
    (n: number) => {
      setDisplayed(n);
      numY.value = NUM_H;
      numY.value = withSpring(0, { damping: 12, stiffness: 210 });
    },
    [numY],
  );

  const doClose = useCallback(() => {
    clearStreakAnim();
  }, [clearStreakAnim]);

  const dismiss = useCallback(() => {
    flameScale.value = withTiming(1, { duration: 150 });
    flameRotate.value = withTiming(0, { duration: 150 });
    flameTranslateY.value = withTiming(0, { duration: 150 });
    contentOpacity.value = withTiming(0, { duration: 260 }, (finished) => {
      if (finished) runOnJS(doClose)();
    });
  }, [contentOpacity, flameScale, flameRotate, flameTranslateY, doClose]);

  useEffect(() => {
    if (!visible) return;

    fromRef.current = streakAnimFrom!;
    setDisplayed(streakAnimFrom!);

    // Reset
    contentOpacity.value = 0;
    contentScale.value = 0.86;
    flameScale.value = 1;
    flameRotate.value = 0;
    flameTranslateY.value = 0;
    numY.value = 0;

    // Content enters
    contentOpacity.value = withDelay(60, withTiming(1, { duration: 340 }));
    contentScale.value = withDelay(60, withSpring(1, { damping: 13, stiffness: 170 }));

    // Flame animation — variant chosen once per day
    if (DAILY_VARIANT === 'A') {
      // Slow soft breathe
      flameScale.value = withDelay(500, withRepeat(
        withSequence(
          withTiming(0.9, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ), -1, false,
      ));
    } else if (DAILY_VARIANT === 'B') {
      // Bouncy spring
      flameScale.value = withDelay(500, withRepeat(
        withSequence(
          withTiming(0.85, { duration: 500, easing: Easing.out(Easing.ease) }),
          withTiming(1.12, { duration: 500, easing: Easing.out(Easing.ease) }),
        ), -1, false,
      ));
      flameTranslateY.value = withDelay(500, withRepeat(
        withSequence(
          withTiming(4, { duration: 500 }),
          withTiming(-4, { duration: 500 }),
        ), -1, false,
      ));
    } else if (DAILY_VARIANT === 'C') {
      // Wobble side to side
      flameRotate.value = withDelay(500, withRepeat(
        withSequence(
          withTiming(-6, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) }),
          withTiming(6, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        ), -1, false,
      ));
      flameScale.value = withDelay(500, withRepeat(
        withSequence(
          withTiming(1.0, { duration: 400 }),
          withTiming(1.05, { duration: 200 }),
          withTiming(1.0, { duration: 400 }),
          withTiming(1.05, { duration: 200 }),
        ), -1, false,
      ));
    } else {
      // D — heartbeat double-pulse
      flameScale.value = withDelay(500, withRepeat(
        withSequence(
          withTiming(1.15, { duration: 196, easing: Easing.out(Easing.ease) }),
          withTiming(0.95, { duration: 196, easing: Easing.in(Easing.ease) }),
          withTiming(1.12, { duration: 196, easing: Easing.out(Easing.ease) }),
          withTiming(1.0, { duration: 392, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 420 }),
        ), -1, false,
      ));
    }

    // Number rolls up to new value after a beat
    numY.value = withDelay(680, withTiming(-NUM_H, { duration: 220 }, (finished) => {
      if (finished) runOnJS(rollIn)(currentStreak);
    }));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: flameScale.value },
      { rotate: `${flameRotate.value}deg` },
      { translateY: flameTranslateY.value },
    ],
  }));

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: numY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="none" statusBarTranslucent>
      {/* Background */}
      <LinearGradient
        colors={['#0D0D0D', '#1E0A3C', '#0D0D0D']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Confetti */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {PARTICLES.map((p) => (
          <Particle key={p.id} p={p} />
        ))}
      </View>

      {/* Main content */}
      <Animated.View style={[styles.content, contentStyle]}>
        {/* Flame */}
        <View style={styles.flameGlow}>
          <Animated.Text style={[styles.flameEmoji, flameStyle]}>
            🔥
          </Animated.Text>
        </View>

        {/* Animated number */}
        <View style={styles.numClip}>
          <Animated.Text style={[styles.numText, numStyle]}>
            {displayed}
          </Animated.Text>
        </View>

        <Text style={styles.streakLabel}>DAY STREAK</Text>
        <Text style={styles.taglineText}>{tagline(currentStreak)}</Text>
      </Animated.View>

      {/* Continue button pinned to bottom */}
      <Animated.View
        style={[
          styles.btnWrap,
          { bottom: insets.bottom + SPACING.xl },
          contentStyle,
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={dismiss}
        >
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  flameGlow: {
    marginBottom: SPACING.xl,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 40,
    shadowOpacity: 0.7,
  },
  flameEmoji: {
    fontSize: 96,
    lineHeight: 110,
  },
  numClip: {
    height: NUM_H,
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  numText: {
    fontSize: 82,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: NUM_H,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.orange,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
  },
  taglineText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textSub,
    textAlign: 'center',
  },
  btnWrap: {
    position: 'absolute',
    left: SPACING.xl,
    right: SPACING.xl,
    alignItems: 'stretch',
  },
  btn: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.full,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: COLORS.purple,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 6,
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.4,
  },
});
