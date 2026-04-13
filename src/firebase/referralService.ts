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
import { db } from './config';
import { saveSubscriptionToFirestore } from './subscriptionService';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER1_THRESHOLD = 3;  // 3 installs → 30% off next billing cycle (for referrer + friends)
const TIER2_THRESHOLD = 7;  // 7 installs → 1 free month for referrer

export interface ReferralRecord {
  referrerId: string;
  code: string;
  installedUids: string[];
  installCount: number;
  tier1Rewarded: boolean;
  tier2Rewarded: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserReferralInfo {
  referralCode: string;
  referredBy: string | null; // code used during install
  referralInstallCount: number;
  referralTier1Rewarded: boolean;
  referralTier2Rewarded: boolean;
}

// ── Code generation ───────────────────────────────────────────────────────────

function generateCode(uid: string): string {
  // 6-char alphanumeric from uid suffix + random chars
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const base = uid.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return (base + rand).slice(0, 8);
}

// ── Get or create referral code ──────────────────────────────────────────────

export async function getOrCreateReferralCode(uid: string): Promise<string> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User not found');

  const data = snap.data() as { referralCode?: string };
  if (data.referralCode) return data.referralCode;

  // Generate a unique code
  let code = generateCode(uid);
  let attempts = 0;
  while (attempts < 5) {
    const codeRef = doc(db, 'referrals', code);
    const existing = await getDoc(codeRef);
    if (!existing.exists()) break;
    code = generateCode(uid + attempts);
    attempts++;
  }

  // Create referral doc + save code on user
  await Promise.all([
    setDoc(doc(db, 'referrals', code), {
      referrerId: uid,
      code,
      installedUids: [],
      installCount: 0,
      tier1Rewarded: false,
      tier2Rewarded: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    updateDoc(userRef, { referralCode: code }),
  ]);

  return code;
}

// ── Record a new install via referral link ────────────────────────────────────
// Called on first open after install, with the referral code from the deep link.

export async function recordReferralInstall(
  newUid: string,
  referralCode: string
): Promise<void> {
  const codeRef = doc(db, 'referrals', referralCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(codeRef);
    if (!snap.exists()) return;

    const data = snap.data() as ReferralRecord;
    if (data.installedUids.includes(newUid)) return; // already counted

    // Guard: skip if user was already referred under a different code
    const newUserRef = doc(db, 'users', newUid);
    const newUserSnap = await tx.get(newUserRef);
    if (newUserSnap.exists() && (newUserSnap.data() as { referredBy?: string }).referredBy) return;

    const newCount = data.installCount + 1;
    const updates: Record<string, unknown> = {
      installedUids: arrayUnion(newUid),
      installCount: increment(1),
      updatedAt: serverTimestamp(),
    };

    tx.update(codeRef, updates);

    // Mark referred user so we can show their status
    tx.update(newUserRef, { referredBy: referralCode });

    // Check tier thresholds for referrer
    if (!data.tier1Rewarded && newCount >= TIER1_THRESHOLD) {
      updates.tier1Rewarded = true;
      // Reward referrer
      const referrerSubRef = doc(db, 'subscriptions', data.referrerId);
      tx.set(referrerSubRef, {
        pendingDiscount: 0.30,
        pendingDiscountMonths: 3,
        pendingDiscountReason: 'referral_tier1',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // Reward all 3 friends (previous installedUids + current newUid)
      const allFriendUids = [...data.installedUids, newUid];
      for (const friendUid of allFriendUids) {
        const friendSubRef = doc(db, 'subscriptions', friendUid);
        tx.set(friendSubRef, {
          pendingDiscount: 0.30,
          pendingDiscountMonths: 3,
          pendingDiscountReason: 'referral_friend_tier1',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    }

    if (!data.tier2Rewarded && newCount >= TIER2_THRESHOLD) {
      updates.tier2Rewarded = true;
      const referrerSubRef = doc(db, 'subscriptions', data.referrerId);
      tx.set(referrerSubRef, {
        freeMonthGranted: true,
        freeMonthReason: 'referral_tier2',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  });
}

// ── Get referral stats for the current user ───────────────────────────────────

export async function getReferralStats(uid: string): Promise<{
  code: string;
  installCount: number;
  tier1Rewarded: boolean;
  tier2Rewarded: boolean;
} | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;

  const userData = snap.data() as { referralCode?: string };
  if (!userData.referralCode) return null;

  const codeRef = doc(db, 'referrals', userData.referralCode);
  const codeSnap = await getDoc(codeRef);
  if (!codeSnap.exists()) return null;

  const data = codeSnap.data() as ReferralRecord;
  return {
    code: data.code,
    installCount: data.installCount,
    tier1Rewarded: data.tier1Rewarded,
    tier2Rewarded: data.tier2Rewarded,
  };
}

// ── Get pending referral rewards for the current user ─────────────────────────

export async function getPendingRewards(uid: string): Promise<{
  pendingDiscount: number | null;
  pendingDiscountMonths: number | null;
  freeMonthGranted: boolean;
}> {
  const ref = doc(db, 'subscriptions', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { pendingDiscount: null, pendingDiscountMonths: null, freeMonthGranted: false };
  const data = snap.data() as { pendingDiscount?: unknown; freeMonthGranted?: unknown; pendingDiscountMonths?: unknown };
  return {
    pendingDiscount: typeof data.pendingDiscount === 'number' ? data.pendingDiscount : null,
    pendingDiscountMonths: typeof data.pendingDiscountMonths === 'number' ? data.pendingDiscountMonths : null,
    freeMonthGranted: data.freeMonthGranted === true,
  };
}

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

// ── Squad types ────────────────────────────────────────────────────────────────────────────

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

// ── Internal helper ───────────────────────────────────────────────────────────────────────

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

// ── Get squad members ───────────────────────────────────────────────────────────────

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

// ── Referral leaderboard ──────────────────────────────────────────────────────────────────

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
          const u = userSnap.data() as { displayName?: string; avatarUrl?: string; username?: string };
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
