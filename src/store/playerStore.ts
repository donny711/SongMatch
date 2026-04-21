import { create } from 'zustand';

interface PlayerState {
  activePreviewUri: string | null;
  setActivePreviewUri: (uri: string | null) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  activePreviewUri: null,
  setActivePreviewUri: (uri) => set({ activePreviewUri: uri }),
}));
