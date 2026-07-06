# Apple Music Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Deezer (audio previews, search, radio) and Last.fm (similar tracks, tags) data with the Apple Music Catalog API, so every piece of third-party audio/catalog/discovery content is licensed under the Apple Music API terms — resolving App Store Guideline 5.2.3 (and permanently closing 5.2.1).

**Architecture:** Introduce one Apple Music client (`appleMusicClient.ts`) that talks to the existing Cloudflare Worker `/apple` proxy (dev token injected server-side). Apple `Song` objects are normalized into the app's existing track shape (currently `DeezerTrack`, aliased to `Track`) so UI, stores, and Firestore are unchanged. The recommendation engine is rebuilt on Apple primitives: seed track → artist → `similar-artists` view → `top-songs` view, with catalog `charts` for cold start. Deezer + Last.fm are then deleted.

**Tech Stack:** React Native (Expo SDK 55), TypeScript, existing Cloudflare Worker (`songmatch-proxy`), Apple Music Catalog API, expo-audio (playback, unchanged), Jest + jest-expo.

## Global Constraints

- **Storefront:** `us` (matches existing `musicKitService.STOREFRONT`).
- **Track IDs stay numeric.** Map Apple catalog id (string, e.g. `"1440811561"`) to `Number(id)`. All existing code uses `number` ids (`Set<number>`, `String(track.id)` Firestore keys) — do not change the id type.
- **Preview field stays `preview: string`** on the track shape — populate from Apple `attributes.previews[0].url`.
- **Artwork already Apple.** Tracks now carry Apple artwork directly (`attributes.artwork.url` → interpolated). The separate `musicKitService.resolveArtwork` lookup becomes unnecessary for rec tracks.
- **All Apple calls go through the Worker proxy** (`MUSIC_PROXY_URL + '/apple'`). Never call `api.music.apple.com` directly from the client (the dev token must stay server-side).
- **Attribution:** Apple Music API terms require Apple Music attribution where catalog content appears. Replace "Audio preview by Deezer" with "Music by Apple Music" (and keep it visible on the track card).
- **`npx tsc --noEmit` must stay clean** (tsconfig has `noUnusedLocals`/`noUnusedParameters`). **`npx jest` must stay green.**
- **Commit + push after each task** (Codemagic builds from GitHub `master`).
- Do NOT re-introduce ads/subscriptions (unrelated; separate compliance track).

---

## File Structure

**Create:**
- `src/api/appleMusicClient.ts` — Apple Music catalog client + `mapAppleSong` normalizer. One responsibility: fetch Apple data and return normalized `Track`s.

**Modify:**
- `src/api/types.ts` — add `export type Track = DeezerTrack` alias + `appleId?` field note; keep `DeezerTrack` for back-compat.
- `src/api/endpoints.ts` — rewrite `getRecommendationsForSeeds` + `getSongSimilarRecs` on Apple primitives. Keep the Spotify export helpers untouched.
- `src/api/tasteEngine.ts` — replace Last.fm calls with Apple artist-based seed building.
- `src/hooks/useRecommendations.ts` — swap `getDeezerChart` → `getAppleCharts`; seed ids become Apple artist/track ids.
- `app/onboarding.tsx` — swap `searchDeezer`/`getArtistTopTracks`/`getArtistSimilar` → Apple client.
- `app/(tabs)/hear.tsx` — swap `searchDeezer` → `searchAppleTracks` (AudD stays).
- `src/components/social/FeedItem.tsx` — swap Deezer preview re-fetch → Apple search.
- `src/components/cards/TrackCard.tsx` — attribution text Deezer → Apple Music.
- `app/settings.tsx` — footer attribution Deezer/Last.fm → Apple Music.
- `src/api/musicKitService.ts` — keep artist artwork; `resolveArtwork` for tracks no longer needed in the rec path (tracks carry artwork). Keep for `FeedItem`/legacy Deezer-id tracks that lack artwork.
- `worker/src/index.ts` — remove `/deezer` and `/lastfm` routes (after client no longer calls them).

