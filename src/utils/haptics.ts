import * as Haptics from 'expo-haptics';

// Light tap - frequent button presses (trash, open-in-app, action buttons)
export const lightTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Medium impact - swipe completion (left or right)
export const swipeConfirm = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// Heavy impact - reserved for future use (e.g. match events)
export const heavyTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
