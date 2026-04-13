# Referral Squad Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a squad section to profile screens and an Invites leaderboard tab to the People tab, using two new Firestore query functions in referralService.ts.

**Architecture:** Two new functions (`getSquadMembers`, `getReferralLeaderboard`) are added to `referralService.ts`. A new `SquadSection` component handles all three display states (CTA, building, tier reached) and is mounted on both the own profile and public user profile screens. The Invites leaderboard lives entirely inside `people.tsx` as an `InvitesLeaderboard` sub-component added to the existing `LeaderboardSegment`.

**Tech Stack:** React Native, Expo, Firebase/Firestore (`getDoc`, `getDocs`, `query`, `collection`, `orderBy`, `limit`), Zustand, `expo-router`, Jest

---

### Task 1: Extend referralService — getSquadMembers + getReferralLeaderboard

**Files:**
- Modify: `src/firebase/referralService.ts`
- Test: `src/firebase/__tests__/referralService.test.ts`

- [ ] **Step 1: Update the firebase/firestore mock in the test file**

Open `src/firebase/__tests__/referralService.test.ts`. Find the `jest.mock('firebase/firestore', ...)` block and replace it with this (adds `getDocs`, `query`, `collection`, `orderBy`, `limit`):

```typescript
jest.mock('firebase/firestore', () => ({
  runTransaction: jest.fn(),
  doc: jest.fn((_db: unknown, collection: string, id: string) => ({ path: `/` })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn((val: unknown) => ({ __arrayUnion: val })),
  increment: jest.fn((n: number) => ({ __increment: n })),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  query: jest.fn((...args: unknown[]) => args),
  collection: jest.fn((_db: unknown, col: string) => col),
  orderBy: jest.fn((field: string, dir: string) => ({ field, dir })),
  limit: jest.fn((n: number) => ({ limit: n })),
}));
```

Also add `getDocs` to the imports at the top of the test file:

```typescript
import {
  runTransaction,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
```

- [ ] **Step 2: Add a QuerySnapshot helper below `makeSnap` in the test file**

```typescript
function makeQuerySnap(docs: Record<string, unknown>[]) {
  return { docs: docs.map((d) => ({ data: () => d })) };
}
```

- [ ] **Step 3: Add getSquadMembers tests to the test file**

Add this new `describe` block after the `markDiscountRedeemed` describe block:

```typescript
// ── getSquadMembers ────────────────────────────────────────────

describe('getSquadMembers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty when user doc does not exist', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce(makeSnap(null));
    expect(await getSquadMembers('uid1')).toEqual({
      members: [],
      isReferrer: false,
      installCount: 0,
      tier1Rewarded: false,
      tier2Rewarded: false,
    });
  });

  it('returns empty when user has neither referralCode nor referredBy', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce(makeSnap({}));
    expect(await getSquadMembers('uid1')).toEqual({
      members: [],
      isReferrer: false,
      installCount: 0,
      tier1Rewarded: false,
      tier2Rewarded: false,
    });
  });

  it('returns squad when user is referrer with installs', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap({ referralCode: 'CODE' }))
      .mockResolvedValueOnce(makeSnap({
        referrerId: 'uid1',
        installedUids: ['uid2', 'uid3'],
        installCount: 2,
        tier1Rewarded: false,
        tier2Rewarded: false,
      }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Alice', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Bob', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Carol', avatarUrl: null, username: null }));

    const result = await getSquadMembers('uid1');
    expect(result.members).toHaveLength(3);
    expect(result.isReferrer).toBe(true);
    expect(result.installCount).toBe(2);
    expect(result.members.find((m) => m.uid === 'uid1')?.isReferrer).toBe(true);
    expect(result.members.find((m) => m.uid === 'uid2')?.isReferrer).toBe(false);
  });

  it('falls back to referredBy group when own code has 0 installs', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap({ referralCode: 'MYCODE', referredBy: 'THEIRCODE' }))
      .mockResolvedValueOnce(makeSnap({
        referrerId: 'uid1', installedUids: [], installCount: 0, tier1Rewarded: false, tier2Rewarded: false,
      }))
      .mockResolvedValueOnce(makeSnap({
        referrerId: 'uid0', installedUids: ['uid1'], installCount: 1, tier1Rewarded: false, tier2Rewarded: false,
      }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Referrer', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Me', avatarUrl: null, username: null }));

    const result = await getSquadMembers('uid1');
    expect(result.isReferrer).toBe(false);
    expect(result.members.find((m) => m.uid === 'uid0')?.isReferrer).toBe(true);
    expect(result.members).toHaveLength(2);
  });

  it('skips deleted accounts gracefully', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap({ referralCode: 'CODE' }))
      .mockResolvedValueOnce(makeSnap({
        referrerId: 'uid1', installedUids: ['uid2', 'uid_gone'], installCount: 2, tier1Rewarded: false, tier2Rewarded: false,
      }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Alice', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Bob', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap(null));

    const result = await getSquadMembers('uid1');
    expect(result.members).toHaveLength(2);
    expect(result.members.map((m) => m.uid)).not.toContain('uid_gone');
  });
});
```

