# Animated Card Themes — Design Spec

**Date:** 2026-04-21  
**Status:** Draft

---

## Overview

Add animated gradient card themes to the shop. Currently all `cardTheme` catalog items are `static` (solid accent color). This adds 5 new premium themes — rare and legendary — with animated gradients rendered as a thin accent bar in the profile screen.

---

## What Already Works

`profile.tsx` already derives `accentColor = themeItem?.colors[0] ?? COLORS.purple` and applies it to:
- Edit Profile button border/icon/text
- Stats row border color
- Rank card background tint
- Go Pro button gradient
- Section titles ("Music Platforms", "Invite")
- ShowcaseSection accent

This static theming is unchanged. Animated themes keep all of the above and additionally render the `CardThemeAccentBar`.

---

## New Catalog Entries

5 new `cardTheme` items added to `src/data/shopCatalog.ts`:

| id | name | rarity | animationType | colors | cost |
|----|------|--------|--------------|--------|------|
| `theme_nebula` | Nebula | legendary | sweep | `['#4C1D95', '#7C3AED', '#C084FC', '#E879F9']` | 1800 |
| `theme_ember` | Ember | rare | sweep | `['#92400E', '#DC2626', '#F97316']` | 900 |
| `theme_arctic` | Arctic | rare | sweep | `['#0E7490', '#06B6D4', '#A5F3FC']` | 900 |
| `theme_aurora` | Aurora | legendary | combo | `['#065F46', '#059669', '#34D399', '#A78BFA']` | 2200 |
| `theme_prism_live` | Prism Live | legendary | wave | `['#FF0080', '#FF8C00', '#00FF80', '#00BFFF', '#BF00FF']` | 2500 |

`accentColor` uses `colors[0]` for all static accent elements (same as before).

---

## CardThemeAccentBar Component

**File:** `src/components/profile/CardThemeAccentBar.tsx`

**Props:**
```ts
interface Props {
  themeId: string | null;
}
```

**Behavior:**
- Returns `null` if `themeId` is null, undefined, or the resolved item has `animationType === 'static'`
- Renders a full-width, 4px tall animated gradient strip
- Uses `useFocusEffect` + `useSharedValue` (Reanimated) to start/stop animations on tab focus, identical pattern to `ProfileBackground`

**Animation per type:**

- `sweep` — a wide `LinearGradient` (1.5× screen width) slides left/right with `withRepeat(withSequence(...))`, 8s cycle, `Easing.inOut(Easing.sin)`. Same logic as `SweepBackground` in `ProfileBackground.tsx` but height is 4px.
- `wave` — `LinearGradient` opacity pulses between 0.6 and 1.0, 1.4s cycle. Colors stay fixed.
- `combo` — sweep motion + opacity pulse combined.
- `float` — treated same as `sweep` (orbs make no sense at 4px height).

**Dependencies:** `expo-linear-gradient`, `react-native-reanimated`, `expo-router` (useFocusEffect). All already installed.

---

## Profile Screen Integration

**File:** `app/(tabs)/profile.tsx`

Add `CardThemeAccentBar` import and place it between the `identityZone` View and the `sections` View:

```jsx
</View>  {/* end identityZone */}

<CardThemeAccentBar themeId={equippedItems.cardTheme} />

<View style={styles.sections}>
```

No layout changes needed — the bar is `position: relative`, full width, zero margin.

---

## Shop Preview Update

**File:** `src/components/shop/ShopItemCard.tsx`

In the `ItemPreview` component, for `cardTheme` items with `animationType !== 'static'`:
- Render a horizontal gradient swatch (using `LinearGradient` from `expo-linear-gradient`) filling the preview rect instead of the current solid `backgroundColor + themeAccent` strip.
- Static themes keep the existing solid color preview.

---

## What Does NOT Change

- All existing `cardTheme` items remain static (no `CardThemeAccentBar` for them)
- `accentColor` derivation is unchanged (`colors[0]`)
- All existing profile accent elements (liked number, rank card tint, etc.) are unchanged
- `ProfileBackground` component is unchanged

---

## File Touch Summary

| File | Change |
|------|--------|
| `src/data/shopCatalog.ts` | Add 5 new `cardTheme` entries |
| `src/components/profile/CardThemeAccentBar.tsx` | New component |
| `app/(tabs)/profile.tsx` | Import + place `<CardThemeAccentBar>` |
| `src/components/shop/ShopItemCard.tsx` | Gradient swatch for animated themes |
