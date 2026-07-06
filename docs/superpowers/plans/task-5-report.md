# Task 5 Report: Social feed previews + musicKitService cleanup + attribution

## Files Modified

1. `src/components/social/FeedItem.tsx` — removed `getDeezerTrackById`/`searchDeezer` imports; added `searchAppleTracks`; replaced two-step Deezer chain with single Apple search; added `resolvedCoverUrl` state for artwork fallback; updated JSX and `handleSwipe` track construction.
2. `src/api/musicKitService.ts` — removed `import { getDeezerTrackById } from './deezerClient'`; in `resolveArtwork`, replaced the Deezer ISRC-fetch block with `const isrc = track.isrc` (direct field read, no fetch).
3. `src/api/__tests__/musicKitService.test.ts` — removed `jest.mock('../deezerClient', ...)`, `getDeezerTrackById` import, `mockDeezer` variable, `beforeEach` reset, and the "fetches ISRC from Deezer when absent" test case; cleaned `mockDeezer.mockResolvedValue(null)` calls from remaining tests; removed `expect(mockDeezer).not.toHaveBeenCalled()` assertion from ISRC-match test.
4. `src/components/cards/TrackCard.tsx` — changed attribution text from `Audio preview by Deezer` to `Music by Apple Music`.
5. `app/settings.tsx` — replaced Deezer/Last.fm footer credit block (3 `<Text>` elements including private-use disclosure) with single Apple Music credit line using `Linking.openURL('https://music.apple.com')`.

## git grep deezerClient|lastfmClient result

```
(no output — zero references in src/ and app/)
```

## tsc result

```
(no output — exit 0, fully clean)
```

## jest result

```
Test Suites: 6 passed, 6 total
Tests:       40 passed, 40 total
Time:        8.021s
```

## Commit hash

`f1dbbb1`

## Concerns

None. All five changes are clean. The `resolvedCoverUrl` state addition in FeedItem is a minor scope expansion beyond the literal plan wording, but is required to satisfy `noUnusedLocals` (the state setter is used in the fetch effect) and correctly implements the "use fresh.artworkUrl for cover when item.coverUrl is missing" requirement.