- [ ] **Step 4: Add getReferralLeaderboard tests**

Add this `describe` block after `getSquadMembers`:

```typescript
// ── getReferralLeaderboard ────────────────────────────────────────

describe('getReferralLeaderboard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty when no referral docs exist', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(makeQuerySnap([]));
    expect(await getReferralLeaderboard(50)).toEqual([]);
  });

  it('filters out entries with 0 installs', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(makeQuerySnap([
      { referrerId: 'uid1', installCount: 0, tier1Rewarded: false, tier2Rewarded: false },
    ]));
    const result = await getReferralLeaderboard(50);
    expect(result).toHaveLength(0);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('returns entries with user profiles', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(makeQuerySnap([
      { referrerId: 'uid1', installCount: 5, tier1Rewarded: true, tier2Rewarded: false },
      { referrerId: 'uid2', installCount: 3, tier1Rewarded: true, tier2Rewarded: false },
    ]));
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap({ displayName: 'Alice', avatarUrl: null, username: 'alice' }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Bob', avatarUrl: null, username: 'bob' }));

    const result = await getReferralLeaderboard(50);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ uid: 'uid1', displayName: 'Alice', installCount: 5, tier1Rewarded: true });
    expect(result[1]).toMatchObject({ uid: 'uid2', displayName: 'Bob', installCount: 3 });
  });

  it('skips entries where user doc does not exist', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(makeQuerySnap([
      { referrerId: 'uid_gone', installCount: 10, tier1Rewarded: true, tier2Rewarded: true },
      { referrerId: 'uid2', installCount: 3, tier1Rewarded: false, tier2Rewarded: false },
    ]));
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap(null))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Bob', avatarUrl: null, username: null }));

    const result = await getReferralLeaderboard(50);
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe('uid2');
  });
});
```

- [ ] **Step 5: Run tests to verify they FAIL**

```bash
cd 'C:/Users/Radu si Vlad Popa/SoundMatch'
npx jest --no-coverage 2>&1 | tail -20
```

Expected: test failures for `getSquadMembers` and `getReferralLeaderboard` — "not a function" or similar. Existing 13 tests should still pass.

- [ ] **Step 6: Add new imports to referralService.ts**

Open `src/firebase/referralService.ts`. Find the existing import line:

```typescript
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
```

Replace with:

```typescript
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
  runTransaction,
  query,
  collection,
  orderBy,
  limit,
} from 'firebase/firestore';
```

- [ ] **Step 7: Add types and new functions to referralService.ts**

Add the following at the end of `src/firebase/referralService.ts` (after `markDiscountRedeemed`):

