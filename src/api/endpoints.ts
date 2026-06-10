import { spotifyFetch } from './spotifyClient';
import { getSimilarTracks, getArtistSimilar, getArtistTopTracks, getTrackTags, getTagTopTracks, getArtistTags } from './lastfmClient';
import { searchDeezer, getDeezerRadio } from './deezerClient';
import type {
  SpotifyUser,
  SpotifyPaginated,
  SpotifyPlaylist,
  SpotifyPlaylistTrackItem,
  SpotifyTrack,
  DeezerTrack,
  RecommendationCard,
} from './types';

// ── Spotify endpoints ─────────────────────────────────────────────────────────

export const getMe = () => spotifyFetch<SpotifyUser>('/me');

export const getMyPlaylists = (offset = 0) =>
  spotifyFetch<SpotifyPaginated<SpotifyPlaylist>>(
    `/me/playlists?limit=50&offset=${offset}`
  );

export const getPlaylistTracks = (playlistId: string, offset = 0) =>
  spotifyFetch<SpotifyPaginated<SpotifyPlaylistTrackItem>>(
    `/playlists/${playlistId}/tracks?limit=100&offset=${offset}`
  );

export const getMyTopTracks = () =>
  spotifyFetch<SpotifyPaginated<SpotifyTrack>>(
    '/me/top/tracks?limit=5&time_range=medium_term'
  );

export const searchTracks = (query: string) =>
  spotifyFetch<{ tracks: SpotifyPaginated<SpotifyTrack> }>(
    `/search?q=${encodeURIComponent(query)}&type=track&limit=5`
  );

export const addTrackToPlaylist = (playlistId: string, trackUri: string) =>
  spotifyFetch<void>(`/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ uris: [trackUri] }),
  });

export const saveTrackToLiked = (trackId: string) =>
  spotifyFetch<void>(`/me/tracks?ids=${encodeURIComponent(trackId)}`, {
    method: 'PUT',
  });

export const createPlaylist = (userId: string, name: string) =>
  spotifyFetch<SpotifyPlaylist>(`/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({ name, public: true }),
  });

/** Search Spotify for a track and return its URI for saving to a playlist. */
export async function findSpotifyTrackUri(title: string, artist: string): Promise<string | null> {
  try {
    const res = await searchTracks(`${title} ${artist}`);
    return res.tracks.items[0]?.uri ?? null;
  } catch {
    return null;
  }
}


/**
 * Resolve liked tracks to Spotify URIs (read-only search scope only).
 * Returns the URIs for clipboard/share — no write scope required.
 */
export async function resolveTracksToSpotifyUris(
  tracks: Array<{ title: string; artist: string }>,
  onProgress: (done: number, total: number) => void,
): Promise<{ uris: string[]; notFound: number }> {
  const uris: string[] = [];
  const BATCH = 5;
  for (let i = 0; i < tracks.length; i += BATCH) {
    const results = await Promise.all(
      tracks.slice(i, i + BATCH).map(t => findSpotifyTrackUri(t.title, t.artist)),
    );
    for (const uri of results) {
      if (uri) uris.push(uri);
    }
    onProgress(Math.min(i + BATCH, tracks.length), tracks.length);
  }
  return { uris, notFound: tracks.length - uris.length };
}

// ── Recommendation engine (Last.fm → Deezer) ─────────────────────────────────

