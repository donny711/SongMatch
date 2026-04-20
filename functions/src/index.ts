import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();

const region = functions.region('europe-west1');

// ── Milestone catalog (must match src/data/milestones.ts) ──────────────────

const MILESTONE_REWARDS: Record<string, { points: number; badge?: string }> = {
  ms_first_launch:        { points: 50,  badge: 'badge_early_adopter' },
  ms_connect_spotify:     { points: 200 },
  ms_connect_soundcloud:  { points: 100 },
  ms_two_platforms:       { points: 150, badge: 'badge_double_platform' },
  ms_liked_10:            { points: 50 },
  ms_liked_25:            { points: 100 },
  ms_liked_50:            { points: 200, badge: 'badge_liked_50' },
  ms_liked_100:           { points: 400, badge: 'badge_liked_100' },
  ms_liked_250:           { points: 600 },
  ms_streak_3:            { points: 75 },
  ms_streak_7:            { points: 150, badge: 'badge_streak_7' },
  ms_streak_14:           { points: 250 },
  ms_streak_30:           { points: 500, badge: 'badge_streak_30' },
};

// ── Shop catalog prices (must match src/data/shopCatalog.ts) ──────────────

const ITEM_COSTS: Record<string, number> = {
  frame_simple_purple: 100, frame_simple_gold: 150,
  frame_pulse_cyan: 300, frame_pulse_pink: 300,
  frame_rotate_rainbow: 500, frame_rotate_fire: 500,
  frame_legendary_nova: 1000, frame_legendary_void: 1000,
  bg_gradient_aurora: 200, bg_gradient_sunset: 200,
  bg_particles_starfield: 400, bg_particles_music: 400,
  bg_gradient_holographic: 700, bg_legendary_cosmos: 1200,
  badge_star_gold: 250, badge_diamond: 500, badge_crown: 800,
  badge_skull: 350, badge_infinity: 600, badge_legendary_aura: 1500,
  theme_ocean: 300, theme_fire: 300, theme_forest: 300,
  theme_rose: 300, theme_midnight: 500,
};

// ── Helper ─────────────────────────────────────────────────────────────────

function userRef(uid: string) {
  return db.collection('users').doc(uid);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── grantMilestonePoints ───────────────────────────────────────────────────

export const grantMilestonePoints = region.https.onCall(
  async (data: { uid: string; milestoneId: string }) => {
    const { uid, milestoneId } = data;
    const reward = MILESTONE_REWARDS[milestoneId];
    if (!reward) throw new functions.https.HttpsError('not-found', 'Unknown milestone');

    const ref = userRef(uid);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found');

      const userData = snap.data()!;
      const earned: string[] = userData.earnedMilestones ?? [];

      if (earned.includes(milestoneId)) {
        return { newBalance: userData.points, alreadyGranted: true };
      }

      const updates: Record<string, unknown> = {
        earnedMilestones: FieldValue.arrayUnion(milestoneId),
        points: FieldValue.increment(reward.points),
        totalEarned: FieldValue.increment(reward.points),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (reward.badge) {
        updates.ownedItems = FieldValue.arrayUnion(reward.badge);
      }

      tx.update(ref, updates);

      return {
        newBalance: (userData.points ?? 0) + reward.points,
        alreadyGranted: false,
      };
    });
  }
);

// ── purchaseItem ────────────────────────────────────────────────────────────

export const purchaseItem = region.https.onCall(
  async (data: { uid: string; itemId: string }) => {
    const { uid, itemId } = data;
    const cost = ITEM_COSTS[itemId];
    if (cost === undefined) throw new functions.https.HttpsError('not-found', 'Unknown item');

    const ref = userRef(uid);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found');

      const userData = snap.data()!;
      const ownedItems: string[] = userData.ownedItems ?? [];

      if (ownedItems.includes(itemId)) {
        return { newBalance: userData.points, alreadyOwned: true };
      }

      if ((userData.points ?? 0) < cost) {
        throw new functions.https.HttpsError('failed-precondition', 'Insufficient points');
      }

      tx.update(ref, {
        points: FieldValue.increment(-cost),
        ownedItems: FieldValue.arrayUnion(itemId),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { newBalance: (userData.points ?? 0) - cost };
    });
  }
);

