import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../../store/toastStore';
import { COLORS, RADIUS, SPACING } from '../../theme';

export function MPToast() {
  const current = useToastStore((s) => s.current);
  const next = useToastStore((s) => s.next);
  const insets = useSafeAreaInsets();

  const slideY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!current || current.id === prevId.current) return;
    prevId.current = current.id;

    slideY.setValue(-80);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 160 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideY, { toValue: -80, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => next());
    }, 2800);

    return () => clearTimeout(timer);
  }, [current?.id]);

  if (!current) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { top: insets.top + 10 },
        { transform: [{ translateY: slideY }], opacity },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="diamond" size={13} color="#22D3EE" />
      </View>
      <Text style={styles.points}>+{current.points} MP</Text>
      <View style={styles.sep} />
      <Text style={styles.label} numberOfLines={1}>{current.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    zIndex: 9999,
    maxWidth: 300,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(34,211,238,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  points: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '800',
  },
  sep: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
});
