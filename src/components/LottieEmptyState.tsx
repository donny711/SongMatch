import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { COLORS, SPACING } from '../theme';

interface Props {
  animationSource: object;
  title: string;
  subtitle: string;
}

export default function LottieEmptyState({ animationSource, title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <LottieView source={animationSource} autoPlay loop style={styles.animation} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xxl },
  animation: { width: 120, height: 120 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
