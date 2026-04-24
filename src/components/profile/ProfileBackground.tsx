import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
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
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface Props {
  backgroundId: string | null;
  height: number;
}

// Shimmer: diagonal beam scans across a deep gradient
function ShimmerBackground({ item, height }: { item: ShopItem; height: number }) {
  const tx = useSharedValue(-SCREEN_WIDTH * 0.5);
  useFocusEffect(
    React.useCallback(() => {
      tx.value = withRepeat(
        withSequence(
          withTiming(SCREEN_WIDTH * 1.2, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
          withTiming(-SCREEN_WIDTH * 0.5, { duration: 400, easing: Easing.linear }),
        ),
        -1,
      );
      return () => { cancelAnimation(tx); tx.value = -SCREEN_WIDTH * 0.5; };
    }, []),
  );
  const beamStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const base = (item.colors.length >= 2 ? [item.colors[0], item.colors[1]] : [item.colors[0], item.colors[0]]) as [string, string];
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden' }}>
      <LinearGradient colors={base} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      <Animated.View style={[{
        position: 'absolute', top: -height, width: SCREEN_WIDTH * 0.22,
        height: height * 3, backgroundColor: 'rgba(255,255,255,0.18)',
        transform: [{ rotate: '-18deg' }],
      }, beamStyle]} />
    </View>
  );
}

// Comet: shooting stars streak across a dark base
function CometStreak({ color, width, top, duration, delay }: { color: string; width: number; top: number; duration: number; delay: number }) {
  const tx = useSharedValue(-width - 20);
  useFocusEffect(
    React.useCallback(() => {
      tx.value = withRepeat(
        withSequence(
          withTiming(SCREEN_WIDTH + 20, { duration, easing: Easing.linear }),
          withTiming(-width - 20, { duration: 0 }),
        ),
        -1,
      );
      return () => { cancelAnimation(tx); tx.value = -width - 20; };
    }, []),
  );
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top, height: 2, width, borderRadius: 2 }, style]}>
      <LinearGradient colors={['transparent', color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 2 }} />
    </Animated.View>
  );
}

function CometBackground({ item, height }: { item: ShopItem; height: number }) {
  const comets = React.useMemo(() => [
    { color: item.colors[0], width: 60, top: height * 0.18, duration: 1800, delay: 0 },
    { color: item.colors[1] ?? item.colors[0], width: 90, top: height * 0.45, duration: 2300, delay: 600 },
    { color: item.colors[2] ?? item.colors[0], width: 45, top: height * 0.68, duration: 1600, delay: 1100 },
    { color: item.colors[1] ?? item.colors[0], width: 70, top: height * 0.30, duration: 2100, delay: 1700 },
  ], []);
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden', backgroundColor: '#0a0816' }}>
      {comets.map((c, i) => <CometStreak key={i} {...c} />)}
    </View>
  );
}

// Tide: two colours breathe from opposite edges and meet in the middle
function TideBackground({ item, height }: { item: ShopItem; height: number }) {
  const progress = useSharedValue(0);
  useFocusEffect(
    React.useCallback(() => {
      progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
      return () => { cancelAnimation(progress); progress.value = 0; };
    }, []),
  );
  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -SCREEN_WIDTH * 0.6 * (1 - progress.value) }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: SCREEN_WIDTH * 0.6 * progress.value }] }));
  const c1 = item.colors[0];
  const c2 = item.colors[1] ?? item.colors[0];
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden', backgroundColor: '#0D0D0D' }}>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, bottom: 0, width: SCREEN_WIDTH }, leftStyle]}>
        <LinearGradient colors={[c1, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, width: SCREEN_WIDTH }, rightStyle]}>
        <LinearGradient colors={['transparent', c2]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

// Plasma: glowing blobs morph on a near-black base
function PlasmaOrb({ x, y, size, color, driftX, driftY, duration }: { x: number; y: number; size: number; color: string; driftX: number; driftY: number; duration: number }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  useFocusEffect(
    React.useCallback(() => {
      tx.value = withRepeat(withSequence(withTiming(driftX, { duration, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })), -1);
      ty.value = withRepeat(withSequence(withTiming(driftY, { duration: duration * 0.85, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: duration * 0.85, easing: Easing.inOut(Easing.sin) })), -1);
      sc.value = withRepeat(withSequence(withTiming(1.3, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }), withTiming(0.75, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) })), -1);
      return () => { cancelAnimation(tx); cancelAnimation(ty); cancelAnimation(sc); tx.value = 0; ty.value = 0; sc.value = 1; };
    }, []),
  );
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.55 }, style]} />
  );
}

