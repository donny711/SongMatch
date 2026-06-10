import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { UserProfile } from './profileService';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PublicUser {
  uid: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  equippedItems: UserProfile['equippedItems'];
  points: number;
  currentStreak: number;
  likedCount: number;
  followerCount: number;
  followingCount: number;
  isPrivate: boolean;
  artistIds: number[];
  isPro: boolean;
}

export interface FeedItem {
  uid: string;
  displayName: string | null;
  avatarUrl: string | null;
  equippedItems: UserProfile['equippedItems'];
  trackId: number;
  title: string;
  artistId: number;
  artistName: string;
  coverUrl: string;
  previewUrl: string | null;
  likedAt: { seconds: number; nanoseconds: number };
  isPro?: boolean;
}

export interface SongLikerUser {
  uid: string;
  displayName: string | null;
  avatarUrl: string | null;
  equippedItems: UserProfile['equippedItems'];
  isPrivate: boolean;
}

// ── Follow / Unfollow ──────────────────────────────────────────────────────

// Client-side transaction — security rules permit a non-owner to change
// exactly followerCount ±1 on the target user, and only together with the
// matching follows/{me}_{them} create/delete in the same atomic write.
// (Cloud Function path exists in functions/src but needs the Blaze plan.)
export async function callFollowUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) throw new Error('Cannot follow yourself');

  const followRef = doc(db, 'follows', `${followerId}_${followingId}`);
  const followerRef = doc(db, 'users', followerId);
  const followingRef = doc(db, 'users', followingId);

  await runTransaction(db, async (tx) => {
    const [followSnap, targetSnap] = await Promise.all([
      tx.get(followRef),
      tx.get(followingRef),
    ]);

    if (followSnap.exists()) return; // already following

    const targetData = targetSnap.data() as UserProfile | undefined;
    if (targetData?.isPrivate) throw new Error('User is private');

    tx.set(followRef, { followerId, followingId, createdAt: serverTimestamp() });
    tx.update(followerRef, { followingCount: increment(1) });
    tx.update(followingRef, { followerCount: increment(1) });
  });
}

export async function callUnfollowUser(followerId: string, followingId: string): Promise<void> {
  const followRef = doc(db, 'follows', `${followerId}_${followingId}`);
  const followerRef = doc(db, 'users', followerId);
  const followingRef = doc(db, 'users', followingId);

  await runTransaction(db, async (tx) => {
    const followSnap = await tx.get(followRef);
    if (!followSnap.exists()) return; // not following

    tx.delete(followRef);
    tx.update(followerRef, { followingCount: increment(-1) });
    tx.update(followingRef, { followerCount: increment(-1) });
  });
}

// ── Relationship queries ───────────────────────────────────────────────────

export async function checkIsFollowing(myUid: string, theirUid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'follows', `${myUid}_${theirUid}`));
  return snap.exists();
}

export async function getFollowing(uid: string, count = 50): Promise<PublicUser[]> {
  const q = query(
    collection(db, 'follows'),
    where('followerId', '==', uid),
    limit(count)
  );
  const snaps = await getDocs(q);
  const followingIds = snaps.docs.map((d) => d.data().followingId as string);
  return fetchUsersByIds(followingIds);
}

export async function getFollowers(uid: string, count = 50): Promise<PublicUser[]> {
  const q = query(
    collection(db, 'follows'),
    where('followingId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(count)
  );
  const snaps = await getDocs(q);
  const followerIds = snaps.docs.map((d) => d.data().followerId as string);
  return fetchUsersByIds(followerIds);
}

export async function getFollowingIds(uid: string): Promise<string[]> {
  const q = query(
    collection(db, 'follows'),
    where('followerId', '==', uid),
    limit(100)
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data().followingId as string);
}

// ── User fetching helpers ──────────────────────────────────────────────────

export async function fetchPublicUser(uid: string): Promise<PublicUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snapToPublicUser(uid, snap.data() as UserProfile);
}

async function fetchUsersByIds(uids: string[]): Promise<PublicUser[]> {
  if (uids.length === 0) return [];
  const results = await Promise.all(uids.map((uid) => fetchPublicUser(uid)));
  return results.filter((u): u is PublicUser => u !== null);
}

function snapToPublicUser(uid: string, data: UserProfile): PublicUser {
  return {
    uid,
    displayName: data.displayName ?? null,
    username: data.username ?? null,
    avatarUrl: data.avatarUrl ?? null,
    equippedItems: data.equippedItems,
    points: data.points ?? 0,
    currentStreak: data.currentStreak ?? 0,
    likedCount: data.likedCount ?? 0,
    followerCount: data.followerCount ?? 0,
    followingCount: data.followingCount ?? 0,
    isPrivate: data.isPrivate ?? false,
    artistIds: data.artistIds ?? [],
    isPro: data.isPro ?? false,
  };
}

// ── Search ─────────────────────────────────────────────────────────────────

