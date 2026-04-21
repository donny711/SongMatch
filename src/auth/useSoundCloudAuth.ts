import { useEffect } from 'react';
import { useAuthRequest, ResponseType } from 'expo-auth-session';
import {
  SOUNDCLOUD_CLIENT_ID,
  SOUNDCLOUD_CLIENT_SECRET,
  SOUNDCLOUD_REDIRECT_URI,
  SOUNDCLOUD_TOKEN_URL,
} from '../utils/constants';
import { TokenStorage } from './TokenStorage';
import { useAuthStore } from '../store/authStore';

const discovery = {
  authorizationEndpoint: 'https://soundcloud.com/connect',
  tokenEndpoint: SOUNDCLOUD_TOKEN_URL,
};

export function useSoundCloudAuth() {
  const addPlatform = useAuthStore((s) => s.addPlatform);
  const setSoundCloudUser = useAuthStore((s) => s.setSoundCloudUser);

  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: SOUNDCLOUD_CLIENT_ID,
      redirectUri: SOUNDCLOUD_REDIRECT_URI,
      usePKCE: false,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success') return;
    const { code } = response.params;
    if (!code) return;

    (async () => {
      const body = [
        `grant_type=authorization_code`,
        `code=${encodeURIComponent(code)}`,
        `redirect_uri=${encodeURIComponent(SOUNDCLOUD_REDIRECT_URI)}`,
        `client_id=${encodeURIComponent(SOUNDCLOUD_CLIENT_ID)}`,
        `client_secret=${encodeURIComponent(SOUNDCLOUD_CLIENT_SECRET)}`,
      ].join('&');

      const tokenRes = await fetch(SOUNDCLOUD_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!tokenRes.ok) return;
      const data = await tokenRes.json();

      await TokenStorage.saveSoundCloudTokens(data.access_token, data.refresh_token ?? null);

      const meRes = await fetch('https://api.soundcloud.com/me', {
        headers: { Authorization: `OAuth ${data.access_token}` },
      });
      if (!meRes.ok) return;
      const me = await meRes.json();

      setSoundCloudUser({
        id: me.id,
        username: me.username,
        full_name: me.full_name ?? me.username,
        avatar_url: me.avatar_url ?? null,
      });
      addPlatform('soundcloud');

      // Grant SoundCloud milestone
      const { useProfileStore } = await import('../store/profileStore');
      useProfileStore.getState().grantMilestone('ms_connect_soundcloud');
      if (useAuthStore.getState().connectedPlatforms.includes('spotify')) {
        useProfileStore.getState().grantMilestone('ms_two_platforms');
      }
    })();
  }, [response]);

  return { request, promptAsync };
}
