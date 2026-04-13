# Launch Readiness Design — SoundMatch iOS

**Date:** 2026-04-13  
**Approach:** B+C — parallel prep while awaiting Apple Developer account, soft-launch via TestFlight before public release  
**Target:** iOS only for v1 launch

---

## Context

SoundMatch is a Tinder-like music discovery app built on Expo 54 + React Native + expo-router. All core screens are built: swipe deck, onboarding, shop/cosmetics, social/leaderboard, referral system, profile, settings, upgrade screen. The app is not yet on the App Store.

**Critical gap:** The Pro subscription (`upgrade.tsx`) currently writes a Firestore flag with no real payment processing. Apple requires StoreKit-based IAP for all paid features on iOS.

---

## Approach

Three sequential phases. Phase 0 runs in parallel with purchasing the Apple Developer account ($99/year), so no time is lost waiting for account activation.

---

## Phase 0 — Parallel Prep (no developer account needed)

### 1. RevenueCat Integration

**What:** Replace the Firestore-flag subscription with real IAP via RevenueCat + `react-native-purchases`.

**How:**
- Install `react-native-purchases` (Expo config plugin available)
- Create a free RevenueCat project, define one entitlement: `pro`
- Define 3 products matching `upgrade.tsx` plans: `soundmatch_monthly`, `soundmatch_quarterly`, `soundmatch_annual`
- In `upgrade.tsx`, replace `saveSubscriptionToFirestore()` with `Purchases.purchasePackage()`
- On app init, call `Purchases.configure({ apiKey })` and sync entitlement status to `subscriptionStore`
- Keep Firestore subscription doc for referral discount data only (not for Pro gating)
- Sandbox testing works before the developer account is live using StoreKit sandbox environment in Xcode Simulator

**Files affected:**
- `app/upgrade.tsx` — purchase flow
- `src/store/subscriptionStore.ts` — entitlement source of truth
- `app/_layout.tsx` — SDK init on mount

### 2. Fix Firestore `subscriptions` Security Rule

**Problem:** `allow write: if request.auth != null` on `subscriptions/{uid}` lets any authenticated user write any user's subscription document — they could grant themselves Pro.

**Fix:** Scope writes to only the fields `recordReferralInstall` legitimately writes cross-uid (pendingDiscount, pendingDiscountMonths, pendingDiscountReason, freeMonthGranted, freeMonthReason). All other subscription fields must only be writable by the owner.

```
match /subscriptions/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if request.auth != null && request.auth.uid == uid;
  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['pendingDiscount','pendingDiscountMonths','pendingDiscountReason',
                   'freeMonthGranted','freeMonthReason','updatedAt']);
}
```

**File:** `firestore.rules`

### 3. Privacy Policy Page

**What:** Apple requires a Privacy Policy URL on every App Store listing.

**Content to cover:**
- Data collected: email (Apple/Spotify auth), Spotify OAuth token, usage/swipe data, profile photo
- Third-party services: Firebase, Supabase, RevenueCat, AdMob, Deezer, Last.fm, AudD
- Data retention and deletion policy
- Contact email

**Hosting:** GitHub Pages or Vercel — a single static HTML page is sufficient. URL goes in App Store Connect and in the app's Settings screen (already has `PRIVACY_POLICY_URL` constant in `src/utils/constants.ts`).

### 4. Landing Page — `songmatch.app`

**What:** The referral share link (`https://songmatch.app/invite/{CODE}`) currently 404s. Need a minimal landing page that redirects to the app.

**Behaviour:**
- `/invite/{CODE}` — redirect to `songmatch://invite/{CODE}` via JS, with a fallback "Download SoundMatch" button linking to the App Store listing
- `/` — simple one-pager describing the app with an App Store badge

**Hosting:** Vercel or GitHub Pages. One HTML file with a meta-refresh + JS redirect is sufficient.

### 5. App Store Metadata Prep

**What:** Prepare all copy and screenshots offline before the App Store Connect listing exists.

**Required assets:**
- App name: `SoundMatch`
- Subtitle (30 chars max): e.g. `Discover music you'll love`
- Description (4000 chars): explain swipe-to-discover, Spotify export, cosmetics, referral
- Keywords (100 chars): music, discovery, swipe, spotify, playlist, recommendations, songs
- Screenshots: 6.7" (iPhone 15 Pro Max) and 6.1" (iPhone 15) — 3-5 screens minimum
- App icon: export at 1024x1024 PNG, no alpha channel

---

## Phase 1 — Developer Account Live

### 6. EAS Build Setup

**`eas.json` profiles:**
- `development` — dev client build for local testing
- `preview` — ad-hoc distribution for TestFlight
- `production` — App Store distribution

**`app.json` additions:**
- `ios.bundleIdentifier`: `com.soundmatch.app`
- `ios.buildNumber`: `1`
- `ios.associatedDomains`: `["applinks:songmatch.app"]`
- `plugins`: add `react-native-purchases` config plugin

### 7. App Store Connect + IAP Products

**3 Auto-Renewable Subscription products:**
- `soundmatch_monthly` — €4.99/month
- `soundmatch_quarterly` — €9.99/3 months
- `soundmatch_annual` — €39.99/year

### 8. Wire RevenueCat → App Store

- Add App Store shared secret to RevenueCat dashboard
- Map the 3 products to the `pro` entitlement
- Test full purchase flow end-to-end in StoreKit sandbox

### 9. Universal Links

- Host `apple-app-site-association` at `https://songmatch.app/.well-known/apple-app-site-association`
- Add `associatedDomains` to `app.json`
- Update `useReferral.ts` to handle `https://songmatch.app/invite/{CODE}` URLs

### 10. TestFlight Build + Distribution

- `eas build --platform ios --profile preview`
- Upload to App Store Connect, add internal testers
- Test: onboarding, swipe, like, purchase, referral share

---

## Phase 2 — TestFlight → Public Launch

### 11. TestFlight Feedback (2-4 weeks)

Focus: onboarding clarity, recommendation quality, purchase flow, crashes, referral end-to-end.

### 12. App Store Submission Pre-flight

- Privacy Policy URL set
- All IAP products approved
- No placeholder content
- Age rating set (4+)
- Content rights confirmed for Deezer preview URLs

### 13. Public Launch

- Go live on App Store
- Share referral code to drive initial installs
- Monitor RevenueCat dashboard for conversion

---

## Priority Order

| # | Task | Phase |
|---|------|-------|
| 1 | RevenueCat SDK integration | 0 |
| 2 | Fix `subscriptions` Firestore rule | 0 |
| 3 | Privacy Policy page | 0 |
| 4 | Landing page (`songmatch.app/invite`) | 0 |
| 5 | App Store metadata + screenshots | 0 |
| 6 | Buy Apple Developer Program | 0 (trigger) |
| 7 | EAS Build setup | 1 |
| 8 | App Store Connect + IAP products | 1 |
| 9 | Wire RevenueCat → App Store | 1 |
| 10 | Universal Links | 1 |
| 11 | TestFlight build + distribute | 1 |
| 12 | TestFlight feedback + fixes | 2 |
| 13 | App Store submission | 2 |
| 14 | Public launch | 2 |