```typescript
// ── Squad types ────────────────────────────────────────────────────────────────────────────────

export interface SquadMember {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  isReferrer: boolean;
}

export interface SquadData {
  members: SquadMember[];
  isReferrer: boolean;
  installCount: number;
  tier1Rewarded: boolean;
  tier2Rewarded: boolean;
}

export interface ReferralLeaderboardEntry {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  installCount: number;
  tier1Rewarded: boolean;
  tier2Rewarded: boolean;
}

const SQUAD_EMPTY: SquadData = {
  members: [],
  isReferrer: false,
  installCount: 0,
  tier1Rewarded: false,
  tier2Rewarded: false,
};

// ── Internal helper ────────────────────────────────────────────────────────────────────────────────

async function fetchSquadFromReferralDoc(
  currentUid: string,
  data: ReferralRecord
): Promise<SquadData> {
  const allUids = [...new Set([data.referrerId, ...data.installedUids])];
  const profiles = await Promise.all(
    allUids.map(async (memberUid) => {
      try {
        const snap = await getDoc(doc(db, 'users', memberUid));
        if (!snap.exists()) return null;
        const u = snap.data() as { displayName?: string; avatarUrl?: string; username?: string };
        const member: SquadMember = {
          uid: memberUid,
          displayName: u.displayName ?? 'SoundMatch User',
          avatarUrl: u.avatarUrl ?? null,
          username: u.username ?? null,
          isReferrer: memberUid === data.referrerId,
        };
        return member;
      } catch {
        return null;
      }
    })
  );
  return {
    members: profiles.filter((m): m is SquadMember => m !== null),
    isReferrer: currentUid === data.referrerId,
    installCount: data.installCount,
    tier1Rewarded: data.tier1Rewarded,
    tier2Rewarded: data.tier2Rewarded,
  };
}

// ── Get squad members for a given user ────────────────────────────────────────────
// Priority: own referral group (if installs > 0) → group they were referred into → empty

export async function getSquadMembers(uid: string): Promise<SquadData> {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return SQUAD_EMPTY;
  const userData = userSnap.data() as { referralCode?: string; referredBy?: string };

  if (userData.referralCode) {
    const codeSnap = await getDoc(doc(db, 'referrals', userData.referralCode));
    if (codeSnap.exists()) {
      const data = codeSnap.data() as ReferralRecord;
      if (data.installCount > 0) {
        return fetchSquadFromReferralDoc(uid, data);
      }
    }
  }

  if (userData.referredBy) {
    const codeSnap = await getDoc(doc(db, 'referrals', userData.referredBy));
    if (codeSnap.exists()) {
      return fetchSquadFromReferralDoc(uid, codeSnap.data() as ReferralRecord);
    }
  }

  return SQUAD_EMPTY;
}

// ── Get top referrers for the leaderboard ─────────────────────────────────────────────

export async function getReferralLeaderboard(
  limitCount: number
): Promise<ReferralLeaderboardEntry[]> {
  const snap = await getDocs(
    query(
      collection(db, 'referrals'),
      orderBy('installCount', 'desc'),
      limit(limitCount)
    )
  );
  const entries = await Promise.all(
    snap.docs
      .filter((d) => (d.data() as ReferralRecord).installCount > 0)
      .map(async (d) => {
        const data = d.data() as ReferralRecord;
        try {
          const userSnap = await getDoc(doc(db, 'users', data.referrerId));
          if (!userSnap.exists()) return null;
          const u = userSnap.data() as {
            displayName?: string;
            avatarUrl?: string;
            username?: string;
          };
          const entry: ReferralLeaderboardEntry = {
            uid: data.referrerId,
            displayName: u.displayName ?? 'SoundMatch User',
            avatarUrl: u.avatarUrl ?? null,
            username: u.username ?? null,
            installCount: data.installCount,
            tier1Rewarded: data.tier1Rewarded,
            tier2Rewarded: data.tier2Rewarded,
          };
          return entry;
        } catch {
          return null;
        }
      })
  );
  return entries.filter((e): e is ReferralLeaderboardEntry => e !== null);
}
```

Also add `getSquadMembers` and `getReferralLeaderboard` to the import in the test file:

```typescript
import {
  recordReferralInstall,
  getPendingRewards,
  markDiscountRedeemed,
  getSquadMembers,
  getReferralLeaderboard,
} from '../referralService';
```

- [ ] **Step 8: Run tests to verify all pass**

```bash
cd 'C:/Users/Radu si Vlad Popa/SoundMatch'
npx jest --no-coverage 2>&1
```

Expected: all 21 tests pass (13 existing + 4 getSquadMembers + 4 getReferralLeaderboard).

- [ ] **Step 9: Commit**

```bash
cd 'C:/Users/Radu si Vlad Popa/SoundMatch'
git add src/firebase/referralService.ts src/firebase/__tests__/referralService.test.ts
git commit -m 'feat(referral): add getSquadMembers and getReferralLeaderboard'
```

---

### Task 2: Create SquadSection component

**Files:**
- Create: `src/components/referral/SquadSection.tsx`

- [ ] **Step 1: Create the referral components directory and SquadSection file**

```bash
mkdir -p 'C:/Users/Radu si Vlad Popa/SoundMatch/src/components/referral'
```

Create `src/components/referral/SquadSection.tsx` with this full content:

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AvatarWithFrame } from '../profile/AvatarWithFrame';
import {
  getSquadMembers,
  getOrCreateReferralCode,
  type SquadData,
} from '../../firebase/referralService';
import { COLORS, SPACING, RADIUS } from '../../theme';

interface Props {
  uid: string;
  viewerUid: string;
  isOwnProfile: boolean;
}

const TIER1_THRESHOLD = 3;

export function SquadSection({ uid, viewerUid, isOwnProfile }: Props) {
  const [squad, setSquad] = useState<SquadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSquadMembers(uid)
      .then((data) => { if (!cancelled) setSquad(data); })
      .catch(() => { if (!cancelled) setSquad({ members: [], isReferrer: false, installCount: 0, tier1Rewarded: false, tier2Rewarded: false }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  // Only fetch referral code for own profile CTA
  useEffect(() => {
    if (!isOwnProfile || !squad || squad.members.length > 0) return;
    let cancelled = false;
    getOrCreateReferralCode(uid)
      .then((code) => { if (!cancelled) setReferralCode(code); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOwnProfile, squad, uid]);

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>YOUR SQUAD</Text>
        <ActivityIndicator color={COLORS.purple} size="small" style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }

  // On other profiles: only show if viewer is in the squad
  if (!isOwnProfile) {
    const viewerInSquad = squad?.members.some((m) => m.uid === viewerUid) ?? false;
    if (!viewerInSquad) return null;
  }

