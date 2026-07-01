# Taste Model + Skip Intelligence — Design

**Date:** 2026-07-01
**Status:** Approved design, pre-implementation
**Scope:** Pillar 1 of the "beat Spotify" recommendation engine evolution.

---

## Why this exists

SongMatch's unfair advantage over Spotify is the **swipe**: a clean, deliberate, per-track
like/skip on a 30-second preview, collected dozens of times per session. It is the highest-signal
music preference data available, and Spotify structurally cannot collect it (their product is
passive listening).

**The current engine throws most of that signal away.** On each fetch it samples a few recent
likes, hands them to Deezer radio / Last.fm, and asks for "similar." There is no persistent model
of the user. Skips only trigger a crude "block this artist after 2 skips" filter
(`useRecommendations.ts`), so the *quality* the user rejected is never learned.

This pillar builds the missing brain: a **persistent, per-user taste model** that learns from every
like AND skip, and re-ranks recommendations against it.

### What this is NOT (out of scope for this spec)
- Within-session live re-ranking after every swipe (Pillar 3 — future spec).
- User-facing Comfort/Balanced/Explorer mode selector + bandit (Pillar 4 — future spec).
- Anti-popularity deep-cut injection (Pillar 5 — future spec; needs `rank` on `DeezerTrack`).
- Collaborative filtering / audio-feature modeling — deliberately not attempted (data moats).

---

## The taste space: Last.fm tags

We have no audio features, but we have **Last.fm genre/mood tags** — and they are already cached
(`tagcache_v1_`, 7-day TTL). Tags become the dimensions of the taste space. Every track/artist is a
bag of tags; a user's taste is a weighted map over those tags. This is our substitute for Spotify's
audio-feature vector.

---

## Data model

Persisted per user at AsyncStorage key `sm_taste_v1_<uid>`:

```ts
interface TasteProfile {
  tagWeights: Record<string, number>;    // e.g. { "indie rock": 4.2, "hyperpop": -3.1 }
  artistWeights: Record<string, number>; // direct artist affinity
  counts: { likes: number; skips: number };
  updatedAt: number;                      // epoch ms, for recency decay
}
```

- **Positive weight** = a quality the user seeks.
- **Negative weight** = a quality the user keeps rejecting.

---

## Learning rules ("Balanced" personality)

Chosen personality: **likes are sticky, skips fade fast unless repeated.** Durable love,
forgiving of one-off bad-mood skips.

**On LIKE(track):**
- Resolve the track's tags (via artist tags — see Cost Strategy). Cap to the top `MAX_TAGS_PER_TRACK` (5) by Last.fm count.
- Each tag: `tagWeights[tag] += LIKE_GAIN`.
- `artistWeights[artist] += LIKE_GAIN`.

**On SKIP(track):**
- Each tag: `tagWeights[tag] -= SKIP_PENALTY` (smaller magnitude than a like — skips are noisier).
- Artist affinity unchanged here (the existing `artistSkipCounts` 2-skip filter still handles
  hard artist suppression; the taste model generalizes the *quality* lesson).

**Recency decay (applied once per session on load, prorated by weeks since `updatedAt`):**
- Positive weights: `w *= POS_DECAY` per week (slow — likes stay sticky).
- Negative weights: `w *= NEG_DECAY` per week (fast toward zero — skips forgiven ~2× faster).
- Asymmetric decay is what implements the "Balanced" personality in a single weight map.

**Bounding:** clamp `|weight| <= WEIGHT_CAP` after every update so no single tag dominates.

---

## Scoring a candidate

```
tasteScore(track) = squash( mean(tagWeights[t] for t in artistTags(track)) + GAMMA * artistWeights[artist] )
```

- Positive → matches liked qualities → floats up.
- Strongly negative (`tasteScore < NEG_FLOOR`) → dropped before it is ever shown.
  **This is the skip intelligence:** after five skipped hyperpop tracks, every hyperpop candidate
  sinks — even brand-new artists the user has never seen. The current engine cannot do this.

---

## Cost strategy: score by ARTIST tags, not track tags

Scoring needs each candidate's tags. Fetching *track*-level Last.fm tags for 40+ radio candidates
per fetch is too slow/expensive.

