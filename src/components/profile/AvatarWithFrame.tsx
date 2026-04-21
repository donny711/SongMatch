import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Ellipse, Defs, LinearGradient as SvgLinearGradient, Stop, ClipPath, G } from 'react-native-svg';
import { SHOP_ITEMS_BY_ID, type ShopItem } from '../../data/shopCatalog';
import { COLORS } from '../../theme';

interface Props {
  uri: string | null;
  frameId: string | null;
  size?: number;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

// ── Static ────────────────────────────────────────────────────────────────────
// Solid ring + a short bright highlight arc that sweeps around continuously.
// linear easing: constant-speed rotation feels right for a decorative loop.
function StaticFrame({ size, color }: { size: number; color: string }) {
  const rotation = useSharedValue(0);

  useFocusEffect(
    React.useCallback(() => {
      rotation.value = withRepeat(
        withTiming(360, { duration: 3500, easing: Easing.linear }),
        -1
      );
      return () => { cancelAnimation(rotation); rotation.value = 0; };
    }, [])
  );

  const svgStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const sw = 3;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const highlightLen = circ * 0.1; // 10% arc = short bright flash

  return (
    <View style={{ position: 'absolute', width: size, height: size }}>
      {/* Base ring */}
      <View
        style={{
          position: 'absolute',
          width: size, height: size,
          borderRadius: size / 2,
          borderWidth: sw,
          borderColor: color,
        }}
      />
      {/* Rotating highlight arc */}
      <AnimatedSvg width={size} height={size} style={[StyleSheet.absoluteFill, svgStyle]}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={sw + 2}
          fill="none"
          strokeDasharray={`${highlightLen} ${circ - highlightLen}`}
          strokeLinecap="round"
        />
      </AnimatedSvg>
    </View>
  );
}

// ── Pulse ─────────────────────────────────────────────────────────────────────
// Spring-like overshoot via Easing.out(Easing.back) — feels alive, not robotic.
// Outer bloom layer amplifies the pulse at larger radius.
function PulseFrame({ size, color }: { size: number; color: string }) {
  const scale = useSharedValue(1);
  const bloomOpacity = useSharedValue(0);

  useFocusEffect(
    React.useCallback(() => {
      // Easing.out(Easing.back(1.7)) → overshoots past 1.14, snaps back: spring feel
      scale.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 480, easing: Easing.out(Easing.back(1.7)) }),
          withTiming(1.0,  { duration: 680, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.0,  { duration: 500 }), // breath pause
        ),
        -1
      );
      // Bloom bursts on the scale-up, fades before next pulse
      bloomOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 380, easing: Easing.out(Easing.cubic) }),
          withTiming(0,   { duration: 900, easing: Easing.in(Easing.quad) }),
          withTiming(0,   { duration: 380 }),
        ),
        -1
      );
      return () => {
        cancelAnimation(scale);
        cancelAnimation(bloomOpacity);
        scale.value = 1;
        bloomOpacity.value = 0;
      };
    }, [])
  );

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{ scale: scale.value * 1.4 }],
  }));

  return (
    <>
      {/* Outer diffuse bloom — expands further than the ring */}
      <Animated.View
        style={[{
          position: 'absolute',
          width: size, height: size,
          borderRadius: size / 2,
          borderWidth: 8,
          borderColor: color,
          shadowColor: color,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
        }, bloomStyle]}
      />
      {/* Main ring */}
      <Animated.View
        style={[{
          position: 'absolute',
          width: size, height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: color,
          shadowColor: color,
          shadowOpacity: 0.85,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
        }, ringStyle]}
      />
    </>
  );
}