function PlasmaBackground({ item, height }: { item: ShopItem; height: number }) {
  const orbColors = item.colors.slice(1).length > 0 ? item.colors.slice(1) : item.colors;
  const orbs = React.useMemo(() => [
    { x: SCREEN_WIDTH * 0.15, y: height * 0.3, size: height * 1.2, color: orbColors[0], driftX: 22, driftY: -14, duration: 6500 },
    { x: SCREEN_WIDTH * 0.80, y: height * 0.65, size: height, color: orbColors[1] ?? orbColors[0], driftX: -26, driftY: 12, duration: 8000 },
    { x: SCREEN_WIDTH * 0.50, y: height * 0.1, size: height * 0.75, color: orbColors[2] ?? orbColors[0], driftX: 16, driftY: 20, duration: 5800 },
  ], []);
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden', backgroundColor: item.colors[0] ?? '#050510' }}>
      {orbs.map((orb, i) => <PlasmaOrb key={i} {...orb} />)}
    </View>
  );
}

// Glitch: neon scan-line cuts across flickering colour blocks
function GlitchBlock({ progress, topPct, leftPct, rightPct, color, period, offset }: { progress: SharedValue<number>; topPct: number; leftPct: number; rightPct: number; color: string; period: number; offset: number }) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const t = (progress.value * 2000 + offset) % period;
    const vis = t < period * 0.09;
    return { opacity: vis ? 0.7 : 0, transform: [{ translateX: vis ? (t % 2 === 0 ? 4 : -4) : 0 }] };
  });
  return <Animated.View style={[{ position: 'absolute', top: topPct + '%' as any, left: leftPct + '%' as any, right: rightPct + '%' as any, height: 7, backgroundColor: color }, style]} />;
}

function GlitchBackground({ item, height }: { item: ShopItem; height: number }) {
  const progress = useSharedValue(0);
  const scanY = useSharedValue(-4);
  useFocusEffect(
    React.useCallback(() => {
      progress.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1);
      scanY.value = withRepeat(withTiming(height + 4, { duration: 1800, easing: Easing.linear }), -1);
      return () => { cancelAnimation(progress); cancelAnimation(scanY); progress.value = 0; scanY.value = -4; };
    }, []),
  );
  const scanStyle = useAnimatedStyle(() => ({ top: scanY.value }));
  const c1 = item.colors[0] ?? '#00F5FF';
  const c2 = item.colors[1] ?? '#FF0080';
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden', backgroundColor: '#030712' }}>
      <LinearGradient colors={['#030712', '#0f172a']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <GlitchBlock progress={progress} topPct={22} leftPct={8} rightPct={25} color={c1 + '55'} period={1600} offset={0} />
      <GlitchBlock progress={progress} topPct={50} leftPct={30} rightPct={5} color={c2 + '55'} period={2100} offset={400} />
      <GlitchBlock progress={progress} topPct={68} leftPct={5} rightPct={40} color={c1 + '44'} period={1900} offset={900} />
      <GlitchBlock progress={progress} topPct={82} leftPct={50} rightPct={10} color={c2 + '44'} period={2400} offset={1200} />
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 3 }, scanStyle]}>
        <LinearGradient colors={['transparent', c1, c2, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

// Inferno: rising flame bars pulse from the bottom
function InfernoBar({ progress, phase, x, barW, maxH, minH, color, opacity }: { progress: SharedValue<number>; phase: number; x: number; barW: number; maxH: number; minH: number; color: string; opacity: number }) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const t = progress.value * Math.PI * 2 + phase;
    const norm = (Math.sin(t) + 1) / 2;
    return { height: minH + norm * (maxH - minH), bottom: 0 };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: x, width: barW, borderTopLeftRadius: barW / 2, borderTopRightRadius: barW / 2, backgroundColor: color, opacity }, style]} />
  );
}

