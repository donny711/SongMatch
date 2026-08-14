import type { Track } from './types';
import { searchAppleTracks } from './appleMusicClient';
import { GENRE_ARTISTS } from '../utils/genres';

/**
 * Weighted random sample without replacement.
 * Applies √-dampening so a dominant item doesn't monopolise every draw.
 */
function weightedSample<T>(
  items: Array<{ item: T; weight: number }>,
  count: number
): T[] {
  const pool = items.map(({ item, weight }) => ({
    item,
    w: Math.sqrt(Math.max(weight, 0)),
  }));
  const result: T[] = [];
  while (result.length < count && pool.length > 0) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    if (total <= 0) break;
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) { idx = i; break; }
    }
    result.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return result;
}

/**
 * Build one seed track from a genre name via Apple search.
 * Picks a representative artist from GENRE_ARTISTS (or falls back to the
 * genre string itself) and returns the first Apple search result.
 */
async function genreSeed(
  genre: string,
  likedArtistKeys: Set<string>
): Promise<{ name: string; artist: string } | null> {
  const reps = GENRE_ARTISTS[genre] ?? [];
  const query = reps.length > 0
    ? reps[Math.floor(Math.random() * reps.length)]
    : genre;
  const [hit] = await searchAppleTracks(query, 1);
  if (!hit) return null;
  const key = hit.artist.name.toLowerCase();
  if (likedArtistKeys.has(key)) return null;
  return { name: hit.title, artist: hit.artist.name };
}

/**
 * Derives personalised recommendation seeds from the user's liked history.
 *
 * v3 — Apple Music source:
 *  1. √-weighted random artist sampling — all liked artists get a fair shot.
 *  2. Seed count scales with library size (3–6) for better coverage.
 *  3. For each source artist, Apple search returns a representative track
 *     whose { name, artist } is passed to getRecommendationsForSeeds which
 *     fans out to similar artists internally (Apple similar-artists view).
 *  4. Onboarding genres fill remaining seed slots when history is sparse
 *     (< 10 likes), keeping early discovery aligned with stated preferences.
 *  5. forceShift=true flips artist weights (least-liked first) so the user
 *     hears a genuinely different area of their taste; if onboarding genres
 *     are available the shift pivots to those declared preferences entirely.
 */
export async function buildTasteSeeds(
  likedTracks: Track[],
  recentSkips: Track[],
  onboardingGenres: string[] = [],
  forceShift = false,
  filteredArtistKeys: Set<string> = new Set(),
  minLikes = 3
): Promise<Array<{ name: string; artist: string }>> {
  // Suppress unused-parameter warning for recentSkips (kept in signature for back-compat).
  void recentSkips;

  if (likedTracks.length < minLikes) {
    // Before any likes exist, fall back to onboarding genres if available
    if (onboardingGenres.length === 0) return [];
    const likedArtistKeys = new Set<string>(filteredArtistKeys);
    const shuffledGenres = [...onboardingGenres].sort(() => Math.random() - 0.5);
    const seeds: Array<{ name: string; artist: string }> = [];
    await Promise.all(
      shuffledGenres.slice(0, 3).map(async (genre) => {
        const s = await genreSeed(genre, likedArtistKeys);
        if (s) seeds.push(s);
      })
    );
    return seeds;
  }

  // ── 1. Artist frequency map ───────────────────────────────────────────────
  const artistMap = new Map<string, { count: number; name: string }>();
  for (const track of likedTracks) {
    const key = track.artist.name.toLowerCase();
    const entry = artistMap.get(key);
    if (entry) entry.count++;
    else artistMap.set(key, { count: 1, name: track.artist.name });
  }
  // Merge liked artists + persistently skip-banned artists so neither seeds
  // recommendations nor appears as a similar-artist candidate.
  const likedArtistKeys = new Set([...artistMap.keys(), ...filteredArtistKeys]);

  // ── 2. Scale seed count with library size ────────────────────────────────
  const n = likedTracks.length;
  const seedCount = n >= 50 ? 6 : n >= 20 ? 5 : n >= 10 ? 4 : 3;

  // ── 3. Genre-shift mode: pivot to onboarding genres or invert weights ─────
  if (forceShift && onboardingGenres.length > 0) {
    // Hard genre reset: build seeds entirely from the user's declared genre
    // preferences, bypassing the liked-artist graph for this batch.
    const shuffledGenres = [...onboardingGenres].sort(() => Math.random() - 0.5);
    const seeds: Array<{ name: string; artist: string }> = [];
    await Promise.all(
      shuffledGenres.slice(0, seedCount).map(async (genre) => {
        const s = await genreSeed(genre, likedArtistKeys);
        if (s) seeds.push(s);
      })
    );
    return seeds.slice(0, seedCount);
  }

  // ── 4. Weighted random sample of source artists ──────────────────────────
  // Normal mode: weight ∝ like count (popular artists preferred).
  // Force-shift without onboarding genres: invert weights (explore rarely-liked artists).
  const artistWeights = [...artistMap.entries()].map(([, { count, name }]) => ({
    item: name,
    weight: forceShift ? 1 / count : count,
  }));
  const sourceArtists = weightedSample(
    artistWeights,
    Math.min(seedCount, artistWeights.length)
  );
  if (sourceArtists.length === 0) return [];

  // ── 5. For each source artist → Apple search → seed track ──────────────
  // getRecommendationsForSeeds fans out to similar artists internally, so
  // the seed only needs to identify the liked artist's style.
  const seeds: Array<{ name: string; artist: string }> = [];
  await Promise.all(
    sourceArtists.map(async (artist) => {
      const [hit] = await searchAppleTracks(artist, 1);
      if (hit) seeds.push({ name: hit.title, artist: hit.artist.name });
    })
  );

  // ── 6. Fill remaining slots from onboarding genres (sparse history) ───────
  if (onboardingGenres.length > 0 && seeds.length < seedCount && likedTracks.length < 10) {
    const shuffledGenres = [...onboardingGenres].sort(() => Math.random() - 0.5);
    await Promise.all(
      shuffledGenres.slice(0, seedCount - seeds.length).map(async (genre) => {
        const s = await genreSeed(genre, likedArtistKeys);
        if (s) seeds.push(s);
      })
    );
  }

  return seeds.slice(0, seedCount);
}