**Delete:**
- `src/api/deezerClient.ts`
- `src/api/lastfmClient.ts`

---

## Task 1: Apple Music client + song normalizer

**Files:**
- Create: `src/api/appleMusicClient.ts`
- Modify: `src/api/types.ts`
- Test: `src/api/__tests__/appleMusicClient.test.ts`

**Interfaces:**
- Consumes: `MUSIC_PROXY_URL` from `../utils/constants`; `DeezerTrack`/`Track` from `./types`.
- Produces:
  - `mapAppleSong(song: AppleSong): Track` — normalizes one Apple catalog song.
  - `searchAppleTracks(query: string, limit?: number): Promise<Track[]>`
  - `getAppleSongByIsrc(isrc: string): Promise<Track | null>`
  - `getSimilarArtistIds(artistId: string, limit?: number): Promise<string[]>`
  - `getArtistTopSongs(artistId: string, limit?: number): Promise<Track[]>`
  - `getAppleCharts(limit?: number): Promise<Track[]>`
  - `getArtistIdForTrack(track: Track): Promise<string | null>` — resolve a track's Apple artist id (from `appleArtistId` if present, else ISRC lookup).
  - Type `AppleSong` (minimal shape used).

- [ ] **Step 1: Add the `Track` alias and Apple fields to types.ts**

In `src/api/types.ts`, extend `DeezerTrack` and add an alias:

```typescript
export interface DeezerTrack {
  id: number;
  title: string;
  artist: DeezerArtist;
  album: DeezerAlbum;
  preview: string;
  duration: number;
  link: string;
  isrc?: string;
  artworkUrl?: string;
  appleMusicId?: string;
  appleArtistId?: string; // Apple catalog artist id, for similar-artists chaining
}

/** Canonical in-app track shape. Populated from Apple Music (was Deezer). */
export type Track = DeezerTrack;
```

- [ ] **Step 2: Write the failing test for `mapAppleSong`**

Create `src/api/__tests__/appleMusicClient.test.ts`:

```typescript
jest.mock('../../utils/constants', () => ({ MUSIC_PROXY_URL: 'https://proxy.test' }));
import { mapAppleSong } from '../appleMusicClient';

const sample = {
  id: '1440811561',
  attributes: {
    name: 'Blinding Lights',
    artistName: 'The Weeknd',
    albumName: 'After Hours',
    durationInMillis: 200040,
    isrc: 'USUG11904206',
    url: 'https://music.apple.com/us/album/x/1',
    artwork: { url: 'https://ex/{w}x{h}bb.jpg' },
    previews: [{ url: 'https://audio/preview.m4a' }],
  },
  relationships: { artists: { data: [{ id: '479756766' }] } },
};

describe('mapAppleSong', () => {
  it('normalizes an Apple song into the Track shape', () => {
    const t = mapAppleSong(sample as any);
    expect(t.id).toBe(1440811561);
    expect(t.title).toBe('Blinding Lights');
    expect(t.artist.name).toBe('The Weeknd');
    expect(t.album.title).toBe('After Hours');
    expect(t.preview).toBe('https://audio/preview.m4a');
    expect(t.duration).toBe(200); // ms → seconds
    expect(t.isrc).toBe('USUG11904206');
    expect(t.appleMusicId).toBe('1440811561');
    expect(t.appleArtistId).toBe('479756766');
    expect(t.artworkUrl).toBe('https://ex/1000x1000bb.jpg');
  });

  it('returns empty preview when Apple has no preview', () => {
    const noPrev = { ...sample, attributes: { ...sample.attributes, previews: [] } };
    expect(mapAppleSong(noPrev as any).preview).toBe('');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/api/__tests__/appleMusicClient.test.ts`
Expected: FAIL — "Cannot find module '../appleMusicClient'".

- [ ] **Step 4: Implement `appleMusicClient.ts`**

Create `src/api/appleMusicClient.ts`:

