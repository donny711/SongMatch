// Pure decision logic for re-engagement notifications. No expo/React Native
// imports — fully unit-testable. The coordinator feeds it current state and
// schedules whatever it returns.

export type NudgeId = 'inactivity-3d' | 'inactivity-7d' | 'streak';

export type NudgeTrigger =
  | { type: 'delay'; seconds: number }        // fire once, N seconds from scheduling
  | { type: 'clock'; hour: number; minute: number }; // fire at the next local HH:MM

export interface Nudge {
  id: NudgeId;
  body: string;
  trigger: NudgeTrigger;
}

export interface ReengagementState {
  /** notificationsEnabled setting AND OS permission granted. */
  enabled: boolean;
  currentStreak: number;
  /** whether the daily streak check-in already happened today. */
  checkedInToday: boolean;
}

/** All notification identifiers this feature owns (for cancel-before-reschedule). */
export const MANAGED_IDS: NudgeId[] = ['inactivity-3d', 'inactivity-7d', 'streak'];

const DAY = 24 * 3600;
const STREAK_HOUR = 20; // 8pm local

/**
 * Decide which nudges should be pending given current state.
 * Called on every app foreground/background; the coordinator cancels MANAGED_IDS
 * first, then schedules exactly this set — so it stays idempotent.
 */
export function computeNudges(s: ReengagementState): Nudge[] {
  if (!s.enabled) return [];

  const nudges: Nudge[] = [
    {
      id: 'inactivity-3d',
      body: 'Your next favorite song is waiting 🎧',
      trigger: { type: 'delay', seconds: 3 * DAY },
    },
    {
      id: 'inactivity-7d',
      body: 'New music picked for you — come take a listen',
      trigger: { type: 'delay', seconds: 7 * DAY },
    },
  ];

  // Streak reminder only for users with something to protect, and only if they
  // haven't already checked in today. The 8pm-vs-tomorrow rollover is handled by
  // the OS-level daily/clock trigger, so this stays a simple clock time.
  if (s.currentStreak >= 1 && !s.checkedInToday) {
    nudges.push({
      id: 'streak',
      body: `🔥 Keep your ${s.currentStreak}-day streak alive — check in before midnight`,
      trigger: { type: 'clock', hour: STREAK_HOUR, minute: 0 },
    });
  }

  return nudges;
}
