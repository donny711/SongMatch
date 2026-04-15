# Design Spec: Haptic Feedback + Lottie Empty States

**Date:** 2026-04-15  
**Status:** Approved

---

## Overview

Two improvements to make SoundMatch feel more premium and polished:

1. **Haptic feedback** on swipe completion and action buttons
2. **Lottie animated empty states** on Liked Songs, Playlists, and People screens

---

## 1. Haptic Feedback

### New file: `src/utils/haptics.ts`

Centralised wrapper around `expo-haptics` with named functions. Makes it easy to retune all haptic strengths in one place after testing on a real device.

Functions:
- `lightTap()` — ImpactFeedbackStyle.Light
- `swipeConfirm()` — ImpactFeedbackStyle.Medium
- `heavyTap()` — ImpactFeedbackStyle.Heavy (reserved, not yet called)

### Call sites

| Location | Function | Trigger |
|---|---|---|
| `src/components/SwipeDeck/SwipeCard.tsx` | `swipeConfirm()` | Inside flyOut worklet via runOnJS, when swipe commits |
| `app/(tabs)/home.tsx` ActionButton | `lightTap()` | onPress of like/skip buttons |
| `app/(tabs)/liked.tsx` trash button | `lightTap()` | onPress |
| `app/(tabs)/liked.tsx` open-in-app button | `lightTap()` | onPress |

Notes:
- swipeConfirm fires once per swipe at the moment the card commits to fly out
- lightTap for frequent taps to avoid fatigue
- expo-haptics is already in Expo SDK 54, no new package needed

---

## 2. Lottie Empty States

### New package: `lottie-react-native`

Install via: npx expo install lottie-react-native

### Lottie asset files

Stored in `assets/lottie/`. Free animations from lottiefiles.com:

| File | Screen | Theme |
|---|---|---|
| `assets/lottie/empty-liked.json` | Liked Songs | Headphones / music |
| `assets/lottie/empty-playlists.json` | Playlists | Music notes / playlist |
| `assets/lottie/empty-people.json` | People | People / social |

### New shared component: `src/components/LottieEmptyState.tsx`

Props: animationSource (Lottie JSON object), title (string), subtitle (string)

Renders:
- Lottie animation: 120x120, looping, autoplay
- Title: COLORS.text, 22px, weight 800
- Subtitle: COLORS.textMuted, 14px
- Layout: centered column, gap SPACING.md
- Uses existing COLORS, SPACING from src/theme.ts

### Screens updated

| Screen | File | Empty state replaced |
|---|---|---|
| Liked Songs | `app/(tabs)/liked.tsx` | styles.emptyState view |
| Playlists | `app/(tabs)/playlists.tsx` | Equivalent empty state view |
| People | `app/(tabs)/people.tsx` | Equivalent empty state view |

The styles.emptyIconWrap and related styles in liked.tsx can be removed after replacement.

---

## Out of scope

- Tab bar animation changes (already implemented)
- SwipeCard animation enhancements (already solid)
- Custom mascot/illustration system
- Lottie on screens not listed above

---

## Implementation order

1. Install lottie-react-native
2. Download and place 3 Lottie JSON files in assets/lottie/
3. Create src/utils/haptics.ts
4. Create src/components/LottieEmptyState.tsx
5. Update SwipeCard.tsx — call swipeConfirm()
6. Update home.tsx ActionButton — call lightTap()
7. Update liked.tsx — haptics on buttons + replace empty state
8. Update playlists.tsx — replace empty state
9. Update people.tsx — replace empty state
