# Profile Themes — Design Spec
Date: 2026-04-23

## Overview

Add a new **Themes** cosmetic tab to the shop. Each theme equips to a new `profileTheme` slot and does two things simultaneously: (1) renders a gradient or animated background in the profile content area **below** the banner, and (2) provides a coordinated accent color for profile UI elements. Themes do not touch the banner area (owned by `profileBackground`) or the swipe card (owned by `cardTheme`).

---

## Data Model

### `ShopItemType` (shopCatalog.ts)
Add `'profileTheme'` to the union:
```ts
export type ShopItemType = 'avatarFrame' | 'profileBackground' | 'badge' | 'cardTheme' | 'profileTheme';
```

### Color array convention for `profileTheme` items
- `colors[0]` — accent color (used for stats numbers, labels, UI highlights in the profile content area)
- `colors[1...]` — gradient stops for the below-banner background fill

No new fields on `ShopItem` are needed.

### `EquipSlot` (profileService.ts)
Add `'profileTheme'` to the `EquipSlot` union. The existing `equip()` and Firestore sync logic handles it without changes.

### `CATALOG_BY_TYPE` (shopCatalog.ts)
Add:
```ts
profileTheme: SHOP_CATALOG.filter(item => item.type === 'profileTheme'),
```

---

## Catalog Items (12 total)

### Common — static gradients (200–400 MP)

| ID | Name | Accent (`colors[0]`) | Background gradient (`colors[1...]`) | Cost |
|----|------|----------------------|--------------------------------------|------|
| `pt_void` | Void | `#A78BFA` | `#0D0D1A`, `#06030F` | 200 |
| `pt_carbon` | Carbon | `#94A3B8` | `#1C1C1E`, `#0D0D0D` | 200 |
| `pt_ember` | Ember | `#FB923C` | `#1A0505`, `#0D0D0D` | 300 |
| `pt_abyss` | Abyss | `#38BDF8` | `#020B18`, `#030712` | 300 |

### Rare — richer gradients (600–1000 MP)

| ID | Name | Accent | Background gradient | Cost |
|----|------|--------|---------------------|------|
| `pt_sapphire` | Sapphire | `#22D3EE` | `#0A1628`, `#0E3A6B`, `#030B18` | 600 |
| `pt_amethyst` | Amethyst | `#C084FC` | `#1A0A2E`, `#2D1580`, `#06030F` | 700 |
| `pt_jade` | Jade | `#34D399` | `#042B2B`, `#065F46`, `#030F06` | 800 |
| `pt_crimson` | Crimson | `#F43F5E` | `#1A0510`, `#4C0020`, `#0D0205` | 1000 |

### Legendary — animated (1800–2500 MP)

| ID | Name | Accent | Animation type | Cost |
|----|------|--------|----------------|------|
| `pt_nebula` | Nebula | `#C084FC` | `plasma` | 1800 |
| `pt_inferno` | Inferno | `#FB923C` | `molten` | 2000 |
| `pt_aurora` | Aurora | `#34D399` | `tide` | 2200 |
| `pt_prism` | Prism | `#FF0080` | `glitch` | 2500 |

---

## Shop UI Changes

### `shop.tsx`
1. Add `{ key: 'profileTheme', label: 'Themes' }` to `CATEGORIES` between Backgrounds and Badges.
2. Add `profileTheme: 'profileTheme'` to `SLOT_FOR_TYPE`. The existing `handleItemPress` equip/purchase flow works unchanged.

### `ShopItemCard.tsx` — `ItemPreview`
Add a `profileTheme` case inside the `ItemPreview` function:
- Render a `previewRect` (72×44) showing a horizontal `LinearGradient` using `colors.slice(1)` as the gradient stops.
- Overlay a small circle in the top-right corner filled with `colors[0]` (the accent) to distinguish it from plain background previews.

---

## Profile Screen Integration (`profile.tsx`)

### New derived values
```ts
const profileThemeItem = equippedItems.profileTheme
  ? SHOP_ITEMS_BY_ID[equippedItems.profileTheme]
  : null;
const profileAccent = profileThemeItem?.colors[0] ?? null;
```

### Below-banner background
Render `<ProfileThemeBackground themeId={equippedItems.profileTheme ?? null} height={contentHeight} />` as an absolute-fill layer inside the profile content area (below the banner), at z-index below all content. Opacity 0.85 keeps text readable.

### Accent color priority
Profile UI elements that currently use `accentColor` (derived from `cardTheme`) switch to:
```ts
const profileUiAccent = profileAccent ?? accentColor;
```
This means:
- Theme equipped → theme accent colors profile stats/labels
- No theme → falls back to card theme accent (existing behavior)
- Card theme is unaffected on the swipe screen

---

## New Component: `ProfileThemeBackground`

**Location:** added as a second export in `src/components/profile/ProfileBackground.tsx`. All animation sub-components (`PlasmaBackground`, `MoltenBackground`, `TideBackground`, `GlitchBackground`) are already defined there — no duplication or new imports needed.

**Signature:**
```ts
export function ProfileThemeBackground({
  themeId,
  height,
}: {
  themeId: string | null;
  height: number;
}): React.ReactElement | null
```

**Behavior:**
- Returns `null` if `themeId` is null or not found in `SHOP_ITEMS_BY_ID`.
- `animationType === 'static'`: renders a vertical `LinearGradient` using `item.colors.slice(1)` as gradient stops, absolutely positioned to fill the parent.
- `animationType === 'plasma'` | `'molten'` | `'tide'` | `'glitch'`: delegates to the matching existing sub-component.

---

## Files Changed

| File | Change |
|------|--------|
| `src/data/shopCatalog.ts` | Add `'profileTheme'` to `ShopItemType`; add 12 catalog items; add `profileTheme` to `CATALOG_BY_TYPE` |
| `src/firebase/profileService.ts` | Add `'profileTheme'` to `EquipSlot` union |
| `src/components/profile/ProfileBackground.tsx` | Export new `ProfileThemeBackground` component |
| `src/components/shop/ShopItemCard.tsx` | Add `profileTheme` preview case to `ItemPreview` |
| `app/shop.tsx` | Add Themes tab to `CATEGORIES`; add `profileTheme` to `SLOT_FOR_TYPE` |
| `app/(tabs)/profile.tsx` | Derive `profileAccent`; render `ProfileThemeBackground`; use `profileUiAccent` for stats/labels |

---

## Out of Scope

- Animated previews in the shop card (static gradient preview only, even for legendary items)
- Per-element accent granularity beyond stats/labels
- Free/milestone-granted themes (all themes are MP-purchased)
