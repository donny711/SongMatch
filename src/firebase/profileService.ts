import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  increment,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import { MILESTONE_MAP } from '../data/milestones';
import { SHOP_ITEMS_BY_ID } from '../data/shopCatalog';
import type { DeezerTrack } from '../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ShowcaseArtist {
  id: number;
  name: string;
  coverUrl: string;
}

export interface EquippedItems {
  avatarFrame: string | null;
  profileBackground: string | null;
  badge1: string | null;
  badge2: string | null;
  badge3: string | null;
  cardTheme: string | null;
  equippedRank: string | null;
  profileTheme: string | null;
}

export interface UserProfile {
  uid: string;
  createdAt: unknown;
  updatedAt: unknown;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatarPending: string | null;
  bannerPending: string | null;
  points: number;
  totalEarned: number;
  lastActiveDate: string;
  currentStreak: number;
  longestStreak: number;
  earnedMilestones: string[];
  ownedItems: string[];
  equippedItems: EquippedItems;
  showcaseTracks: DeezerTrack[];
  showcaseArtists: ShowcaseArtist[];
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  likedCount: number;
  displayNameLower: string;
  artistIds: number[];
  username: string | null;
  gifBgUrl?: string | null;
  isPro?: boolean;
}

export type ProfileField = Partial<Pick<UserProfile,
  'displayName' | 'avatarUrl' | 'bannerUrl' | 'avatarPending' | 'bannerPending' | 'isPrivate' | 'username' | 'gifBgUrl' | 'email'
>>;

export type EquipSlot = keyof EquippedItems;

const DEFAULT_EQUIPPED: EquippedItems = {
  avatarFrame: null,
  profileBackground: null,
  badge1: null,
  badge2: null,
  badge3: null,
  cardTheme: 'theme_default',
  equippedRank: null,
  profileTheme: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function userRef(uid: string) {
  return doc(db, 'users', uid);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getOrCreateUserDoc(uid: string): Promise<UserProfile> {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserProfile;

  const newProfile = {
    uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    email: null,
    displayName: null,
    avatarUrl: null,
    bannerUrl: null,
    avatarPending: null,
    bannerPending: null,
    points: 0,
    totalEarned: 0,
    lastActiveDate: '',
    currentStreak: 0,
    longestStreak: 0,
    earnedMilestones: [],
    ownedItems: ['theme_default'],
    equippedItems: DEFAULT_EQUIPPED,
    showcaseTracks: [],
    showcaseArtists: [],
    isPrivate: false,
    followerCount: 0,
    followingCount: 0,
    likedCount: 0,
    displayNameLower: '',
    artistIds: [],
    username: null,
  };
  await setDoc(ref, newProfile);
  return newProfile as UserProfile;
}

export function subscribeToProfile(
  uid: string,
  callback: (profile: UserProfile) => void
): Unsubscribe {
  return onSnapshot(userRef(uid), (snap) => {
    if (snap.exists()) callback(snap.data() as UserProfile);
  });
}

export async function updateProfileFields(uid: string, fields: ProfileField): Promise<void> {
  const updates: Record<string, unknown> = { ...fields, updatedAt: serverTimestamp() };
  if (fields.displayName !== undefined) {
    updates.displayNameLower = fields.displayName?.toLowerCase() ?? '';
  }
  await updateDoc(userRef(uid), updates);
}

// ── Points & Milestones (client-side Firestore transactions) ───────────────

export async function grantMilestone(
  uid: string,
  milestoneId: string
): Promise<{ newBalance: number; alreadyGranted: boolean }> {
  const milestone = MILESTONE_MAP[milestoneId];
  if (!milestone) return { newBalance: 0, alreadyGranted: false };

  const ref = userRef(uid);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return { newBalance: 0, alreadyGranted: false };

    const data = snap.data() as UserProfile;
    const earned: string[] = data.earnedMilestones ?? [];

    if (earned.includes(milestoneId)) {
      return { newBalance: data.points, alreadyGranted: true };
    }

    const updates: Record<string, unknown> = {
      earnedMilestones: arrayUnion(milestoneId),
      points: increment(milestone.pointsReward),
      totalEarned: increment(milestone.pointsReward),
      updatedAt: serverTimestamp(),
    };

    if (milestone.badgeGrant) {
      updates.ownedItems = arrayUnion(milestone.badgeGrant);
    }

    tx.update(ref, updates);
    return {
      newBalance: (data.points ?? 0) + milestone.pointsReward,
      alreadyGranted: false,
    };
  });
}

