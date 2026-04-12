# Referral System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing referral backend into a working end-to-end flow: deep link capture → install recording → discount redemption UI + manual code entry.

**Architecture:** A `useReferral` hook mounted once in `_layout.tsx` handles deep link capture and auto-records the install via AsyncStorage + UID watcher. The upgrade screen reads pending rewards from Firestore on mount and clears them after purchase. The referral screen gets a manual code entry section that calls the existing `recordReferralInstall` directly.

**Tech Stack:** Expo 54, React Native, expo-router, Firebase/Firestore, Zustand, `expo-linking`, `@react-native-async-storage/async-storage`

> **Note:** No Jest test infrastructure exists in this project. TDD steps are replaced with manual verification instructions.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/firebase/referralService.ts` | Add `getPendingRewards()` + `markDiscountRedeemed()` |
| Create | `src/hooks/useReferral.ts` | Deep link capture, UID watcher, auto install recording |
| Modify | `app/_layout.tsx` | Mount `useReferral()` once |
| Modify | `app/upgrade.tsx` | Discount banner, discounted prices, clear reward after purchase |
| Modify | `app/referral.tsx` | Manual code input section |

---

## Task 1: Extend `referralService.ts`

**Files:**
- Modify: `src/firebase/referralService.ts`

Add two functions after the existing `getReferralStats` export.

- [ ] **Step 1: Add imports**

The file already imports `doc`, `getDoc`, `setDoc`, `serverTimestamp` from `firebase/firestore` and `db` from `./config`. No new imports needed.

- [ ] **Step 2: Add `getPendingRewards`**

Append to `src/firebase/referralService.ts`:

```typescript
// ── Get pending referral rewards for the current user ─────────────────────────

