import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default festival palette: purple → hot pink → electric cyan
const DEFAULT_COLORS = ['#FFFFFF', '#A78BFA'];

interface Props {
  children: string;
  fontSize?: number;
  /** Horizontal padding on each side (to match screen padding) */
  hPad?: number;
  colors?: string[];
  letterSpacing?: number;
  centered?: boolean;
}

export default function GradientText({
  children,
  fontSize = 34,
  hPad = 16,
  colors = DEFAULT_COLORS,
  letterSpacing = -1,
  centered = false,
}: Props) {
  const svgW = SCREEN_WIDTH - hPad * 2;
  const svgH = Math.ceil(fontSize * 1.3);
  const gradId = `tg_${children.replace(/\W/g, '').slice(0, 8)}`;

  const stopStep = colors.length === 1 ? 0 : 1 / (colors.length - 1);

  return (
    <Svg height={svgH} width={svgW}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          {colors.map((c, i) => (
            <Stop
              key={i}
              offset={String(i * stopStep)}
              stopColor={c}
              stopOpacity="1"
            />
          ))}
        </LinearGradient>
      </Defs>
      <SvgText
        fill={`url(#${gradId})`}
        fontSize={fontSize}
        fontWeight="bold"
        x={centered ? svgW / 2 : 0}
        y={fontSize}
        letterSpacing={letterSpacing}
        textAnchor={centered ? 'middle' : 'start'}
      >
        {children}
      </SvgText>
    </Svg>
  );
}
