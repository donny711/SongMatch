import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { SHOP_ITEMS_BY_ID, type ShopItem } from '../../data/shopCatalog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  backgroundId: string | null;
  height: number;
}

// ── Sweep (Common) ─────────────────────────────────────────────────────────────
// A wide gradient slowly pans left/right — subtle and premium.
function SweepBackground({ item, height }: { item: ShopItem; height: number }) {
  const tx = useSharedValue(0);

  useFocusEffect(
    React.useCallback(() => {
      tx.value = withRepeat(
        withSequence(
          withTiming(-SCREEN_WIDTH * 0.35, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
      return () => {
        cancelAnimation(tx);
        tx.value = 0;
      };
    }, []),
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const colors = (
    item.colors.length >= 2 ? item.colors : [item.colors[0], item.colors[0]]
  ) as [string, string, ...string[]];

  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden' }}>
      <Animated.View style={[{ width: SCREEN_WIDTH * 1.35, height }, animStyle]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

// ── Wave bar ───────────────────────────────────────────────────────────────────
function WaveBar({
  phase,
  progress,
  barWidth,
  gap,
  maxH,
  minH,
  color,
  opacity,
}: {
  phase: number;
  progress: SharedValue<number>;
  barWidth: number;
  gap: number;
  maxH: number;
  minH: number;
  color: string;
  opacity: number;
}) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const t = progress.value * Math.PI * 2 + phase;
    const norm = (Math.sin(t) + 1) / 2;
    return { height: minH + norm * (maxH - minH) };
  });

  return (
    <Animated.View
      style={[
        {
          width: barWidth,
          marginRight: gap,
          borderTopLeftRadius: barWidth / 2,
          borderTopRightRadius: barWidth / 2,
          backgroundColor: color,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ── Wave (Rare) ────────────────────────────────────────────────────────────────
// Live audio waveform bars on a near-black base.
function WaveBackground({ item, height }: { item: ShopItem; height: number }) {
  const progress = useSharedValue(0);

  useFocusEffect(
    React.useCallback(() => {
      progress.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.linear }),
        -1,
      );
      return () => {
        cancelAnimation(progress);
        progress.value = 0;
      };
    }, []),
  );

  const BAR_COUNT = 32;
  const BAR_WIDTH = 3;
  const BAR_GAP = (SCREEN_WIDTH - BAR_COUNT * BAR_WIDTH) / (BAR_COUNT + 1);

  const bars = React.useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => ({
        phase: (i / BAR_COUNT) * Math.PI * 2,
        color: item.colors[i % item.colors.length],
        opacity: 0.45 + (i % 3) * 0.18,
      })),
    [],
  );

  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden' }}>
      <LinearGradient colors={['#0D0D0D', '#1F1F28']} style={StyleSheet.absoluteFill} />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: BAR_GAP,
          right: 0,
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}
      >
        {bars.map((b, i) => (
          <WaveBar
            key={i}
            phase={b.phase}
            progress={progress}
            barWidth={BAR_WIDTH}
            gap={BAR_GAP}
            maxH={height * 0.72}
            minH={height * 0.1}
            color={b.color}
            opacity={b.opacity}
          />
        ))}
      </View>
    </View>
  );
}

// ── Float orb ─────────────────────────────────────────────────────────────────
function FloatOrb({
  x,
  y,
  size,
  color,
  driftX,
  driftY,
  duration,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  driftX: number;
  driftY: number;
  duration: number;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);

  useFocusEffect(
    React.useCallback(() => {
      tx.value = withRepeat(
        withSequence(
          withTiming(driftX, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
      ty.value = withRepeat(
        withSequence(
          withTiming(driftY, { duration: duration * 0.85, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duration * 0.85, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
      sc.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.86, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
      return () => {
        cancelAnimation(tx);
        cancelAnimation(ty);
        cancelAnimation(sc);
        tx.value = 0;
        ty.value = 0;
        sc.value = 1;
      };
    }, []),
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.2,
        },
        style,
      ]}
    />
  );
}

// ── Float (Rare) ───────────────────────────────────────────────────────────────
// Soft oversized orbs drift slowly — blurry bokeh feel.
function FloatBackground({ item, height }: { item: ShopItem; height: number }) {
  // colors[0] is the dark base, colors[1..] are the orb colors
  const darkBase = item.colors[0];
  const orbColors = item.colors.slice(1).length > 0 ? item.colors.slice(1) : item.colors;

  const orbs = React.useMemo(
    () => [
      { x: SCREEN_WIDTH * 0.15, y: height * 0.35, size: height * 1.1, color: orbColors[0],                    driftX: 18,  driftY: -12, duration: 7000 },
      { x: SCREEN_WIDTH * 0.78, y: height * 0.6,  size: height * 0.95, color: orbColors[1] ?? orbColors[0],   driftX: -22, driftY: 10,  duration: 8500 },
      { x: SCREEN_WIDTH * 0.5,  y: height * 0.1,  size: height * 0.7,  color: orbColors[0],                   driftX: 14,  driftY: 18,  duration: 6200 },
      { x: SCREEN_WIDTH * 0.88, y: height * 0.15, size: height * 0.55, color: orbColors[1] ?? orbColors[0],   driftX: -10, driftY: 22,  duration: 9000 },
      { x: SCREEN_WIDTH * 0.25, y: height * 0.85, size: height * 0.65, color: orbColors[0],                   driftX: 20,  driftY: -8,  duration: 7800 },
    ],
    [],
  );

  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden' }}>
      <LinearGradient
        colors={[darkBase, '#0D0D0D']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {orbs.map((orb, i) => (
        <FloatOrb key={i} {...orb} />
      ))}
    </View>
  );
}

// ── Combo (Legendary) ─────────────────────────────────────────────────────────
// Slow sweep base + waveform overlay.
function ComboBackground({ item, height }: { item: ShopItem; height: number }) {
  const progress = useSharedValue(0);
  const tx = useSharedValue(0);
  const isInferno = item.id.includes('inferno');

  useFocusEffect(
    React.useCallback(() => {
      progress.value = withRepeat(
        withTiming(1, { duration: isInferno ? 1200 : 1800, easing: Easing.linear }),
        -1,
      );
      tx.value = withRepeat(
        withSequence(
          withTiming(-SCREEN_WIDTH * 0.2, { duration: 12000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 12000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
      return () => {
        cancelAnimation(progress);
        cancelAnimation(tx);
        progress.value = 0;
        tx.value = 0;
      };
    }, []),
  );

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const BAR_COUNT = 36;
  const BAR_WIDTH = 2.5;
  const BAR_GAP = (SCREEN_WIDTH - BAR_COUNT * BAR_WIDTH) / (BAR_COUNT + 1);

  // colors[0] and [1] are the base sweep; [2..] go to bars
  const baseColors = [item.colors[0], item.colors[1] ?? item.colors[0]] as [string, string];
  const barColors = item.colors.length > 2 ? item.colors.slice(2) : item.colors;

  const bars = React.useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => ({
        phase: (i / BAR_COUNT) * Math.PI * 2,
        color: barColors[i % barColors.length],
        opacity: 0.38 + (i % 4) * 0.12,
      })),
    [],
  );

  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden' }}>
      <Animated.View style={[{ width: SCREEN_WIDTH * 1.2, height }, sweepStyle]}>
        <LinearGradient
          colors={baseColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: BAR_GAP,
          right: 0,
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}
      >
        {bars.map((b, i) => (
          <WaveBar
            key={i}
            phase={b.phase}
            progress={progress}
            barWidth={BAR_WIDTH}
            gap={BAR_GAP}
            maxH={height * (isInferno ? 0.62 : 0.52)}
            minH={height * 0.08}
            color={b.color}
            opacity={b.opacity}
          />
        ))}
      </View>
    </View>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────
export function ProfileBackground({ backgroundId, height }: Props) {
  if (!backgroundId) return null;
  const item = SHOP_ITEMS_BY_ID[backgroundId];
  if (!item) return null;

  switch (item.animationType) {
    case 'sweep':
      return <SweepBackground item={item} height={height} />;
    case 'wave':
      return <WaveBackground item={item} height={height} />;
    case 'float':
      return <FloatBackground item={item} height={height} />;
    case 'combo':
      return <ComboBackground item={item} height={height} />;
    default:
      return null;
  }
}
