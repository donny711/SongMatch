import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHOP_ITEMS_BY_ID } from '../../data/shopCatalog';
import { RADIUS } from '../../theme';

// Maps badge IDs to Ionicons icon names
const BADGE_ICONS: Record<string, string> = {
  badge_early_adopter: 'flash',
  badge_streak_7: 'flame',
  badge_streak_30: 'flame',
  badge_liked_50: 'heart',
  badge_liked_100: 'heart',
  badge_double_platform: 'link',
  badge_star_gold: 'star',
  badge_diamond: 'diamond',
  badge_crown: 'trophy',
  badge_skull: 'skull',
  badge_infinity: 'infinite',
  badge_legendary_aura: 'sparkles',
};

function BadgeIcon({ badgeId }: { badgeId: string }) {
  const item = SHOP_ITEMS_BY_ID[badgeId];
  if (!item) return null;
  const iconName = BADGE_ICONS[badgeId] ?? 'ribbon';
  const color = item.colors[0] ?? '#A855F7';

  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
      <Ionicons name={iconName as any} size={14} color={color} />
    </View>
  );
}

interface Props {
  badge1: string | null;
  badge2: string | null;
  badge3: string | null;
}

export function BadgeRow({ badge1, badge2, badge3 }: Props) {
  const badges = [badge1, badge2, badge3].filter(Boolean) as string[];
  if (badges.length === 0) return null;

  return (
    <View style={styles.row}>
      {badges.map((id) => (
        <BadgeIcon key={id} badgeId={id} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { BADGE_ICONS };
