import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';

interface Props {
  likeStyle: object;
  nopeStyle: object;
}

export default function SwipeIndicators({ likeStyle, nopeStyle }: Props) {
  return (
    <>
      <Animated.View style={[styles.badge, styles.like, likeStyle]}>
        <Ionicons name="heart" size={24} color="#fff" />
        <Animated.Text style={styles.likeText}>LIKE</Animated.Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.nope, nopeStyle]}>
        <Ionicons name="close" size={24} color="#fff" />
        <Animated.Text style={styles.nopeText}>NOPE</Animated.Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 48,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  like: {
    left: 20,
    backgroundColor: COLORS.green,
    transform: [{ rotate: '-15deg' }],
    shadowColor: COLORS.green,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },
  nope: {
    right: 20,
    backgroundColor: COLORS.pink,
    transform: [{ rotate: '15deg' }],
    shadowColor: COLORS.pink,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },
  likeText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  nopeText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
