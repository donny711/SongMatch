import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { RADIUS } from '../../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// The dim layer is one view's border, sized to cover the screen from any
// hole position. The transparent interior is the spotlight hole.
const DIM = Math.max(SCREEN_W, SCREEN_H) + 100;

interface Props {
  targetX: SharedValue<number>;
  targetY: SharedValue<number>;
  targetW: SharedValue<number>;
  targetH: SharedValue<number>;
  padding: number;
}

/**
 * Border-trick spotlight: a single Animated.View whose huge border paints the
 * dim overlay and whose interior is the rounded hole. Runs entirely on the UI
 * thread — the previous SVG-mask version called runOnJS + setState every
 * animation frame, re-rendering React and re-rasterizing the mask (visibly
 * choppy on device).
 */
export function TutorialSpotlight({ targetX, targetY, targetW, targetH, padding }: Props) {
  const holeStyle = useAnimatedStyle(() => ({
    left: targetX.value - padding - DIM,
    top: targetY.value - padding - DIM,
    width: targetW.value + padding * 2 + DIM * 2,
    height: targetH.value + padding * 2 + DIM * 2,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.hole,
        // Inner corner radius = borderRadius - borderWidth, so this rounds
        // the hole by RADIUS.lg while the outer edge stays offscreen.
        { borderWidth: DIM, borderRadius: DIM + RADIUS.lg },
        holeStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  hole: {
    position: 'absolute',
    borderColor: 'rgba(0,0,0,0.75)',
  },
});
