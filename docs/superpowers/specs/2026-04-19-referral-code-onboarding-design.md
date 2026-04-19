# Referral Code Entry in Onboarding

**Date:** 2026-04-19
**Status:** Approved

## Overview

Add a dedicated referral code step to the onboarding flow, after the favourite-song step and before the loading step. The step is optional — users can skip it or proceed without a valid code.

## Flow

```
genres → song → referral → loading
```

The step-dots row updates from 2 to 3 dots. The referral dot (3rd) is active on the new screen.

## UI

Same structural pattern as the song step:

- **Header:** back arrow (returns to `song` step) + 3-dot progress row, 3rd dot active
- **Title:** Gradient "Got an invite code?" (GradientText, fontSize 30)
- **Subtitle:** "Optional — enter a friend's referral code to join their squad"
- **Input row:**
  - TextInput: auto-uppercases on change, maxLength 8, placeholder "e.g. K7F2A4B3", same style as existing search input
  - "Verify" button (arrow icon): disabled when input is empty, same style as the search button on the song step
- **Inline feedback** (shown below input after Verify tap):
  - Valid: green "✓ Valid code!"
  - Invalid: red "Code not found"
  - Checking: small ActivityIndicator
- **Footer:**
  - Primary "Continue" button — always enabled
  - "Skip" link below it

## State

```ts
referralInput: string          // controlled text input value
verifyStatus: 'idle' | 'checking' | 'valid' | 'invalid'
```

Resetting referralInput clears verifyStatus back to 'idle'.

## Logic

### Verify tap
1. Set verifyStatus = 'checking'
2. getDoc(doc(db, 'referrals', referralInput))
3. If exists → verifyStatus = 'valid'; if not → verifyStatus = 'invalid'

### Continue tap
- Calls finish(verifyStatus === 'valid' ? referralInput : undefined)

### finish() change
- Signature: finish(favSong: DeezerTrack | null, referralCode?: string)
- After the existing AsyncStorage.setItem calls, if referralCode is provided:
  - Get uid from auth.currentUser?.uid
  - If uid exists: call recordReferralInstall(uid, referralCode) — fire-and-forget
- Navigation to /(tabs)/home is not blocked by the referral call.

## Error handling

- If the Firestore read in Verify fails (network error etc.), set verifyStatus = 'invalid' and show "Code not found" — safe fallback, user can still continue.
- recordReferralInstall errors are silently swallowed (already handled inside the service).

## Files changed

- app/onboarding.tsx — only file modified