export async function purchaseItem(
  uid: string,
  itemId: string
): Promise<{ newBalance: number }> {
  const item = SHOP_ITEMS_BY_ID[itemId];
  if (!item) throw new Error('Unknown item');

  const ref = userRef(uid);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('User not found');

    const data = snap.data() as UserProfile;
    const owned: string[] = data.ownedItems ?? [];

    if (owned.includes(itemId)) return { newBalance: data.points };

    if ((data.points ?? 0) < item.cost) {
      throw new Error('Insufficient points');
    }

    tx.update(ref, {
      points: increment(-item.cost),
      ownedItems: arrayUnion(itemId),
      updatedAt: serverTimestamp(),
    });

    return { newBalance: (data.points ?? 0) - item.cost };
  });
}

export async function equipItem(
  uid: string,
  slot: EquipSlot,
  itemId: string | null
): Promise<void> {
  await updateDoc(userRef(uid), {
    [`equippedItems.${slot}`]: itemId,
    updatedAt: serverTimestamp(),
  });
}

export async function updateShowcase(
  uid: string,
  tracks: DeezerTrack[],
  artists: ShowcaseArtist[]
): Promise<void> {
  await updateDoc(userRef(uid), {
    showcaseTracks: tracks,
    showcaseArtists: artists,
    updatedAt: serverTimestamp(),
  });
}

// ── Ad reward ─────────────────────────────────────────────────────────────

const AD_REWARD_POINTS = 30;
const AD_MAX_PER_DAY = 5;

export async function grantAdReward(uid: string): Promise<{ granted: boolean; remaining: number }> {
  const today = todayISO();
  const ref = userRef(uid);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return { granted: false, remaining: 0 };

    const data = snap.data() as UserProfile & { adRewardDate?: string; adRewardCount?: number };
    const sameDay = data.adRewardDate === today;
    const count = sameDay ? (data.adRewardCount ?? 0) : 0;

    if (count >= AD_MAX_PER_DAY) return { granted: false, remaining: 0 };

    tx.update(ref, {
      points: increment(AD_REWARD_POINTS),
      totalEarned: increment(AD_REWARD_POINTS),
      adRewardDate: today,
      adRewardCount: count + 1,
      updatedAt: serverTimestamp(),
    });

    return { granted: true, remaining: AD_MAX_PER_DAY - count - 1 };
  });
}

// ── Username ───────────────────────────────────────────────────────────────

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', username));
  return !snap.exists();
}

export async function claimUsername(
  uid: string,
  newUsername: string,
  oldUsername: string | null
): Promise<void> {
  const newRef = doc(db, 'usernames', newUsername);
  const uRef = userRef(uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(newRef);
    if (snap.exists() && snap.data()?.uid !== uid) {
      throw new Error('Username already taken');
    }
    if (oldUsername && oldUsername !== newUsername) {
      tx.delete(doc(db, 'usernames', oldUsername));
    }
    tx.set(newRef, { uid });
    tx.set(uRef, { username: newUsername, updatedAt: serverTimestamp() }, { merge: true });
  });
}

// ── Social: liked track sync ───────────────────────────────────────────────

