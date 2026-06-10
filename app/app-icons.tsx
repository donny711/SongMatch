import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect as SvgRect } from 'react-native-svg';
import { useSubscriptionStore } from '../src/store/subscriptionStore';
import { APP_ICONS, ICON_CATEGORIES, type AppIconDef } from '../src/data/appIcons';
import { COLORS, SPACING } from '../src/theme';
import { lightTap } from '../src/utils/haptics';

let AlternateIcons: any = null;
try { AlternateIcons = require('expo-alternate-app-icons'); } catch {}

function toPascalCase(id: string): string {
  return id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
function toIconId(name: string | null): string {
  if (!name) return 'dark_purple';
  return name.replace(/([A-Z])/g, (c, _, i) => (i ? '_' : '') + c.toLowerCase());
}

const CARD_SIZE = 80;
const CARD_BR = 18;

// Pixel-accurate SVG preview matching the HTML icon designs.
// Bar geometry matches viewBox 120x120: heights 28/56/80/56/28, centered at y=60.
// Bars use a vertical gradient (barGradStart top -> barGradEnd bottom at barGradEndOpacity).
function IconPreview({ icon, size = CARD_SIZE }: { icon: AppIconDef; size?: number }) {
  const bgId = 'bg_' + icon.id;
  const barId = 'bar_' + icon.id;
  const hasGradBg = icon.bgColors.length > 1;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        {hasGradBg ? (
          <SvgGrad id={bgId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={icon.bgColors[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={icon.bgColors[1]} stopOpacity="1" />
          </SvgGrad>
        ) : null}
        <SvgGrad id={barId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={icon.barGradStart} stopOpacity="1" />
          <Stop offset="1" stopColor={icon.barGradEnd} stopOpacity={icon.barGradEndOpacity} />
        </SvgGrad>
      </Defs>
      <SvgRect width="120" height="120" rx="28" fill={hasGradBg ? ('url(#' + bgId + ')') : icon.bgColors[0]} />
      {icon.innerBorder ? <SvgRect x="6" y="6" width="108" height="108" rx="23" fill="none" stroke={icon.innerBorder} strokeWidth="1.5" opacity="0.4" /> : null}
      <SvgRect x="29" y="46" width="10" height="28" rx="5" fill={'url(#' + barId + ')'} opacity={icon.opacities[0]} />
      <SvgRect x="43" y="32" width="10" height="56" rx="5" fill={'url(#' + barId + ')'} opacity={icon.opacities[1]} />
      <SvgRect x="57" y="20" width="10" height="80" rx="5" fill={'url(#' + barId + ')'} opacity={icon.opacities[2]} />
      <SvgRect x="71" y="32" width="10" height="56" rx="5" fill={'url(#' + barId + ')'} opacity={icon.opacities[3]} />
      <SvgRect x="85" y="46" width="10" height="28" rx="5" fill={'url(#' + barId + ')'} opacity={icon.opacities[4]} />
    </Svg>
  );
}

function IconCard({ icon, isActive, canUse, onPress }: {
  icon: AppIconDef; isActive: boolean; canUse: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.previewWrap, isActive && styles.previewWrapActive]}>
        <IconPreview icon={icon} />
        {!canUse && (
          <View style={styles.lockBadge}>
            <MaterialCommunityIcons name="crown" size={10} color="#ffd700" />
          </View>
        )}
        {isActive && <View style={styles.activeDot} />}
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{icon.name}</Text>
      <View style={[styles.tagPill, { backgroundColor: icon.tagBg }]}>
        <Text style={[styles.tagText, { color: icon.tagColor }]}>{icon.tag}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AppIconsScreen() {
  const insets = useSafeAreaInsets();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const [activeIcon, setActiveIcon] = useState<string>('dark_purple');

  useEffect(() => {
    if (!AlternateIcons) return;
    try {
      const name = AlternateIcons.getAppIconName?.() ?? null;
      setActiveIcon(toIconId(name));
    } catch {}
  }, []);

  const handleSelect = useCallback(async (icon: AppIconDef) => {
    lightTap();
    if (icon.pro && !isPro) { router.push('/upgrade'); return; }
    if (icon.id === activeIcon) return;
    if (!AlternateIcons) {
      Alert.alert('Not available', 'Alternate icons only work in a native build.');
      return;
    }
    try {
      await AlternateIcons.setAlternateAppIcon(icon.id === 'dark_purple' ? null : toPascalCase(icon.id));
      setActiveIcon(icon.id);
    } catch (e: any) {
      Alert.alert('Could not change icon', e?.message ?? 'Unknown error');
    }
  }, [isPro, activeIcon]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Icon</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {ICON_CATEGORIES.map((cat) => {
          const icons = APP_ICONS.filter((ic) => ic.category === cat);
          return (
            <View key={cat} style={styles.section}>
              <Text style={styles.sectionLabel}>{cat}</Text>
              <View style={styles.grid}>
                {icons.map((icon) => (
                  <IconCard
                    key={icon.id}
                    icon={icon}
                    isActive={activeIcon === icon.id}
                    canUse={!icon.pro || isPro}
                    onPress={() => handleSelect(icon)}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg },
  section: { marginBottom: SPACING.xl },
  sectionLabel: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACING.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { alignItems: 'center', gap: 5, width: CARD_SIZE },
  previewWrap: {
    borderRadius: CARD_BR + 4, borderWidth: 2.5,
    borderColor: 'transparent', padding: 2,
  },
  previewWrapActive: { borderColor: COLORS.purple },
  lockBadge: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10, padding: 3,
  },
  activeDot: {
    position: 'absolute', bottom: 5, alignSelf: 'center',
    width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.purple,
  },
  cardName: { color: COLORS.text, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  tagPill: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  tagText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.4 },
});