function InfernoBackground({ item, height }: { item: ShopItem; height: number }) {
  const progress = useSharedValue(0);
  useFocusEffect(
    React.useCallback(() => {
      progress.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1);
      return () => { cancelAnimation(progress); progress.value = 0; };
    }, []),
  );
  const BAR_COUNT = 30;
  const BAR_W = 11;
  const GAP = (SCREEN_WIDTH - BAR_COUNT * BAR_W) / (BAR_COUNT + 1);
  const bars = React.useMemo(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => ({
      phase: (i / BAR_COUNT) * Math.PI * 2,
      color: item.colors[i % item.colors.length],
      opacity: 0.45 + (i % 3) * 0.2,
      x: GAP + i * (BAR_W + GAP),
    })),
  []);
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden', backgroundColor: '#0D0D0D' }}>
      <LinearGradient colors={['#0D0D0D', '#1a0500']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {bars.map((b, i) => (
        <InfernoBar key={i} progress={progress} phase={b.phase} x={b.x} barW={BAR_W} maxH={height * 0.82} minH={height * 0.12} color={b.color} opacity={b.opacity} />
      ))}
    </View>
  );
}

// ── Export ──────────────────────────────────────────────────────────// Frost: jagged SVG polyline cracks radiate from an impact point and rewind.
// Coords normalised 0-1 (x scales to width, y scales to height).
// First point of every polyline IS the crack origin so strokeDashoffset
// draws it from that origin outward.  glow cracks get a soft under-layer.
type CrackDef = {
  pts: ReadonlyArray<[number, number]>;
  sw: number; s: number; e: number; glow?: true;
};

