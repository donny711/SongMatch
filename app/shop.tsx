import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProfileStore } from '../src/store/profileStore';
import { useDeckStore } from '../src/store/deckStore';
import { CATALOG_BY_TYPE, type ShopItem, type ShopItemType } from '../src/data/shopCatalog';
import { RANKS } from '../src/data/ranks';
import { RankBadge } from '../src/components/profile/RankBadge';
import { ShopItemCard } from '../src/components/shop/ShopItemCard';
import { MatchPointsDisplay } from '../src/components/profile/MatchPointsDisplay';
import { COLORS, SPACING, RADIUS } from '../src/theme';
import type { EquipSlot } from '../src/firebase/profileService';

type ActiveTab = ShopItemType | 'ranks';

const CATEGORIES: { key: ActiveTab; label: string }[] = [
  { key: 'avatarFrame', label: 'Frames' },
  { key: 'profileBackground', label: 'Backgrounds' },
  { key: 'profileTheme', label: 'Themes' },
  { key: 'badge', label: 'Badges' },
  { key: 'cardTheme', label: 'Accents' },
  { key: 'ranks', label: 'Ranks' },
];

const SLOT_FOR_TYPE: Record<ShopItemType, EquipSlot | null> = {
  avatarFrame: 'avatarFrame',
  profileBackground: 'profileBackground',
  cardTheme: 'cardTheme',
  badge: null, // badge slot selection handled separately
  profileTheme: 'profileTheme',
};

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<ActiveTab>('avatarFrame');
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const points = useProfileStore((s) => s.points);
  const ownedItems = useProfileStore((s) => s.ownedItems);
  const equippedItems = useProfileStore((s) => s.equippedItems);
  const purchase = useProfileStore((s) => s.purchase);
  const equip = useProfileStore((s) => s.equip);
  const likedCount = useDeckStore((s) => s.likedCount);

  const items = activeCategory !== 'ranks' ? CATALOG_BY_TYPE[activeCategory] : [];
  const isEquipped = (item: ShopItem) => Object.values(equippedItems).includes(item.id);

  const handleItemPress = async (item: ShopItem) => {
    const owned = ownedItems.includes(item.id);

    if (owned) {
      // Equip / unequip
      if (item.type === 'badge') {
        // Find an empty badge slot or cycle
        const slots: EquipSlot[] = ['badge1', 'badge2', 'badge3'];
        const currentSlot = slots.find((s) => equippedItems[s] === item.id);
        if (currentSlot) {
          await equip(currentSlot, null);
        } else {
          const emptySlot = slots.find((s) => !equippedItems[s]);
          const targetSlot = emptySlot ?? 'badge1';
          await equip(targetSlot, item.id);
        }
        return;
      }
      const slot = SLOT_FOR_TYPE[item.type];
      if (!slot) return;
      const alreadyEquipped = equippedItems[slot] === item.id;
      await equip(slot, alreadyEquipped ? null : item.id);
      return;
    }

    if (item.cost === 0) return; // milestone-granted, not purchasable

    if (points < item.cost) {
      Alert.alert(
        'Not enough MatchPoints',
        `You need ${(item.cost - points).toLocaleString('en-US')} more MP to unlock ${item.name}.`
      );
      return;
    }

    Alert.alert(
      `Buy ${item.name}?`,
      `This will cost ${item.cost.toLocaleString('en-US')} MP. You have ${points.toLocaleString('en-US')} MP.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Buy for ${item.cost.toLocaleString('en-US')} MP`,
          onPress: async () => {
            setPurchasing(item.id);
            try {
              await purchase(item.id);
            } catch {
              Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ShopItem }) => {
    const owned = ownedItems.includes(item.id);
    const equipped = isEquipped(item);
    const canAfford = points >= item.cost;
    const isLoading = purchasing === item.id;

    return (
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={[styles.card, styles.cardLoading]}>
            <ActivityIndicator color={COLORS.purple} />
          </View>
        ) : (
          <ShopItemCard
            item={item}
            owned={owned}
            equipped={equipped}
            canAfford={canAfford}
            onPress={() => handleItemPress(item)}
          />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Shop</Text>
        <MatchPointsDisplay points={points} size="lg" />
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.tab, activeCategory === cat.key && styles.tabActive]}
            onPress={() => setActiveCategory(cat.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, activeCategory === cat.key && styles.tabTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ranks collection */}
      {activeCategory === 'ranks' ? (
        <FlatList
          key="ranks"
          data={RANKS}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.ranksList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: rank }) => {
            const earned = likedCount >= rank.minLikes;
            const isEquipped = equippedItems.equippedRank === rank.id;
            return (
              <TouchableOpacity
                style={[
                  styles.rankRow,
                  !earned && styles.rankRowLocked,
                  isEquipped && { borderColor: rank.color, borderWidth: 1.5 },
                ]}
                onPress={earned ? async () => { await equip('equippedRank', isEquipped ? null : rank.id); } : undefined}
                activeOpacity={earned ? 0.75 : 1}
              >
                <View style={{ opacity: earned ? 1 : 0.3 }}>
                  <RankBadge rankId={rank.id} size={52} />
                </View>
                <View style={styles.rankRowText}>
                  <Text style={[styles.rankRowLabel, { color: earned ? rank.color : COLORS.textMuted }]}>
                    {rank.label}
                  </Text>
                  <Text style={styles.rankRowReq}>
                    {rank.minLikes === 0 ? 'Starting rank' : `${rank.minLikes.toLocaleString('en-US')} likes required`}
                  </Text>
                  <Text style={styles.rankRowTime}>{rank.timeEstimate}</Text>
                </View>
                {isEquipped ? (
                  <View style={[styles.equippedChip, { backgroundColor: `${rank.color}22`, borderColor: rank.color }]}>
                    <Text style={[styles.equippedChipText, { color: rank.color }]}>Equipped</Text>
                  </View>
                ) : earned ? (
                  <Ionicons name="checkmark-circle" size={22} color={rank.color} />
                ) : (
                  <Ionicons name="lock-closed" size={16} color={COLORS.textMuted} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        /* Grid */
        <FlatList
          key="grid"
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    maxHeight: 48,
  },
  tabBarContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  tabActive: {
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  tabText: {
    color: COLORS.textSub,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.purple,
    fontWeight: '700',
  },
  grid: {
    padding: SPACING.sm,
    paddingBottom: SPACING.xxl,
  },
  card: {
    flex: 1,
    margin: SPACING.xs,
    minHeight: 150,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Ranks tab
  ranksList: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
    gap: SPACING.xs,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankRowLocked: {
    borderColor: 'rgba(167,139,250,0.07)',
  },
  rankRowText: { flex: 1, gap: 3 },
  rankRowLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  rankRowReq: { color: COLORS.textMuted, fontSize: 12 },
  rankRowTime: { color: COLORS.textMuted, fontSize: 11, opacity: 0.7 },
  equippedChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  equippedChipText: { fontSize: 11, fontWeight: '700' },
});