**Decision: use artist-level tags for both profile-building and candidate scoring.**
- One tag fetch per unique artist, heavily cacheable (existing `tagcache_v1_` cache).
- Deezer radio clusters by artist anyway, so artist tags are a fair proxy.
- Track-level tags remain only in "Hear a Song" (`getSongSimilarRecs`), where volume is low and
  precision matters — that path is unchanged by this spec.

---

## Integration: blend, don't replace

Deezer radio's audio-fingerprint similarity (match = 1.0) is genuinely good and is kept. Final
ranking blends it with the taste score, replacing the sort at `endpoints.ts:218`:

```
final = W_MATCH * matchScore + W_TASTE * tasteScore
```

Candidates with `tasteScore < NEG_FLOOR` are filtered out entirely before the blend.

---

## Cold start

Seed the profile from onboarding genres (`onboardingGenres`, already collected) as declared tags at
a moderate positive weight (`SEED_WEIGHT`). Session 1 is therefore not blind; seeds decay normally
and are overwritten by real swipes within a few sessions.

---

## Touch points

1. **New module `src/api/tasteProfile.ts`** — pure, testable functions:
   `loadProfile(uid)`, `persistProfile`, `applyLike(profile, tags, artist)`,
   `applySkip(profile, tags)`, `decay(profile, now)`, `scoreTrack(profile, artistTags, artist)`,
   `seedFromGenres(genres)`.
2. **`src/store/deckStore.ts`** — like/skip actions fire the profile update (they already own
   `likedTracks`, `recentSkips`, `artistSkipCounts`).
3. **`src/api/endpoints.ts` → `getRecommendationsForSeeds`** — accept the profile (or a scoring
   fn), filter on `NEG_FLOOR`, and replace the final sort with the blended rank.
4. **Artist-tag resolution** — reuse/extend the existing tag cache; add `getArtistTags` batching if
   not already present (it exists in `lastfmClient`).

No new APIs, no new data sources.

---

## Parameters (initial values, all tunable)

| Param | Value | Meaning |
|---|---|---|
| `LIKE_GAIN` | +1.0 | per-tag gain on like |
| `SKIP_PENALTY` | 0.4 | per-tag penalty on skip (< like; noisier) |
| `GAMMA` | 0.5 | artist-affinity weight in scoring |
| `POS_DECAY` | 0.97 / week | slow decay of positive weights (sticky likes) |
| `NEG_DECAY` | 0.85 / week | fast decay of negative weights (forgiving skips) |
| `WEIGHT_CAP` | 8.0 | clamp so no tag dominates |
| `NEG_FLOOR` | -2.0 | below this tasteScore, drop the candidate |
| `MAX_TAGS_PER_TRACK` | 5 | cap tags considered per track/artist |
| `SEED_WEIGHT` | 0.5 | initial weight per onboarding-genre tag |
| `W_MATCH` | 0.6 | blend weight for existing match score |
| `W_TASTE` | 0.4 | blend weight for taste score |

---

## Testing strategy

- **Unit tests (no network)** on the pure functions in `tasteProfile.ts`:
  - `applyLike` / `applySkip` move weights the right direction and respect `WEIGHT_CAP`.
  - `decay` fades negatives ~2× faster than positives over a simulated week.
  - `scoreTrack` ranks a liked-tag track above a skipped-tag track; drops below `NEG_FLOOR`.
  - `seedFromGenres` produces the expected starting profile.
- **Integration** with a mocked artist-tag fetch: a profile trained to reject a tag removes matching
  candidates from `getRecommendationsForSeeds` output.
- **Manual device check:** skip several tracks of one genre; confirm that genre stops appearing even
  from new artists, and that likes of another genre surface more of it.

---

## Risks / open questions

- **Tag sparsity:** some artists return few/no Last.fm tags → tasteScore ≈ 0 (neutral). Acceptable;
  neutral candidates fall back to the existing match-score ordering.
- **Artist-tag coarseness:** an artist spanning genres gets one averaged tag set. Accepted tradeoff
  for cost; revisit with track tags if quality suffers.
- **Parameter tuning:** initial values are educated guesses; expect a tuning pass after device use.
- **Free-tier constraint:** all client-side + AsyncStorage; no Cloud Functions (Firebase Spark).
