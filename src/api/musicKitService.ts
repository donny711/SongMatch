import AsyncStorage from '@react-native-async-storage/async-storage';
import { MUSIC_PROXY_URL } from '../utils/constants';
import type { DeezerTrack } from './types';

// Apple Music catalog is storefront-scoped; SongMatch queries the US storefront
// (largest catalog, safest for ISRC/text matching). See migration design doc.
const STOREFRONT = 'us';

// All Apple calls go through the Cloudflare Worker proxy, which injects the
// developer token server-side and caches responses in KV. In local dev without
// the proxy configured, artwork resolution is a no-op (components fall back).
const APPLE_PROXY = MUSIC_PROXY_URL ? `${MUSIC_PROXY_URL}/apple` : '';

// Artwork is impossible without the proxy (the Apple token lives server-side).
// Surface that loudly in dev instead of silently rendering placeholders.
if (__DEV__ && !APPLE_PROXY) {
  console.warn('[artwork] EXPO_PUBLIC_MUSIC_PROXY_URL is not set — Apple artwork disabled, all covers will be placeholders');
}

const DEFAULT_ART_SIZE = 1000;
const CACHE_PREFIX = 'applematch_v2_'; // v2: v1 cached transient failures as permanent misses
const ARTIST_CACHE_PREFIX = 'appleartist_v1_';

export interface Artwork {
  appleMusicId: string | null;
  artworkTemplate: string | null; // e.g. https://.../{w}x{h}bb.jpg
  artworkUrl: string | null;       // template interpolated at DEFAULT_ART_SIZE
}

const EMPTY: Artwork = { appleMusicId: null, artworkTemplate: null, artworkUrl: null };

interface AppleSong {
  id: string;
  attributes?: { artwork?: { url?: string } };
}

/** Interpolate Apple's `{w}x{h}` artwork template to a concrete pixel size. */
export function buildArtworkUrl(template: string, size = DEFAULT_ART_SIZE): string {
  return template.replace('{w}', String(size)).replace('{h}', String(size));
}

// ── Apple catalog lookups (via Worker proxy) ────────────────────────────────

// Throws on any failure (no proxy, non-2xx, network, bad JSON) so the caller can
// tell a real "no match" apart from a transient failure and avoid caching the latter.
async function appleGet(path: string): Promise<any> {
  if (!APPLE_PROXY) throw new Error('music proxy not configured');
  const res = await fetch(`${APPLE_PROXY}${path}`);
  if (!res.ok) throw new Error(`apple ${res.status}`);
  return await res.json();
}

async function searchByIsrc(isrc: string): Promise<AppleSong | null> {
  const data = await appleGet(
    `/v1/catalog/${STOREFRONT}/songs?filter[isrc]=${encodeURIComponent(isrc)}&limit=1`
  );
  return data?.data?.[0] ?? null;
}

async function searchByText(title: string, artist: string): Promise<AppleSong | null> {
  const term = encodeURIComponent(`${title} ${artist}`);
  const data = await appleGet(
    `/v1/catalog/${STOREFRONT}/search?term=${term}&types=songs&limit=1`
  );
  return data?.results?.songs?.data?.[0] ?? null;
}

// ── Cache: in-memory Map + AsyncStorage (mirrors the tag cache pattern) ──────

const mem = new Map<string, Artwork>();

async function readCache(id: number): Promise<Artwork | null> {
  const key = `${CACHE_PREFIX}${id}`;
  const hit = mem.get(key);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const val = JSON.parse(raw) as Artwork;
    mem.set(key, val);
    return val;
  } catch {
    return null;
  }
}

async function writeCache(id: number, val: Artwork): Promise<void> {
  const key = `${CACHE_PREFIX}${id}`;
  mem.set(key, val);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch {
    // best-effort cache; never block on storage
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve a Deezer track to its licensed Apple Music artwork.
 *
 * ISRC-first: fetches the ISRC from Deezer /track/{id} when the track doesn't
 * already carry one, matches the Apple catalog exactly, and only falls back to
 * a fuzzy title+artist search when no ISRC match exists. Results (including
 * misses) are cached so we never repeat a lookup for the same track.
 */
export async function resolveArtwork(track: DeezerTrack): Promise<Artwork> {
  const cached = await readCache(track.id);
  if (cached) return cached;

  try {
    const isrc = track.isrc;

    let song = isrc ? await searchByIsrc(isrc) : null;
    if (!song) song = await searchByText(track.title, track.artist.name);

    const template = song?.attributes?.artwork?.url ?? null;
    const result: Artwork = {
      appleMusicId: song?.id ?? null,
      artworkTemplate: template,
      artworkUrl: template ? buildArtworkUrl(template) : null,
    };
    if (__DEV__ && !result.artworkUrl) {
      console.log(`[artwork] NO MATCH: "${track.title}" — ${track.artist.name} (isrc=${isrc ?? 'none'})`);
    }
    // Cache only a COMPLETED lookup (a real match or a genuine no-match from
    // Apple). Transient failures throw below and are NOT cached, so they retry
    // next time instead of being remembered as a permanent miss.
    await writeCache(track.id, result);
    return result;
  } catch (e: any) {
    if (__DEV__) console.log(`[artwork] LOOKUP FAILED: "${track.title}" — ${e?.message ?? e}`);
    return EMPTY;
  }
}

// ── Artist artwork ───────────────────────────────────────────────────────────

const artistMem = new Map<string, string | null>();

/**
 * Resolve licensed Apple Music **artist** artwork by name (there is no ISRC for
 * artists, so this is a name search). Returns an interpolated URL or null when
 * Apple has no match. Cached — including misses — so a name is looked up once.
 */
export async function resolveArtistArtwork(name: string): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const key = `${ARTIST_CACHE_PREFIX}${trimmed.toLowerCase()}`;

  if (artistMem.has(key)) return artistMem.get(key)!;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw !== null) {
      const v = JSON.parse(raw) as string | null;
      artistMem.set(key, v);
      return v;
    }
  } catch {
    // fall through to a live lookup
  }

  let url: string | null = null;
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/search?term=${encodeURIComponent(trimmed)}&types=artists&limit=1`
    );
    const tmpl = data?.results?.artists?.data?.[0]?.attributes?.artwork?.url ?? null;
    if (tmpl) url = buildArtworkUrl(tmpl, 300);
  } catch {
    // transient failure — return null without caching so it retries next time
    return null;
  }

  artistMem.set(key, url);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(url));
  } catch {
    // best-effort cache
  }
  return url;
}

/**
 * Enrich a batch of tracks with Apple artwork, bounded concurrency so we don't
 * fire dozens of simultaneous lookups. Tracks with no catalog match are
 * returned unchanged (UI applies a placeholder).
 */
export async function resolveArtworkForTracks(tracks: DeezerTrack[]): Promise<DeezerTrack[]> {
  const BATCH = 6;
  const out: DeezerTrack[] = [];
  for (let i = 0; i < tracks.length; i += BATCH) {
    const slice = tracks.slice(i, i + BATCH);
    const arts = await Promise.all(slice.map((t) => resolveArtwork(t).catch(() => EMPTY)));
    slice.forEach((t, j) => {
      const a = arts[j];
      out.push(
        a.artworkUrl
          ? { ...t, artworkUrl: a.artworkUrl, appleMusicId: a.appleMusicId ?? undefined }
          : t
      );
    });
  }
  if (__DEV__) {
    const hit = out.filter((t) => t.artworkUrl).length;
    console.log(`[artwork] batch: ${hit}/${out.length} covers resolved (proxy=${APPLE_PROXY || 'NOT SET'})`);
  }
  return out;
}
