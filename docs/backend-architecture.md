# Backend architecture decision

**Decided 2026-06-10.** SongMatch uses two backend services with a hard boundary:

| Concern | Service | Why |
|---|---|---|
| Auth, user data, social graph, likes, referrals, leaderboards | **Firebase** (Auth + Firestore + Cloud Functions, `europe-west1`) | Already the system of record for everything relational |
| Profile **image blobs only** (avatar, banner, gif-bg) | **Supabase Storage** (`profile-images` bucket) | Free-tier object storage + CDN; Firebase Storage requires Blaze billing |

## The rules

1. **Firestore is the only database.** No user data, counters, or app state
   ever go to Supabase tables. The Supabase client exists solely so
   `src/firebase/storageService.ts` can upload images and produce public URLs.
2. **Supabase output is just a URL string.** The resulting public URL is stored
   in Firestore (`avatarUrl`, `bannerUrl`); nothing else in the app reads from
   or writes to Supabase.
3. **New features default to Firebase.** Adding any `@supabase/supabase-js`
   import outside `src/supabase/config.ts` and `src/firebase/storageService.ts`
   needs a deliberate decision, not convenience.
4. **Do not remove Supabase** without migrating the `profile-images` bucket and
   rewriting every stored URL in Firestore.

## Current boundary (verified 2026-06-10)

Only two files reference Supabase:

- `src/supabase/config.ts` — client + bucket name
- `src/firebase/storageService.ts` — `uploadProfileImage()`

If that list grows, re-read rule 3.
