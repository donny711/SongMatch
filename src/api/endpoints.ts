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
  likedArtistKeys: Set<string> = new Set()
): Promise<RecommendationCard[]> {
  const perSeed = Math.ceil(limit / seeds.length) + 8;
  const similarArrays = await Promise.all(
    seeds.map(async (s) => {
      const similar = await getSimilarTracks(s.artist, s.name, perSeed);
      if (similar.length > 0) {
        return similar.sort((a, b) => b.match - a.match);
      }
      const tops = await getArtistTopTracks(s.artist, perSeed);
      return tops.map((t) => ({ ...t, match: 0.5 }));
    })
  );

  // Round-robin interleave so every seed contributes proportionally.
  const seenKeys = new Set<string>();
  const candidates: Array<{ name: string; artist: string; match: number }> = [];
  const maxLen = Math.max(...similarArrays.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of similarArrays) {
      if (i >= arr.length) continue;
      const t = arr[i];
      const key = `${t.artist.toLowerCase()}|${t.name.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        candidates.push(t);
      }
    }
  }

  // Buffer at 4× the desired limit — many Last.fm tracks aren't on Deezer.
  const fetchBatch = candidates.slice(0, Math.min(candidates.length, limit * 4));

  // Carry match scores through the Deezer lookup.
  const deezerWithMatch: Array<{ track: DeezerTrack | null; match: number }> = [];
  for (let i = 0; i < fetchBatch.length && deezerWithMatch.filter((r) => r.track).length < limit; i += 8) {
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
    deezerWithMatch.push(...batchResults);
  }

  // Build a match-score index keyed by Deezer track ID (take the highest score
  // if the same track appears from multiple seeds).
  const matchById = new Map<number, number>();
  for (const { track, match } of deezerWithMatch) {
    if (!track) continue;
    if ((matchById.get(track.id) ?? 0) < match) matchById.set(track.id, match);
  }

  // Post-process: filter seen/liked, enforce artist diversity window.
  const output: DeezerTrack[] = [];
  const windowArtists: string[] = [];
  const windowSet = new Set<string>();

  for (const { track } of deezerWithMatch) {
    if (!track) continue;
    if (output.length >= limit) break;
    if (seenIds.has(track.id)) continue;
    const artistKey = track.artist.name.toLowerCase();
    if (likedArtistKeys.has(artistKey)) continue;
    if (windowSet.has(artistKey)) continue;
    output.push(track);
    windowArtists.push(artistKey);
    windowSet.add(artistKey);
    if (windowArtists.length > 9) {
      const evicted = windowArtists.shift()!;
      windowSet.delete(evicted);
    }
  }

  // Sort by Last.fm match score so highest-confidence tracks surface first.
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
