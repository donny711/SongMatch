import { create } from 'zustand';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayISO } from '../utils/dateUtils';

const DAILY_SEARCH_KEY = 'songmatch_daily_searches_v12';
const FREE_DAILY_LIMIT = 999; // effectively unlimited during non-commercial phase

export const RC_PRODUCTS = {
  monthly: 'songmatch_pro_monthly',
  quarterly: 'songmatch_pro_quarterly',
  annual: 'songmatch_pro_annual',
} as const;

export type ProTier = 'monthly' | 'quarterly' | 'annual';

interface DailySearchState {
  count: number;
  date: string;
  bonusGranted: boolean;
}

interface SubscriptionState {
  isPro: boolean;
  tier: ProTier | null;
  expiresAt: Date | null;
  isLoading: boolean;

  dailySearchCount: number;
  dailyBonusGranted: boolean;
  searchesRemaining: number;

  initialize: (uid: string) => Promise<void>;
  purchase: (tier: ProTier) => Promise<void>;
  restore: () => Promise<void>;
  recordSearch: () => Promise<boolean>;
  refreshDaily: () => Promise<void>;
  syncFromFirestore: (uid: string) => Promise<void>;
}

async function loadDailyState(): Promise<DailySearchState> {
  const today = todayISO();
  try {
    const raw = await AsyncStorage.getItem(DAILY_SEARCH_KEY);
    if (raw) {
      const parsed: DailySearchState = JSON.parse(raw);
      if (parsed.date === today) return parsed;
    }
  } catch {}
  return { count: 0, date: today, bonusGranted: false };
}

async function saveDailyState(state: DailySearchState): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_SEARCH_KEY, JSON.stringify(state));
  } catch {}
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPro: false,
  tier: null,
  expiresAt: null,
  isLoading: false,

  dailySearchCount: 0,
  dailyBonusGranted: false,
  searchesRemaining: FREE_DAILY_LIMIT,

  initialize: async (_uid: string) => {
    const daily = await loadDailyState();
    set({
      dailySearchCount: daily.count,
      dailyBonusGranted: daily.bonusGranted,
      searchesRemaining: FREE_DAILY_LIMIT - daily.count,
    });
  },

  purchase: async (_tier: ProTier) => {
    Alert.alert('Coming Soon', 'Pro subscriptions are not available yet. Stay tuned!');
  },

  restore: async () => {
    Alert.alert('Coming Soon', 'Pro subscriptions are not available yet.');
  },

  recordSearch: async () => {
    const { dailySearchCount } = get();
    if (dailySearchCount >= FREE_DAILY_LIMIT) return false;
    const newCount = dailySearchCount + 1;
    const daily: DailySearchState = {
      count: newCount,
      date: todayISO(),
      bonusGranted: get().dailyBonusGranted,
    };
    await saveDailyState(daily);
    set({ dailySearchCount: newCount, searchesRemaining: FREE_DAILY_LIMIT - newCount });
    return true;
  },

  refreshDaily: async () => {
    const daily = await loadDailyState();
    set({
      dailySearchCount: daily.count,
      dailyBonusGranted: daily.bonusGranted,
      searchesRemaining: FREE_DAILY_LIMIT - daily.count,
    });
  },

  syncFromFirestore: async (_uid: string) => {},
}));
