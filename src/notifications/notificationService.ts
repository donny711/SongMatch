// Thin wrapper over expo-notifications. Knows nothing about app state/stores —
// it just configures, asks permission, and schedules/cancels by identifier.
// Every call swallows errors so notification plumbing can never crash the app.

import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import type { Nudge } from './reengagement';

/** How a delivered notification is presented while the app is foregrounded. */
export function configureHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Current OS permission, without prompting. */
export async function hasPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Prompt for permission if not already granted. No-op (false) on simulators. */
export async function ensurePermission(): Promise<boolean> {
  try {
    if (!Device.isDevice) return false;
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Soft pre-permission prime, then the real OS prompt on accept. Returns whether
 * permission ended up granted. Used at the end of onboarding.
 */
export function primeNotificationPermission(): Promise<boolean> {
  return new Promise((res) => {
    Alert.alert(
      'Stay in the loop?',
      "We'll nudge you when it's time to discover fresh music and keep your streak alive.",
      [
        { text: 'Not now', style: 'cancel', onPress: () => res(false) },
        { text: 'Enable', onPress: async () => res(await ensurePermission()) },
      ],
    );
  });
}

function toTrigger(n: Nudge): Notifications.NotificationTriggerInput {
  if (n.trigger.type === 'delay') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: n.trigger.seconds,
      repeats: false,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: n.trigger.hour,
    minute: n.trigger.minute,
  };
}

/** Schedule (or replace, since the identifier is stable) a single nudge. */
export async function scheduleNudge(n: Nudge): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: 'SongMatch', body: n.body },
      trigger: toTrigger(n),
    });
  } catch {
    // best-effort
  }
}

export async function cancelNudges(ids: string[]): Promise<void> {
  try {
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  } catch {
    // best-effort
  }
}

/** Route a notification tap to a handler (all nudges open the home deck). */
export function addTapListener(onTap: () => void): { remove: () => void } {
  const sub = Notifications.addNotificationResponseReceivedListener(() => onTap());
  return { remove: () => sub.remove() };
}
