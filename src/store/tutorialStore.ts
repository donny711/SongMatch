import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOTAL_STEPS } from '../components/tutorial/tutorialSteps';

const TUTORIAL_KEY = 'sm_tutorial_complete';
const ONBOARDING_KEY = 'sm_onboarding_complete';

interface TutorialState {
  isComplete: boolean;
  isActive: boolean;
  currentStep: number;
  start: () => void;
  next: () => void;
  skip: () => void;
  complete: () => void;
  replay: () => void;
  load: () => Promise<void>;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  isComplete: false,
  isActive: false,
  currentStep: 0,

  start: () => set({ isActive: true, currentStep: 0 }),

  next: () => {
    const { currentStep } = get();
    if (currentStep >= TOTAL_STEPS - 1) {
      get().complete();
    } else {
      set({ currentStep: currentStep + 1 });
    }
  },

  skip: () => {
    set({ isActive: false, isComplete: true });
    AsyncStorage.setItem(TUTORIAL_KEY, '1');
  },

  complete: () => {
    set({ isActive: false, isComplete: true });
    AsyncStorage.setItem(TUTORIAL_KEY, '1');
  },

  replay: () => {
    AsyncStorage.removeItem(TUTORIAL_KEY);
    set({ isComplete: false, isActive: true, currentStep: 0 });
  },

  load: async () => {
    try {
      const done = await AsyncStorage.getItem(TUTORIAL_KEY);
      if (done === '1') {
        set({ isComplete: true });
        return;
      }
      const onboarded = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (onboarded === '1') {
        // Onboarding done but tutorial not — will auto-start when home mounts
        set({ isComplete: false });
      }
    } catch {}
  },
}));