export async function searchUsers(term: string, myUid: string): Promise<PublicUser[]> {
  if (!term.trim()) return [];
  const lower = term.trim().toLowerCase().replace(/^@/, '');

  const [byName, byUsername] = await Promise.all([
    getDocs(query(
      collection(db, 'users'),
      where('displayNameLower', '>=', lower),
      where('displayNameLower', '<=', lower + '\uf8ff'),
      limit(20)
    )),
    getDocs(query(
      collection(db, 'users'),
      where('username', '>=', lower),
      where('username', '<=', lower + '\uf8ff'),
      limit(20)
    )),
  ]);

  const seen = new Set<string>();
  const results: PublicUser[] = [];
  for (const snap of [...byName.docs, ...byUsername.docs]) {
    if (seen.has(snap.id)) continue;
    seen.add(snap.id);
    const data = snap.data() as UserProfile;
    if (snap.id === myUid || data.isPrivate) continue;
    results.push(snapToPublicUser(snap.id, data));
  }
  return results;
}

// ── Leaderboard ────────────────────────────────────────────────────────────

export type LeaderboardField = 'points' | 'currentStreak' | 'likedCount';

export async function getLeaderboard(field: LeaderboardField, count = 50): Promise<PublicUser[]> {
  // orderBy on a single field — no composite index required; filter private client-side
  const q = query(
    collection(db, 'users'),
    orderBy(field, 'desc'),
    limit(count + 20) // fetch extra to account for private users filtered out
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map((d) => snapToPublicUser(d.id, d.data() as UserProfile))
    .filter((u) => !u.isPrivate)
    .slice(0, count);
}

// ── Suggested users (client-side artist overlap) ───────────────────────────

export async function getSuggestedUsers(myArtistIds: number[], myUid: string): Promise<PublicUser[]> {
  const q = query(
    collection(db, 'users'),
    limit(50)
  );
  const snaps = await getDocs(q);
  const mySet = new Set(myArtistIds);

  const scored = snaps.docs
    .filter((d) => d.id !== myUid && !(d.data() as UserProfile).isPrivate)
    .map((d) => {
      const data = d.data() as UserProfile;
      const theirIds: number[] = data.artistIds ?? [];
      const shared = theirIds.filter((id) => mySet.has(id)).length;
      const score = mySet.size + theirIds.length > 0
        ? shared / Math.sqrt((mySet.size || 1) * (theirIds.length || 1))
        : 0;
      return { user: snapToPublicUser(d.id, data), score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ user }) => user);

  return scored;
}

// ── Activity feed ──────────────────────────────────────────────────────────

export async function getFeedItems(
  followingUids: string[],
  count = 5
): Promise<FeedItem[]> {
  if (followingUids.length === 0) return [];

  // Fetch user profile data and liked tracks in parallel
  const [profileResults, trackResults] = await Promise.all([
    Promise.all(followingUids.map((uid) => fetchPublicUser(uid))),
    Promise.all(
      followingUids.map((uid) =>
        getDocs(
          query(
            collection(db, 'likedTracks', uid, 'tracks'),
            orderBy('likedAt', 'desc'),
            limit(count)
          )
        )
      )
    ),
  ]);

  const profileMap = new Map<string, PublicUser>();
  followingUids.forEach((uid, i) => {
    const p = profileResults[i];
    if (p) profileMap.set(uid, p);
  });

  const items: FeedItem[] = [];
  followingUids.forEach((uid, i) => {
    const profile = profileMap.get(uid);
    if (!profile) return;
    trackResults[i].docs.forEach((d) => {
      const data = d.data();
      items.push({
        uid,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        equippedItems: profile.equippedItems,
        isPro: profile.isPro,
        trackId: data.trackId as number,
        title: data.title as string,
        artistId: (data.artistId as number) ?? 0,
        artistName: data.artistName as string,
        coverUrl: data.coverUrl as string,
        previewUrl: (data.previewUrl as string) ?? null,
        likedAt: data.likedAt,
      });
    });
  });

  return items.sort((a, b) => (b.likedAt?.seconds ?? 0) - (a.likedAt?.seconds ?? 0));
}

// ── Who liked this song ────────────────────────────────────────────────────

export async function getWhoLikedSong(trackId: number): Promise<SongLikerUser[]> {
  const likersSnap = await getDocs(
    query(collection(db, 'songLikes', String(trackId), 'likers'), orderBy('likedAt', 'desc'), limit(50))
  );
  if (likersSnap.empty) return [];

  const uids = likersSnap.docs.map((d) => d.data().uid as string);
  const users = await fetchUsersByIds(uids);
  return users
    .filter((u) => !u.isPrivate)
    .map((u) => ({
      uid: u.uid,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      equippedItems: u.equippedItems,
      isPrivate: u.isPrivate,
    }));
}

export async function getSongLikerCount(trackId: number): Promise<{ count: number; previewUids: string[] }> {
  const snap = await getDoc(doc(db, 'songLikes', String(trackId)));
  return {
    count: snap.exists() ? (snap.data().likerCount ?? 0) : 0,
    previewUids: [],
  };
}
