import {
  searchAppleTracks, getArtistTopSongs, getSimilarArtistIds,
  getArtistIdForTrack, getAppleCharts,
} from './appleMusicClient';
import type {
  Track,
  RecommendationCard,
} from './types';

// ── Recommendation engine (Apple Music) ──────────────────────────────────────

export async function getRecommendationsForSeeds(
  seeds: Array<{ name: string; artist: string }>,
  limit = 20,
  seenIds: Set<number> = new Set(),
  likedArtistKeys: Set<string> = new Set(),
  seedArtistIds: string[] = []
): Promise<RecommendationCard[]> {
  // 1) Resolve seed artist ids: explicit ones first, then from seed search.
  const artistIds = new Set<string>(seedArtistIds.filter(Boolean));
  if (artistIds.size === 0 && seeds.length > 0) {
    const found = await Promise.all(
      seeds.slice(0, 4).map(async (s) => {
        const [hit] = await searchAppleTracks(`${s.name} ${s.artist}`, 1);
        return hit ? getArtistIdForTrack(hit) : null;
      })
    );
    for (const id of found) if (id) artistIds.add(id);
  }

  // 2) Fan out: seed artists' top songs + their similar artists' top songs.
  const seedArtistList = [...artistIds].slice(0, 4);
  const similarLists = await Promise.all(seedArtistList.map((id) => getSimilarArtistIds(id, 8)));
  const candidateArtistIds = [
    ...seedArtistList,
    ...similarLists.flat(),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 16);

  const songLists = await Promise.all(candidateArtistIds.map((id) => getArtistTopSongs(id, 6)));

  // 3) Cold-start / top-up from charts when discovery is thin.
  let pool: Track[] = songLists.flat();
  if (pool.length < limit) pool = [...pool, ...(await getAppleCharts(40))];

  // 4) Filter + diversify (mirror the old windowed artist cap of 2, window 9).
  const output: Track[] = [];
  const outputIds = new Set<number>();
  const windowArtists: string[] = [];
  const windowCounts = new Map<string, number>();
  for (const track of pool) {
    if (output.length >= limit) break;
    if (!track.preview) continue;                 // must be playable
    if (seenIds.has(track.id) || outputIds.has(track.id)) continue;
    const key = track.artist.name.toLowerCase();
    if (likedArtistKeys.has(key)) continue;       // avoid already-liked artists
    if ((windowCounts.get(key) ?? 0) >= 2) continue;
    output.push(track);
    outputIds.add(track.id);
    windowArtists.push(key);
    windowCounts.set(key, (windowCounts.get(key) ?? 0) + 1);
    if (windowArtists.length > 9) {
      const evicted = windowArtists.shift()!;
      const rem = (windowCounts.get(evicted) ?? 1) - 1;
      if (rem <= 0) windowCounts.delete(evicted); else windowCounts.set(evicted, rem);
    }
  }

  if (__DEV__) console.log(`[SongMatch] apple recs: ${output.length}/${limit} from ${candidateArtistIds.length} artists`);
  return output.map((track) => ({ type: 'track' as const, track }));
}

export async function getSongSimilarRecs(
  seedArtist: string,
  seedTitle: string,
  limit = 15,
  seenIds: Set<number> = new Set(),
  filteredArtistKeys: Set<string> = new Set(),
  seedAppleArtistId?: string
): Promise<RecommendationCard[]> {
  const seedArtistKey = seedArtist.toLowerCase();

  // Resolve the seed's Apple artist id.
  let artistId = seedAppleArtistId ?? null;
  if (!artistId) {
    const [hit] = await searchAppleTracks(`${seedTitle} ${seedArtist}`, 1);
    artistId = hit?.appleArtistId ?? null;
  }
  if (!artistId) return [];

  const similar = await getSimilarArtistIds(artistId, 10);
  const artistIds = [artistId, ...similar].filter((v, i, a) => a.indexOf(v) === i).slice(0, 12);
  const songLists = await Promise.all(artistIds.map((id) => getArtistTopSongs(id, 6)));

  const output: Track[] = [];
  const outputIds = new Set<number>();
  const recentArtists: string[] = [];
  for (const track of songLists.flat()) {
    if (output.length >= limit) break;
    if (!track.preview) continue;
    if (seenIds.has(track.id) || outputIds.has(track.id)) continue;
    const key = track.artist.name.toLowerCase();
    if (key === seedArtistKey) continue;
    if (filteredArtistKeys.has(key)) continue;
    if (recentArtists.slice(-5).includes(key)) continue;
    output.push(track);
    outputIds.add(track.id);
    recentArtists.push(key);
  }
  return output.map((track) => ({ type: 'track' as const, track }));
}