const ICE_CRACKS: ReadonlyArray<CrackDef> = [
  // Primary (6) – radiate from impact, irregular jags, glow layer
  // Crack 1: shoots left, dips then rises unpredictably
  { pts: [[0.54,0.44],[0.45,0.49],[0.36,0.42],[0.24,0.47],[0.13,0.40],[0.03,0.46]], sw: 1.9, s: 0.00, e: 0.28, glow: true },
  // Crack 2: upper-right, kinks sharply back before continuing
  { pts: [[0.54,0.44],[0.62,0.33],[0.68,0.26],[0.75,0.32],[0.84,0.20],[0.93,0.14],[0.99,0.22]], sw: 1.9, s: 0.00, e: 0.28, glow: true },
  // Crack 3: lower-left, zigzags – crosses centre-line twice
  { pts: [[0.54,0.44],[0.48,0.57],[0.54,0.64],[0.40,0.72],[0.45,0.82],[0.32,0.91],[0.24,0.97]], sw: 1.6, s: 0.03, e: 0.30, glow: true },
  // Crack 4: lower-right, veers inward mid-way then recovers
  { pts: [[0.54,0.44],[0.60,0.55],[0.66,0.60],[0.62,0.70],[0.72,0.78],[0.82,0.83],[0.94,0.79]], sw: 1.6, s: 0.03, e: 0.30, glow: true },
  // Crack 5: straight up but weaves left-right
  { pts: [[0.54,0.44],[0.56,0.31],[0.50,0.22],[0.56,0.12],[0.52,0.02]],             sw: 1.4, s: 0.01, e: 0.29, glow: true },
  // Crack 6: mostly horizontal right, slight oscillation
  { pts: [[0.54,0.44],[0.64,0.41],[0.73,0.46],[0.82,0.40],[0.90,0.45],[0.97,0.42]], sw: 1.3, s: 0.02, e: 0.29, glow: true },

  // Secondary (10) – branch at 1/3, 2/5, 4/5 of parent (NOT midpoints)
  { pts: [[0.36,0.42],[0.30,0.50],[0.24,0.62],[0.16,0.70],[0.08,0.78]],     sw: 1.1, s: 0.20, e: 0.50 },
  { pts: [[0.13,0.40],[0.08,0.54],[0.04,0.69],[0.01,0.84]],                  sw: 1.0, s: 0.22, e: 0.52 },
  { pts: [[0.68,0.26],[0.72,0.14],[0.70,0.04]],                              sw: 1.0, s: 0.18, e: 0.46 },
  { pts: [[0.93,0.14],[0.96,0.28],[0.98,0.44],[0.95,0.61]],                  sw: 1.0, s: 0.22, e: 0.52 },
  { pts: [[0.48,0.57],[0.36,0.54],[0.24,0.56],[0.12,0.52],[0.02,0.56]],      sw: 0.9, s: 0.22, e: 0.54 },
  { pts: [[0.72,0.78],[0.80,0.72],[0.88,0.66],[0.96,0.62]],                  sw: 0.9, s: 0.24, e: 0.54 },
  { pts: [[0.50,0.22],[0.40,0.18],[0.30,0.20],[0.20,0.15],[0.12,0.20]],      sw: 0.9, s: 0.18, e: 0.46 },
  { pts: [[0.73,0.46],[0.76,0.56],[0.72,0.66],[0.74,0.76]],                  sw: 0.9, s: 0.24, e: 0.54 },
  { pts: [[0.24,0.47],[0.20,0.34],[0.16,0.22],[0.20,0.10]],                  sw: 0.9, s: 0.24, e: 0.54 },
  { pts: [[0.40,0.72],[0.50,0.70],[0.60,0.72],[0.68,0.70],[0.76,0.74]],      sw: 0.9, s: 0.22, e: 0.54 },

  // Cross cracks (5) – bridge shards, non-horizontal angles
  { pts: [[0.32,0.91],[0.40,0.88],[0.48,0.90],[0.56,0.88],[0.64,0.90],[0.72,0.88]], sw: 0.85, s: 0.30, e: 0.60 },
  { pts: [[0.08,0.78],[0.16,0.74],[0.26,0.76],[0.36,0.74],[0.46,0.76]],             sw: 0.80, s: 0.32, e: 0.62 },
  { pts: [[0.94,0.79],[0.96,0.86],[0.94,0.94],[0.88,0.98]],                         sw: 0.80, s: 0.32, e: 0.62 },
  { pts: [[0.24,0.62],[0.28,0.52],[0.34,0.44],[0.38,0.36],[0.36,0.28]],             sw: 0.80, s: 0.26, e: 0.56 },
  { pts: [[0.66,0.60],[0.70,0.52],[0.72,0.44],[0.70,0.36]],                         sw: 0.80, s: 0.26, e: 0.56 },

  // Micro (15) – short, dense, scattered
  { pts: [[0.45,0.49],[0.38,0.38],[0.28,0.30],[0.20,0.22],[0.14,0.14]], sw: 0.70, s: 0.50, e: 0.70 },
  { pts: [[0.75,0.32],[0.78,0.42],[0.76,0.52]],                          sw: 0.70, s: 0.50, e: 0.70 },
  { pts: [[0.16,0.70],[0.10,0.74],[0.06,0.82]],                          sw: 0.70, s: 0.52, e: 0.72 },
  { pts: [[0.54,0.64],[0.58,0.72],[0.56,0.82]],                          sw: 0.70, s: 0.52, e: 0.72 },
  { pts: [[0.20,0.15],[0.14,0.22],[0.10,0.32]],                          sw: 0.65, s: 0.55, e: 0.74 },
  { pts: [[0.24,0.97],[0.30,0.94],[0.38,0.96]],                          sw: 0.65, s: 0.55, e: 0.74 },
  { pts: [[0.82,0.83],[0.88,0.86],[0.92,0.92],[0.96,0.97]],              sw: 0.65, s: 0.58, e: 0.76 },
  { pts: [[0.62,0.70],[0.58,0.78],[0.56,0.88]],                          sw: 0.65, s: 0.58, e: 0.76 },
  { pts: [[0.96,0.62],[0.97,0.72],[0.96,0.82]],                          sw: 0.60, s: 0.60, e: 0.78 },
  { pts: [[0.72,0.14],[0.66,0.18],[0.60,0.24]],                          sw: 0.60, s: 0.60, e: 0.78 },
  { pts: [[0.46,0.76],[0.50,0.82],[0.48,0.90]],                          sw: 0.55, s: 0.65, e: 0.82 },
  { pts: [[0.20,0.10],[0.26,0.06],[0.34,0.04],[0.44,0.06],[0.52,0.02]],  sw: 0.55, s: 0.65, e: 0.82 },
  { pts: [[0.01,0.84],[0.02,0.91],[0.01,0.97]],                          sw: 0.55, s: 0.67, e: 0.84 },
  { pts: [[0.70,0.04],[0.74,0.10],[0.78,0.18]],                          sw: 0.55, s: 0.67, e: 0.84 },
  { pts: [[0.36,0.28],[0.30,0.22],[0.24,0.16],[0.18,0.08]],              sw: 0.50, s: 0.68, e: 0.84 },
];

