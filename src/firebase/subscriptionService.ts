import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { ProTier } from '../store/subscriptionStore';

export interface SubscriptionRecord {
  isPro: boolean;
  tier: ProTier | null;
  expiresAt: string | null; // ISO string
  updatedAt: unknown;
}

export async function getSubscriptionFromFirestore(uid: string): Promise<SubscriptionRecord | null> {
  const ref = doc(db, 'subscriptions', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as SubscriptionRecord;
}

export async function saveSubscriptionToFirestore(
  uid: string,
  data: { isPro: boolean; tier: ProTier | null; expiresAt: Date | null }
): Promise<void> {
  const ref = doc(db, 'subscriptions', uid);
  await setDoc(ref, {
    isPro: data.isPro,
    tier: data.tier,
    expiresAt: data.expiresAt?.toISOString() ?? null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  // Mirror onto the public profile doc so leaderboard / social can read it
  const profileRef = doc(db, 'users', uid);
  await setDoc(profileRef, { isPro: data.isPro }, { merge: true });
}
