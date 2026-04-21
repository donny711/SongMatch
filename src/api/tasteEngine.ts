import type { DeezerTrack } from './types';
import { getTrackTags, getArtistSimilar, getArtistTopTracks } from './lastfmClient';
import { GENRE_ARTISTS } from '../utils/genres';

// Session-level tag cache — avoids re-fetching the same track's tags
const tagCache = new Map<string, string[]>();

async function tagsFor(track: DeezerTrack): Promise<string[]> {
  const key = `${track.artist.name.toLowerCase()}|${track.title.toLowerCase()}`;
  if (tagCache.has(key)) return tagCache.get(key)!;
  const tags = await getTrackTags(track.artist.name, track.title);
  tagCache.set(key, tags);
  return tags;
}

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

/** Build one seed track from a genre name (used for genre-shift and sparse-history modes). */
async function genreSeed(
  genre: string,
  likedArtistKeys: Set<string>
): Promise<{ name: string; artist: string } | null> {
  const reps = GENRE_ARTISTS[genre] ?? [];
  if (reps.length === 0) return null;
  const [rep] = weightedSample(
    reps.map((name, i) => ({ item: name, weight: reps.length - i })),
    1
  );
  if (!rep) return null;
  const similar = await getArtistSimilar(rep, 12);
  const candidates = similar.filter((a) => !likedArtistKeys.has(a.toLowerCase()));
  const pool = candidates.length > 0 ? candidates : [rep];
  const [pick] = weightedSample(
    pool.slice(0, 6).map((name, i) => ({ item: name, weight: pool.length - i })),
    1
  );
  if (!pick) return null;
  const tops = await getArtistTopTracks(pick, 10);
  if (tops.length === 0) return null;
  const [track] = weightedSample(
    tops.slice(0, 5).map((t, i) => ({ item: t, weight: 5 - i })),
    1
  );
  return track ?? null;
}

/**
 * Derives personalised recommendation seeds from the user's liked history.
 *
 * v2 — unbiased, liked-song-first strategy:
 *  1. √-weighted random artist sampling — all liked artists get a fair shot.
 *  2. Seed count scales with library size (3–6) for better coverage.
 *  3. Overplay detection softly reduces weights (0–80%) not hard-skips.
 *  4. Similar-artist and track selection are rank-weighted, not random.
 *  5. Onboarding genres fill remaining seed slots when history is sparse
 *     (< 10 likes), keeping early discovery aligned with stated preferences.
 *  6. forceShift=true flips artist weights (least-liked first) so the user
 *     hears a genuinely different area of their taste; if onboarding genres
 *     are available the shift pivots to those declared preferences entirely.
 */
export async function buildTasteSeeds(
  likedTracks: DeezerTrack[],
  recentSkips: DeezerTrack[],
  onboardingGenres: string[] = [],
  forceShift = false,
  filteredArtistKeys: Set<string> = new Set(),
  minLikes = 3
): Promise<Array<{ name: string; artist: string }>> {
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

  // ── 4. Detect overplayed genres → soft weight reduction ──────────────────
  const overplayPenalty = new Map<string, number>(); // artistKey → 0..0.8
  if (recentSkips.length >= 3) {
    const skipTagCounts = new Map<string, number>();
    await Promise.all(
      recentSkips.slice(0, 9).map(async (t) => {
        const tags = await tagsFor(t);
        tags.forEach((tag) =>
          skipTagCounts.set(tag, (skipTagCounts.get(tag) ?? 0) + 1)
        );
      })
    );
    const overplayedTags = new Set(
      [...skipTagCounts.entries()]
        .filter(([, c]) => c >= 3)
        .map(([tag]) => tag)
    );
    if (overplayedTags.size > 0) {
      await Promise.all(
        [...artistMap.keys()].map(async (key) => {
          const sample = likedTracks.find(
            (t) => t.artist.name.toLowerCase() === key
          );
          if (!sample) return;
          const tags = await tagsFor(sample);
          if (tags.length === 0) return;
          const overlap = tags.filter((t) => overplayedTags.has(t)).length;
          if (overlap > 0)
            overplayPenalty.set(key, Math.min(0.8, overlap / tags.length));
        })
      );
    }
  }

  // ── 5. Weighted random sample of source artists ──────────────────────────
  // Normal mode: weight ∝ like count (popular artists preferred).
  // Force-shift without onboarding genres: invert weights (explore rarely-liked artists).
  const artistWeights = [...artistMap.entries()].map(([key, { count, name }]) => ({
    item: name,
    weight: forceShift
      ? 1 / count                                        // rarely-liked → higher weight
      : count * (1 - (overplayPenalty.get(key) ?? 0)),  // normal path
  }));
  const sourceArtists = weightedSample(
    artistWeights,
    Math.min(seedCount, artistWeights.length)
  );
  if (sourceArtists.length === 0) return [];

  // ── 6. For each source artist → similar artist → seed track ──────────────
  const seeds: Array<{ name: string; artist: string }> = [];
  await Promise.all(
    sourceArtists.map(async (artist) => {
      const similar = await getArtistSimilar(artist, 20);
      if (similar.length === 0) return;

      const candidates = similar.filter(
        (a) => !likedArtistKeys.has(a.toLowerCase())
      );
      if (candidates.length === 0) return;

      const topCandidates = candidates.slice(0, 10);
      const [pick] = weightedSample(
        topCandidates.map((name, i) => ({
          item: name,
          weight: topCandidates.length - i,
        })),
        1
      );
      if (!pick) return;

      const tops = await getArtistTopTracks(pick, 10);
      if (tops.length === 0) return;

      const [track] = weightedSample(
        tops.slice(0, 5).map((t, i) => ({ item: t, weight: 5 - i })),
        1
      );
      if (track) seeds.push(track);
    })
  );

  // ── 7. Fill remaining slots from onboarding genres (sparse history) ───────
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