// ── equipItem ──────────────────────────────────────────────────────────────

const VALID_SLOTS = ['avatarFrame', 'profileBackground', 'badge1', 'badge2', 'badge3', 'cardTheme'];

export const equipItem = region.https.onCall(
  async (data: { uid: string; slot: string; itemId: string | null }) => {
    const { uid, slot, itemId } = data;
    if (!VALID_SLOTS.includes(slot)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid slot');
    }

    const ref = userRef(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found');

    if (itemId !== null) {
      const owned: string[] = snap.data()!.ownedItems ?? [];
      if (!owned.includes(itemId)) {
        throw new functions.https.HttpsError('permission-denied', 'Item not owned');
      }
    }

    await ref.update({
      [`equippedItems.${slot}`]: itemId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

// ── updateStreak ────────────────────────────────────────────────────────────

export const updateStreak = region.https.onCall(
  async (data: { uid: string }) => {
    const { uid } = data;
    const today = todayISO();
    const yesterday = yesterdayISO();
    const ref = userRef(uid);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found');

      const userData = snap.data()!;
      const lastActive: string = userData.lastActiveDate ?? '';
      const currentStreak: number = userData.currentStreak ?? 0;
      const longestStreak: number = userData.longestStreak ?? 0;

      if (lastActive === today) {
        // Already checked in today
        return { currentStreak, pointsGranted: 0 };
      }

      let newStreak: number;
      if (lastActive === yesterday) {
        newStreak = currentStreak + 1;
      } else {
        newStreak = 1;
      }

      const newLongest = Math.max(newStreak, longestStreak);

      // Check streak milestones
      const streakMilestones = [3, 7, 14, 30] as const;
      const earned: string[] = userData.earnedMilestones ?? [];
      let pointsGranted = 0;

      const updates: Record<string, unknown> = {
        lastActiveDate: today,
        currentStreak: newStreak,
        longestStreak: newLongest,
        updatedAt: FieldValue.serverTimestamp(),
      };

      for (const days of streakMilestones) {
        if (newStreak >= days) {
          const msId = `ms_streak_${days}`;
          if (!earned.includes(msId)) {
            const reward = MILESTONE_REWARDS[msId];
            if (reward) {
              pointsGranted += reward.points;
              (updates.earnedMilestones as unknown) = FieldValue.arrayUnion(msId);
              (updates.points as unknown) = FieldValue.increment(reward.points);
              (updates.totalEarned as unknown) = FieldValue.increment(reward.points);
              if (reward.badge) {
                (updates.ownedItems as unknown) = FieldValue.arrayUnion(reward.badge);
              }
            }
          }
        }
      }

      tx.update(ref, updates);
      return { currentStreak: newStreak, pointsGranted };
    });
  }
);

// ── moderateImage (HTTPS Callable) ─────────────────────────────────────────
// Called by the client after uploading to Supabase Storage.
// Downloads the image from the public URL, runs Vision SafeSearch,
// then updates Firestore. The client deletes from Supabase if rejected.

export const moderateImage = region.https.onCall(
  async (data: { uid: string; imageUrl: string; type: 'avatar' | 'banner' }) => {
    const { uid, imageUrl, type } = data;
    const isAvatar = type === 'avatar';
    const urlKey = isAvatar ? 'avatarUrl' : 'bannerUrl';
    const pendingKey = isAvatar ? 'avatarPending' : 'bannerPending';
    const ref = userRef(uid);

    try {
      const vision = await import('@google-cloud/vision');
      const client = new vision.ImageAnnotatorClient();

      // Fetch the image bytes from the public Supabase URL
      const fetch = (await import('node-fetch')).default;
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      const [result] = await client.safeSearchDetection({ image: { content: imageBuffer } });
      const annotations = result.safeSearchAnnotation;

      const DANGEROUS = new Set(['VERY_LIKELY', 'LIKELY']);
      const isViolating =
        DANGEROUS.has(annotations?.adult ?? '') ||
        DANGEROUS.has(annotations?.violence ?? '') ||
        DANGEROUS.has(annotations?.racy ?? '');

      if (isViolating) {
        await ref.update({
          [pendingKey]: null,
          moderationRejected: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { approved: false };
      }

      // Approved — set the public URL on the profile
      await ref.update({
        [urlKey]: imageUrl,
        [pendingKey]: null,
        moderationRejected: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { approved: true };
    } catch (err) {
      functions.logger.error('Image moderation failed', err);
      // On error, approve to avoid blocking the user
      await ref.update({
        [urlKey]: imageUrl,
        [pendingKey]: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { approved: true };
    }
  }
);

// ── followUser ─────────────────────────────────────────────────────────────

export const followUser = region.https.onCall(
  async (data: { followerId: string; followingId: string }) => {
    const { followerId, followingId } = data;
    if (!followerId || !followingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing UIDs');
    }
    if (followerId === followingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot follow yourself');
    }

    const targetSnap = await userRef(followingId).get();
    if (!targetSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }
    if (targetSnap.data()?.isPrivate === true) {
      throw new functions.https.HttpsError('permission-denied', 'User is private');
    }

    const followDocId = `${followerId}_${followingId}`;
    const followRef = db.collection('follows').doc(followDocId);
    const existing = await followRef.get();
    if (existing.exists) return { success: true, alreadyFollowing: true };

    const batch = db.batch();
    batch.set(followRef, { followerId, followingId, createdAt: FieldValue.serverTimestamp() });
    batch.update(userRef(followerId), { followingCount: FieldValue.increment(1) });
    batch.update(userRef(followingId), { followerCount: FieldValue.increment(1) });
    await batch.commit();

    return { success: true, alreadyFollowing: false };
  }
);

// ── unfollowUser ───────────────────────────────────────────────────────────

export const unfollowUser = region.https.onCall(
  async (data: { followerId: string; followingId: string }) => {
    const { followerId, followingId } = data;
    if (!followerId || !followingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing UIDs');
    }

    const followDocId = `${followerId}_${followingId}`;
    const followRef = db.collection('follows').doc(followDocId);
    const existing = await followRef.get();
    if (!existing.exists) return { success: true, wasFollowing: false };

    const batch = db.batch();
    batch.delete(followRef);

    const followerSnap = await userRef(followerId).get();
    const followingSnap = await userRef(followingId).get();

    if ((followerSnap.data()?.followingCount ?? 0) > 0) {
      batch.update(userRef(followerId), { followingCount: FieldValue.increment(-1) });
    }
    if ((followingSnap.data()?.followerCount ?? 0) > 0) {
      batch.update(userRef(followingId), { followerCount: FieldValue.increment(-1) });
    }

    await batch.commit();
    return { success: true, wasFollowing: true };
  }
);

// ── API cache helpers ──────────────────────────────────────────────────────

function cacheKey(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

async function getCache(key: string): Promise<unknown | null> {
  const doc = await db.collection('_apiCache').doc(key).get();
  if (!doc.exists) return null;
  const { expiresAt, data } = doc.data()!;
  if (expiresAt && expiresAt.toMillis() < Date.now()) return null;
  return data;
}

async function setCache(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await db.collection('_apiCache').doc(key).set({ data, expiresAt, updatedAt: FieldValue.serverTimestamp() });
}

// ── lastfmProxy ────────────────────────────────────────────────────────────

const LASTFM_TTL: Record<string, number> = {
  'track.getsimilar':  86400,   // 24h
  'artist.gettoptracks': 86400, // 24h
  'artist.getsimilar': 172800,  // 48h
  'track.gettoptags':  172800,  // 48h
  'tag.gettoptracks':  86400,   // 24h
};

export const lastfmProxy = region.https.onCall(
  async (data: { method: string; params: Record<string, string | number> }) => {
    const { method, params } = data;
    if (!method) throw new functions.https.HttpsError('invalid-argument', 'method required');

    const key = cacheKey(`lfm:${method}:${JSON.stringify(params)}`);
    const cached = await getCache(key);
    if (cached !== null) return cached;

    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) throw new functions.https.HttpsError('internal', 'Last.fm key not configured');

    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const url = `https://ws.audioscrobbler.com/2.0/?method=${method}&api_key=${encodeURIComponent(apiKey)}&format=json&${qs}`;

    const fetch = (await import('node-fetch')).default;
    const res = await fetch(url);
    const json = await res.json();

    const ttl = LASTFM_TTL[method] ?? 86400;
    await setCache(key, json, ttl);
    return json;
  }
);

// ── deezerProxy ────────────────────────────────────────────────────────────

export const deezerProxy = region.https.onCall(
  async (data: { action: 'search' | 'track' | 'chart'; query?: string; id?: number; limit?: number }) => {
    const { action, query, id, limit = 20 } = data;
    if (!action) throw new functions.https.HttpsError('invalid-argument', 'action required');

    let url: string;
    let ttl: number;

    if (action === 'search') {
      if (!query) throw new functions.https.HttpsError('invalid-argument', 'query required for search');
      url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;
      ttl = 21600; // 6h
    } else if (action === 'track') {
      if (!id) throw new functions.https.HttpsError('invalid-argument', 'id required for track');
      url = `https://api.deezer.com/track/${id}`;
      ttl = 604800; // 7 days
    } else {
      url = `https://api.deezer.com/chart/0/tracks?limit=${limit}`;
      ttl = 3600; // 1h
    }

    const key = cacheKey(`deezer:${action}:${query ?? ''}:${id ?? ''}:${limit}`);
    const cached = await getCache(key);
    if (cached !== null) return cached;

    const fetch = (await import('node-fetch')).default;
    const res = await fetch(url);
    const json = await res.json();

    await setCache(key, json, ttl);
    return json;
  }
);

// ── onLikedTrackWrite — maintains users/{uid}.artistIds ───────────────────

export const onLikedTrackWrite = functions
  .region('europe-west1')
  .firestore.document('likedTracks/{uid}/tracks/{trackId}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;

    // Fetch up to 200 liked tracks to compute top artist IDs
    const tracksSnap = await db
      .collection('likedTracks')
      .doc(uid)
      .collection('tracks')
      .limit(200)
      .get();

    const artistCounts: Record<number, number> = {};
    tracksSnap.docs.forEach((d) => {
      const artistId = d.data().artistId as number;
      if (artistId) artistCounts[artistId] = (artistCounts[artistId] ?? 0) + 1;
    });

    const topArtistIds = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => Number(id));

    await userRef(uid).update({ artistIds: topArtistIds });
  });

// -- createAffiliate --
// HTTP endpoint for songmatch.net admin panel to create affiliate records.
// Set AFFILIATE_ADMIN_SECRET in Firebase console env vars.

export const createAffiliate = region.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const adminSecret = process.env.AFFILIATE_ADMIN_SECRET;
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const { code, creatorName, creatorEmail, platform, profileUrl, tier } = req.body as {
    code?: string; creatorName?: string; creatorEmail?: string;
    platform?: string; profileUrl?: string; tier?: string;
  };

  if (!code || !creatorName || !creatorEmail || !platform || !tier) {
    res.status(400).json({ error: 'Missing required fields: code, creatorName, creatorEmail, platform, tier' }); return;
  }

  const validTiers = ['starter', 'rising', 'partner', 'elite'];
  if (!validTiers.includes(tier)) {
    res.status(400).json({ error: 'Invalid tier. Must be one of: ' + validTiers.join(', ') }); return;
  }

  const [affiliateSnap, referralSnap] = await Promise.all([
    db.collection('affiliates').doc(code).get(),
    db.collection('referrals').doc(code).get(),
  ]);

  if (affiliateSnap.exists) { res.status(409).json({ error: 'Affiliate code already exists' }); return; }
  if (referralSnap.exists) { res.status(409).json({ error: 'Code already in use as a user referral code' }); return; }

  await db.collection('affiliates').doc(code).set({
    code, creatorName, creatorEmail, platform,
    profileUrl: profileUrl ?? '',
    tier, status: 'active',
    installedUids: [], installCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(200).json({ success: true, code });
});
