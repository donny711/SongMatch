# Resolve Legal & Launch Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all commercial monetization (AdMob + RevenueCat), fix the naming inconsistency, and re-enable the tutorial — clearing the path to a non-commercial TestFlight/App Store submission while the music licensing situation is resolved.

**Architecture:** Each task is independent and can be executed sequentially. No new abstractions are introduced. Everything is either deleted or stubbed. The subscription store keeps its daily-search machinery intact but hardcodes `isPro: false` and sets the free limit high enough that it doesn't frustrate users during the legal limbo period.

**Tech Stack:** React Native (Expo SDK 55), TypeScript, expo-router, Firebase SDK v12.

---

## Phase 0: Legal Consultation (Gate — no coding)

This is not a coding task. It is a prerequisite gate that blocks Phase 2 (Deezer replacement / re-monetization). Do not skip it.

- [ ] **Step 1: Find a music licensing attorney**

  Search for attorneys specialising in music tech / app licensing. Budget: $300–500/hr for a one-hour consultation. Key questions to bring:
  1. Does distributing Deezer 30-second previews in an App Store app with no monetisation still violate Deezer ToS Section IV?
  2. What licence (mechanical, sync, master) would a replacement provider like SoundCloud or Audiomack need to grant for in-app previews?
  3. Is a non-commercial free-to-download app on the App Store legally safe with Deezer previews while we negotiate or migrate?

- [ ] **Step 2: Document the outcome**

  Create `docs/legal/music-licensing-consult-YYYY-MM-DD.md` with: attorney name, firm, date, questions asked, answers received, recommended next action, and any follow-up deadlines.

---

## Task 1: Fix Naming Inconsistency (SoundMatch → SongMatch)

**Files to modify:**
- `README.md`
- `app.json`
- `src/store/subscriptionStore.ts`
- `app/earn-mp.tsx`
- `src/firebase/referralService.ts`
- `src/data/shopCatalog.ts`
- `src/data/milestones.ts`
- `functions/package.json`
- `src/components/referral/SquadSection.tsx`

- [ ] **Step 1: Fix README.md title**

  Open `README.md`. Find line 1 (the `# SoundMatch` heading). Change it to:
  ```markdown
  # SongMatch
  ```

- [ ] **Step 2: Fix app.json photo permission string**

  Open `app.json`. On line 55 (inside `expo-image-picker` plugin config), change:
  ```json
  "photosPermission": "SoundMatch needs access to your photo library to set a profile photo and banner."
  ```
  to:
  ```json
  "photosPermission": "SongMatch needs access to your photo library to set a profile photo and banner."
  ```

- [ ] **Step 3: Fix RevenueCat product IDs in subscriptionStore**

  Open `src/store/subscriptionStore.ts`, lines 18–22. Change:
  ```typescript
  export const RC_PRODUCTS = {
    monthly: 'soundmatch_pro_monthly',
    quarterly: 'soundmatch_pro_quarterly',
    annual: 'soundmatch_pro_annual',
  } as const;
  ```
  to:
  ```typescript
  export const RC_PRODUCTS = {
    monthly: 'songmatch_pro_monthly',
    quarterly: 'songmatch_pro_quarterly',
    annual: 'songmatch_pro_annual',
  } as const;
  ```
  Note: these product IDs will need to be updated in App Store Connect and RevenueCat dashboard if/when monetisation is re-enabled. The store objects are stubbed out in Task 3 anyway.

- [ ] **Step 4: Fix earn-mp.tsx**

  Open `app/earn-mp.tsx`. Find line 74 (string `"Open SoundMatch for the first time"`). Change it to:
  ```
  "Open SongMatch for the first time"
  ```

- [ ] **Step 5: Fix referralService.ts**

  Open `src/firebase/referralService.ts`. Find both occurrences of `'SoundMatch User'` (lines ~281 and ~351). Change both to `'SongMatch User'`.

- [ ] **Step 6: Fix shopCatalog.ts**

  Open `src/data/shopCatalog.ts`. Find both occurrences of `SoundMatch` (lines ~336 and ~496 — they appear in item descriptions). Replace each with `SongMatch`.

- [ ] **Step 7: Fix milestones.ts**

  Open `src/data/milestones.ts`. Find line ~23: `"Welcome to SoundMatch"`. Change to `"Welcome to SongMatch"`.

