# Task 2 Report: Rewrite Recommendation Engine on Apple Primitives

## Files Modified

- `src/api/endpoints.ts` — replaced Deezer/Last.fm imports and both rec functions
- `src/api/__tests__/endpoints.recs.test.ts` — new test file (created)

## Changes to `endpoints.ts`

**Removed imports:**
- `getSimilarTracks, getArtistSimilar, getArtistTopTracks, getTrackTags, getTagTopTracks, getArtistTags` from `./lastfmClient`
- `searchDeezer, getDeezerRadio` from `./deezerClient`
- `resolveArtworkForTracks` from `./musicKitService` (no longer called — Apple tracks carry artwork directly)

**Added import:**
- `searchAppleTracks, getArtistTopSongs, getSimilarArtistIds, getArtistIdForTrack, getAppleCharts` from `./appleMusicClient`

**Type import change:** `DeezerTrack` → `Track` (same type, but new functions use `Track`)

**`getRecommendationsForSeeds` signature change:** last arg renamed `deezerSeedIds: number[]` → `seedArtistIds: string[]`. Callers updated in later tasks.

**`getSongSimilarRecs` signature change:** last arg renamed `seedDeezerTrackId?: number` → `seedAppleArtistId?: string`. Callers updated in later tasks.

## Test Commands and Output

### New test (endpoints.recs.test.ts) — PASS
```
npx jest src/api/__tests__/endpoints.recs.test.ts --no-coverage
PASS src/api/__tests__/endpoints.recs.test.ts
  √ builds recs from seed artist → similar artists → top songs, filtering seen + artist dupes (56 ms)
Tests: 1 passed, 1 total
```

### Full test suite — all green
```
npx jest --no-coverage
PASS src/api/__tests__/endpoints.recs.test.ts
PASS src/api/__tests__/appleMusicClient.test.ts
PASS src/api/__tests__/musicKitService.test.ts
PASS src/firebase/__tests__/referralService.test.ts
PASS src/notifications/__tests__/reengagement.test.ts
Test Suites: 5 passed, 5 total
Tests: 40 passed, 40 total
```

## TypeScript Result

`npx tsc --noEmit` exits with code 2. Errors are **only in callers** (Task 3+ responsibility). `endpoints.ts` itself is clean.

Expected-error files:
- `app/(tabs)/hear.tsx:463` — passes `number` where `string` now expected (seedAppleArtistId)
- `app/_layout.tsx:74` — passes `number[]` for `seedArtistIds` (not in plan's error list but same cause)
- `app/onboarding.tsx:226` — passes `number[]` for `seedArtistIds`
- `src/hooks/useRecommendations.ts:141` — passes `number[]` for `seedArtistIds`

No errors in `tasteEngine.ts` (it doesn't directly call the rec engine).

## Deviation from Plan

**Test mock additions:** The plan's test code did not include `jest.mock('../../utils/constants', ...)` or `jest.mock('../spotifyClient', ...)`. These were required because `endpoints.ts` imports `spotifyClient` which imports `constants.ts` which calls `expo-auth-session`'s `makeRedirectUri` at module evaluation time — a known pattern in this codebase (every other test in `src/api/__tests__/` mocks constants). Added both mocks to make the test runnable. This is consistent with existing tests, not a functional change.

## Commit Hash

`68a4861` — pushed to `origin/master`

## Concerns

None blocking. The `_layout.tsx` error (not mentioned in the plan's expected error list) is benign — it calls `getRecommendationsForSeeds` with the old `number[]` seed arg and will be fixed when the caller chain is updated in Task 3.