// ── Neon ──────────────────────────────────────────────────────────────────────
// Three independent layers on separate flicker phases:
//   1. Outer diffuse bloom  (large, soft, flickers most)
//   2. Glass tube           (medium, crisp border)
//   3. Bright white core    (thin, almost always on)
function NeonFrame({ size, color }: { size: number; color: string }) {
  const bloom = useSharedValue(1);
  const tube  = useSharedValue(1);
  const core  = useSharedValue(1);

  useFocusEffect(
    React.useCallback(() => {
      // Outer bloom: most volatile, rapid double-flicker pattern
      bloom.value = withRepeat(
        withSequence(
          withTiming(1,    { duration: 1600 }),
          withTiming(0.05, { duration: 55 }),
          withTiming(0.8,  { duration: 45 }),
          withTiming(0.05, { duration: 40 }),
          withTiming(1,    { duration: 70 }),
          withTiming(1,    { duration: 2100 }),
          withTiming(0.2,  { duration: 75 }),
          withTiming(1,    { duration: 55 }),
          withTiming(0.5,  { duration: 50 }),
          withTiming(1,    { duration: 95 }),
          withTiming(1,    { duration: 800 }),
        ),
        -1
      );
      // Tube: same rhythm, slightly offset phase
      tube.value = withRepeat(
        withSequence(
          withTiming(1,    { duration: 900 }),
          withTiming(0.1,  { duration: 50 }),
          withTiming(1,    { duration: 60 }),
          withTiming(1,    { duration: 2600 }),
          withTiming(0.15, { duration: 60 }),
          withTiming(0.9,  { duration: 40 }),
          withTiming(0.15, { duration: 35 }),
          withTiming(1,    { duration: 80 }),
          withTiming(1,    { duration: 1200 }),
        ),
        -1
      );
      // Core: mostly steady — occasional single flicker
      core.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 3500 }),
          withTiming(0.3, { duration: 50 }),
          withTiming(1,   { duration: 60 }),
          withTiming(1,   { duration: 2200 }),
          withTiming(0.2, { duration: 40 }),
          withTiming(1,   { duration: 50 }),
          withTiming(1,   { duration: 1400 }),
        ),
        -1
      );
      return () => {
        cancelAnimation(bloom); cancelAnimation(tube); cancelAnimation(core);
        bloom.value = 1; tube.value = 1; core.value = 1;
      };
    }, [])
  );

  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value * 0.28 }));
  const tubeStyle  = useAnimatedStyle(() => ({ opacity: tube.value }));
  const coreStyle  = useAnimatedStyle(() => ({ opacity: core.value * 0.7 }));

  return (
    <>
      {/* 1 — Diffuse outer bloom */}
      <Animated.View
        style={[{
          position: 'absolute',
          width: size + 18, height: size + 18,
          borderRadius: (size + 18) / 2,
          borderWidth: 9,
          borderColor: color,
          left: -9, top: -9,
          shadowColor: color,
          shadowOpacity: 1,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
        }, bloomStyle]}
      />
      {/* 2 — Neon glass tube */}
      <Animated.View
        style={[{
          position: 'absolute',
          width: size, height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: color,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 0 },
        }, tubeStyle]}
      />
      {/* 3 — Bright white core line */}
      <Animated.View
        style={[{
          position: 'absolute',
          width: size - 2, height: size - 2,
          borderRadius: (size - 2) / 2,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.9)',
          left: 1, top: 1,
        }, coreStyle]}
      />
    </>
  );
}