- [ ] **Step 8: Fix functions/package.json description**

  Open `functions/package.json`. Find line 3 (the `description` field containing `SoundMatch`). Update the description to use `SongMatch`.

- [ ] **Step 9: Fix SquadSection.tsx share message**

  Open `src/components/referral/SquadSection.tsx`. Find line ~73 (a share message containing `SoundMatch`). Change it to use `SongMatch`.

- [ ] **Step 10: Verify no SoundMatch strings remain**

  Run:
  ```
  grep -rn "SoundMatch" C:\Users\user\Desktop\SongMatch\src C:\Users\user\Desktop\SongMatch\app C:\Users\user\Desktop\SongMatch\functions C:\Users\user\Desktop\SongMatch\README.md C:\Users\user\Desktop\SongMatch\app.json
  ```
  Expected: no output. If any remain, fix them before continuing.

- [ ] **Step 11: Commit**

  ```bash
  git add -A
  git commit -m "fix: rename all SoundMatch strings to SongMatch"
  ```

---

## Task 2: Remove AdMob

**Files to modify:**
- `app.json` — remove `react-native-google-mobile-ads` plugin block and top-level config block
- `package.json` — remove `react-native-google-mobile-ads` dep
- `src/hooks/adsInit.ts` — stub to no-op
- `src/hooks/useSwipeGateAd.ts` — stub to unavailable
- `src/hooks/useRewardedAd.ts` — stub to unavailable
- `src/hooks/useSearchBonusAd.ts` — stub to unavailable

(`src/hooks/useInterstitialAd.ts` is already stubbed — no change needed.)

- [ ] **Step 1: Remove AdMob from app.json**

  Open `app.json`. Delete lines 154–160 (the `react-native-google-mobile-ads` plugin entry):
  ```json
  [
    "react-native-google-mobile-ads",
    {
      "android_app_id": "ca-app-pub-5279884722039690~5452090114",
      "ios_app_id": "ca-app-pub-5279884722039690~5452090114"
    }
  ]
  ```
  Also delete lines 169–172 (the top-level `react-native-google-mobile-ads` block):
  ```json
  "react-native-google-mobile-ads": {
    "android_app_id": "ca-app-pub-5279884722039690~5452090114",
    "ios_app_id": "ca-app-pub-5279884722039690~5452090114"
  }
  ```
  Make sure the `plugins` array still has a valid trailing comma structure after removing the last entry.

- [ ] **Step 2: Remove package from package.json**

  Open `package.json`. Delete the line:
  ```
  "react-native-google-mobile-ads": "^16.3.3",
  ```

- [ ] **Step 3: Stub adsInit.ts**

  Replace the entire contents of `src/hooks/adsInit.ts` with:
  ```typescript
  export function adsInitialized() { return false; }
  export function adsFailed() { return true; }
  export async function initializeAds(): Promise<void> {}
  ```

- [ ] **Step 4: Stub useSwipeGateAd.ts**

  Replace the entire contents of `src/hooks/useSwipeGateAd.ts` with:
  ```typescript
  import { useCallback } from 'react';

  export type SwipeGateAdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

  export function useSwipeGateAd(_onRewarded: () => void) {
    const show = useCallback(() => {}, []);
    return { status: 'unavailable' as SwipeGateAdStatus, show };
  }
  ```

- [ ] **Step 5: Stub useRewardedAd.ts**

  Replace the entire contents of `src/hooks/useRewardedAd.ts` with:
  ```typescript
  import { useCallback } from 'react';

  export type AdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

  export function useRewardedAd() {
    const show = useCallback(() => {}, []);
    const retry = useCallback(async () => {}, []);
    return { status: 'unavailable' as AdStatus, show, retry };
  }
  ```

- [ ] **Step 6: Stub useSearchBonusAd.ts**

  Replace the entire contents of `src/hooks/useSearchBonusAd.ts` with:
  ```typescript
  import { useCallback } from 'react';

  export type SearchBonusAdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

  export function useSearchBonusAd() {
    const show = useCallback(() => {}, []);
    return { status: 'unavailable' as SearchBonusAdStatus, show };
  }
  ```

