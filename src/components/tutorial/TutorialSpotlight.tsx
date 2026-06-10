import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { COLORS, RADIUS } from '../../theme';
import type { TargetRect } from './TutorialMeasureContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DIM_COLOR = 'rgba(0,0,0,0.75)';

interface Props {
  rect: TargetRect;
  padding: number;
}

/**
 * Four plain dim strips around the hole + a highlight ring. Every previous
 * implementation (SVG mask, giant border-trick view) created a layer far
 * bigger than the screen; the overlay's opacity fade then composited that
 * oversized layer offscreen every frame — choppy on device no matter how the
 * hole was drawn. These views never exceed screen size, so fades stay cheap.
 */
export function TutorialSpotlight({ rect, padding }: Props) {
  const left = Math.max(0, rect.x - padding);
  const top = Math.max(0, rect.y - padding);
  const right = Math.min(SCREEN_W, rect.x + rect.width + padding);
  const bottom = Math.min(SCREEN_H, rect.y + rect.height + padding);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.dim, { left: 0, right: 0, top: 0, height: top }]} />
      <View style={[styles.dim, { left: 0, right: 0, top: bottom, bottom: 0 }]} />
      <View style={[styles.dim, { left: 0, top, width: left, height: bottom - top }]} />
      <View style={[styles.dim, { left: right, right: 0, top, height: bottom - top }]} />
      {/* Highlight ring marks the target and softens the hole's square corners */}
      <View
        style={[
          styles.ring,
          { left: left - 2, top: top - 2, width: right - left + 4, height: bottom - top + 4 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: DIM_COLOR,
  },
  ring: {
    position: 'absolute',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.purple,
  },
});
