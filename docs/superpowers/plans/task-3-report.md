# Task 3 Report — Taste Seeds + useRecommendations on Apple Music

## Files Modified

| File | Change |
|------|--------|
| `src/api/tasteEngine.ts` | Removed Last.fm imports (`getTrackTags`, `getArtistSimilar`, `getArtistTopTracks`) and AsyncStorage. Removed `tagsFor` and the overplay-detection block. Rewrote `genreSeed` to call `searchAppleTracks(rep \|\| genre, 1)`. Replaced Step 6 (artist → Last.fm similar → top track) with `searchAppleTracks(artist, 1)`. |
| `src/hooks/useRecommendations.ts` | Swapped `getDeezerChart` import for `getAppleCharts`. Removed `onboardingSongId`/`onboardingArtistTrackIds` from destructure + deps array. Replaced `deezerSeedIds` build with `seedArtistIds` from liked tracks' `appleArtistId`. Replaced last-resort Deezer chart branch with `getAppleCharts`. Updated final `getRecommendationsForSeeds` call. |
| `app/_layout.tsx` | Removed `onboardingSongId`/`onboardingArtistTrackIds` from `prefetchRecommendations` destructure. Replaced `deezerSeedIds` build with `seedArtistIds` from `likedTracks.slice(0,20).map(t => t.appleArtistId)` (sampled to 4). |
| `src/api/__tests__/tasteEngine.test.ts` | Created: mocks `appleMusicClient` + `constants` + `async-storage`; asserts `buildTasteSeeds` returns seeds with `name`/`artist` from Apple search. |

## Test Commands and Output

```
npx jest src/api/__tests__/tasteEngine.test.ts --no-coverage
PASS src/api/__tests__/tasteEngine.test.ts
  √ builds seeds from onboarding genres via Apple search (7 ms)
```

```
npx jest --no-coverage
Test Suites: 6 passed, 6 total
Tests:       41 passed, 41 total
Time: 5.591 s
```

## TypeScript Result

```
npx tsc --noEmit
app/(tabs)/hear.tsx(463,102): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
app/onboarding.tsx(226,93): error TS2345: Argument of type 'number[]' is not assignable to parameter of type 'string[]'.
```

`tasteEngine.ts`, `useRecommendations.ts`, and `_layout.tsx` are clean. Errors are only in `hear.tsx` and `onboarding.tsx` (Task 4 — expected). No `FeedItem.tsx` errors.

## Commit

```
02f79c0  feat: taste seeds + useRecommendations on Apple Music
```
Pushed to `origin/master`.

## Concerns

None blocking. One design note: the new `genreSeed` falls back to searching the genre string directly (e.g. `"pop"`) when `GENRE_ARTISTS` has no case-matching key. The test uses lowercase `'pop'` which triggers this fallback — this is harmless in production since onboarding genres are stored with the casing from `GENRES` (e.g. `'Pop'`).
