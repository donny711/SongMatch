import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { RADIUS } from '../../theme';
import type { TargetRect } from './TutorialMeasureContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// The dim layer is one view's border, sized to cover the screen from any
// hole position. The transparent interior is the spotlight hole.
const DIM = Math.max(SCREEN_W, SCREEN_H) + 100;

interface Props {
  rect: TargetRect;
  padding: number;
}

/**
 * Static border-trick spotlight: the huge border paints the dim layer and the
 * rounded interior is the hole. Position changes are a single layout per step
 * — no per-frame animation. Earlier versions animated the hole every frame
 * (first via SVG-mask re-rasters, then via layout props on this giant view);
 * both were unusably choppy on device. Step transitions are covered by the
 * overlay/tooltip opacity fades, which stay on the GPU.
 */
export function TutorialSpotlight({ rect, padding }: Props) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.hole,
        {
          left: rect.x - padding - DIM,
          top: rect.y - padding - DIM,
          width: rect.width + padding * 2 + DIM * 2,
          height: rect.height + padding * 2 + DIM * 2,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  hole: {
    position: 'absolute',
    borderColor: 'rgba(0,0,0,0.75)',
    borderWidth: DIM,
    // Inner corner radius = borderRadius - borderWidth → rounds the hole by
    // RADIUS.lg while the outer edge stays offscreen.
    borderRadius: DIM + RADIUS.lg,
  },
});
