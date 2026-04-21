import { create } from 'zustand';

export interface ToastItem {
  id: string;
  points: number;
  label: string;
}

interface ToastState {
  current: ToastItem | null;
  queue: ToastItem[];
  push: (points: number, label: string) => void;
  next: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  queue: [],
  push: (points, label) => {
    const item: ToastItem = { id: Math.random().toString(36).slice(2), points, label };
    if (!get().current) {
      set({ current: item });
    } else {
      set((s) => ({ queue: [...s.queue, item] }));
    }
  },
  next: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ current: next, queue: rest });
    } else {
      set({ current: null });
    }
  },
}));
