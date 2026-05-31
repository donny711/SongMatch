/**
 * SoundMatch — Firestore seed script
 * Creates 5 fake users with liked tracks, follow relationships, and song-likes data.
 *
 * Run from the SoundMatch root:
 *   node scripts/seed.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.mjs';

// ── Firebase init  ────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n) {
  return Timestamp.fromDate(new Date(Date.now() - n * 86_400_000));
}

function cover(seed) {
  return `https://picsum.photos/seed/${seed}/500/500`;
}

// ── Fake data ──────────────────────────────────────────────────────────────

const TRACKS = [
  { id: 1001, title: 'Blinding Lights',   artistId: 4050205, artistName: 'The Weeknd',     albumId: 1, albumTitle: 'After Hours' },
  { id: 1002, title: 'Levitating',         artistId: 5080187, artistName: 'Dua Lipa',       albumId: 2, albumTitle: 'Future Nostalgia' },
  { id: 1003, title: 'As It Was',          artistId: 1219052, artistName: 'Harry Styles',   albumId: 3, albumTitle: "Harry's House" },
  { id: 1004, title: 'Enemy',              artistId: 5257805, artistName: 'Imagine Dragons',albumId: 4, albumTitle: 'Mercury' },
  { id: 1005, title: 'Heat Waves',         artistId: 9367066, artistName: 'Glass Animals',  albumId: 5, albumTitle: 'Dreamland' },
  { id: 1006, title: 'Bad Guy',            artistId: 6077756, artistName: 'Billie Eilish',  albumId: 6, albumTitle: 'When We All Fall Asleep' },
  { id: 1007, title: 'Circles',            artistId: 4050205, artistName: 'Post Malone',    albumId: 7, albumTitle: "Hollywood's Bleeding" },
  { id: 1008, title: 'drivers license',   artistId: 5819110, artistName: 'Olivia Rodrigo',  albumId: 8, albumTitle: 'SOUR' },
  { id: 1009, title: 'Stay',               artistId: 1057960, artistName: 'The Kid LAROI',  albumId: 9, albumTitle: 'F*CK LOVE 3' },
  { id: 1010, title: 'Peaches',            artistId: 7327,    artistName: 'Justin Bieber',  albumId: 10, albumTitle: 'Justice' },
];

const DEFAULT_EQUIPPED = {
  avatarFrame: null,
  profileBackground: null,
  badge1: null,
  badge2: null,
  badge3: null,
  cardTheme: 'theme_default',
};

const USERS = [
  {
    uid: 'seed_user_1',
    displayName: 'Alex Rivers',
    displayNameLower: 'alex rivers',
    avatarUrl: null,
    bannerUrl: null,
    avatarPending: null,
    bannerPending: null,
    points: 1240,
    totalEarned: 1240,
    currentStreak: 7,
    longestStreak: 12,
    likedCount: 4,
    followerCount: 0, // will be updated
    followingCount: 0,
    isPrivate: false,
    earnedMilestones: ['ms_first_launch'],
    ownedItems: ['theme_default'],
    equippedItems: DEFAULT_EQUIPPED,
    showcaseTracks: [],
    showcaseArtists: [],
    artistIds: [4050205, 5080187, 1219052],
    lastActiveDate: new Date().toISOString().slice(0, 10),
    likedSyncVersion: 1,
    likedTracks: [1001, 1002, 1005, 1006],
  },
  {
    uid: 'seed_user_2',
    displayName: 'Maya Chen',
    displayNameLower: 'maya chen',
    avatarUrl: null,
    bannerUrl: null,
    avatarPending: null,
    bannerPending: null,
    points: 890,
    totalEarned: 890,
    currentStreak: 14,
    longestStreak: 14,
    likedCount: 5,
    followerCount: 0,
    followingCount: 0,
    isPrivate: false,
    earnedMilestones: ['ms_first_launch', 'ms_streak_7'],
    ownedItems: ['theme_default'],
    equippedItems: DEFAULT_EQUIPPED,
    showcaseTracks: [],
    showcaseArtists: [],
    artistIds: [6077756, 9367066, 5257805],
    lastActiveDate: new Date().toISOString().slice(0, 10),
    likedSyncVersion: 1,
    likedTracks: [1001, 1004, 1005, 1006, 1008],
  },
  {
    uid: 'seed_user_3',
    displayName: 'Jordan Blake',
    displayNameLower: 'jordan blake',
    avatarUrl: null,
    bannerUrl: null,
    avatarPending: null,
    bannerPending: null,
    points: 2100,
    totalEarned: 2100,
    currentStreak: 21,
    longestStreak: 30,
    likedCount: 6,
    followerCount: 0,
    followingCount: 0,
    isPrivate: false,
    earnedMilestones: ['ms_first_launch', 'ms_streak_7', 'ms_liked_25'],
    ownedItems: ['theme_default'],
    equippedItems: DEFAULT_EQUIPPED,
    showcaseTracks: [],
    showcaseArtists: [],
    artistIds: [7327, 1057960, 5819110],
    lastActiveDate: new Date().toISOString().slice(0, 10),
    likedSyncVersion: 1,
    likedTracks: [1002, 1003, 1007, 1008, 1009, 1010],
  },
  {
    uid: 'seed_user_4',
    displayName: 'Sam Torres',
    displayNameLower: 'sam torres',
    avatarUrl: null,
    bannerUrl: null,
    avatarPending: null,
    bannerPending: null,
    points: 450,
    totalEarned: 450,
    currentStreak: 3,
    longestStreak: 7,
    likedCount: 3,
    followerCount: 0,
    followingCount: 0,
    isPrivate: false,
    earnedMilestones: ['ms_first_launch'],
    ownedItems: ['theme_default'],
    equippedItems: DEFAULT_EQUIPPED,
    showcaseTracks: [],
    showcaseArtists: [],
    artistIds: [4050205, 6077756],
    lastActiveDate: new Date().toISOString().slice(0, 10),
    likedSyncVersion: 1,
    likedTracks: [1001, 1006, 1010],
  },
  {
    uid: 'seed_user_5',
    displayName: 'Riley Kim',
    displayNameLower: 'riley kim',
    avatarUrl: null,
    bannerUrl: null,
    avatarPending: null,
    bannerPending: null,
    points: 1750,
    totalEarned: 1750,
    currentStreak: 5,
    longestStreak: 21,
    likedCount: 5,
    followerCount: 0,
    followingCount: 0,
    isPrivate: false,
    earnedMilestones: ['ms_first_launch', 'ms_liked_10'],
    ownedItems: ['theme_default'],
    equippedItems: DEFAULT_EQUIPPED,
    showcaseTracks: [],
    showcaseArtists: [],
    artistIds: [4050205, 5080187, 9367066, 7327],
    lastActiveDate: new Date().toISOString().slice(0, 10),
    likedSyncVersion: 1,
    likedTracks: [1001, 1002, 1005, 1009, 1010],
  },
];

// follow relationships: [followerId, followingId]
const FOLLOWS = [
  ['seed_user_1', 'seed_user_2'],
  ['seed_user_1', 'seed_user_3'],
  ['seed_user_2', 'seed_user_1'],
  ['seed_user_2', 'seed_user_5'],
  ['seed_user_3', 'seed_user_4'],
  ['seed_user_5', 'seed_user_1'],
  ['seed_user_5', 'seed_user_2'],
  ['seed_user_5', 'seed_user_3'],
];

// ── Seed functions ─────────────────────────────────────────────────────────

async function seedUsers() {
  console.log('Writing users...');
  const batch = writeBatch(db);
  for (const u of USERS) {
    const { likedTracks: _, ...profile } = u;
    batch.set(doc(db, 'users', u.uid), {
      ...profile,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(0),
    });
  }
  await batch.commit();
  console.log(`  ✓ ${USERS.length} users`);
}

async function seedLikedTracks() {
  console.log('Writing likedTracks...');
  let total = 0;
  for (const user of USERS) {
    const batch = writeBatch(db);
    user.likedTracks.forEach((trackId, i) => {
      const track = TRACKS.find((t) => t.id === trackId);
      if (!track) return;
      batch.set(
        doc(db, 'likedTracks', user.uid, 'tracks', String(trackId)),
        {
          trackId: track.id,
          title: track.title,
          artistId: track.artistId,
          artistName: track.artistName,
          albumId: track.albumId,
          albumTitle: track.albumTitle,
          coverUrl: cover(track.id),
          likedAt: daysAgo(user.likedTracks.length - i),
        }
      );
      total++;
    });
    await batch.commit();
  }
  console.log(`  ✓ ${total} liked track docs`);
}

async function seedSongLikes() {
  console.log('Writing songLikes...');
  // Build inverted index: trackId → likerUids
  const index = new Map();
  for (const user of USERS) {
    for (const trackId of user.likedTracks) {
      if (!index.has(trackId)) index.set(trackId, []);
      index.get(trackId).push(user.uid);
    }
  }
  const batch = writeBatch(db);
  for (const [trackId, uids] of index) {
    const track = TRACKS.find((t) => t.id === trackId);
    if (!track) continue;
    batch.set(doc(db, 'songLikes', String(trackId)), {
      trackId: track.id,
      title: track.title,
      artistName: track.artistName,
      coverUrl: cover(track.id),
      likerUids: uids,
      likerCount: uids.length,
    });
  }
  await batch.commit();
  console.log(`  ✓ ${index.size} songLikes docs`);
}

async function seedFollows() {
  console.log('Writing follows...');
  // Compute counts
  const followerCounts = {};
  const followingCounts = {};
  for (const uid of USERS.map((u) => u.uid)) {
    followerCounts[uid] = 0;
    followingCounts[uid] = 0;
  }
  for (const [ferId, fIngId] of FOLLOWS) {
    followingCounts[ferId]++;
    followerCounts[fIngId]++;
  }

  const batch = writeBatch(db);

  // Follow docs
  for (const [followerId, followingId] of FOLLOWS) {
    batch.set(doc(db, 'follows', `${followerId}_${followingId}`), {
      followerId,
      followingId,
      createdAt: daysAgo(Math.floor(Math.random() * 10)),
    });
  }

  // Update user counts
  for (const uid of USERS.map((u) => u.uid)) {
    batch.update(doc(db, 'users', uid), {
      followerCount: followerCounts[uid],
      followingCount: followingCounts[uid],
    });
  }

  await batch.commit();
  console.log(`  ✓ ${FOLLOWS.length} follow relationships`);
}

// ── Run ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Firestore...\n');
  await seedUsers();
  await seedLikedTracks();
  await seedSongLikes();
  await seedFollows();
  console.log('\n✅ Done! Fake users: seed_user_1 … seed_user_5');
  console.log('   Open the People tab and search for "alex", "maya", "jordan", "sam", or "riley"');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