const PRIMARY_CRACKS = ICE_CRACKS.filter(c => c.glow);

function polylineLen(pxPts: Array<[number, number]>): number {
  let l = 0;
  for (let i = 1; i < pxPts.length; i++) {
    const dx = pxPts[i][0] - pxPts[i - 1][0];
    const dy = pxPts[i][1] - pxPts[i - 1][1];
    l += Math.sqrt(dx * dx + dy * dy);
  }
  return l;
}

function IceCrack({ progress, pts, startP, endP, sw, color, w, h, opacity }: {
  progress: SharedValue<number>;
  pts: ReadonlyArray<[number, number]>;
  startP: number; endP: number; sw: number; color: string;
  w: number; h: number; opacity: number;
}) {
  const pxPts = pts.map(([x, y]) => [x * w, y * h] as [number, number]);
  const len = polylineLen(pxPts);
  const pointsStr = pxPts.map(([x, y]) => `${x},${y}`).join(' ');
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const localP = Math.max(0, Math.min(1, (progress.value - startP) / (endP - startP)));
    return { strokeDashoffset: len * (1 - localP) };
  });
  return (
    <AnimatedPolyline
      points={pointsStr}
      stroke={color}
      strokeWidth={sw}
      strokeOpacity={opacity}
      strokeDasharray={`${len} ${len}`}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      animatedProps={animatedProps}
    />
  );
}

function FrostBackground({ item, height }: { item: ShopItem; height: number }) {
  const progress = useSharedValue(0);
  useFocusEffect(
    React.useCallback(() => {
      // Fast crack  → hold  → slow graceful rewind  → pause
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 1600 }),
          withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 800 }),
        ),
        -1,
      );
      return () => { cancelAnimation(progress); progress.value = 0; };
    }, []),
  );
  const c1 = item.colors[0] ?? '#0E7490';
  const c2 = item.colors[1] ?? '#06B6D4';
  const crackColor = item.colors[2] ?? '#A5F3FC';
  const W = SCREEN_WIDTH;
  const shared = { progress, w: W, h: height, color: crackColor };
  return (
    <View style={{ width: W, height, overflow: 'hidden' }}>
      <LinearGradient
        colors={[c1, c2] as [string, string]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Svg width={W} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Soft glow under primary cracks */}
        {PRIMARY_CRACKS.map((c, i) => (
          <IceCrack key={`g${i}`} {...shared}
            pts={c.pts} startP={c.s} endP={c.e} sw={c.sw * 5} opacity={0.12} />
        ))}
        {/* All cracks */}
        {ICE_CRACKS.map((c, i) => (
          <IceCrack key={i} {...shared}
            pts={c.pts} startP={c.s} endP={c.e} sw={c.sw} opacity={0.88} />
        ))}
      </Svg>
    </View>
  );
}