export async function getRecommendationsForSeeds(
  seeds: Array<{ name: string; artist: string }>,
  limit = 20,
  seenIds: Set<number> = new Set(),
  likedArtistKeys: Set<string> = new Set(),
  deezerSeedIds: number[] = []
): Promise<RecommendationCard[]> {
  const perSeed = seeds.length > 0 ? Math.ceil(limit / seeds.length) + 8 : 0;

  // Run Deezer radio and Last.fm similarity in parallel.
  // Radio uses audio fingerprints — no text search, higher fidelity.
  // Last.fm fills any slots radio doesn't cover.
  const [radioArrays, similarArrays] = await Promise.all([
    deezerSeedIds.length > 0
      ? Promise.all(deezerSeedIds.slice(0, 4).map(id => getDeezerRadio(id, 40).catch(() => [] as DeezerTrack[])))
      : Promise.resolve([] as DeezerTrack[][]),
    seeds.length > 0
      ? Promise.all(seeds.map(async (s) => {
          const similar = await getSimilarTracks(s.artist, s.name, perSeed);
          if (similar.length > 0) return similar.sort((a, b) => b.match - a.match);
          const tops = await getArtistTopTracks(s.artist, perSeed);
          return tops.map((t) => ({ ...t, match: 0.5 }));
        }))
      : Promise.resolve([] as Array<Array<{ name: string; artist: string; match: number }>>),
  ]);

  // Build radio candidate pool (already Deezer tracks; assign match=1.0).
  const radioCandidates: Array<{ track: DeezerTrack; match: number }> = [];
  {
    const radioSeen = new Set<number>();
    const maxLen = Math.max(0, ...radioArrays.map(a => a.length));
    for (let i = 0; i < maxLen; i++) {
      for (const arr of radioArrays) {
        if (i >= arr.length) continue;
        const t = arr[i];
        if (!radioSeen.has(t.id)) { radioSeen.add(t.id); radioCandidates.push({ track: t, match: 1.0 }); }
      }
    }
  }

  // Build Last.fm candidate pool (requires Deezer text search).
  const lastfmCandidates: Array<{ track: DeezerTrack | null; match: number }> = [];
  if (similarArrays.length > 0) {
    const seenKeys = new Set<string>();
    const candidates: Array<{ name: string; artist: string; match: number }> = [];
    const maxLen = Math.max(0, ...similarArrays.map((a) => a.length));
    for (let i = 0; i < maxLen; i++) {
      for (const arr of similarArrays) {
        if (i >= arr.length) continue;
        const t = arr[i];
        const key = `${t.artist.toLowerCase()}|${t.name.toLowerCase()}`;
        if (!seenKeys.has(key)) { seenKeys.add(key); candidates.push(t); }
      }
    }
    const fetchBatch = candidates.slice(0, Math.min(candidates.length, limit * 4));
    for (let i = 0; i < fetchBatch.length && lastfmCandidates.filter((r) => r.track).length < limit; i += 8) {
      const batch = fetchBatch.slice(i, i + 8);
      const batchResults = await Promise.all(
        batch.map(async (t) => {
          try {
            const tracks = await searchDeezer(`${t.name} ${t.artist}`, 1);
            return { track: tracks[0] ?? null, match: t.match };
          } catch {
            return { track: null, match: t.match };
          }
        })
      );
      lastfmCandidates.push(...batchResults);
    }
  }

  // Build match-score index (radio = 1.0, Last.fm = actual similarity score).
  const matchById = new Map<number, number>();
  for (const { track, match } of radioCandidates) {
    matchById.set(track.id, match);
  }
  for (const { track, match } of lastfmCandidates) {
    if (track && (matchById.get(track.id) ?? 0) < match) matchById.set(track.id, match);
  }

  // Merge: radio first (audio fidelity), then Last.fm fills remaining slots.
  const allCandidates: DeezerTrack[] = [
    ...radioCandidates.map(r => r.track),
    ...lastfmCandidates.flatMap(r => r.track ? [r.track] : []),
  ];

  const output: DeezerTrack[] = [];
  const outputIds = new Set<number>();
  const windowArtists: string[] = [];
  const windowArtistCounts = new Map<string, number>();
  let radioFillCount = 0;

  // Track boundary between radio and Last.fm candidates in allCandidates.
  const radioEnd = radioCandidates.length;
  let candidateIdx = 0;

  for (const track of allCandidates) {
    if (output.length >= limit) break;
    const isRadio = candidateIdx < radioEnd;
    candidateIdx++;
    if (seenIds.has(track.id)) continue;
    if (outputIds.has(track.id)) continue;
    if (!track.preview) continue; // no 30s preview — card would have a dead play button
    const artistKey = track.artist.name.toLowerCase();
    // Radio results are audio-fingerprint similarity — don't suppress liked artists,
    // the user wants MORE of what they like. Last.fm text-search is discovery mode,
    // so keep the liked-artist filter there to avoid repetition.
    if (!isRadio && likedArtistKeys.has(artistKey)) continue;
    // Artist diversity: radio clusters naturally around similar artists so allow 2
    // per artist; Last.fm fill is broader so cap at 1.
    const artistMax = isRadio ? 2 : 1;
    if ((windowArtistCounts.get(artistKey) ?? 0) >= artistMax) continue;
    output.push(track);
    outputIds.add(track.id);
    if (isRadio) radioFillCount++;
    windowArtists.push(artistKey);
    windowArtistCounts.set(artistKey, (windowArtistCounts.get(artistKey) ?? 0) + 1);
    if (windowArtists.length > 9) {
      const evicted = windowArtists.shift()!;
      const remaining = (windowArtistCounts.get(evicted) ?? 1) - 1;
      if (remaining <= 0) windowArtistCounts.delete(evicted);
      else windowArtistCounts.set(evicted, remaining);
    }
  }

  console.log(`[SongMatch] recs: radio=${radioFillCount} lastfm=${output.length - radioFillCount} total=${output.length}`);

  // Sort: radio tracks (1.0) surface first, then by Last.fm similarity score.
  output.sort((a, b) => (matchById.get(b.id) ?? 0) - (matchById.get(a.id) ?? 0));
  return output.map((track) => ({ type: 'track' as const, track }));
}

