# Re-engagement Notifications (Phase 1) — Design

**Date:** 2026-07-03
**Status:** Approved design, pre-implementation
**Scope:** Phase 1 of push notifications — **local, on-device re-engagement nudges only.**

---

## Why this exists

The top job pre-launch is getting users to come *back and swipe*. Local scheduled
notifications drive that directly, and — critically — they need **no server, no APNs key, no
push token**. That sidesteps the Firebase Spark-plan constraint (no Cloud Functions) entirely.

### Out of scope (Phase 2, separate spec)
- Social event pushes ("someone liked your song", new follower/match) — require a trigger from
  another user's action. Planned approach: a **Cloudflare Worker cron** polling Firestore and
  batching Expo pushes. Needs push-token registration + APNs. Not built here.
- Broadcast/announcement pushes.
- Remote push of any kind. Phase 1 is 100% local notifications.

---

## Architecture

- **Dependencies:** `expo-notifications`, `expo-device`. Local notifications require **no** Apple
  push entitlement/APNs key.
- **`src/notifications/notificationService.ts`** — thin wrapper over expo-notifications:
  - `configureHandler()` — foreground presentation + tap→route to the home deck.
  - `ensurePermission()` — request iOS permission; returns granted/denied.
  - `schedule<Nudge>()` / `cancel(id)` — each nudge scheduled under a **stable string identifier**
    so re-scheduling replaces rather than duplicates.
  - `cancelAll()`.
- **`src/notifications/reengagement.ts`** — the **pure decision logic**: given
  `{ enabled, permission, currentStreak, checkedInToday, deckExhausted }`, returns the set of
  nudges to schedule (id + trigger + body). No expo calls — unit-testable in isolation.
- **Coordinator** in `app/_layout.tsx` via an `AppState` listener:
  - on **background/inactive** → compute nudges from current `deckStore` + profile state and
    schedule them.
  - on **active (foreground)** → cancel the "come back" nudges (`inactivity-3d`, `inactivity-7d`,
    `feed-ready`); the user is here.
- **Settings gate:** `notificationsEnabled: boolean` added to `settingsStore` (persisted in
  AsyncStorage `sm_settings`, mirrors `autoPlayPreviews`). A toggle row in `settings.tsx`.
  When off, the coordinator cancels everything and schedules nothing.

---

## The three nudges

Fixed identifiers (so reschedule = replace):

| id | Trigger | Timing | Body |
|---|---|---|---|
| `inactivity-3d` | app background | now + **3 days** | "Your next favorite song is waiting 🎧" |
| `inactivity-7d` | app background | now + **7 days** | "New music picked for you — come take a listen" |
| `streak` | app background, **only if `currentStreak ≥ 1`** and not yet checked in today | next **8:00pm local**; if already past 8pm today, tomorrow 8pm | "🔥 Keep your {N}-day streak alive — check in before midnight" |
| `feed-ready` | deck reaches the exhausted / "all caught up" state | now + **8 hours** | "Fresh tracks just dropped for you" |

**Anti-spam by construction:**
- Active-streak users open daily, so the app foregrounds daily → `inactivity-*` timers reset and
  never fire.
- `streak` is skipped when `currentStreak = 0` (nothing to protect).
- `feed-ready` only arises from an explicit exhaustion event and is canceled the moment they return
  and swipe.
- On every foreground the come-back nudges are canceled first, then re-scheduled on next
  background — so at most one of each id is ever pending.

---

## Permission UX

- **Not** requested on first launch. Requested **right after onboarding completes**
  (`app/onboarding.tsx` final step): a soft prime ("Want a nudge when fresh music is ready?") →
  on accept, call `ensurePermission()` (system prompt) and set `notificationsEnabled = true`.
- Re-enableable any time via the settings toggle (which calls `ensurePermission()` if not yet
  granted, and deep-links to iOS Settings if permission was previously denied at the OS level).
- Denial is respected silently — no re-prompting, no nagging.

---

## Data flow

1. Onboarding finishes → prime → `ensurePermission()` → `notificationsEnabled = true`.
2. App backgrounds → coordinator reads `settingsStore.notificationsEnabled`, profile
   `currentStreak` + `lastActiveDate` (→ `checkedInToday`), and `deckStore` exhaustion → calls
   `reengagement.computeNudges(...)` → schedules each returned nudge.
3. App foregrounds → cancel come-back nudges. `updateStreak()` (existing) runs on first open of the
   day, which the coordinator uses to decide the `streak` nudge next time it backgrounds.
4. Deck exhausts → schedule `feed-ready`. User swipes again → cancel `feed-ready`.
5. Tap a notification → handler routes to the home deck.

---

## Error handling

- No permission / `notificationsEnabled = false` → schedule nothing; `cancelAll()`.
- expo-notifications throwing (simulator, odd OS state) → swallow and no-op; never crash the app
  lifecycle.
- Scheduling is idempotent via fixed identifiers — safe to run on every background.

---

## Testing

- **Unit (no device):** `reengagement.computeNudges` — table of `{state} → {expected nudge ids +
  triggers}`: streak skipped at 0, streak included ≥1, 8pm-vs-next-day rollover, come-back nudges
  present, `feed-ready` only when exhausted, empty set when disabled.
- **Manual device:** permission prime after onboarding; background the app and fast-forward device
  clock / use short test intervals to confirm delivery; tap routes to deck; settings toggle
  cancels all.

---

## Touch points

1. `package.json` — add `expo-notifications`, `expo-device`; `app.json` — add the
   `expo-notifications` plugin (icon/color).
2. New `src/notifications/notificationService.ts` and `src/notifications/reengagement.ts`.
3. `src/store/settingsStore.ts` — add `notificationsEnabled` (+ setter, load default `false`).
4. `app/_layout.tsx` — AppState coordinator + `configureHandler()` on mount.
5. `app/onboarding.tsx` — permission prime on completion.
6. `app/settings.tsx` (or the settings screen) — toggle row.
7. Deck exhaustion hook (`useRecommendations` / home empty-state) — fire `feed-ready` schedule.

No server, no APNs, no Firestore changes.
