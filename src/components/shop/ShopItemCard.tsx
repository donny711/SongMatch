import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { type ShopItem, RARITY_COLORS } from '../../data/shopCatalog';
import { BADGE_ICONS } from '../profile/BadgeRow';

interface Props {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  onPress: () => void;
}

function ItemPreview({ item }: { item: ShopItem }) {
  const color = item.colors[0];

  if (item.type === 'badge') {
    const iconName = BADGE_ICONS[item.id] ?? 'ribbon';
    return (
      <View style={[styles.previewCircle, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
        <Ionicons name={iconName as any} size={28} color={color} />
      </View>
    );
  }

  if (item.type === 'cardTheme') {
    if (item.animationType !== 'static' && item.colors.length >= 2) {
      const gradColors = item.colors as [string, string, ...string[]];
      return (
        <View style={[styles.previewRect, { borderColor: `${color}66`, overflow: 'hidden' }]}>
          <LinearGradient
            colors={gradColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </View>
      );
    }
    return (
      <View style={[styles.previewRect, { backgroundColor: `${color}33`, borderColor: `${color}55` }]}>
        <View style={[styles.themeAccent, { backgroundColor: color }]} />
        <Ionicons name="color-palette" size={20} color={color} />
      </View>
    );
  }

  if (item.type === 'avatarFrame') {
    return (
      <View style={styles.previewCircle}>
        <View style={[styles.frameInner, { borderColor: color }]}>
          <Ionicons name="person" size={18} color={COLORS.textMuted} />
        </View>
      </View>
    );
  }

  // profileBackground
  return (
    <View style={[styles.previewRect, { backgroundColor: `${color}22`, borderColor: `${color}44`, overflow: 'hidden' }]}>
      {item.colors.slice(0, 3).map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: `${c}55` }} />
      ))}
    </View>
  );
}

export function ShopItemCard({ item, owned, equipped, canAfford, onPress }: Props) {
  const rarityColor = RARITY_COLORS[item.rarity];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        equipped && styles.cardEquipped,
        !owned && !canAfford && styles.cardDimmed,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Rarity indicator */}
      <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />

      {/* Preview */}
      <ItemPreview item={item} />

      {/* Name */}
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>

      {/* Status chip */}
      {equipped ? (
        <View style={[styles.chip, styles.chipEquipped]}>
          <Ionicons name="checkmark-circle" size={10} color="#A78BFA" />
          <Text style={[styles.chipText, { color: '#A78BFA' }]}>Equipped</Text>
        </View>
      ) : owned ? (
        <View style={[styles.chip, styles.chipOwned]}>
          <Text style={[styles.chipText, { color: COLORS.textSub }]}>Tap to equip</Text>
        </View>
      ) : item.cost === 0 ? (
        <View style={[styles.chip, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
          <Ionicons name="lock-open" size={10} color="#A78BFA" />
          <Text style={[styles.chipText, { color: '#A78BFA' }]}>Free</Text>
        </View>
      ) : (
        <View style={[styles.chip, canAfford ? styles.chipBuy : styles.chipCantAfford]}>
          <Ionicons name="diamond" size={10} color={canAfford ? '#22D3EE' : COLORS.textMuted} />
          <Text style={[styles.chipText, { color: canAfford ? '#22D3EE' : COLORS.textMuted }]}>
            {item.cost.toLocaleString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingTop: 32,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-start',
  },
  cardEquipped: {
    borderColor: 'rgba(167,139,250,0.4)',
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  cardDimmed: {
    opacity: 0.5,
  },
  rarityDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  previewRect: {
    width: 72,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
  },
  name: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipEquipped: {
    backgroundColor: 'rgba(167,139,250,0.15)',
  },
  chipOwned: {
    backgroundColor: COLORS.surface,
  },
  chipBuy: {
    backgroundColor: 'rgba(34,211,238,0.15)',
  },
  chipCantAfford: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
