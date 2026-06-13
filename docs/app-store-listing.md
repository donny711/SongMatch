# SongMatch — App Store Connect submission pack

Everything below is copy-paste ready for App Store Connect. Derived from the live
privacy policy (https://donny711.github.io/songmatch-legal/privacy.html) and verified
against the app code (auth, Sentry config, package.json) on 2026-06-13.

---

## 1. App Privacy ("nutrition labels")

Set these under **App Store Connect → your app → App Privacy**.

### Data Used to Track You
**None.** The app has no ads, no analytics SDKs, and no third-party tracking
(verified: nothing matching analytics/ads/attribution in package.json).
→ Answer "No" to tracking. **No App Tracking Transparency prompt is required.**

### Data Linked to You
| Apple data type | Category | Purpose | Source in app |
|---|---|---|---|
| Email Address | Contact Info | App Functionality | Email/password signup; Sign in with Apple |
| Name | Contact Info | App Functionality | Optional — only if user shares it via Sign in with Apple |
| Photos or Videos | User Content | App Functionality | Avatar + banner images (Supabase) |
| Other User Content | User Content | App Functionality | Username, display name |
| User ID | Identifiers | App Functionality | Firebase UID |
| Product Interaction | Usage Data | App Functionality, Product Personalization | Likes/skips, genres, taste profile, streaks/points/ranks, follows/blocks |

For every row above, answer: used for tracking = **No**, linked to identity = **Yes**.

### Data Not Linked to You
| Apple data type | Category | Purpose | Notes |
|---|---|---|---|
| Crash Data | Diagnostics | App Functionality | Sentry, `sendDefaultPii: false` — no user identity attached |
| Performance Data | Diagnostics | App Functionality | Sentry |
| Audio Data | User Content | App Functionality | Mic clip sent to AudD for song ID only; not stored, not linked |

**Audio Data note:** Apple's "optional disclosure" exception lets you omit data that is
user-initiated, disclosed in-context, not stored, not used for tracking, and not linked —
which the AudD identify feature meets. Declaring it as *Not Linked / App Functionality*
(as above) is the safe, honest choice; omitting it is also defensible. Don't mark it Linked.

---

## 2. Listing text

**App Name** (max 30): `SongMatch`

**Subtitle** (max 30): `Swipe to discover new music`

**Promotional Text** (max 170, editable anytime without review):
> Discover your next favorite song by swiping through 30-second previews. Build a taste profile, follow friends, and watch your music match score climb.

**Keywords** (max 100 chars, comma-separated, NO spaces):
`music,discovery,songs,swipe,playlist,recommend,taste,new music,tracks,artists,deezer,match,social,radio`

**Description** (max 4000):
```
SongMatch turns finding new music into something you actually look forward to.

Swipe through 30-second previews, like what you love, skip what you don't, and SongMatch learns your taste with every swipe. The more you listen, the sharper your recommendations get.

DISCOVER BY SWIPING
Tap into an endless feed of songs picked for you. Like a track to save it; skip to move on. Your taste profile updates instantly.

RECOMMENDATIONS THAT GET YOU
SongMatch blends real audio similarity with your listening history, favorite genres, and the artists you love — so the next song always feels like it belongs.

HEAR A SONG, FIND MORE LIKE IT
Use song identification to recognize what's playing around you, then dive straight into similar tracks.

BUILD YOUR PROFILE
Show off your liked songs, climb the ranks, keep daily streaks alive, and earn rewards as you discover.

CONNECT WITH LISTENERS
Follow other people, see what they're into, and compare taste. Full controls to block or report anyone keep the community friendly.

FREE, NO ADS
SongMatch is completely free. No ads, no tracking, no analytics — just music.

Music previews and metadata are provided by Deezer and Last.fm and are for private, personal listening only.
```

**Primary Category:** Music
**Secondary Category:** Social Networking

**Support URL:** `https://donny711.github.io/songmatch-legal/`
**Marketing URL** (optional): `https://donny711.github.io/songmatch-legal/`
**Privacy Policy URL:** `https://donny711.github.io/songmatch-legal/privacy.html`

> App Store Connect has no dedicated Terms of Service field. Terms live in-app and are
> linked from the privacy/landing pages: `https://donny711.github.io/songmatch-legal/terms.html`

---

## 3. Age rating

The app has user-generated content (profiles, usernames, images) and social features.
In the App Store Connect age-rating questionnaire:
- User-generated content: **Yes** — and confirm you have moderation (you do: in-app
  report with ~24h review, block, and create-only reports collection).
- No explicit/violent/gambling/contests content.

Expect this to land around **12+** (possibly higher depending on how the UGC questions
resolve). That's normal for a social discovery app.

---

## 4. Review-notes checklist (paste into "App Review Information → Notes")

```
- Sign in: create an account with email + password + username on the onboarding screen,
  or use Sign in with Apple (iOS).
- Music is 30-second previews from Deezer; full tracks are not hosted.
- Spotify connect is currently disabled for new users (shown as "coming soon") pending
  Spotify extended-quota approval.
- User-generated content (profiles/usernames/images) is moderated: every profile has
  Report and Block; reports are reviewed within 24 hours.
- Account deletion: Settings → Account → Delete Account (removes all data).
- No ads, no tracking, no in-app purchases.
```

## 5. Still needed from you (not draftable)
- **Screenshots** — 6.7" and 6.5" iPhone sizes minimum (App Store requires them).
- **App icon** — 1024×1024, already in the project if the build has one.
- **Demo account** — Apple reviewers need login creds; create a throwaway email account
  and paste it in App Review Information.