export async function getPendingRewards(uid: string): Promise<{
  pendingDiscount: number | null;
  freeMonthGranted: boolean;
}> {
  const ref = doc(db, 'subscriptions', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { pendingDiscount: null, freeMonthGranted: false };
  const data = snap.data();
  return {
    pendingDiscount: typeof data.pendingDiscount === 'number' ? data.pendingDiscount : null,
    freeMonthGranted: data.freeMonthGranted === true,
  };
}
```

- [ ] **Step 3: Add `markDiscountRedeemed`**

Append to `src/firebase/referralService.ts`:

```typescript
// ── Clear pending rewards after redemption ────────────────────────────────────

export async function markDiscountRedeemed(uid: string): Promise<void> {
  const ref = doc(db, 'subscriptions', uid);
  await setDoc(ref, {
    pendingDiscount: null,
    pendingDiscountReason: null,
    freeMonthGranted: null,
    freeMonthReason: null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `referralService.ts`

- [ ] **Step 5: Commit**

```bash
git add src/firebase/referralService.ts
git commit -m "feat(referral): add getPendingRewards and markDiscountRedeemed"
```

---

## Task 2: Create `useReferral` hook

**Files:**
- Create: `src/hooks/useReferral.ts`

- [ ] **Step 1: Create the file**

Create `src/hooks/useReferral.ts` with the full content below:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useProfileStore } from '../store/profileStore';
import { recordReferralInstall } from '../firebase/referralService';

const PENDING_REFERRAL_KEY = 'sm_pending_referral_code';

function extractCode(url: string | null | undefined): string | null {
  if (!url) return null;
  // Matches: songmatch://invite/ABC12345
  const match = url.match(/invite\/([A-Z0-9]{6,10})/i);
  return match ? match[1].toUpperCase() : null;
}

async function savePendingCode(url: string | null | undefined): Promise<void> {
  const code = extractCode(url);
  if (code) {
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
  }
}

export function useReferral(): void {
  const uid = useProfileStore((s) => s.uid);
  const appliedRef = useRef(false);

  // Capture the URL that cold-started the app
  useEffect(() => {
    Linking.getInitialURL()
      .then(savePendingCode)
      .catch(() => {});

    const sub = Linking.addEventListener('url', ({ url }) => {
      savePendingCode(url).catch(() => {});
    });

    return () => sub.remove();
  }, []);

  // When UID is ready, apply any pending referral code
  useEffect(() => {
    if (!uid || appliedRef.current) return;
    appliedRef.current = true;

    (async () => {
      try {
        // Guard: skip if user was already referred
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists() && userSnap.data().referredBy) return;

        const code = await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
        if (!code) return;

        await recordReferralInstall(uid, code);
        await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
      } catch {
        // Non-critical — silent fail
      }
    })();
  }, [uid]);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `src/hooks/useReferral.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useReferral.ts
git commit -m "feat(referral): add useReferral hook for deep link capture and install recording"
```

---

## Task 3: Wire `useReferral` into `_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add import**

In `app/_layout.tsx`, add the import after the existing hook imports (around line 16):

```typescript
import { useReferral } from '../src/hooks/useReferral';
```

- [ ] **Step 2: Mount the hook**

Inside the `RootLayout` component body, add one line after the existing store hooks (around line 83, after `const appState = useRef...`):

```typescript
useReferral();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Manual verification**

In the Expo Go simulator:
1. Open a terminal and run `npx expo start`
2. In another terminal, simulate a deep link: `npx uri-scheme open "songmatch://invite/TESTCODE" --ios`
3. Check AsyncStorage using React Native Debugger or add a temporary `console.log` after `AsyncStorage.getItem(PENDING_REFERRAL_KEY)` — you should see `TESTCODE` logged.
4. Remove the temporary log if added.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(referral): mount useReferral hook in root layout"
```

---

## Task 4: Add discount banner to `upgrade.tsx`

**Files:**
- Modify: `app/upgrade.tsx`

This task adds a `RewardBanner` component and wires it to Firestore-read pending rewards.

- [ ] **Step 1: Add imports**

At the top of `app/upgrade.tsx`, add after the existing imports:

```typescript
import { getPendingRewards, markDiscountRedeemed } from '../src/firebase/referralService';
```

- [ ] **Step 2: Add `RewardBanner` component**

Add this component definition after the `PlanCard` component (around line 87, before `export default function UpgradeScreen`):

```typescript
function RewardBanner({ discount, freeMonth }: { discount: number | null; freeMonth: boolean }) {
  if (!discount && !freeMonth) return null;

  const label = freeMonth
    ? '🎁 You\'ve earned 1 free month — referral reward'
    : `🎁 You have ${Math.round((discount ?? 0) * 100)}% off — referral reward`;

  return (
    <View style={rewardBannerStyles.wrap}>
      <LinearGradient
        colors={['rgba(167,139,250,0.18)', 'rgba(232,121,249,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={rewardBannerStyles.grad}
      >
        <Ionicons name="gift" size={16} color={COLORS.purple} />
        <Text style={rewardBannerStyles.text}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

const rewardBannerStyles = StyleSheet.create({
  wrap: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  grad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  text: { color: COLORS.text, fontSize: 13, fontWeight: '700', flex: 1 },
});
```

- [ ] **Step 3: Add reward state to `UpgradeScreen`**

Inside `UpgradeScreen`, add state variables and a load effect after the existing `useState` calls (around line 93):

```typescript
const [pendingDiscount, setPendingDiscount] = useState<number | null>(null);
const [freeMonthGranted, setFreeMonthGranted] = useState(false);

useEffect(() => {
  if (!uid) return;
  getPendingRewards(uid).then(({ pendingDiscount, freeMonthGranted }) => {
    setPendingDiscount(pendingDiscount);
    setFreeMonthGranted(freeMonthGranted);
  }).catch(() => {});
}, [uid]);
```

- [ ] **Step 4: Clear reward after successful purchase**

In `handlePurchase`, after the `Alert.alert('Welcome to Pro!', ...)` call, add:

```typescript
if (uid && (pendingDiscount || freeMonthGranted)) {
  markDiscountRedeemed(uid).catch(() => {});
}
```

So `handlePurchase` becomes:

```typescript
const handlePurchase = useCallback(async () => {
  setPurchasing(true);
  try {
    await purchase(selectedTier);
    if (uid) {
      await saveSubscriptionToFirestore(uid, {
        isPro: true,
        tier: selectedTier,
        expiresAt: null,
      });
    }
    if (uid && (pendingDiscount || freeMonthGranted)) {
      markDiscountRedeemed(uid).catch(() => {});
    }
    Alert.alert('Welcome to Pro!', 'Your subscription is now active.', [
      { text: 'Let\'s go!', onPress: () => router.back() },
    ]);
  } catch (e: any) {
    if (e?.code !== 'PURCHASE_CANCELLED') {
      Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
    }
  } finally {
    setPurchasing(false);
  }
}, [selectedTier, uid, purchase, pendingDiscount, freeMonthGranted]);
```

- [ ] **Step 5: Render the banner in the ScrollView**

Inside the `ScrollView`'s `contentContainerStyle` content, add `<RewardBanner>` as the first child, before the hero section:

```typescript
<ScrollView
  contentContainerStyle={styles.content}
  showsVerticalScrollIndicator={false}
>
  {/* ── Reward banner ── */}
  <RewardBanner discount={pendingDiscount} freeMonth={freeMonthGranted} />

  {/* ── Hero ── */}
  <View style={styles.hero}>
  ...
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `app/upgrade.tsx`.

- [ ] **Step 7: Manual verification**

1. In Firebase Console, open `subscriptions/{a-test-uid}` and set `pendingDiscount: 0.3`
2. Launch the app with that UID, navigate to the upgrade screen
3. Confirm the purple gift banner appears at the top
4. Remove the test value from Firestore when done

- [ ] **Step 8: Commit**

```bash
git add app/upgrade.tsx
git commit -m "feat(referral): add discount reward banner to upgrade screen"
```

---

## Task 5: Add manual code entry to `referral.tsx`

**Files:**
- Modify: `app/referral.tsx`

- [ ] **Step 1: Add imports**

In `app/referral.tsx`, the existing React Native import is:
```typescript
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
```

Replace it with:
```typescript
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  TextInput,
} from 'react-native';
```

Then add after the existing `referralService` import line:
```typescript
import { recordReferralInstall } from '../src/firebase/referralService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase/config';
```

(`recordReferralInstall` is a new import — `getOrCreateReferralCode` and `getReferralStats` are already imported from the same file, so just add `recordReferralInstall` to that existing import line instead of adding a separate one.)

- [ ] **Step 2: Add state for manual entry**

Inside `ReferralScreen`, add state after the existing `useState` calls:

```typescript
const [manualCode, setManualCode] = useState('');
const [redeeming, setRedeeming] = useState(false);
const [redeemError, setRedeemError] = useState<string | null>(null);
const [redeemSuccess, setRedeemSuccess] = useState(false);
const [alreadyReferred, setAlreadyReferred] = useState(false);
```

- [ ] **Step 3: Check `referredBy` on load**

In the existing `useEffect` that loads stats (around line 84), after `setStats(...)`, add:

```typescript
// Check if this user was already referred — hides the manual entry section
const userSnap = await getDoc(doc(db, 'users', uid));
if (userSnap.exists() && userSnap.data().referredBy) {
  setAlreadyReferred(true);
}
```

So the full effect body becomes:

```typescript
useEffect(() => {
  if (!uid) return;
  (async () => {
    try {
      const code = await getOrCreateReferralCode(uid);
      const existing = await getReferralStats(uid);
      setStats(existing ?? { code, installCount: 0, tier1Rewarded: false, tier2Rewarded: false });

      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists() && userSnap.data().referredBy) {
        setAlreadyReferred(true);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  })();
}, [uid]);
```

- [ ] **Step 4: Add `handleRedeem` function**

Inside `ReferralScreen`, after the `handleShare` function, add:

```typescript
const handleRedeem = async () => {
  const code = manualCode.trim().toUpperCase();
  if (!code || !uid) return;

  setRedeeming(true);
  setRedeemError(null);

  try {
    // Own code check
    if (stats?.code === code) {
      setRedeemError("You can't use your own code");
      return;
    }

    // Code existence check
    const codeSnap = await getDoc(doc(db, 'referrals', code));
    if (!codeSnap.exists()) {
      setRedeemError('Invalid code');
      return;
    }

    await recordReferralInstall(uid, code);
    setRedeemSuccess(true);
    setAlreadyReferred(true);
    setManualCode('');
  } catch {
    setRedeemError('Something went wrong. Please try again.');
  } finally {
    setRedeeming(false);
  }
};
```

- [ ] **Step 5: Add the manual entry section to the render**

In the return, after the `<Text style={styles.note}>` block and before the closing `</View>` of `styles.content`, add:

```typescript
{/* Manual code entry — hidden if already referred */}
{!alreadyReferred && (
  <View style={styles.redeemSection}>
    <Text style={styles.milestonesTitle}>Have a friend's code?</Text>
    {redeemSuccess ? (
      <View style={styles.redeemSuccess}>
        <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
        <Text style={styles.redeemSuccessText}>Code applied — 30% off your next purchase</Text>
      </View>
    ) : (
      <>
        <View style={styles.redeemRow}>
          <TextInput
            style={styles.redeemInput}
            value={manualCode}
            onChangeText={(t) => { setManualCode(t.toUpperCase()); setRedeemError(null); }}
            placeholder="Enter code"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            maxLength={10}
            keyboardAppearance="dark"
          />
          <TouchableOpacity
            style={[styles.redeemBtn, (!manualCode.trim() || redeeming) && styles.redeemBtnDisabled]}
            onPress={handleRedeem}
            disabled={!manualCode.trim() || redeeming}
            activeOpacity={0.85}
          >
            {redeeming
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.redeemBtnText}>Redeem</Text>
            }
          </TouchableOpacity>
        </View>
        {redeemError && (
          <Text style={styles.redeemError}>{redeemError}</Text>
        )}
      </>
    )}
  </View>
)}
```

- [ ] **Step 6: Add styles**

In the `StyleSheet.create({...})` block, add after the existing `note` style:

```typescript
redeemSection: { gap: SPACING.sm },
redeemRow: { flexDirection: 'row', gap: SPACING.sm },
redeemInput: {
  flex: 1,
  backgroundColor: COLORS.surface,
  borderRadius: RADIUS.md,
  borderWidth: 1,
  borderColor: COLORS.border,
  color: COLORS.text,
  paddingHorizontal: SPACING.md,
  paddingVertical: 12,
  fontSize: 15,
  fontWeight: '700',
  letterSpacing: 2,
},
redeemBtn: {
  backgroundColor: COLORS.purple,
  borderRadius: RADIUS.md,
  paddingHorizontal: SPACING.lg,
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 88,
  minHeight: 46,
},
redeemBtnDisabled: { opacity: 0.4 },
redeemBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
redeemError: { color: '#F87171', fontSize: 12 },
redeemSuccess: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: SPACING.sm,
  paddingVertical: SPACING.sm,
},
redeemSuccessText: { color: COLORS.green, fontSize: 13, fontWeight: '600', flex: 1 },
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `app/referral.tsx`.

- [ ] **Step 8: Manual verification**

1. Navigate to the referral screen on a fresh user (no `referredBy` set in Firestore)
2. Confirm the "Have a friend's code?" section is visible
3. Enter an invalid code → confirm "Invalid code" error appears
4. Enter your own referral code → confirm "You can't use your own code" error
5. Enter a valid code from another test user → confirm success state and section hides
6. On a user with `referredBy` already set → confirm the section does not render

- [ ] **Step 9: Commit**

```bash
git add app/referral.tsx
git commit -m "feat(referral): add manual code redemption to referral screen"
```

---

## Post-Implementation Checklist

- [ ] Full deep link flow: `npx uri-scheme open "songmatch://invite/REALCODE" --ios` → install app fresh → open → confirm `referredBy` is set in Firestore and `pendingDiscount` is written to `subscriptions/{uid}`
- [ ] Upgrade screen: navigate to upgrade → confirm reward banner appears when `pendingDiscount` is set
- [ ] Upgrade screen: complete a test purchase → confirm `pendingDiscount` is cleared in Firestore
- [ ] Referral screen: manual code entry happy path works end to end
- [ ] Referral screen: section hidden after redemption

---

## Out of Scope (future)

- Universal Links — add `apple-app-site-association` + `assetlinks.json` when `songmatch.app` hosting is ready; update `extractCode()` to also match `https://songmatch.app/invite/:code`
- Push notification when a friend installs
- RevenueCat Introductory Offer configuration in App Store Connect (separate task for billing team)
