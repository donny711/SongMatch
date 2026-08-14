/**
 * One-time backfill: replace stored cover URLs with Apple Music
 * artwork on all pre-migration Firestore data.
 *
 * Uses the Admin SDK (service account) so it bypasses the songLikes security
 * rules that deny client-side coverUrl drift. Matching mirrors the client's
 * musicKitService: ISRC-first, title+artist fallback,
 * through the same Cloudflare Worker `/apple` proxy so results are cached.
 *
 * Prerequisites:
 *   1. npm i -D firebase-admin
 *   2. Firebase console → Project settings → Service accounts → Generate key.
 *      Save it and set GOOGLE_APPLICATION_CREDENTIALS to its path
 *      (or drop it at ./serviceAccount.json).
 *   3. EXPO_PUBLIC_MUSIC_PROXY_URL must be set in ../.env (already used by app).
 *
 * Run:
 *   node scripts/backfill-apple-artwork.mjs --dry-run   # report only
 *   node scripts/backfill-apple-artwork.mjs             # apply
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
const STOREFRONT = 'us';
const ART_SIZE = 1000;

// ── Config from .env ────────────────────────────────────────────────────────
const env = {};
try {
  for (const line of readFileSync(resolve(__dirname, '../.env'), 'utf8').split('\n')) {
    const m = line.match(/^([^#][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {
  console.error('Could not read ../.env');
  process.exit(1);
}

const PROXY = env.EXPO_PUBLIC_MUSIC_PROXY_URL;
if (!PROXY) {
  console.error('EXPO_PUBLIC_MUSIC_PROXY_URL missing from .env');
  process.exit(1);
}

// ── Admin SDK ───────────────────────────────────────────────────────────────
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || resolve(__dirname, '../serviceAccount.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
} catch {
  console.error(`Service account key not found at ${saPath}. See script header.`);
  process.exit(1);
}
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Apple matching (mirrors src/api/musicKitService.ts) ─────────────────────
const cache = new Map(); // trackId -> { artworkUrl, appleMusicId }
let apiCalls = 0;

async function appleGet(path) {
  apiCalls++;
  try {
    const r = await fetch(`${PROXY}/apple${path}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchIsrc(id) {
  try {
    const r = await fetch(`${PROXY}/apple/v1/catalog/us/songs/${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.isrc || null;
  } catch {
    return null;
  }
}

const buildUrl = (tmpl) => tmpl.replace('{w}', String(ART_SIZE)).replace('{h}', String(ART_SIZE));

async function resolveArtwork(trackId, title, artist) {
  if (cache.has(trackId)) return cache.get(trackId);
  let song = null;

  const isrc = await fetchIsrc(trackId);
  if (isrc) {
    const d = await appleGet(`/v1/catalog/${STOREFRONT}/songs?filter[isrc]=${encodeURIComponent(isrc)}&limit=1`);
    song = d?.data?.[0] ?? null;
  }
  if (!song && title) {
    const term = encodeURIComponent(`${title} ${artist || ''}`.trim());
    const d = await appleGet(`/v1/catalog/${STOREFRONT}/search?term=${term}&types=songs&limit=1`);
    song = d?.results?.songs?.data?.[0] ?? null;
  }

  const tmpl = song?.attributes?.artwork?.url ?? null;
  const res = { artworkUrl: tmpl ? buildUrl(tmpl) : null, appleMusicId: song?.id ?? null };
  cache.set(trackId, res);
  return res;
}

// ── Backfill passes ─────────────────────────────────────────────────────────
const stats = { songLikes: [0, 0], likedTracks: [0, 0], showcase: [0, 0] };

async function backfillSongLikes() {
  const snap = await db.collection('songLikes').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const id = d.trackId ?? Number(doc.id);
    const { artworkUrl, appleMusicId } = await resolveArtwork(id, d.title, d.artistName);
    stats.songLikes[1]++;
    if (!artworkUrl) continue;
    if (!DRY_RUN) await doc.ref.update({ coverUrl: artworkUrl, appleMusicId });
    stats.songLikes[0]++;
  }
}

async function backfillLikedTracks() {
  const snap = await db.collectionGroup('tracks').get();
  for (const doc of snap.docs) {
    // Only likedTracks/{uid}/tracks/{id}
    if (doc.ref.parent.parent?.parent.id !== 'likedTracks') continue;
    const d = doc.data();
    const id = d.trackId ?? Number(doc.id);
    const { artworkUrl, appleMusicId } = await resolveArtwork(id, d.title, d.artistName);
    stats.likedTracks[1]++;
    if (!artworkUrl) continue;
    if (!DRY_RUN) await doc.ref.update({ coverUrl: artworkUrl, appleMusicId });
    stats.likedTracks[0]++;
  }
}

async function backfillShowcases() {
  const snap = await db.collection('users').get();
  for (const doc of snap.docs) {
    const st = doc.data().showcaseTracks;
    if (!Array.isArray(st) || st.length === 0) continue;
    let changed = false;
    const updated = [];
    for (const t of st) {
      const { artworkUrl, appleMusicId } = await resolveArtwork(t.id, t.title, t.artist?.name);
      if (artworkUrl) {
        updated.push({ ...t, artworkUrl, appleMusicId });
        changed = true;
      } else {
        updated.push(t);
      }
    }
    stats.showcase[1]++;
    if (changed) {
      if (!DRY_RUN) await doc.ref.update({ showcaseTracks: updated });
      stats.showcase[0]++;
    }
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log(`\n🎨 Apple artwork backfill ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE)'}\n`);
await backfillSongLikes();
console.log(`  songLikes:   matched ${stats.songLikes[0]}/${stats.songLikes[1]}`);
await backfillLikedTracks();
console.log(`  likedTracks: matched ${stats.likedTracks[0]}/${stats.likedTracks[1]}`);
await backfillShowcases();
console.log(`  showcases:   updated ${stats.showcase[0]}/${stats.showcase[1]} users`);
console.log(`\n✅ Done. Apple API calls: ${apiCalls}, unique tracks: ${cache.size}\n`);
process.exit(0);
