import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GenreShiftAfter = 3 | 5 | 10;

interface SettingsState {
  genreShiftAfter: GenreShiftAfter;
  autoPlayPreviews: boolean;
  setGenreShiftAfter: (v: GenreShiftAfter) => void;
  setAutoPlayPreviews: (v: boolean) => void;
  load: () => Promise<void>;
}

const SETTINGS_KEY = 'sm_settings';

async function persist(patch: Partial<Pick<SettingsState, 'genreShiftAfter' | 'autoPlayPreviews'>>) {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  const current = raw ? JSON.parse(raw) : {};
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }));
}

export const useSettingsStore = create<SettingsState>((set) => ({
  genreShiftAfter: 5,
  autoPlayPreviews: true,

  setGenreShiftAfter: (v) => {
    set({ genreShiftAfter: v });
    persist({ genreShiftAfter: v });
  },

  setAutoPlayPreviews: (v) => {
    set({ autoPlayPreviews: v });
    persist({ autoPlayPreviews: v });
  },

  load: async () => {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    set({
      genreShiftAfter: saved.genreShiftAfter ?? 5,
      autoPlayPreviews: saved.autoPlayPreviews ?? true,
    });
  },
}));
