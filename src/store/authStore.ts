import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SpotifyUser } from '../api/types';

export type MusicPlatform = 'spotify' | 'apple_music' | 'soundcloud';

export type SoundCloudUser = {
  id: number;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

const PLATFORMS_KEY = 'sm_connected_platforms';

interface AuthState {
  accessToken: string | null;
  user: SpotifyUser | null;
  soundCloudUser: SoundCloudUser | null;
  connectedPlatforms: MusicPlatform[];
  setAccessToken: (token: string | null) => void;
  setUser: (user: SpotifyUser | null) => void;
  setSoundCloudUser: (user: SoundCloudUser | null) => void;
  logout: () => void;
  addPlatform: (p: MusicPlatform) => void;
  removePlatform: (p: MusicPlatform) => void;
  loadPlatforms: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  soundCloudUser: null,
  connectedPlatforms: [],

  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  setSoundCloudUser: (user) => set({ soundCloudUser: user }),

  logout: () => {
    const platforms = get().connectedPlatforms.filter((p) => p !== 'spotify');
    set({ accessToken: null, user: null, connectedPlatforms: platforms });
    AsyncStorage.setItem(PLATFORMS_KEY, JSON.stringify(platforms));
  },

  addPlatform: (p) => {
    const current = get().connectedPlatforms;
    if (current.includes(p)) return;
    const updated = [...current, p];
    set({ connectedPlatforms: updated });
    AsyncStorage.setItem(PLATFORMS_KEY, JSON.stringify(updated));
  },

  removePlatform: (p) => {
    const updated = get().connectedPlatforms.filter((x) => x !== p);
    set({ connectedPlatforms: updated });
    AsyncStorage.setItem(PLATFORMS_KEY, JSON.stringify(updated));
  },

  loadPlatforms: async () => {
    try {
      const raw = await AsyncStorage.getItem(PLATFORMS_KEY);
      if (raw) set({ connectedPlatforms: JSON.parse(raw) });
    } catch {}
  },
}));