```typescript
import { MUSIC_PROXY_URL } from '../utils/constants';
import type { Track } from './types';

const STOREFRONT = 'us';
const APPLE_PROXY = MUSIC_PROXY_URL ? `${MUSIC_PROXY_URL}/apple` : '';
const ART_SIZE = 1000;

export interface AppleSong {
  id: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    isrc?: string;
    url?: string;
    artwork?: { url?: string };
    previews?: { url?: string }[];
  };
  relationships?: { artists?: { data?: { id: string }[] } };
}

function artUrl(tmpl?: string): string | undefined {
  if (!tmpl) return undefined;
  return tmpl.replace('{w}', String(ART_SIZE)).replace('{h}', String(ART_SIZE));
}

/** Normalize one Apple catalog song into the app's Track shape. */
export function mapAppleSong(song: AppleSong): Track {
  const a = song.attributes ?? {};
  return {
    id: Number(song.id),
    title: a.name ?? '',
    artist: { id: Number(song.relationships?.artists?.data?.[0]?.id ?? 0), name: a.artistName ?? '' },
    album: { id: 0, title: a.albumName ?? '', cover_xl: artUrl(a.artwork?.url) ?? '' },
    preview: a.previews?.[0]?.url ?? '',
    duration: a.durationInMillis ? Math.round(a.durationInMillis / 1000) : 0,
    link: a.url ?? '',
    isrc: a.isrc,
    artworkUrl: artUrl(a.artwork?.url),
    appleMusicId: song.id,
    appleArtistId: song.relationships?.artists?.data?.[0]?.id,
  };
}

async function appleGet(path: string): Promise<any> {
  if (!APPLE_PROXY) throw new Error('music proxy not configured');
  const res = await fetch(`${APPLE_PROXY}${path}`);
  if (!res.ok) throw new Error(`apple ${res.status}`);
  return res.json();
}

/** Full-text catalog search → tracks with previews. */
export async function searchAppleTracks(query: string, limit = 5): Promise<Track[]> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/search?term=${encodeURIComponent(query)}&types=songs&limit=${limit}`
    );
    return (data?.results?.songs?.data ?? []).map(mapAppleSong);
  } catch {
    return [];
  }
}

export async function getAppleSongByIsrc(isrc: string): Promise<Track | null> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/songs?filter[isrc]=${encodeURIComponent(isrc)}&limit=1`
    );
    const song = data?.data?.[0];
    return song ? mapAppleSong(song) : null;
  } catch {
    return null;
  }
}

export async function getSimilarArtistIds(artistId: string, limit = 10): Promise<string[]> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/artists/${artistId}/view/similar-artists?limit=${limit}`
    );
    return (data?.data ?? []).map((a: { id: string }) => a.id);
  } catch {
    return [];
  }
}

export async function getArtistTopSongs(artistId: string, limit = 10): Promise<Track[]> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/artists/${artistId}/view/top-songs?limit=${limit}`
    );
    return (data?.data ?? []).map(mapAppleSong);
  } catch {
    return [];
  }
}

export async function getAppleCharts(limit = 20): Promise<Track[]> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/charts?types=songs&limit=${limit}`
    );
    return (data?.results?.songs?.[0]?.data ?? []).map(mapAppleSong);
  } catch {
    return [];
  }
}

