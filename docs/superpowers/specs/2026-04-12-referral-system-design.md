# Referral System Design

**Date:** 2026-04-12  
**Status:** Approved  

---

## Overview

A two-tier referral system for SongMatch. Users share a personal invite code/link. When friends install and open the app via that link, both the referrer and friends receive billing discounts.

**Tier 1** — 3 installs → referrer + all 3 friends get 30% off next billing cycle  
**Tier 2** — 7 installs → referrer gets 1 month free (stacks with Tier 1)

Rewards trigger on install + first open, not on link click alone.

---

## What Already Exists

- `src/firebase/referralService.ts` — full Firestore logic: code generation, `recordReferralInstall` (transaction-safe), `getReferralStats`, tier reward writes
- `app/referral.tsx` — complete UI: code display, copy/share, tier progress bars
- `app/(tabs)/profile.tsx` — "Invite Friends" button routing to `/referral`
- `app/_layout.tsx` — referral screen registered in Stack navigator
- Firestore model: `referrals/{code}`, `subscriptions/{uid}` with `pendingDiscount` / `freeMonthGranted`

---

## Architecture

### New File: `src/hooks/useReferral.ts`

Single hook that owns the full referral lifecycle. Mounted once in `_layout.tsx`.

**Responsibilities:**

1. **Cold-start link capture** — calls `Linking.getInitialURL()` on mount. If the URL matches `songmatch://invite/:code`, saves the code to AsyncStorage under `sm_pending_referral_code`.

2. **Foreground link listener** — subscribes to `Linking.addEventListener('url', ...)` for links received while the app is running.

3. **UID watcher** — watches `profileStore.uid`. When a UID becomes available (Firebase auth complete), checks AsyncStorage for a pending code. If found:
   - Skips if user doc already has `referredBy` set (reinstall guard)
   - Calls existing `recordReferralInstall(uid, code)`
   - Clears AsyncStorage key
   - Re-reads `subscriptions/{uid}` to surface `pendingDiscount`

4. **Manual redemption** — exposes `redeemCode(code: string)`. Used by the new input on the referral screen. Same path as deep link flow. Guards: own-code check, already-referred check.

5. **Discount state** — exposes `pendingDiscount: number | null` and `markDiscountRedeemed()`. Read by the upgrade screen.

### Deep Link Strategy

Custom scheme for now: `songmatch://invite/CODE`  
Already configured via `scheme: "songmatch"` in `app.json` — no config changes needed.

Designed to upgrade to Universal Links (`https://songmatch.app/invite/CODE`) later: one URL format change inside the hook, plus AASA/assetlinks.json files on the web host.

---

## Modified Files

### `app/_layout.tsx`
Add `useReferral()` — one line in the root layout component.

### `app/upgrade.tsx`
When `pendingDiscount > 0`:
- Show banner: "You have 30% off — referral reward"
- Price cards show crossed-out original + discounted price (display calculation)
- Actual purchase uses a RevenueCat Introductory Offer (30% off, 1 billing period — configured once in App Store Connect)
- On successful purchase: call `markDiscountRedeemed(uid)` to set `pendingDiscount: null` in Firestore

For existing Pro users who hit a tier: banner shown on referral screen — "Your 30% discount is ready for your next renewal."

**Tier 2 free month (`freeMonthGranted`):** shown as a separate banner on the upgrade screen and referral screen — "You've earned 1 free month — tap to redeem." Uses a RevenueCat Introductory Offer (100% off, 1 month). `markDiscountRedeemed` also clears `freeMonthGranted` after successful redemption.

### `app/referral.tsx`
New section below milestones — only shown if `referredBy` is null on the user's doc:

```
Have a friend's code?
[ code input ]  [Redeem]
```

Calls `redeemCode()` from the hook. Success toast: "Code applied — 30% off your next purchase."  
Error states: "Invalid code", "Already redeemed", "Can't use your own code."

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Double-recording | `recordReferralInstall` transaction guards via `installedUids.includes(newUid)`. Client also skips if `referredBy` already set. |
| Own code | `redeemCode()` checks `code === currentUser.referralCode` before Firestore call |
| Code not found | Silently skipped on deep link flow; "Invalid code" shown on manual entry |
| UID not ready at link arrival | Code sits in AsyncStorage; UID watcher picks it up when auth resolves |
| App killed between link tap and open | `Linking.getInitialURL()` captures the launch URL on cold start |
| Discount reused | `markDiscountRedeemed` sets `pendingDiscount: null`; banner only shows when `> 0` |
| Reinstall | `referredBy` already set on user doc → install recording skipped |

---

## Data Model (existing, no changes)

```
referrals/{code}
  referrerId: string
  code: string
  installedUids: string[]
  installCount: number
  tier1Rewarded: boolean
  tier2Rewarded: boolean
  createdAt: Timestamp
  updatedAt: Timestamp

subscriptions/{uid}
  ...existing fields...
  pendingDiscount: number | null        // 0.30 = 30% off
  pendingDiscountReason: string | null  // 'referral_friend' | 'referral_tier1'
  freeMonthGranted: boolean | null      // tier2 reward
  freeMonthReason: string | null
```

---

## Out of Scope

- Universal Links (deferred until `songmatch.app` hosting is set up)
- RevenueCat server-side webhook for auto-applying discounts on renewal
- Push notification when a friend installs
- Admin dashboard for referral analytics