- [ ] **Step 7: Run npm install to sync lockfile**

  ```bash
  cd C:\Users\user\Desktop\SongMatch && npm install
  ```
  Expected: no errors. The `react-native-google-mobile-ads` package should no longer appear in `node_modules`.

- [ ] **Step 8: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no new errors related to AdMob. Fix any type errors that appear before continuing.

- [ ] **Step 9: Commit**

  ```bash
  git add -A
  git commit -m "feat: remove AdMob — stub all ad hooks to unavailable"
  ```

---

## Task 3: Remove RevenueCat / Simplify Subscription

**Files to modify:**
- `src/store/subscriptionStore.ts` — gut RC integration, keep daily-search machinery, hardcode `isPro: false`
- `app/upgrade.tsx` — replace with "coming soon" screen
- `package.json` — remove `react-native-purchases`

- [ ] **Step 1: Rewrite subscriptionStore.ts**

  Replace the entire contents of `src/store/subscriptionStore.ts` with:

  ```typescript
  import { create } from 'zustand';
  import { Alert } from 'react-native';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { todayISO } from '../utils/dateUtils';

  const DAILY_SEARCH_KEY = 'songmatch_daily_searches_v12';
  const FREE_DAILY_LIMIT = 999; // effectively unlimited during non-commercial phase

  export const RC_PRODUCTS = {
    monthly: 'songmatch_pro_monthly',
    quarterly: 'songmatch_pro_quarterly',
    annual: 'songmatch_pro_annual',
  } as const;

  export type ProTier = 'monthly' | 'quarterly' | 'annual';

  interface DailySearchState {
    count: number;
    date: string;
    bonusGranted: boolean;
  }

  interface SubscriptionState {
    isPro: boolean;
    tier: ProTier | null;
    expiresAt: Date | null;
    isLoading: boolean;

    dailySearchCount: number;
    dailyBonusGranted: boolean;
    searchesRemaining: number;

    initialize: (uid: string) => Promise<void>;
    refreshFromStore: () => Promise<void>;
    purchase: (tier: ProTier) => Promise<void>;
    restore: () => Promise<void>;
    recordSearch: () => Promise<boolean>;
    grantSearchBonus: () => Promise<void>;
    restoreSearches: (n: number) => Promise<void>;
    refreshDaily: () => Promise<void>;
    syncFromFirestore: (uid: string) => Promise<void>;
  }

  async function loadDailyState(): Promise<DailySearchState> {
    const today = todayISO();
    try {
      const raw = await AsyncStorage.getItem(DAILY_SEARCH_KEY);
      if (raw) {
        const parsed: DailySearchState = JSON.parse(raw);
        if (parsed.date === today) return parsed;
      }
    } catch {}
    return { count: 0, date: today, bonusGranted: false };
  }

  async function saveDailyState(state: DailySearchState): Promise<void> {
    try {
      await AsyncStorage.setItem(DAILY_SEARCH_KEY, JSON.stringify(state));
    } catch {}
  }

  export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
    isPro: false,
    tier: null,
    expiresAt: null,
    isLoading: false,

    dailySearchCount: 0,
    dailyBonusGranted: false,
    searchesRemaining: FREE_DAILY_LIMIT,

    initialize: async (_uid: string) => {
      const daily = await loadDailyState();
      set({
        dailySearchCount: daily.count,
        dailyBonusGranted: daily.bonusGranted,
        searchesRemaining: FREE_DAILY_LIMIT - daily.count,
      });
    },

    refreshFromStore: async () => {},

    purchase: async (_tier: ProTier) => {
      Alert.alert('Coming Soon', 'Pro subscriptions are not available yet. Stay tuned!');
    },

    restore: async () => {
      Alert.alert('Coming Soon', 'Pro subscriptions are not available yet.');
    },

    recordSearch: async () => {
      const { dailySearchCount } = get();
      if (dailySearchCount >= FREE_DAILY_LIMIT) return false;
      const newCount = dailySearchCount + 1;
      const daily: DailySearchState = {
        count: newCount,
        date: todayISO(),
        bonusGranted: get().dailyBonusGranted,
      };
      await saveDailyState(daily);
      set({ dailySearchCount: newCount, searchesRemaining: FREE_DAILY_LIMIT - newCount });
      return true;
    },

    grantSearchBonus: async () => {},

    restoreSearches: async (n: number) => {
      const { dailySearchCount } = get();
      const newCount = Math.max(0, dailySearchCount - n);
      const daily: DailySearchState = {
        count: newCount,
        date: todayISO(),
        bonusGranted: get().dailyBonusGranted,
      };
      await saveDailyState(daily);
      set({ dailySearchCount: newCount, searchesRemaining: FREE_DAILY_LIMIT - newCount });
    },

    refreshDaily: async () => {
      const daily = await loadDailyState();
      set({
        dailySearchCount: daily.count,
        dailyBonusGranted: daily.bonusGranted,
        searchesRemaining: FREE_DAILY_LIMIT - daily.count,
      });
    },

    syncFromFirestore: async (_uid: string) => {},
  }));
  ```

