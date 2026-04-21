import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  cancelAnimation,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.68;

export default function SkeletonCard() {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.80, { duration: 780 }),
        withTiming(0.35, { duration: 780 })
      ),
      -1,
      false
    );
    return () => cancelAnimation(opacity);
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.infoBlock}>
        <View style={[styles.bar, { width: '72%', height: 26 }]} />
        <View style={[styles.bar, { width: '46%', height: 15, backgroundColor: 'rgba(196,181,253,0.22)' }]} />
        <View style={[styles.bar, { width: '62%', height: 12 }]} />
        <View style={[styles.bar, { height: 44, borderRadius: 22, backgroundColor: 'rgba(167,139,250,0.20)' }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    backgroundColor: '#1F1F28',
    overflow: 'hidden',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.50,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(167,139,250,0.07)',
  },
  infoBlock: {
    padding: 20,
    paddingBottom: 18,
    gap: 10,
    backgroundColor: 'rgba(13,13,13,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.14)',
  },
  bar: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 7,
  },
});
