import React from 'react';
import { View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { SHOP_ITEMS_BY_ID } from '../../data/shopCatalog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 4;

interface Props {
  themeId: string | null | undefined;
}

export function CardThemeAccentBar({ themeId }: Props) {
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);

  const item = themeId ? SHOP_ITEMS_BY_ID[themeId] : null;
  const isAnimated = !!item && item.animationType !== 'static';

  useFocusEffect(
    React.useCallback(() => {
      if (!isAnimated || !item) return;

      if (item.animationType === 'sweep') {
        tx.value = withRepeat(
          withSequence(
            withTiming(-SCREEN_WIDTH * 0.5, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        );
      } else if (item.animationType === 'wave') {
        opacity.value = withRepeat(
          withSequence(
            withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        );
      } else if (item.animationType === 'combo') {
        tx.value = withRepeat(
          withSequence(
            withTiming(-SCREEN_WIDTH * 0.4, { duration: 10000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 10000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        );
        opacity.value = withRepeat(
          withSequence(
            withTiming(0.65, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        );
      }

      return () => {
        cancelAnimation(tx);
        cancelAnimation(opacity);
        tx.value = 0;
        opacity.value = 1;
      };
    }, [isAnimated, item?.id]),
  );

  if (!isAnimated || !item) return null;

  const colors = (
    item.colors.length >= 2 ? item.colors : [item.colors[0], item.colors[0]]
  ) as [string, string, ...string[]];

  // For sweep/combo, use a wider strip that slides; for wave, full width static + opacity pulse
  const isSweep = item.animationType === 'sweep' || item.animationType === 'combo';
  const gradientWidth = isSweep ? SCREEN_WIDTH * 1.5 : SCREEN_WIDTH;

  const animStyle = useAnimatedStyle(() => ({
    transform: isSweep ? [{ translateX: tx.value }] : [],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: SCREEN_WIDTH, height: BAR_HEIGHT, overflow: 'hidden' }}>
      <Animated.View style={[{ width: gradientWidth, height: BAR_HEIGHT }, animStyle]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
