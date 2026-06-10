import { useEffect } from 'react';
import { useAuthRequest, ResponseType } from 'expo-auth-session';
import { router } from 'expo-router';
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPES,
  SPOTIFY_TOKEN_URL,
} from '../utils/constants';
import { TokenStorage } from './TokenStorage';
import { useAuthStore } from '../store/authStore';
import { useDeckStore } from '../store/deckStore';
import { getMe } from '../api/endpoints';
import { migrateSpotifyProfile } from '../firebase/profileService';

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: SPOTIFY_TOKEN_URL,
};

export function useSpotifyAuth() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const addPlatform = useAuthStore((s) => s.addPlatform);

  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SPOTIFY_SCOPES.split(' '),
      redirectUri: SPOTIFY_REDIRECT_URI,
      usePKCE: true,
    },
    discovery,
  );


  useEffect(() => {
    if (response?.type !== 'success') return;
    const { code } = response.params;
    if (!code || !request?.codeVerifier) return;

    (async () => {
      const bodyStr = [
        `grant_type=authorization_code`,
        `code=${encodeURIComponent(code)}`,
        `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}`,
        `client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}`,
        `code_verifier=${encodeURIComponent(request.codeVerifier ?? '')}`,
      ].join('&');

      const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyStr,
      });

      if (!tokenRes.ok) return;
      const data = await tokenRes.json();

      await TokenStorage.saveTokens(data.access_token, data.refresh_token);
      setAccessToken(data.access_token);

      const user = await getMe();
      setUser(user);
      addPlatform('spotify');
      await useDeckStore.getState().loadForUser(user.id);

      // Grant Spotify milestone and initialize profile with Spotify ID
      const { useProfileStore } = await import('../store/profileStore');
      await useProfileStore.getState().initialize(user.id);

      // One-time migration: if the user had a profile stored under their Spotify
      // UID (before Firebase Auth was added), move it to the Firebase Auth UID.
      const currentUid = useProfileStore.getState().uid;
      if (currentUid && currentUid !== user.id) {
        await migrateSpotifyProfile(user.id, currentUid);
        // The onSnapshot listener will automatically sync the migrated data.
      }

      useProfileStore.getState().grantMilestone('ms_connect_spotify');
      if (useAuthStore.getState().connectedPlatforms.includes('soundcloud')) {
        useProfileStore.getState().grantMilestone('ms_two_platforms');
      }

      router.replace('/(tabs)/home');
    })();
  }, [response]);

  return { request, promptAsync };
}
