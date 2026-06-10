import { makeRedirectUri } from 'expo-auth-session';

export const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
export const SPOTIFY_REDIRECT_URI = makeRedirectUri({ native: 'songmatch://callback' });

// Request ONLY scopes with live call sites — unused scopes are the top
// rejection reason in Spotify's extended-quota review.
export const SPOTIFY_SCOPES = [
  'user-read-private',           // /me — account display name for the profile screen
  'playlist-read-private',       // playlist browser + playlist-seeded recommendations
  'playlist-read-collaborative', // include collaborative playlists in the browser
  'user-top-read',               // top tracks as recommendation seeds
].join(' ');

export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export const SOUNDCLOUD_CLIENT_ID = process.env.EXPO_PUBLIC_SOUNDCLOUD_CLIENT_ID ?? '';
export const SOUNDCLOUD_CLIENT_SECRET = process.env.EXPO_PUBLIC_SOUNDCLOUD_CLIENT_SECRET ?? '';
export const SOUNDCLOUD_REDIRECT_URI = makeRedirectUri();
export const SOUNDCLOUD_TOKEN_URL = 'https://api.soundcloud.com/oauth2/token';

export const AUDD_API_TOKEN = process.env.EXPO_PUBLIC_AUDD_API_TOKEN ?? '';
export const LASTFM_API_KEY = process.env.EXPO_PUBLIC_LASTFM_API_KEY ?? '';
export const MUSIC_PROXY_URL = process.env.EXPO_PUBLIC_MUSIC_PROXY_URL ?? '';

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
