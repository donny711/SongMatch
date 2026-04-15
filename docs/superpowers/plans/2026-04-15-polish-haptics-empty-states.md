# Haptics + Lottie Empty States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add moderate haptic feedback on swipe/button interactions and replace plain empty states on Liked, Playlists, and People screens with Lottie animations.

**Architecture:** Centralised `src/utils/haptics.ts` provides named haptic functions imported wherever needed. A shared `src/components/LottieEmptyState.tsx` renders any Lottie JSON with consistent title/subtitle layout. Three Lottie JSON files live in `assets/lottie/`.

**Tech Stack:** expo-haptics (already in SDK 54), lottie-react-native (new), react-native-reanimated (existing)

---

### Task 1: Install lottie-react-native and download Lottie assets

**Files:**
- Modify: `package.json` (via expo install)
- Create: `assets/lottie/empty-liked.json`
- Create: `assets/lottie/empty-playlists.json`
- Create: `assets/lottie/empty-people.json`

- [ ] **Step 1:** Run `npx expo install lottie-react-native`
Expected: package added to package.json with Expo-compatible version.

- [ ] **Step 2:** Run `mkdir -p assets/lottie`

- [ ] **Step 3:** Download 3 free Lottie JSON files from lottiefiles.com:
  - Search "music headphones" -> save as `assets/lottie/empty-liked.json`
  - Search "music notes playlist" -> save as `assets/lottie/empty-playlists.json`
  - Search "people social" -> save as `assets/lottie/empty-people.json`
  - Requirements: free/CC, .json format (not .lottie), works on dark bg, under 100KB each

- [ ] **Step 4:** `git add assets/lottie/ package.json package-lock.json && git commit -m "feat: install lottie-react-native, add lottie assets"`

---

### Task 2: Create src/utils/haptics.ts

**Files:**
- Create: `src/utils/haptics.ts`

- [ ] **Step 1:** Create `src/utils/haptics.ts`:

```ts
import * as Haptics from "expo-haptics";

// Light tap - frequent button presses (trash, open-in-app, action buttons)
export const lightTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Medium impact - swipe completion (left or right)
export const swipeConfirm = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// Heavy impact - reserved for future use (e.g. match events)
export const heavyTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
```

- [ ] **Step 2:** Verify: `grep "expo-haptics" package.json`. If missing: `npx expo install expo-haptics`.
- [ ] **Step 3:** `git add src/utils/haptics.ts && git commit -m "feat: add centralised haptics utility"`

---

### Task 3: Create src/components/LottieEmptyState.tsx

**Files:**
- Create: `src/components/LottieEmptyState.tsx`

- [ ] **Step 1:** Create `src/components/LottieEmptyState.tsx`:

```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";
import { COLORS, SPACING } from "../theme";

interface Props { animationSource: object; title: string; subtitle: string; }

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
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md, padding: SPACING.xxl },
  animation: { width: 120, height: 120 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { color: COLORS.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
```

- [ ] **Step 2:** `git add src/components/LottieEmptyState.tsx && git commit -m "feat: add LottieEmptyState shared component"`

---

### Task 4: Add swipeConfirm haptic to SwipeCard.tsx

**Files:**
- Modify: `src/components/SwipeDeck/SwipeCard.tsx`

`flyOut` is a Reanimated worklet. `runOnJS` is already imported in this file.

- [ ] **Step 1:** Add after last import in `src/components/SwipeDeck/SwipeCard.tsx`:

```ts
import { swipeConfirm } from "../../utils/haptics";
```

- [ ] **Step 2:** Find `flyOut` (~line 50). Add `runOnJS(swipeConfirm)()` as the first line inside the worklet body.

  Before:
```ts
const flyOut = (direction: "left" | "right", callback: () => void) => {
  "worklet";
  translateX.value = withSpring(
    direction === "right" ? SCREEN_WIDTH * 1.6 : -SCREEN_WIDTH * 1.6,
    { damping: 22, stiffness: 200, mass: 0.9 },
    () => runOnJS(callback)()
  );
};
```

  After:
```ts
const flyOut = (direction: "left" | "right", callback: () => void) => {
  "worklet";
  runOnJS(swipeConfirm)();
  translateX.value = withSpring(
    direction === "right" ? SCREEN_WIDTH * 1.6 : -SCREEN_WIDTH * 1.6,
    { damping: 22, stiffness: 200, mass: 0.9 },
    () => runOnJS(callback)()
  );
};
```

- [ ] **Step 3:** `git add src/components/SwipeDeck/SwipeCard.tsx && git commit -m "feat: add swipe haptic feedback on card fly-out"`

---

### Task 5: Add lightTap haptic to ActionButton in home.tsx

**Files:**
- Modify: `app/(tabs)/home.tsx`

- [ ] **Step 1:** Add after last import in `app/(tabs)/home.tsx`:

```ts
import { lightTap } from "../../src/utils/haptics";
```

- [ ] **Step 2:** In the `ActionButton` component, find `onPress={onPress}` (~line 46). Replace with:

```tsx
onPress={() => { lightTap(); onPress(); }}
```

- [ ] **Step 3:** `git add "app/(tabs)/home.tsx" && git commit -m "feat: add light haptic to like/skip action buttons"`

