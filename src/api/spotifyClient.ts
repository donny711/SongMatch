import { SPOTIFY_API_BASE, SPOTIFY_TOKEN_URL, SPOTIFY_CLIENT_ID } from '../utils/constants';
import { useAuthStore } from '../store/authStore';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'spotify_access_token';
const REFRESH_TOKEN_KEY = 'spotify_refresh_token';

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = [
    `grant_type=refresh_token`,
    `refresh_token=${encodeURIComponent(refreshToken)}`,
    `client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}`,
  ].join('&');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Token refresh failed');

    const data = await res.json();
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.access_token);
    if (data.refresh_token) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    useAuthStore.getState().setAccessToken(data.access_token);
    return data.access_token;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
}

export async function spotifyFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  let token = useAuthStore.getState().accessToken;

  if (!token) {
    token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token) useAuthStore.getState().setAccessToken(token);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401 && !retried) {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error('No refresh token — please log in again');
      const newToken = await refreshAccessToken(refreshToken);
      useAuthStore.getState().setAccessToken(newToken);
      return spotifyFetch<T>(path, options, true);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Spotify API error ${res.status}`);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
}