export async function syncLikedTrackToFirestore(uid: string, track: DeezerTrack): Promise<void> {
  const batch = writeBatch(db);

  // Write to user's liked subcollection
  const trackRef = doc(db, 'likedTracks', uid, 'tracks', String(track.id));
  batch.set(trackRef, {
    trackId: track.id,
    title: track.title,
    artistId: track.artist.id,
    artistName: track.artist.name,
    albumId: track.album.id,
    albumTitle: track.album.title,
    coverUrl: track.album.cover_xl,
    previewUrl: track.preview ?? null,
    likedAt: serverTimestamp(),
  });

  // Increment user's likedCount
  batch.update(userRef(uid), { likedCount: increment(1) });

  // Update inverted index for "who liked this song"
  const songLikesRef = doc(db, 'songLikes', String(track.id));
  batch.set(songLikesRef, {
    trackId: track.id,
    title: track.title,
    artistName: track.artist.name,
    coverUrl: track.album.cover_xl,
    likerCount: increment(1),
  }, { merge: true });
  batch.set(doc(db, 'songLikes', String(track.id), 'likers', uid), {
    uid,
    likedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function removeLikedTrackFromFirestore(uid: string, trackId: number): Promise<void> {
  const uRef = userRef(uid);
  const songRef = doc(db, 'songLikes', String(trackId));
  const trackRef = doc(db, 'likedTracks', uid, 'tracks', String(trackId));

  await runTransaction(db, async (tx) => {
    const [userSnap, songSnap] = await Promise.all([tx.get(uRef), tx.get(songRef)]);

    const currentLikedCount: number = userSnap.exists()
      ? ((userSnap.data() as UserProfile).likedCount ?? 0)
      : 0;
    const currentLikerCount: number = songSnap.exists()
      ? ((songSnap.data() as { likerCount?: number }).likerCount ?? 0)
      : 0;

    tx.delete(trackRef);
    tx.update(uRef, {
      likedCount: Math.max(0, currentLikedCount - 1),
    });
    if (songSnap.exists()) {
      tx.update(songRef, { likerCount: Math.max(0, currentLikerCount - 1) });
      tx.delete(doc(db, 'songLikes', String(trackId), 'likers', uid));
    }
  });
}

export async function runLikedTracksMigration(uid: string, likedTracks: DeezerTrack[]): Promise<void> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  if ((data.likedSyncVersion as number ?? 0) >= 1) return;

  // Batch-write in chunks of 490 (batch limit is 500 ops; reserve 2 for counts)
  const CHUNK = 490;
  for (let i = 0; i < likedTracks.length; i += CHUNK) {
    const chunk = likedTracks.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const track of chunk) {
      batch.set(doc(db, 'likedTracks', uid, 'tracks', String(track.id)), {
        trackId: track.id,
        title: track.title,
        artistId: track.artist.id,
        artistName: track.artist.name,
        albumId: track.album.id,
        albumTitle: track.album.title,
        coverUrl: track.album.cover_xl,
        likedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  await updateDoc(userRef(uid), {
    likedCount: likedTracks.length,
    likedSyncVersion: 1,
  });
}

// ── Spotify → Firebase Auth UID migration ─────────────────────────────────
// Called once after Spotify login when the app has switched to Firebase Anonymous
// Auth. Copies the old Spotify-ID-keyed profile to the new Firebase Auth UID.

export async function migrateSpotifyProfile(
  spotifyId: string,
  newUid: string,
): Promise<boolean> {
  if (spotifyId === newUid) return false;

  const oldRef = doc(db, 'users', spotifyId);
  const newRef = doc(db, 'users', newUid);

  const [oldSnap, newSnap] = await Promise.all([getDoc(oldRef), getDoc(newRef)]);
  if (!oldSnap.exists()) return false;

  const oldProfile = oldSnap.data() as UserProfile;

  // Skip if the new UID already has real data (username or points > 0)
  if (newSnap.exists()) {
    const np = newSnap.data() as UserProfile;
    if (np.username || (np.points ?? 0) > 0) return false;
  }

  const batch = writeBatch(db);
  batch.set(newRef, { ...oldProfile, uid: newUid });
  if (oldProfile.username) {
    batch.set(doc(db, 'usernames', oldProfile.username), { uid: newUid });
  }
  batch.delete(oldRef);
  await batch.commit();
  return true;
}

export async function updateArtistIds(uid: string, likedTracks: DeezerTrack[]): Promise<void> {
  const counts = new Map<number, number>();
  for (const track of likedTracks) {
    const id = track.artist.id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);
  await updateDoc(userRef(uid), { artistIds: topIds });
}

export async function updateStreak(uid: string): Promise<{ currentStreak: number; pointsGranted: number }> {
  const today = todayISO();
  const yesterday = yesterdayISO();
  const ref = userRef(uid);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return { currentStreak: 0, pointsGranted: 0 };

    const data = snap.data() as UserProfile;
    const lastActive: string = data.lastActiveDate ?? '';
    const currentStreak: number = data.currentStreak ?? 0;
    const longestStreak: number = data.longestStreak ?? 0;

    if (lastActive === today) {
      return { currentStreak, pointsGranted: 0 };
    }

    const newStreak = lastActive === yesterday ? currentStreak + 1 : 1;
    const newLongest = Math.max(newStreak, longestStreak);

    const updates: Record<string, unknown> = {
      lastActiveDate: today,
      currentStreak: newStreak,
      longestStreak: newLongest,
      updatedAt: serverTimestamp(),
    };

    // Check streak milestones
    let pointsGranted = 0;
    const earned: string[] = data.earnedMilestones ?? [];
    const streakMilestones = [3, 7, 14, 30];

    let totalMilestonePoints = 0;
    for (const days of streakMilestones) {
      if (newStreak >= days) {
        const msId = `ms_streak_${days}`;
        if (!earned.includes(msId)) {
          const milestone = MILESTONE_MAP[msId];
          if (milestone) {
            pointsGranted += milestone.pointsReward;
            totalMilestonePoints += milestone.pointsReward;
            updates.earnedMilestones = arrayUnion(msId);
            if (milestone.badgeGrant) {
              updates.ownedItems = arrayUnion(milestone.badgeGrant);
            }
          }
        }
      }
    }
    if (totalMilestonePoints > 0) {
      updates.points = increment(totalMilestonePoints);
      updates.totalEarned = increment(totalMilestonePoints);
    }

    tx.update(ref, updates);
    return { currentStreak: newStreak, pointsGranted };
  });
}