- [ ] **Step 2: Replace upgrade.tsx with coming-soon screen**

  Replace the entire contents of `app/upgrade.tsx` with:

  ```typescript
  import React from 'react';
  import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { Ionicons } from '@expo/vector-icons';
  import { router } from 'expo-router';
  import { COLORS, SPACING, RADIUS } from '../src/theme';

  export default function UpgradeScreen() {
    const insets = useSafeAreaInsets();

    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.close} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Ionicons name="rocket-outline" size={64} color={COLORS.purple} />
          <Text style={styles.title}>SongMatch Pro</Text>
          <Text style={styles.subtitle}>
            Pro subscriptions are coming soon. Stay tuned for unlimited searches, exclusive icons, and more.
          </Text>
        </View>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    close: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
      padding: 8,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
      gap: SPACING.lg,
    },
    title: {
      color: COLORS.text,
      fontSize: 28,
      fontWeight: '700',
      textAlign: 'center',
    },
    subtitle: {
      color: COLORS.textMuted,
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 24,
    },
  });
  ```

- [ ] **Step 3: Remove react-native-purchases from package.json**

  Open `package.json`. Delete the line:
  ```
  "react-native-purchases": "^9.15.2",
  ```

- [ ] **Step 4: Run npm install**

  ```bash
  cd C:\Users\user\Desktop\SongMatch && npm install
  ```
  Expected: no errors.

- [ ] **Step 5: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors. The `upgrade.tsx` no longer imports from `react-native-purchases`. If other files still import from `react-native-purchases`, find and remove those imports now.

  Check for remaining RC imports:
  ```bash
  grep -rn "react-native-purchases\|RNPurchases\|Purchases\." src app
  ```
  Remove any remaining imports found.

- [ ] **Step 6: Commit**

  ```bash
  git add -A
  git commit -m "feat: remove RevenueCat — stub subscription store, replace upgrade screen"
  ```

---

## Phase 2: Replace Deezer with Licensed Preview Provider (Future — blocked on Phase 0)

**This phase is blocked until the legal consultation (Phase 0) confirms an acceptable path forward.**

Options identified by the LLM Council:
1. **SoundCloud API** — has a commercial partner API. Contact: developers.soundcloud.com/docs/api/guide. Requires a commercial agreement.
2. **Audiomack API** — lower barrier, explicit licensing for preview streams. Contact: developers.audiomack.com.
3. **Deezer Commercial Partnership** — apply via the Deezer B2B programme. Timeline unknown.

Once Phase 0 completes and an option is selected:
- Replace `src/api/tasteEngine.ts` Deezer API calls with the new provider's API
- Update preview URLs throughout the player
- Update attribution/branding as required by the new provider's ToS
- Re-enable monetisation (AdMob / RevenueCat) once the music licensing is legally clear

---

## Launch Checklist (after Tasks 1–3 are complete)

- [ ] All `SoundMatch` strings eliminated — verified by grep
- [ ] No `react-native-google-mobile-ads` in `package.json` or `app.json`
- [ ] No `react-native-purchases` in `package.json`
- [ ] All ad hooks return `status: 'unavailable'`
- [ ] `subscriptionStore.isPro` is always `false`, `purchase()` shows "Coming Soon" alert
- [ ] `upgrade.tsx` shows "Coming Soon" screen
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] EAS build succeeds: `eas build --platform ios --profile production`
- [ ] TestFlight internal testing with at least 3 testers before App Store submission
- [ ] App Store description does not mention "Pro", "subscription", "ads", or "SoundMatch"
