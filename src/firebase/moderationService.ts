import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { callUnfollowUser } from './socialService';

export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'other';

/**
 * Block lives as blockedUids on the blocker's own user doc (owner-writable
 * under the rules; no Cloud Function needed). Every social list filters
 * against it client-side via socialService.
 */
export async function blockUser(myUid: string, theirUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', myUid), { blockedUids: arrayUnion(theirUid) });
  // Also stop their activity reaching the feed.
  await callUnfollowUser(myUid, theirUid).catch(() => {});
}

export async function unblockUser(myUid: string, theirUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', myUid), { blockedUids: arrayRemove(theirUid) });
}

/**
 * Reports land in a write-only collection (clients can create, never read)
 * and are reviewed in the Firebase console.
 */
export async function reportUser(
  reporterId: string,
  targetUid: string,
  reason: ReportReason
): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    reporterId,
    targetUid,
    reason,
    createdAt: serverTimestamp(),
  });
}