---

### Task 6: Update liked.tsx - haptics + Lottie empty state

**Files:**
- Modify: `app/(tabs)/liked.tsx`

- [ ] **Step 1:** Add after last import in `app/(tabs)/liked.tsx`:

```ts
import { lightTap } from "../../src/utils/haptics";
import LottieEmptyState from "../../src/components/LottieEmptyState";
const emptyLikedAnim = require("../../assets/lottie/empty-liked.json");
```

- [ ] **Step 2:** In `LikedTrackRow`, find open-in-app button onPress (~line 60):

```tsx
// Find:
onPress={() => openTrackOnPlatform(item, connectedPlatforms)}
// Replace with:
onPress={() => { lightTap(); openTrackOnPlatform(item, connectedPlatforms); }}
```

- [ ] **Step 3:** Find trash button `onPress={onRemove}` (~line 72, `styles.removeBtn`). Replace with:

```tsx
onPress={() => { lightTap(); onRemove(); }}
```

- [ ] **Step 4:** Find empty state block (~line 101) and replace with:

  Find:
```tsx
{likedTracks.length === 0 ? (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconWrap}>
      <Ionicons name="heart-outline" size={38} color={COLORS.green} />
    </View>
    <Text style={styles.emptyTitle}>No liked songs yet</Text>
    <Text style={styles.emptySub}>Swipe right on songs you love</Text>
  </View>
) : (
```

  Replace with:
```tsx
{likedTracks.length === 0 ? (
  <LottieEmptyState
    animationSource={emptyLikedAnim}
    title="No liked songs yet"
    subtitle="Swipe right on songs you love"
  />
) : (
```

- [ ] **Step 5:** Remove from `StyleSheet.create`: `emptyState`, `emptyIconWrap`, `emptyTitle`, `emptySub`.
- [ ] **Step 6:** `git add "app/(tabs)/liked.tsx" && git commit -m "feat: haptics on liked track buttons + lottie empty state"`

---

### Task 7: Update playlists.tsx - Lottie empty state

**Files:**
- Modify: `app/(tabs)/playlists.tsx`

- [ ] **Step 1:** Add after last import in `app/(tabs)/playlists.tsx`:

```ts
import LottieEmptyState from "../../src/components/LottieEmptyState";
const emptyPlaylistsAnim = require("../../assets/lottie/empty-playlists.json");
```

- [ ] **Step 2:** Replace the entire `if (!accessToken)` return block (lines 36-61) with:

```tsx
if (!accessToken) {
  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Playlists</Text>
      </View>
      <LottieEmptyState
        animationSource={emptyPlaylistsAnim}
        title="Connect Spotify"
        subtitle="Link your Spotify account to seed recommendations from your playlists and save liked songs."
      />
      <TouchableOpacity
        style={styles.connectBtn}
        onPress={() => router.navigate("/(auth)/login")}
        accessibilityLabel="Connect Spotify"
        accessibilityRole="button"
      >
        <Text style={styles.connectBtnText}>Connect Spotify</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 3:** Remove from `StyleSheet.create`: `connectState`, `connectIconWrap`, `connectTitle`, `connectSubtitle`.
- [ ] **Step 4:** `git add "app/(tabs)/playlists.tsx" && git commit -m "feat: lottie empty state on playlists connect screen"`

---

### Task 8: Update people.tsx - Lottie empty states

**Files:**
- Modify: `app/(tabs)/people.tsx`

- [ ] **Step 1:** Add after last import in `app/(tabs)/people.tsx`:

```ts
import LottieEmptyState from "../../src/components/LottieEmptyState";
const emptyPeopleAnim = require("../../assets/lottie/empty-people.json");
```

- [ ] **Step 2:** In `FeedSegment`, replace the `items.length === 0` return block (~line 84):

  Find: View with `styles.center` containing Ionicons + emptyTitle + emptySub + discoverBtn.

  Replace with:
```tsx
if (items.length === 0) {
  return (
    <LottieEmptyState
      animationSource={emptyPeopleAnim}
      title="Nothing here yet"
      subtitle="Follow people to see what they are liking"
    />
  );
}
```

- [ ] **Step 3:** In `FriendsSegment`, replace the `following.length === 0` return block (~line 143):

  Find: View with `styles.center` containing Ionicons + emptyTitle + emptySub.

  Replace with:
```tsx
if (following.length === 0) {
  return (
    <LottieEmptyState
      animationSource={emptyPeopleAnim}
      title="Not following anyone yet"
      subtitle="Head to Discover to find people with your taste"
    />
  );
}
```

- [ ] **Step 4:** `git add "app/(tabs)/people.tsx" && git commit -m "feat: lottie empty states on people screen"`

---

## Testing checklist

- Swipe a card -> medium haptic fires at the moment it flies off
- Tap like/skip action buttons -> light haptic on each tap
- Tap trash or open-in-app on Liked Songs -> light haptic
- Empty Liked Songs screen -> Lottie animation plays and loops
- Playlists screen with no Spotify login -> Lottie animation plays
- People > Friends with nobody followed -> Lottie animation plays
- People > Feed tab with no following activity -> Lottie animation plays
