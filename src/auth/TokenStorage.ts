import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'spotify_access_token';
const REFRESH_KEY = 'spotify_refresh_token';
const SC_ACCESS_KEY = 'soundcloud_access_token';
const SC_REFRESH_KEY = 'soundcloud_refresh_token';

export const TokenStorage = {
  saveTokens: async (accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  },
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_KEY),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY),
  clearTokens: async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },

  saveSoundCloudTokens: async (accessToken: string, refreshToken: string | null) => {
    await SecureStore.setItemAsync(SC_ACCESS_KEY, accessToken);
    if (refreshToken) await SecureStore.setItemAsync(SC_REFRESH_KEY, refreshToken);
  },
  getSoundCloudAccessToken: () => SecureStore.getItemAsync(SC_ACCESS_KEY),
  clearSoundCloudTokens: async () => {
    await SecureStore.deleteItemAsync(SC_ACCESS_KEY);
    await SecureStore.deleteItemAsync(SC_REFRESH_KEY);
  },
};