/**
 * Recommendation engine specifically for "Hear a Song" mode.
 *
 * Uses three layered similarity signals so results stay musically coherent
 * even when Last.fm's track-level data is sparse:
 *
 *   1. track.getSimilar   — highest fidelity; direct song-to-song similarity
 *   2. artist.getSimilar  — artist-level graph; broader but still relevant
 *   3. tag.getTopTracks   — genre/mood tags of the seed; broadest fallback
 *
 * Candidates are scored and merged before Deezer lookup so the best matches
 * always surface first regardless of which signal produced them.
 */
export async function getSongSimilarRecs(
  seedArtist: string,
  seedTitle: string,
  limit = 15,
  seenIds: Set<number> = new Set(),
  filteredArtistKeys: Set<string> = new Set(),
  seedDeezerTrackId?: number
): Promise<RecommendationCard[]> {
  const seedArtistKey = seedArtist.toLowerCase();

  // Fetch all signals in parallel
  const [trackSimilar, trackTags, similarArtists, radioTracks] = await Promise.all([
    getSimilarTracks(seedArtist, seedTitle, 50).catch(() => [] as Array<{ name: string; artist: string; match: number }>),
    getTrackTags(seedArtist, seedTitle),
    getArtistSimilar(seedArtist, 10),
    seedDeezerTrackId ? getDeezerRadio(seedDeezerTrackId, 40) : Promise.resolve([]),
  ]);

  // If track tags sparse, fall back to artist-level tags
  const tags = trackTags.length >= 2 ? trackTags : await getArtistTags(seedArtist);

  // Signal 1: Last.fm track similarity (score 0.4-1.0)
  type Candidate = { name: string; artist: string; score: number };
  const seen = new Map<string, Candidate>();
  const add = (name: string, artist: string, score: number) => {
    const key = `${artist.toLowerCase()}|${name.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || score > existing.score) seen.set(key, { name, artist, score });
  };

  trackSimilar.forEach((t) => add(t.name, t.artist, 0.4 + t.match * 0.6));

  // Signal 2: similar artists top tracks (score 0.25-0.4)
  const artistCandidates = await Promise.all(
    similarArtists.slice(0, 8).map((a) => getArtistTopTracks(a, 8))
  );
  similarArtists.slice(0, 8).forEach((artist, i) => {
    const artistScore = 0.4 - i * 0.02;
    artistCandidates[i].forEach((t, j) => add(t.name, t.artist, artistScore - j * 0.01));
  });

  // Signal 3: genre/tag top tracks (score ~0.22)
  if (tags.length > 0) {
    const tagTracks = await Promise.all(
      tags.slice(0, 4).map((tag) => getTagTopTracks(tag, 30))
    );
    tagTracks.flat().forEach((t, i) => add(t.name, t.artist, 0.22 - i * 0.001));
  }

  const ranked = [...seen.values()]
    .filter((c) => c.artist.toLowerCase() !== seedArtistKey)
    .sort((a, b) => b.score - a.score);

  // Build output: Deezer radio first (audio similarity), then Last.fm fill
  const output: DeezerTrack[] = [];
  const outputIds = new Set<number>();
  const recentArtists: string[] = [];

  const accept = (track: DeezerTrack): boolean => {
    if (output.length >= limit) return false;
    if (seenIds.has(track.id) || outputIds.has(track.id)) return false;
    if (!track.preview) return false; // no 30s preview — card would have a dead play button
    const artistKey = track.artist.name.toLowerCase();
    if (artistKey === seedArtistKey) return false;
    if (filteredArtistKeys.has(artistKey)) return false;
    if (recentArtists.slice(-5).includes(artistKey)) return false;
    output.push(track);
    outputIds.add(track.id);
    recentArtists.push(artistKey);
    return true;
  };

  // Pool 1: Deezer radio (audio-fingerprint similarity, highest quality)
  for (const track of radioTracks) accept(track);

  // Pool 2: Last.fm candidates via Deezer lookup (fills remaining slots)
  if (output.length < limit) {
    const fetchBatch = ranked.slice(0, (limit - output.length) * 6);
    const deezerResults: (DeezerTrack | null)[] = [];
    for (let i = 0; i < fetchBatch.length && deezerResults.filter(Boolean).length < (limit - output.length); i += 8) {
      const batch = fetchBatch.slice(i, i + 8);
      const batchResults = await Promise.all(
        batch.map(async (c) => {
          try {
            const tracks = await searchDeezer(`${c.name} ${c.artist}`, 1);
            return tracks[0] ?? null;
          } catch {
            return null;
          }
        })
      );
      deezerResults.push(...batchResults);
    }
    for (const track of deezerResults) {
      if (track) accept(track);
    }
  }

  return output.map((track) => ({ type: 'track' as const, track }));
}