// ── Rotate ────────────────────────────────────────────────────────────────────
// Two arcs rotating in opposite directions at different speeds.
// linear easing for both — constant-speed rotation is the right call here.
function RotateFrame({ size, colors }: { size: number; colors: string[] }) {
  const r1 = useSharedValue(0);   // clockwise, slower
  const r2 = useSharedValue(0);   // counter-clockwise, faster

  useFocusEffect(
    React.useCallback(() => {
      r1.value = withRepeat(
        withTiming(360, { duration: 3200, easing: Easing.linear }),
        -1
      );
      r2.value = withRepeat(
        withTiming(-360, { duration: 2000, easing: Easing.linear }),
        -1
      );
      return () => {
        cancelAnimation(r1); cancelAnimation(r2);
        r1.value = 0; r2.value = 0;
      };
    }, [])
  );

  const svg1Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${r1.value}deg` }],
  }));
  const svg2Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${r2.value}deg` }],
  }));

  const sw = 4;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size - sw) / 2;
  const outerC = 2 * Math.PI * outerR;
  const c1 = colors[0];
  const cLast = colors[colors.length - 1];

  return (
    <>
      {/* Primary arc — 72% coverage, full gradient */}
      <AnimatedSvg width={size} height={size} style={[StyleSheet.absoluteFill, svg1Style]}>
        <Defs>
          <SvgLinearGradient id={`rotMain_${c1}`} x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((c, i) => (
              <Stop
                key={i}
                offset={`${(i / Math.max(colors.length - 1, 1)) * 100}%`}
                stopColor={c}
              />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={cx} cy={cy} r={outerR}
          stroke={`url(#rotMain_${c1})`}
          strokeWidth={sw + 1}
          fill="none"
          strokeDasharray={`${outerC * 0.72} ${outerC * 0.28}`}
          strokeLinecap="round"
        />
      </AnimatedSvg>
      {/* Counter arc — 28% coverage, accent color, semi-transparent */}
      <AnimatedSvg width={size} height={size} style={[StyleSheet.absoluteFill, svg2Style]}>
        <Circle
          cx={cx} cy={cy} r={outerR}
          stroke={cLast}
          strokeWidth={sw - 1}
          fill="none"
          strokeDasharray={`${outerC * 0.28} ${outerC * 0.72}`}
          strokeLinecap="round"
          strokeOpacity="0.65"
        />
      </AnimatedSvg>
    </>
  );
}

// ── Combo ─────────────────────────────────────────────────────────────────────
// Outer ring: slow clockwise. Inner ring: fast counter-clockwise.
// Spring-bounce pulse on top via Easing.out(Easing.back(2)) — dramatic overshoot.
function ComboFrame({ size, colors }: { size: number; colors: string[] }) {
  const r1        = useSharedValue(0);
  const r2        = useSharedValue(0);
  const pulse     = useSharedValue(1);

  useFocusEffect(
    React.useCallback(() => {
      r1.value = withRepeat(
        withTiming(360,  { duration: 5000, easing: Easing.linear }),
        -1
      );
      r2.value = withRepeat(
        withTiming(-360, { duration: 2400, easing: Easing.linear }),
        -1
      );
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.11, { duration: 520, easing: Easing.out(Easing.back(2)) }),
          withTiming(1.0,  { duration: 620, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.0,  { duration: 650 }),
        ),
        -1
      );
      return () => {
        cancelAnimation(r1); cancelAnimation(r2); cancelAnimation(pulse);
        r1.value = 0; r2.value = 0; pulse.value = 1;
      };
    }, [])
  );

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${r1.value}deg` }, { scale: pulse.value }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${r2.value}deg` }],
  }));

  const sw = 4;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size - sw) / 2;
  const innerR = outerR - 5;
  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;
  const c1    = colors[0];
  const cMid  = colors[Math.floor(colors.length / 2)] ?? c1;
  const cLast = colors[colors.length - 1];

  return (
    <>
      {/* Outer ring — wide arc, full gradient, scaled by pulse */}
      <AnimatedSvg width={size} height={size} style={[StyleSheet.absoluteFill, outerStyle]}>
        <Defs>
          <SvgLinearGradient id={`comboOut_${c1}`} x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((c, i) => (
              <Stop
                key={i}
                offset={`${(i / Math.max(colors.length - 1, 1)) * 100}%`}
                stopColor={c}
              />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={cx} cy={cy} r={outerR}
          stroke={`url(#comboOut_${c1})`}
          strokeWidth={sw + 1}
          fill="none"
          strokeDasharray={`${outerC * 0.78} ${outerC * 0.22}`}
          strokeLinecap="round"
        />
      </AnimatedSvg>
      {/* Inner ring — narrower arc, reversed gradient, counter-rotates */}
      <AnimatedSvg width={size} height={size} style={[StyleSheet.absoluteFill, innerStyle]}>
        <Defs>
          <SvgLinearGradient id={`comboIn_${cLast}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%"   stopColor={cLast} />
            <Stop offset="50%"  stopColor={cMid} />
            <Stop offset="100%" stopColor={c1} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={cx} cy={cy} r={innerR}
          stroke={`url(#comboIn_${cLast})`}
          strokeWidth={sw - 1}
          fill="none"
          strokeDasharray={`${innerC * 0.42} ${innerC * 0.58}`}
          strokeLinecap="round"
          strokeOpacity="0.8"
        />
      </AnimatedSvg>
    </>
  );
}

function Frame({ item, size }: { item: ShopItem; size: number }) {
  switch (item.animationType) {
    case 'neon':   return <NeonFrame size={size} color={item.colors[0]} />;
    case 'pulse':  return <PulseFrame size={size} color={item.colors[0]} />;
    case 'rotate': return <RotateFrame size={size} colors={item.colors} />;
    case 'combo':  return <ComboFrame size={size} colors={item.colors} />;
    default:       return <StaticFrame size={size} color={item.colors[0]} />;
  }
}

export function AvatarWithFrame({ uri, frameId, size = 80 }: Props) {
  const frameItem = frameId ? SHOP_ITEMS_BY_ID[frameId] : null;
  const outerSize = size + (frameItem ? 8 : 0);

  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <SvgLinearGradient id="defaultAvatar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#A78BFA" />
              <Stop offset="100%" stopColor="#7C3AED" />
            </SvgLinearGradient>
            <ClipPath id="avatarClip">
              <Circle cx="50" cy="50" r="50" />
            </ClipPath>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#defaultAvatar)" />
          <G clipPath="url(#avatarClip)">
            <Circle cx="50" cy="36" r="16" fill="rgba(255,255,255,0.88)" />
            <Ellipse cx="50" cy="86" rx="32" ry="24" fill="rgba(255,255,255,0.88)" />
          </G>
        </Svg>
      )}
      {frameItem && <Frame item={frameItem} size={outerSize} />}
    </View>
  );
}