// Molten: red and orange breathe from opposite edges and meet in the middle
function MoltenBackground({ item, height }: { item: ShopItem; height: number }) {
  const progress = useSharedValue(0);
  useFocusEffect(
    React.useCallback(() => {
      progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }), -1, true);
      return () => { cancelAnimation(progress); progress.value = 0; };
    }, []),
  );
  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -SCREEN_WIDTH * 0.55 * (1 - progress.value) }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: SCREEN_WIDTH * 0.55 * (1 - progress.value) }],
  }));
  const c1 = item.colors[1] ?? '#DC2626';
  const c2 = item.colors[2] ?? '#F97316';
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden', backgroundColor: '#110300' }}>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, bottom: 0, width: SCREEN_WIDTH }, leftStyle]}>
        <LinearGradient colors={[c1, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, width: SCREEN_WIDTH }, rightStyle]}>
        <LinearGradient colors={['transparent', c2]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}


// ── Nebula: twinkling starfield with drifting gas clouds ──────────────────────

const NEBULA_STARS: ReadonlyArray<{ px: number; py: number; sz: number; op: number; phase: number }> = [
  { px: 0.05, py: 0.08, sz: 1.5, op: 0.90, phase: 0.00 },
  { px: 0.18, py: 0.03, sz: 1.0, op: 0.65, phase: 0.13 },
  { px: 0.32, py: 0.11, sz: 2.0, op: 0.85, phase: 0.27 },
  { px: 0.47, py: 0.06, sz: 1.5, op: 0.60, phase: 0.41 },
  { px: 0.63, py: 0.14, sz: 1.0, op: 0.80, phase: 0.07 },
  { px: 0.78, py: 0.04, sz: 2.0, op: 0.95, phase: 0.55 },
  { px: 0.91, py: 0.09, sz: 1.5, op: 0.70, phase: 0.18 },
  { px: 0.12, py: 0.25, sz: 1.0, op: 0.55, phase: 0.36 },
  { px: 0.28, py: 0.31, sz: 2.5, op: 0.90, phase: 0.63 },
  { px: 0.44, py: 0.28, sz: 1.0, op: 0.65, phase: 0.44 },
  { px: 0.59, py: 0.22, sz: 1.5, op: 0.80, phase: 0.21 },
  { px: 0.73, py: 0.35, sz: 1.0, op: 0.70, phase: 0.72 },
  { px: 0.88, py: 0.26, sz: 2.0, op: 0.85, phase: 0.09 },
  { px: 0.07, py: 0.45, sz: 1.5, op: 0.60, phase: 0.48 },
  { px: 0.22, py: 0.52, sz: 1.0, op: 0.75, phase: 0.31 },
  { px: 0.38, py: 0.48, sz: 2.0, op: 0.90, phase: 0.67 },
  { px: 0.54, py: 0.55, sz: 1.5, op: 0.65, phase: 0.14 },
  { px: 0.69, py: 0.42, sz: 1.0, op: 0.80, phase: 0.82 },
  { px: 0.84, py: 0.50, sz: 2.5, op: 0.95, phase: 0.53 },
  { px: 0.15, py: 0.68, sz: 1.0, op: 0.70, phase: 0.39 },
  { px: 0.31, py: 0.72, sz: 1.5, op: 0.60, phase: 0.76 },
  { px: 0.66, py: 0.65, sz: 2.0, op: 0.85, phase: 0.25 },
];

const NEBULA_CLOUDS: ReadonlyArray<{ px: number; py: number; w: number; h: number; phase: number; phase2: number }> = [
  { px: 0.15, py: 0.20, w: 260, h: 180, phase: 0.00, phase2: 0.25 },
  { px: 0.82, py: 0.55, w: 300, h: 220, phase: 0.33, phase2: 0.60 },
  { px: 0.45, py: 0.15, w: 240, h: 200, phase: 0.66, phase2: 0.10 },
  { px: 0.22, py: 0.78, w: 280, h: 190, phase: 0.50, phase2: 0.80 },
];