/** Resolve a track's Apple artist id (used to fan out to similar-artists). */
export async function getArtistIdForTrack(track: Track): Promise<string | null> {
  if (track.appleArtistId) return track.appleArtistId;
  if (track.isrc) {
    const song = await getAppleSongByIsrc(track.isrc);
    return song?.appleArtistId ?? null;
  }
  const [hit] = await searchAppleTracks(`${track.title} ${track.artist.name}`, 1);
  return hit?.appleArtistId ?? null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/api/__tests__/appleMusicClient.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/api/appleMusicClient.ts src/api/types.ts src/api/__tests__/appleMusicClient.test.ts
git commit -m "feat: Apple Music catalog client + song normalizer"
git push
```

---

## Task 2: Rewrite the recommendation engine on Apple primitives

**Files:**
- Modify: `src/api/endpoints.ts` (`getRecommendationsForSeeds`, `getSongSimilarRecs`)
- Test: `src/api/__tests__/endpoints.recs.test.ts`

**Interfaces:**
- Consumes: `searchAppleTracks`, `getArtistTopSongs`, `getSimilarArtistIds`, `getArtistIdForTrack`, `getAppleCharts` from `./appleMusicClient`; `Track`, `RecommendationCard` from `./types`.
- Produces (signatures UNCHANGED so callers don't break):
  - `getRecommendationsForSeeds(seeds: Array<{ name: string; artist: string }>, limit?, seenIds?: Set<number>, likedArtistKeys?: Set<string>, seedArtistIds?: string[]): Promise<RecommendationCard[]>`
  - `getSongSimilarRecs(seedArtist: string, seedTitle: string, limit?, seenIds?: Set<number>, filteredArtistKeys?: Set<string>, seedAppleArtistId?: string): Promise<RecommendationCard[]>`

Note: the last positional arg changes meaning from Deezer track ids to Apple artist ids. `useRecommendations.ts` (Task 3) is updated to match.

- [ ] **Step 1: Write the failing test**

Create `src/api/__tests__/endpoints.recs.test.ts`:

```typescript
jest.mock('../appleMusicClient');
import * as apple from '../appleMusicClient';
import { getRecommendationsForSeeds } from '../endpoints';
import type { Track } from '../types';

function mk(id: number, name: string, artist: string, artistId: string): Track {
  return {
    id, title: name, artist: { id: Number(artistId), name },
    album: { id: 0, title: '', cover_xl: 'art' }, preview: 'p', duration: 100, link: '',
    artworkUrl: 'art', appleArtistId: artistId,
  };
}

it('builds recs from seed artist → similar artists → top songs, filtering seen + artist dupes', async () => {
  (apple.searchAppleTracks as jest.Mock).mockResolvedValue([mk(1, 'Seed', 'A', '10')]);
  (apple.getArtistIdForTrack as jest.Mock).mockResolvedValue('10');
  (apple.getSimilarArtistIds as jest.Mock).mockResolvedValue(['20', '30']);
  (apple.getArtistTopSongs as jest.Mock).mockImplementation((aid: string) =>
    Promise.resolve([mk(Number(aid) + 1, 'Song' + aid, 'Artist' + aid, aid)]));
  (apple.getAppleCharts as jest.Mock).mockResolvedValue([]);

  const cards = await getRecommendationsForSeeds(
    [{ name: 'Seed', artist: 'A' }], 10, new Set<number>([1]), new Set<string>(), ['10']
  );
  const ids = cards.map((c) => c.track.id);
  expect(ids).not.toContain(1);          // seen filtered
  expect(cards.every((c) => c.track.preview)).toBe(true); // only playable
  expect(cards.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/api/__tests__/endpoints.recs.test.ts`
Expected: FAIL (old implementation still calls Deezer/Last.fm; ids/behavior mismatch or import errors).

- [ ] **Step 3: Replace the imports + both functions in `endpoints.ts`**

At the top of `src/api/endpoints.ts`, remove the Last.fm + Deezer imports:

```typescript
// DELETE these two lines:
// import { getSimilarTracks, getArtistSimilar, getArtistTopTracks, getTrackTags, getTagTopTracks, getArtistTags } from './lastfmClient';
// import { searchDeezer, getDeezerRadio } from './deezerClient';

// ADD:
import {
  searchAppleTracks, getArtistTopSongs, getSimilarArtistIds,
  getArtistIdForTrack, getAppleCharts,
} from './appleMusicClient';
```

Replace the entire body of `getRecommendationsForSeeds` with:

```typescript
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
```

Replace the entire body of `getSongSimilarRecs` with:

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/api/__tests__/endpoints.recs.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck (expect errors in callers — that's Task 3+)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `useRecommendations.ts`, `onboarding.tsx`, `hear.tsx`, `tasteEngine.ts` (still import Deezer/Last.fm). `endpoints.ts` itself is clean. Do not fix callers here.

- [ ] **Step 6: Commit**

```bash
git add src/api/endpoints.ts src/api/__tests__/endpoints.recs.test.ts
git commit -m "feat: rebuild rec engine on Apple similar-artists + top-songs"
git push
```

---

## Task 3: Rewrite taste-seed building + useRecommendations

**Files:**
- Modify: `src/api/tasteEngine.ts` (`buildTasteSeeds`)
- Modify: `src/hooks/useRecommendations.ts`
- Test: `src/api/__tests__/tasteEngine.test.ts`

**Interfaces:**
- `buildTasteSeeds` keeps its signature and return type `Array<{ name: string; artist: string }>` but sources genre representative tracks from Apple search instead of Last.fm.
- `useRecommendations.ts`: replace `getDeezerChart` import with `getAppleCharts`; the `deezerSeedIds` array becomes `seedArtistIds: string[]` built from liked tracks' `appleArtistId`.

- [ ] **Step 1: Write the failing test for `buildTasteSeeds`**

Create `src/api/__tests__/tasteEngine.test.ts`:

```typescript
jest.mock('../appleMusicClient');
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn() }));
import * as apple from '../appleMusicClient';
import { buildTasteSeeds } from '../tasteEngine';

it('builds seeds from onboarding genres via Apple search', async () => {
  (apple.searchAppleTracks as jest.Mock).mockResolvedValue([
    { title: 'X', artist: { name: 'ArtistX' } },
  ]);
  const seeds = await buildTasteSeeds([], [], ['pop'], false, new Set<string>(), 1);
  expect(seeds.length).toBeGreaterThan(0);
  expect(seeds[0]).toHaveProperty('name');
  expect(seeds[0]).toHaveProperty('artist');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/api/__tests__/tasteEngine.test.ts`
Expected: FAIL (tasteEngine still imports Last.fm).

- [ ] **Step 3: Replace Last.fm usage in `tasteEngine.ts`**

Replace the import line 2:

```typescript
// DELETE: import { getTrackTags, getArtistSimilar, getArtistTopTracks } from './lastfmClient';
import { searchAppleTracks } from './appleMusicClient';
import { GENRE_ARTISTS } from '../utils/genres';
```

Then in `buildTasteSeeds`, wherever it used `getArtistTopTracks(artist, n)` / `getArtistSimilar` / `getTrackTags` to turn a genre or artist into `{ name, artist }` seeds, replace with an Apple search on a genre-representative artist. The minimal, behavior-preserving replacement for the genre path:

```typescript
// For each selected genre, pick a representative artist and search Apple for a track.
const genreSeedResults = await Promise.all(
  genres.slice(0, 3).map(async (genre) => {
    const reps = GENRE_ARTISTS[genre] ?? [];
    if (reps.length === 0) return null;
    const rep = reps[Math.floor(Math.random() * reps.length)];
    const [hit] = await searchAppleTracks(rep, 1);
    return hit ? { name: hit.title, artist: hit.artist.name } : null;
  })
);
```

Keep the rest of the function's structure (liked-track sampling, filtering) intact — only the data-source calls change. Remove any now-unused Last.fm-derived tag logic.

- [ ] **Step 4: Update `useRecommendations.ts`**

Replace the Deezer chart import:

```typescript
// DELETE: import { getDeezerChart } from '../api/deezerClient';
import { getAppleCharts } from '../api/appleMusicClient';
```

Replace the `deezerSeedIds` construction (lines ~61-71) with Apple artist ids drawn from liked tracks:

```typescript
// Apple artist-id seeds: sample from recently-liked tracks' Apple artist ids.
const likedArtistIds = likedTracks
  .slice(0, 20)
  .map((t) => t.appleArtistId)
  .filter((v): v is string => !!v);
const sampledArtistIds = likedArtistIds.length <= 4
  ? likedArtistIds
  : [...likedArtistIds].sort(() => Math.random() - 0.5).slice(0, 4);
const seedArtistIds = sampledArtistIds;
```

Replace the last-resort Deezer chart branch (lines ~122-132) with:

```typescript
} else {
  // Last resort: Apple charts minus filtered artists
  try {
    const chart = await getAppleCharts(20);
    seeds = chart
      .filter((t) => !filteredArtistKeys.has(t.artist.name.toLowerCase()))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((t) => ({ name: t.title, artist: t.artist.name }));
  } catch {
    seeds = [];
  }
}
```

Update the final call to pass `seedArtistIds` instead of `deezerSeedIds`:

```typescript
return getRecommendationsForSeeds(seeds, 20, seenIds, filteredArtistKeys, forceShift ? [] : seedArtistIds);
```

- [ ] **Step 5: Run taste test + typecheck**

Run: `npx jest src/api/__tests__/tasteEngine.test.ts` → PASS
Run: `npx tsc --noEmit` → errors now only in `onboarding.tsx`, `hear.tsx`, `FeedItem.tsx` (Task 4/5).

- [ ] **Step 6: Commit**

```bash
git add src/api/tasteEngine.ts src/hooks/useRecommendations.ts src/api/__tests__/tasteEngine.test.ts
git commit -m "feat: taste seeds + useRecommendations on Apple Music"
git push
```

---

## Task 4: Onboarding + Hear-a-Song on Apple

**Files:**
- Modify: `app/onboarding.tsx`
- Modify: `app/(tabs)/hear.tsx`

**Interfaces:** consumes `searchAppleTracks`, `getArtistTopSongs`, `getSimilarArtistIds` from `../src/api/appleMusicClient`.

- [ ] **Step 1: Onboarding — replace Deezer/Last.fm imports**

In `app/onboarding.tsx`:

```typescript
// DELETE:
// import { searchDeezer } from '../src/api/deezerClient';
// import { getArtistSimilar, getArtistTopTracks } from '../src/api/lastfmClient';
import { searchAppleTracks } from '../src/api/appleMusicClient';
```

In `finish()`, the artist/genre seed-building currently calls `getArtistTopTracks(a.name, 3)` + `searchDeezer(a.name, 10)` and `getArtistSimilar(rep, 10)`. Replace each `searchDeezer(x, n)` with `searchAppleTracks(x, n)` (same return shape: `Track[]`), and replace `getArtistTopTracks(name, n)` with `searchAppleTracks(name, n)` mapped to `{ name, artist }`. Replace the Deezer-radio seed ids (`selectedSong.id`, artist track ids) with Apple artist ids collected from the search hits' `appleArtistId`, and pass them as the `seedArtistIds` argument to `getRecommendationsForSeeds`.

Concretely, the favourite-artists block becomes:

```typescript
Promise.all(favoriteArtists.map(async (a) => {
  const hits = await searchAppleTracks(a.name, 3).catch(() => []);
  if (hits.length > 0) seeds.push({ name: hits[0].title, artist: hits[0].artist.name });
  return hits[0]?.appleArtistId ?? null;   // artist id for radio seeds
})),
```

and the genre block similarly uses `searchAppleTracks(rep, 3)`. Collect the returned artist ids into `seedArtistIds: string[]` and change the final call:

```typescript
const cards = await getRecommendationsForSeeds(seeds, 20, new Set(), new Set(), seedArtistIds);
```

Persist `appleArtistId`s (not Deezer track ids) into the deck store fields you already set (`onboardingArtistTrackIds` → repurpose as `onboardingArtistIds: string[]`; update `deckStore` field type accordingly and `useRecommendations` seed usage). Keep AsyncStorage keys but store the Apple ids.

- [ ] **Step 2: Hear-a-Song — replace Deezer search**

In `app/(tabs)/hear.tsx`:

```typescript
// DELETE: import { searchDeezer } from '../../src/api/deezerClient';
import { searchAppleTracks } from '../../src/api/appleMusicClient';
```

Replace both `searchDeezer(query, 5)` and `searchDeezer(\`${match.title} ${match.artist}\`, 5)` calls with `searchAppleTracks(...)` (identical `Track[]` return). AudD (`recognizeSong`) is unchanged — it returns `{ title, artist }`, which now feeds an Apple search. `getSongSimilarRecs` calls stay (its internals are already Apple from Task 2); pass the recognized track's `appleArtistId` if available as the new last arg.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors now only in `FeedItem.tsx` and `musicKitService.ts`/tests referencing `deezerClient` (Task 5).

- [ ] **Step 4: Commit**

```bash
git add app/onboarding.tsx "app/(tabs)/hear.tsx" src/store/deckStore.ts
git commit -m "feat: onboarding + Hear-a-Song search via Apple Music"
git push
```

---

## Task 5: Social feed previews + musicKitService cleanup + attribution

**Files:**
- Modify: `src/components/social/FeedItem.tsx`
- Modify: `src/api/musicKitService.ts`
- Modify: `src/components/cards/TrackCard.tsx`
- Modify: `app/settings.tsx`
- Modify: `src/api/__tests__/musicKitService.test.ts`

- [ ] **Step 1: FeedItem — re-resolve preview via Apple**

In `src/components/social/FeedItem.tsx`:

```typescript
// DELETE: import { getDeezerTrackById, searchDeezer } from '../../api/deezerClient';
import { searchAppleTracks } from '../../api/appleMusicClient';
```

The component re-fetches a fresh preview URL for a liked track (stored with `title`/`artistName`). Replace the Deezer fetch chain with a single Apple search:

```typescript
const hits = await searchAppleTracks(`${item.title} ${item.artistName}`, 1).catch(() => []);
const fresh = hits[0] ?? null;
// use fresh.preview for playback; fresh.artworkUrl for cover if item.coverUrl is missing
```

Remove the `getDeezerTrackById` branch entirely. The constructed fallback `track` object keeps the same `Track` shape.

- [ ] **Step 2: musicKitService — drop the Deezer dependency**

In `src/api/musicKitService.ts`:

```typescript
// DELETE: import { getDeezerTrackById } from './deezerClient';
```

In `resolveArtwork`, the ISRC-fetch fallback used `getDeezerTrackById(track.id)`. Since Apple tracks now carry `isrc` + `artworkUrl` directly, simplify: if `track.artworkUrl` exists, return it; else if `track.isrc` exists, use `getAppleSongByIsrc`; else fall back to title+artist search via the existing `searchByText`. Replace the Deezer branch:

```typescript
// was: const full = await getDeezerTrackById(track.id).catch(() => null); isrc = full?.isrc;
// now: no Deezer — rely on track.isrc / title+artist only.
let isrc = track.isrc;
```

(Leave the rest of `resolveArtwork`/`resolveArtistArtwork` intact — they already call the Apple proxy.)

- [ ] **Step 3: Update the musicKitService test**

In `src/api/__tests__/musicKitService.test.ts`, remove the `jest.mock('../deezerClient', ...)` line and the `getDeezerTrackById` import + the test case "fetches ISRC from Deezer when absent" (that path no longer exists). Keep ISRC-match, title+artist fallback, miss, cache, and batch tests. Update any `track()` helper that relied on Deezer id fetch to set `isrc` directly.

- [ ] **Step 4: Attribution swap**

In `src/components/cards/TrackCard.tsx`, change the attribution line:

```typescript
// was: <Text style={styles.attribution}>Audio preview by Deezer</Text>
<Text style={styles.attribution}>Music by Apple Music</Text>
```

In `app/settings.tsx`, replace the Deezer/Last.fm footer credits block with an Apple Music credit line and remove the Deezer private-use disclosure:

```typescript
<Text style={styles.footer}>
  Music, previews and artwork provided by{' '}
  <Text style={styles.footerLink} onPress={() => Linking.openURL('https://music.apple.com')}>
    Apple Music
  </Text>
</Text>
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest` → all green
Run: `npx tsc --noEmit` → clean

- [ ] **Step 6: Commit**

```bash
git add src/components/social/FeedItem.tsx src/api/musicKitService.ts src/api/__tests__/musicKitService.test.ts src/components/cards/TrackCard.tsx app/settings.tsx
git commit -m "feat: Apple previews in feed, Apple Music attribution, drop Deezer from musicKitService"
git push
```

---

## Task 6: Delete Deezer + Last.fm; prune the worker

**Files:**
- Delete: `src/api/deezerClient.ts`, `src/api/lastfmClient.ts`
- Modify: `worker/src/index.ts` (remove `/deezer`, `/lastfm` routes)

- [ ] **Step 1: Confirm nothing imports the dead clients**

Run: `git grep -n "deezerClient\|lastfmClient" -- src app`
Expected: NO results (all consumers migrated in Tasks 2-5). If any remain, fix them before deleting.

- [ ] **Step 2: Delete the client files**

```bash
git rm src/api/deezerClient.ts src/api/lastfmClient.ts
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If a stray reference appears, resolve it.)

- [ ] **Step 4: Prune worker routes**

In `worker/src/index.ts`, remove the `/deezer/` and `/lastfm` route dispatch lines and their handler functions (`handleDeezer`, `handleLastFm`) and the `LASTFM_API_KEY` env binding + `ttlFor` cases no longer used. Keep `/apple/*`, `/musickit/token`, and `proxyWithCache`. Verify the bundle builds:

Run: `cd worker && npx wrangler deploy --dry-run --outdir ./.dryrun && rm -rf ./.dryrun`
Expected: "Total Upload" line, no errors.

- [ ] **Step 5: Deploy the worker**

Run: `cd worker && npx wrangler deploy`
Expected: "Deployed songmatch-proxy".

- [ ] **Step 6: Run full test suite + typecheck**

Run: `npx jest` → all green
Run: `npx tsc --noEmit` → clean

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove Deezer + Last.fm clients and worker routes"
git push
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Verify the live pipeline through the worker**

Run these and confirm non-empty, preview-bearing results:

```bash
BASE="https://songmatch-proxy.radupopa214.workers.dev"
curl -s "$BASE/apple/v1/catalog/us/search?term=drake&types=songs&limit=1" | grep -o '"previews"'
curl -s "$BASE/apple/v1/catalog/us/artists/479756766/view/similar-artists?limit=2" | grep -o '"name"' | head -1
curl -s "$BASE/apple/v1/catalog/us/charts?types=songs&limit=1" | grep -o '"previews"'
```

Expected: each prints a match (previews/name present).

- [ ] **Step 2: Confirm no Deezer/Last.fm references remain in shipping code**

Run: `git grep -in "deezer\|last\.fm\|lastfm\|audioscrobbler" -- src app | grep -v "__tests__"`
Expected: no results except intentional none. (AudD in `hear.tsx` is a separate service and may remain — it is song *recognition*, not catalog/streaming.)

- [ ] **Step 3: Trigger a Codemagic build and verify the IPA**

After the build, inspect the IPA bundle:

```bash
grep -ac "songmatch-proxy" Payload/SongMatch.app/main.jsbundle   # proxy present
grep -ac "api.deezer.com" Payload/SongMatch.app/main.jsbundle    # expect 0
```

- [ ] **Step 4: Device QA checklist (manual)**

- Onboarding builds a first feed (Apple previews play).
- Discovery swipe feed loads and refills.
- Hear-a-Song: mic + text search return Apple tracks with playable previews.
- Liked list + social feed play previews.
- Track card shows "Music by Apple Music" attribution.

---

## Post-migration: App Store resubmission notes

- **5.2.3:** reply that all audio previews, catalog, and discovery are now sourced from the Apple Music Catalog API under the Apple Music API terms (your Apple Developer Program License Agreement is the documentary evidence). No third-party (Deezer/Last.fm) audio/catalog/discovery remains.
- **5.2.1:** all artwork is Apple Music catalog artwork; re-shoot screenshots from the migrated app (or keep covers, since they are now genuinely Apple-sourced).
- **Guideline 4:** Shop text wrapping fixed (commit 5102951) — verify on iPad in the new build.
