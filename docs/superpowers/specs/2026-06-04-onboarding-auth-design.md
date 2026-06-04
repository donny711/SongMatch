# Onboarding Auth & Flow Redesign

## Overview

Add email/password authentication (sign up + log in) as the first step of onboarding. Expand genre selection from 14 to 26 genres. Move streak celebration to the last onboarding step.

## Onboarding Flow

### Sign Up Path (new user)
1. **Auth** — Sign Up tab: email, password, username
2. **Genres** — "What's your vibe?" (26 genres)
3. **Song** — "Got a favourite song?"
4. **Referral** — "Got an invite code?"
5. **Streak** — "+1 day!" celebration → Main App

### Log In Path (returning user)
1. **Auth** — Log In tab: email/username + password
2. **Streak** — Show if first use today (+1 for the day) → Main App
3. If already used today → skip straight to Main App

## Auth Screen

### Layout
- Tabbed UI: **Sign Up** | **Log In** tabs at the top
- Matches existing app theme (navy-dark OLED palette, theme.ts tokens)

### Sign Up Tab
- **Email** field
- **Password** field (with show/hide toggle)
- **Username** field
  - Helper text: "This is how others find you and how you log in"
  - Real-time validation:
    - Min 3 characters
    - Alphanumeric + underscores only
    - Must be unique (checked against Firestore)
    - Profanity filter (client-side word list)
- **"Create Account"** button

### Log In Tab
- **Email or Username** field (single input, auto-detect)
  - If input contains `@` → treat as email
  - Otherwise → look up email from Firestore `usernames` collection
- **Password** field
- **"Log In"** button
- **"Forgot password?"** link

### Forgot Password
1. User taps "Forgot password?"
2. Bottom sheet appears asking for email (or username → look up email from Firestore)
3. Firebase Auth sends password reset email
4. User resets in browser, returns to app to log in

## Username System

### Storage
- Firestore `usernames` collection: `{ username (doc ID) → userId }`
- Username stored on user's profile document as well

### Rules
- Min 3 characters
- Alphanumeric + underscores only
- Must be unique (case-insensitive)
- Profanity filtered (client-side word list checked before Firestore write)
- Username is permanent (or hard to change)

### Display
- Shown on profile page under the display name
- Styled smaller/lighter as `@username` in grey
- Display name and username are independent — display name can be changed freely

## Expanded Genres (26 total)

### Existing (14)
| Genre | Artists | Color |
|-------|---------|-------|
| Pop | Taylor Swift, Ed Sheeran, Dua Lipa | #EC4899 |
| Rock | Arctic Monkeys, Foo Fighters, The Killers | #EF4444 |
| Hip-Hop | Kendrick Lamar, Drake, J. Cole | #F59E0B |
| Electronic | Daft Punk, Calvin Harris, Disclosure | #22D3EE |
| R&B / Soul | The Weeknd, Frank Ocean, SZA | #A855F7 |
| Indie | Tame Impala, Vampire Weekend, Bon Iver | #84CC16 |
| Metal | Metallica, System of a Down, Tool | #94A3B8 |
| Jazz | Miles Davis, John Coltrane, Herbie Hancock | #F97316 |
| Country | Morgan Wallen, Chris Stapleton, Luke Combs | #D97706 |
| Latin | Bad Bunny, J Balvin, Maluma | #F43F5E |
| Classical | Ludovico Einaudi, Hans Zimmer, Max Richter | #60A5FA |
| Reggae | Bob Marley, Damian Marley, Chronixx | #22C55E |
| Dance | Calvin Harris, Kygo, Martin Garrix | #8B5CF6 |
| Blues | B.B. King, Eric Clapton, Gary Clark Jr. | #3B82F6 |

### New (12)
| Genre | Artists | Color |
|-------|---------|-------|
| Punk | Green Day, Blink-182, The Offspring | TBD |
| Alternative | Radiohead, Muse, Cage The Elephant | TBD |
| Trap | Travis Scott, Future, 21 Savage | TBD |
| Lo-fi | Nujabes, Joji, Idealism | TBD |
| K-Pop | BTS, BLACKPINK, Stray Kids | TBD |
| Afrobeats | Burna Boy, Wizkid, Rema | TBD |
| Phonk | Kordhell, Freddie Dredd, DVRST | TBD |
| Drill | Central Cee, Pop Smoke, Headie One | TBD |
| Folk | Hozier, Fleet Foxes, Mumford & Sons | TBD |
| Funk | Anderson .Paak, Bruno Mars, Vulfpeck | TBD |
| Disco | Doja Cat, Bee Gees, Nile Rodgers | TBD |
| Ambient | Brian Eno, Tycho, Boards of Canada | TBD |

Colors for new genres will be assigned during implementation to complement existing palette.

## Streak in Onboarding

### New Users (Sign Up)
- After referral step → streak celebration screen
- Uses existing `StreakCelebration` component/animation
- Shows "+1 day!" — "You're on your way!"
- Tap to continue → main app

### Returning Users (Log In)
- Skip genres/song/referral entirely
- If first use today → show streak with current count (+1)
- If already used today → go straight to main app

## Technical Implementation

### Firebase Auth
- `createUserWithEmailAndPassword()` for sign up
- `signInWithEmailAndPassword()` for log in
- `sendPasswordResetEmail()` for forgot password

### Firestore Schema
- `usernames/{username}` → `{ userId: string, createdAt: timestamp }`
- Username lookup for login: query `usernames` collection by doc ID

### Profanity Filter
- Client-side word list (array of blocked words/patterns)
- Check before attempting Firestore write
- Case-insensitive matching

### Files to Modify
- `app/onboarding.tsx` — Add auth step, streak step, update flow logic
- `src/utils/genres.ts` — Add 12 new genres with artists and colors
- `src/store/profileStore.ts` — Username field, login detection for streak
- `src/firebase/config.ts` — May need auth state listener updates
- New: profanity word list utility

## Migration Notes

### Anonymous Auth Transition
- Current app uses anonymous Firebase auth on first launch
- With this change: anonymous auth is no longer created during onboarding
- Users must sign up or log in before proceeding
- Existing anonymous users (pre-update) will see the auth screen on next app open if onboarding hasn't been completed

### Firestore Security Rules
- `usernames` collection: only authenticated users can create a doc, only if doc doesn't already exist
- Users can only create a username doc where `userId` matches their own auth UID

### Username Case Handling
- Usernames stored lowercase in `usernames` collection for uniqueness
- Original casing preserved on user's profile document for display