// Deep space palette for the gas clouds — violet, magenta, indigo, teal
const NEBULA_CLOUD_PALETTE = ['#7C3AED', '#BE185D', '#4C1D95', '#0E7490'];

function NebulaStar({ clock, px, py, sz, op, phase, width, height }: {
  clock: SharedValue<number>; px: number; py: number; sz: number; op: number;
  phase: number; width: number; height: number;
}) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const t = (clock.value + phase) % 1;
    const brightness = op * (0.15 + 0.85 * ((Math.sin(t * Math.PI * 2) + 1) / 2));
    return { opacity: brightness };
  });
  return (
    <Animated.View style={[{
      position: 'absolute',
      left: px * width - sz / 2,
      top: py * height - sz / 2,
      width: sz,
      height: sz,
      borderRadius: sz,
      backgroundColor: '#ffffff',
    }, style]} />
  );
}

function NebulaCloud({ clock, px, py, w, h, color, op, phase, phase2, width, containerH }: {
  clock: SharedValue<number>; px: number; py: number; w: number; h: number;
  color: string; op: number; phase: number; phase2: number; width: number; containerH: number;
}) {
  const style = useAnimatedStyle(() => {
    'worklet';
    // clock * 0.08 → one cloud oscillation ≈ 37 s (imperceptibly slow)
    const t1 = (clock.value * 0.08 + phase) % 1;
    const t2 = (clock.value * 0.07 + phase2) % 1;
    const dx = Math.sin(t1 * Math.PI * 2) * 22;
    const dy = Math.sin(t2 * Math.PI * 2) * 12;
    return { transform: [{ translateX: dx }, { translateY: dy }] };
  });
  return (
    <Animated.View style={[{
      position: 'absolute',
      left: px * width - w / 2,
      top: py * containerH - h / 2,
      width: w,
      height: h,
      borderRadius: w / 2,
      backgroundColor: color,
      opacity: op,
    }, style]} />
  );
}

function NebulaBackground({ item: _item, height }: { item: ShopItem; height: number }) {
  const clock = useSharedValue(0);
  useFocusEffect(
    React.useCallback(() => {
      // 3 s per clock cycle → stars twinkle visibly; clouds cycle in ~37 s
      clock.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
      return () => { cancelAnimation(clock); clock.value = 0; };
    }, []),
  );
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden', backgroundColor: '#050010' }}>
      {/* Gas clouds — rendered first so stars sit on top */}
      {NEBULA_CLOUDS.map((c, i) => (
        <NebulaCloud
          key={`nc${i}`}
          clock={clock}
          px={c.px} py={c.py}
          w={c.w} h={c.h}
          color={NEBULA_CLOUD_PALETTE[i % NEBULA_CLOUD_PALETTE.length]}
          op={0.09 + (i % 3) * 0.02}
          phase={c.phase} phase2={c.phase2}
          width={SCREEN_WIDTH} containerH={height}
        />
      ))}
      {/* Stars */}
      {NEBULA_STARS.map((s, i) => (
        <NebulaStar
          key={`ns${i}`}
          clock={clock}
          px={s.px} py={s.py}
          sz={s.sz} op={s.op} phase={s.phase}
          width={SCREEN_WIDTH} height={height}
        />
      ))}
    </View>
  );
}

// ── Prism: diagonal spectrum light bands slowly drifting ──────────────────────

// ── Vortex: concentric arcs spinning at independent speeds ───────────────────

