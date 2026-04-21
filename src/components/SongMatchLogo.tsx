import React from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface Props {
  size?: number;
}

// 5-bar equalizer mark — matches the default app icon (bars only, no background)
// viewBox: 0 0 66 80 (bars centered, heights 28/56/80/56/28)
export function SongMatchLogo({ size = 34 }: Props) {
  const w = Math.round(size * (66 / 80));
  return (
    <Svg width={w} height={size} viewBox="0 0 66 80">
      <Defs>
        <LinearGradient id="logo_g" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#A78BFA" stopOpacity="1" />
          <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0.35" />
        </LinearGradient>
      </Defs>
      <Rect x="0"  y="26" width="10" height="28" rx="5" fill="url(#logo_g)" opacity={0.35} />
      <Rect x="14" y="12" width="10" height="56" rx="5" fill="url(#logo_g)" opacity={0.65} />
      <Rect x="28" y="0"  width="10" height="80" rx="5" fill="url(#logo_g)" />
      <Rect x="42" y="12" width="10" height="56" rx="5" fill="url(#logo_g)" opacity={0.65} />
      <Rect x="56" y="26" width="10" height="28" rx="5" fill="url(#logo_g)" opacity={0.35} />
    </Svg>
  );
}
