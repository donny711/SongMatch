import React, { useState, useCallback } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, Mask } from 'react-native-svg';
import {
  useAnimatedReaction,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { RADIUS } from '../../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  targetX: SharedValue<number>;
  targetY: SharedValue<number>;
  targetW: SharedValue<number>;
  targetH: SharedValue<number>;
  padding: number;
}

export function TutorialSpotlight({ targetX, targetY, targetW, targetH, padding }: Props) {
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const updateRect = useCallback((x: number, y: number, w: number, h: number) => {
    setRect({ x, y, w, h });
  }, []);

  useAnimatedReaction(
    () => ({
      x: targetX.value,
      y: targetY.value,
      w: targetW.value,
      h: targetH.value,
    }),
    (cur) => {
      runOnJS(updateRect)(cur.x, cur.y, cur.w, cur.h);
    }
  );

  return (
    <Svg style={StyleSheet.absoluteFill} width={SCREEN_W} height={SCREEN_H} pointerEvents="none">
      <Defs>
        <Mask id="spotlight-mask">
          <Rect width={SCREEN_W} height={SCREEN_H} fill="white" />
          <Rect
            x={rect.x - padding}
            y={rect.y - padding}
            width={rect.w + padding * 2}
            height={rect.h + padding * 2}
            rx={RADIUS.lg}
            ry={RADIUS.lg}
            fill="black"
          />
        </Mask>
      </Defs>
      <Rect
        width={SCREEN_W}
        height={SCREEN_H}
        fill="rgba(0,0,0,0.75)"
        mask="url(#spotlight-mask)"
      />
    </Svg>
  );
}
