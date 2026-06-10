import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

// ── Sprite sheet layout ─────────────────────────────────────────────────────
//
//  rank_badges.png is a 1254×1254 sprite sheet — 4 columns × 4 rows.
//  Each cell: 313.5 × 313.5 px
//
//  Rows    (top → bottom):  Silver | Gold | Diamond | Legend
//  Columns (left → right):  Div I  | Div II | Div III | Div IV

const SPRITE = require('../../../assets/images/rank_badges.png');
const CELLS  = 4;

const TIER_ROW: Record<string, number> = {
  silver:  0,
  gold:    1,
  diamond: 2,
  legend:  3,
};

interface Props {
  rankId: string;  // e.g. 'silver_1', 'gold_3', 'diamond_2', 'legend_4'
  size?: number;
}

export function RankBadge({ rankId, size = 72 }: Props) {
  const [tierStr = 'silver', divStr = '1'] = rankId.split('_');
  const row = TIER_ROW[tierStr] ?? 0;
  const col = Math.min(3, Math.max(0, (parseInt(divStr, 10) || 1) - 1));

  // Scale the full sprite so that one cell = size px
  const scaledFull = size * CELLS;
  const offset     = size; // one cell = size px, so col/row offset in px

  return (
    <View style={[styles.clip, { width: size, height: size }]}>
      <Image
        source={SPRITE}
        style={{
          position: 'absolute',
          width:  scaledFull,
          height: scaledFull,
          left:  -col * offset,
          top:   -row * offset,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
