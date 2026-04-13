# Referral Squad Visibility Design

**Date:** 2026-04-13
**Status:** Approved

---

## Overview

Two connected features that make the referral system social:

1. **Squad section** on the profile tab — every user sees their referral group (referrer + referred friends). Always visible: shows a CTA when empty, progress when building, and the full squad when tier 1 is reached.
2. **Invites leaderboard** in the people tab — a 4th tab alongside Points / Streak / Likes showing top referrers by install count.

---

## What Already Exists

- `src/firebase/referralService.ts` — `getOrCreateReferralCode`, `getReferralStats`, `recordReferralInstall`, `getPendingRewards`, `markDiscountRedeemed`
- `referrals/{code}` — `referrerId`, `installedUids`, `installCount`, `tier1Rewarded`, `tier2Rewarded`
- `users/{uid}` — `referralCode`, `referredBy`
- `app/(tabs)/profile.tsx` — profile screen with stats, showcase, cosmetics
- `app/user/[uid].tsx` — public read-only user profile
- `app/(tabs)/people.tsx` — social tab with leaderboard (Points / Streak / Likes tabs)
- `src/components/profile/AvatarWithFrame.tsx` — avatar with equipped frame overlay
- `src/components/social/LeaderboardRow.tsx` — existing leaderboard row component
- `src/theme.ts` — `COLORS`, `SPACING`, `RADIUS` design tokens

---

## Architecture

### Data approach: client-side reads (Approach A)

No schema changes. Two new functions added to `referralService.ts`:

#### `getSquadMembers(uid): Promise<SquadData>`

Returns the full squad for a given uid. Logic:

1. Read `users/{uid}` to get `referralCode` and `referredBy`
2. Determine which referral doc to load:
   - If user is a **referrer**: load `referrals/{user.referralCode}`
   - If user was **referred**: load `referrals/{user.referredBy}`
   - If neither: return `{ members: [], isReferrer: false, installCount: 0, tier1Rewarded: false }`
3. From the referral doc, collect all uids: `[referrerId, ...installedUids]` (deduplicated)
4. Batch-fetch `users/{uid}` for each member (display name, avatar url, username)
5. Return `SquadData`

```typescript
interface SquadMember {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  isReferrer: boolean; // shows crown badge
}

interface SquadData {
  members: SquadMember[];
  isReferrer: boolean;        // current user is the referrer
  installCount: number;
  tier1Rewarded: boolean;
  tier2Rewarded: boolean;
}
```

#### `getReferralLeaderboard(limitCount: number): Promise<ReferralLeaderboardEntry[]>`

1. Query `referrals` ordered by `installCount` desc, limit `limitCount`
2. Batch-fetch `users/{referrerId}` for each entry
3. Return array of entries

```typescript
interface ReferralLeaderboardEntry {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  installCount: number;
  tier1Rewarded: boolean;
  tier2Rewarded: boolean;
}
```

---

## Feature 1: Squad Section on Profile

### Placement

Added to `app/(tabs)/profile.tsx` below the showcase section. Also added to `app/user/[uid].tsx` with a visibility guard.

### Component: `src/components/referral/SquadSection.tsx`

Props:
```typescript
interface SquadSectionProps {
  uid: string;           // whose squad to load
  viewerUid: string;     // current logged-in user
  isOwnProfile: boolean; // true on profile.tsx, false on user/[uid].tsx
}
```

Visibility rule for `user/[uid].tsx`:
- Only render if `viewerUid` appears in the loaded squad's `members` array
- If not in squad: render nothing (no empty state, no heading)

### Three display states

**State 1 — No squad (installCount === 0 and no referredBy)**

CTA card:
- Purple left-accent stripe (3px, `COLORS.purple`)
- `COLORS.surface` background, `COLORS.border` border
- Text: `"Invite 3 friends, get 30% off for 3 months"`
- Sub text: `"You and your friends all get the discount when 3 install"`
- "Share your code" button → triggers same `Share.share()` as referral screen

**State 2 — Building (1 or 2 members, tier1Rewarded false)**

- Section label: `"YOUR SQUAD"` in small-caps muted style
- Horizontal `ScrollView` of `AvatarWithFrame` (52px) with display name below (truncated 8 chars)
- Referrer avatar gets `ribbon` Ionicon overlay in `#F59E0B` (amber), 14px, bottom-right
- Progress bar below row: thin (4px), `COLORS.purple` fill, same style as milestone bars
- Progress label: `"2 / 3 · 1 more to unlock rewards"`

**State 3 — Tier 1 reached (tier1Rewarded true)**

- Same avatar row as State 2
- No progress bar
- Status line: `"Tier 1 unlocked · 30% off active"` with `checkmark-circle` icon in `COLORS.green`
- If tier2Rewarded: additional line `"Tier 2 unlocked · Free month earned"`

### Loading state

`ActivityIndicator` centered, `COLORS.purple`, shown while `getSquadMembers` resolves.

---

## Feature 2: Invites Leaderboard Tab

### Placement

`app/(tabs)/people.tsx` — add `"Invites"` as 4th tab pill in the existing leaderboard tab row (after Likes).

### Data

Call `getReferralLeaderboard(50)` when the Invites tab is first selected (lazy load, same pattern as other leaderboard tabs).

### Row design

Reuses `LeaderboardRow` pattern with additions:
- Right side: `person-add` Ionicon + install count number
- Tier badge (small pill, 18px height):
  - `"T2"` if `tier2Rewarded` — `rgba(167,139,250,0.15)` bg, `#A78BFA` text
  - `"T1"` if `tier1Rewarded && !tier2Rewarded` — same style
  - No badge if neither tier reached

**Top 3 rank number colors:**
- `#F59E0B` gold (rank 1)
- `#94A3B8` silver (rank 2)
- `#CD7F32` bronze (rank 3)
- `COLORS.textMuted` for rank 4+

**Current user's row:** `rgba(167,139,250,0.08)` background + 2px left border `COLORS.purple` (same as existing leaderboard highlight pattern).

**Empty / loading states:** same skeleton/spinner pattern as existing leaderboard tabs.

---

## Modified Files

| File | Change |
|---|---|
| `src/firebase/referralService.ts` | Add `getSquadMembers`, `getReferralLeaderboard`, `SquadData`, `SquadMember`, `ReferralLeaderboardEntry` types |
| `app/(tabs)/profile.tsx` | Add `<SquadSection uid={uid} viewerUid={uid} isOwnProfile />` |
| `app/user/[uid].tsx` | Add `<SquadSection uid={profileUid} viewerUid={currentUid} isOwnProfile={false} />` |
| `app/(tabs)/people.tsx` | Add "Invites" tab to leaderboard, call `getReferralLeaderboard` |

## New Files

| File | Purpose |
|---|---|
| `src/components/referral/SquadSection.tsx` | Squad display component (all 3 states) |

---

## Edge Cases

| Scenario | Handling |
|---|---|
| User is both referrer and was referred | `referralCode` check takes priority (they're a referrer) |
| Squad member has no avatar | `AvatarWithFrame` falls back to initials (existing behaviour) |
| Referral doc has installedUids with deleted accounts | `getDoc` returns non-existent snap → skip that uid, don't crash |
| Viewer not in squad on `user/[uid].tsx` | Component renders null — no heading, no empty state |
| Leaderboard user deleted their account | Row skipped if user doc doesn't exist |
| installCount = 0 in leaderboard | Filtered out (only include entries with installCount > 0) |

---

## Out of Scope

- Real-time squad updates (one-time load on mount is sufficient)
- Push notification when a squad member joins
- Chat or messaging within the squad
- Squad visibility settings (public/private toggle)