const VORTEX_ARCS: ReadonlyArray<{
  radius: number; color: string; arcFrac: number; sw: number; dir: 1 | -1; speed: number;
}> = [
  { radius: 58,  color: '#818CF8', arcFrac: 0.55, sw: 2.5, dir:  1, speed: 0.60 },
  { radius: 105, color: '#C026D3', arcFrac: 0.40, sw: 2.0, dir: -1, speed: 0.85 },
  { radius: 155, color: '#22D3EE', arcFrac: 0.30, sw: 1.8, dir:  1, speed: 1.10 },
  { radius: 208, color: '#F43F5E', arcFrac: 0.20, sw: 1.5, dir: -1, speed: 0.45 },
  { radius: 262, color: '#A855F7', arcFrac: 0.58, sw: 2.2, dir:  1, speed: 0.72 },
];

function VortexArc({ clock, radius, color, arcFrac, sw, dir, speed, cx, cy }: {
  clock: SharedValue<number>; radius: number; color: string; arcFrac: number;
  sw: number; dir: 1 | -1; speed: number; cx: number; cy: number;
}) {
  const r = radius - sw / 2;
  const circumference = 2 * Math.PI * r;
  const arcLen = circumference * arcFrac;
  const dashArray = `${arcLen} ${circumference - arcLen}`;
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${clock.value * 360 * dir * speed}deg` }],
  }));
  return (
    <Animated.View style={[{
      position: 'absolute',
      left: cx - radius,
      top: cy - radius,
      width: radius * 2,
      height: radius * 2,
    }, style]}>
      <Svg width={radius * 2} height={radius * 2}>
        <Circle
          cx={radius} cy={radius} r={r}
          stroke={color} strokeWidth={sw}
          strokeDasharray={dashArray}
          strokeDashoffset={0}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

function VortexBackground({ item: _item, height }: { item: ShopItem; height: number }) {
  const clock = useSharedValue(0);
  useFocusEffect(
    React.useCallback(() => {
      // 20 s per full rotation at speed=1
      clock.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.linear }), -1);
      return () => { cancelAnimation(clock); clock.value = 0; };
    }, []),
  );
  const cx = SCREEN_WIDTH / 2;
  // Fixed cy so the vortex stays in the upper portion regardless of content height
  const cy = SCREEN_WIDTH * 0.62;
  return (
    <View style={{ width: SCREEN_WIDTH, height, overflow: 'hidden', backgroundColor: '#030311' }}>
      {VORTEX_ARCS.map((arc, i) => (
        <VortexArc key={i} clock={clock} {...arc} cx={cx} cy={cy} />
      ))}
    </View>
  );
}

export function ProfileBackground({ backgroundId, height }: Props) {
  if (!backgroundId) return null;
  const item = SHOP_ITEMS_BY_ID[backgroundId];
  if (!item) return null;

  switch (item.animationType) {
    case 'shimmer': return <ShimmerBackground item={item} height={height} />;
    case 'comet': return <CometBackground item={item} height={height} />;
    case 'tide': return <TideBackground item={item} height={height} />;
    case 'plasma': return <PlasmaBackground item={item} height={height} />;
    case 'glitch': return <GlitchBackground item={item} height={height} />;
    case 'inferno': return <InfernoBackground item={item} height={height} />;
    case 'frost':   return <FrostBackground item={item} height={height} />;
    case 'molten':  return <MoltenBackground item={item} height={height} />;
    default: return null;
  }
}

export function ProfileThemeBackground({
  themeId,
  height,
}: {
  themeId: string | null;
  height: number;
}): React.ReactElement | null {
  if (!themeId) return null;
  const item = SHOP_ITEMS_BY_ID[themeId];
  if (!item) return null;

  if (item.animationType === 'static') {
    const gradColors = item.colors.slice(1) as [string, string, ...string[]];
    return (
      <LinearGradient
        colors={gradColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    );
  }

  switch (item.animationType) {
    case 'plasma':  return <PlasmaBackground item={item} height={height} />;
    case 'molten':  return <MoltenBackground item={item} height={height} />;
    case 'tide':    return <TideBackground item={item} height={height} />;
    case 'glitch':  return <GlitchBackground item={item} height={height} />;
    case 'nebula':   return <NebulaBackground item={item} height={height} />;
    case 'vortex':   return <VortexBackground item={item} height={height} />;
    default:        return null;
  }
}
