// Proxy URL is public by design (it ships in every JS bundle; all secrets stay
// inside the worker). Hardcoded default so a missing CI env var can never
// silently ship a build with no proxy.
export const MUSIC_PROXY_URL =
  process.env.EXPO_PUBLIC_MUSIC_PROXY_URL || 'https://songmatch-proxy.radupopa214.workers.dev';

export const PRIVACY_POLICY_URL = 'https://donny711.github.io/songmatch-legal/privacy.html';

export const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '';
export const FIREBASE_AUTH_DOMAIN = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '';
export const FIREBASE_PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '';
export const FIREBASE_STORAGE_BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';
export const FIREBASE_MESSAGING_SENDER_ID = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '';
export const FIREBASE_APP_ID = process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '';

export const SWIPE_THRESHOLD = 120;
export const SWIPE_VELOCITY_THRESHOLD = 800;
export const DECK_REFETCH_AT = 3;
