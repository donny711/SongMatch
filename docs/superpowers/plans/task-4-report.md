# Task 4 Report: Onboarding + Hear-a-Song on Apple

## Files Modified

| File | Change |
|------|--------|
| `app/onboarding.tsx` | Removed `searchDeezer` (deezerClient) and `getArtistSimilar`/`getArtistTopTracks` (lastfmClient) imports. Added `searchAppleTracks` from appleMusicClient. Replaced all 4 `searchDeezer` call sites (handleSearch, handleArtistSearch, finish artist block, finish genre block) with `searchAppleTracks`. Rewrote `finish()` parallel lookup to collect `appleArtistId` from hits, build `seedArtistIds: string[]`, and pass to `getRecommendationsForSeeds`. Updated `useDeckStore.setState` to write `onboardingArtistTrackIds` as `string[]` (Apple artist ids). |
| `app/(tabs)/hear.tsx` | Removed `searchDeezer` (deezerClient) import. Added `searchAppleTracks` from appleMusicClient. Replaced both `searchDeezer(...)` calls (AudD recognition path + manual search path) with `searchAppleTracks(...)`. Changed `getSongSimilarRecs` last arg from `track.id` (number) to `track.appleArtistId` (string | undefined). AudD `recognizeSong` unchanged. |
| `src/store/deckStore.ts` | Changed `onboardingArtistTrackIds` type from `number[]` to `string[]` in both the interface and the `loadForUser` parse line. No numeric coercion was applied to this field, so no further changes needed. Field name kept as `onboardingArtistTrackIds` to minimize churn. |

## Field Rename Decision

Kept the field name `onboardingArtistTrackIds` (not renamed to `onboardingArtistIds`) to minimize churn — the name is only referenced in `deckStore.ts` and `onboarding.tsx` after Tasks 1–3 removed it from `useRecommendations.ts` and `app/_layout.tsx`.

## tsc Result

`npx tsc --noEmit` exits 0 — fully clean. `FeedItem.tsx` and `musicKitService.ts` still import from `deezerClient` (Task 5), but since `deezerClient.ts` still exists (deleted in Task 6), tsc passes with no errors.

## Jest Result

`npx jest` — 6 test suites, 41 tests, all passed. No regressions.

## Commit

Hash: `5dda55f`  
Branch: `master`  
Pushed to GitHub.

## Concerns

None. All changes are clean. The `appleArtistId` field on `Track` is `string | undefined`, so passing `track.appleArtistId` to `getSongSimilarRecs` (which accepts `seedAppleArtistId?: string`) is type-safe. The `onboardingArtistTrackIds: string[]` change is backwards-compatible with JSON.parse (old numeric values stored as JSON numbers would parse as numbers, but new sessions write string ids — acceptable migration since the field is a cold-start seed only, not critical data).
