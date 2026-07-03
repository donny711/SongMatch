// Bridges app state → notification scheduling. Reads the settings + profile
// stores, asks reengagement.ts what should be pending, and cancels-then-reschedules
// the managed set. Safe to call on every app foreground/background.

import { useSettingsStore } from '../store/settingsStore';
import { useProfileStore } from '../store/profileStore';
import { computeNudges, MANAGED_IDS } from './reengagement';
import { hasPermission, cancelNudges, scheduleNudge } from './notificationService';
import { todayISO } from '../utils/localDate';

export async function syncReengagementNotifications(): Promise<void> {
  try {
    // Cancel first so a disabled/denied state clears everything.
    await cancelNudges(MANAGED_IDS);

    if (!useSettingsStore.getState().notificationsEnabled) return;
    if (!(await hasPermission())) return;

    const { currentStreak, lastActiveDate } = useProfileStore.getState();
    const nudges = computeNudges({
      enabled: true,
      currentStreak,
      checkedInToday: lastActiveDate === todayISO(),
    });

    for (const n of nudges) await scheduleNudge(n);
  } catch {
    // never let notification scheduling break the app lifecycle
  }
}
