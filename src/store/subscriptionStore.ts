import { create } from 'zustand';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSubscriptionFromFirestore,
  saveSubscriptionToFirestore,
  type SubscriptionRecord,
} from '../firebase/subscriptionService';

const RC_AVAILABLE = !!NativeModules.RNPurchases;

const DAILY_SEARCH_KEY = 'songmatch_daily_searches_v7';
const FREE_DAILY_LIMIT = 5;
const REWARDED_BONUS = 2;

// RevenueCat product IDs — must match App Store Connect & RevenueCat dashboard
export const RC_PRODUCTS = {
  monthly: 'songmatch_pro_monthly',
  quarterly: 'songmatch_pro_quarterly',
  annual: 'songmatch_pro_annual',
} as const;

export type ProTier = 'monthly' | 'quarterly' | 'annual';

interface DailySearchState {
  count: number;
  date: string; // ISO date string YYYY-MM-DD
  bonusGranted: boolean; // rewarded ad bonus already used today
}

interface SubscriptionState {
  isPro: boolean;
  tier: ProTier | null;
  expiresAt: Date | null;
  isLoading: boolean;

  // Daily search tracking (free users)
  dailySearchCount: number;
  dailyBonusGranted: boolean;
  searchesRemaining: number; // computed

  // Actions
  initialize: (uid: string) => Promise<void>;
  refreshFromStore: () => Promise<void>;
  purchase: (tier: ProTier) => Promise<void>;
  restore: () => Promise<void>;
  recordSearch: () => Promise<boolean>; // returns false if limit hit
  grantSearchBonus: () => Promise<void>; // called after rewarded ad
  restoreSearches: (n: number) => Promise<void>; // give back n searches
  refreshDaily: () => Promise<void>; // re-sync daily count (call on app foreground / screen focus)
  syncFromFirestore: (uid: string) => Promise<void>;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadDailyState(): Promise<DailySearchState> {
  const today = todayISO();
  try {
    const raw = await AsyncStorage.getItem(DAILY_SEARCH_KEY);
    if (raw) {
      const parsed: DailySearchState = JSON.parse(raw);
      if (parsed.date === today) return parsed;
    }
  } catch {
    // ignore
  }
  return { count: 0, date: today, bonusGranted: false };
}

async function saveDailyState(state: DailySearchState): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_SEARCH_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPro: false,
  tier: null,
  expiresAt: null,
  isLoading: false,
  dailySearchCount: 0,
  dailyBonusGranted: false,
  searchesRemaining: FREE_DAILY_LIMIT,

  initialize: async (uid: string) => {
    set({ isLoading: true });
    try {
      // Load daily search state
      const daily = await loadDailyState();
      const maxSearches = FREE_DAILY_LIMIT + (daily.bonusGranted ? REWARDED_BONUS : 0);
      set({
        dailySearchCount: daily.count,
        dailyBonusGranted: daily.bonusGranted,
        searchesRemaining: Math.max(0, maxSearches - daily.count),
      });

      // Try RevenueCat if available
      if (RC_AVAILABLE) {
        try {
          const Purchases = require('react-native-purchases').default;
          const apiKey = Platform.select({
            ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
            android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
            default: '',
          })!;
          if (apiKey) {
            await Purchases.configure({ apiKey, appUserID: uid });
            const info = await Purchases.getCustomerInfo();
            const activeEntitlements = info.entitlements.active;
            const isPro = !!activeEntitlements['pro'];
            let tier: ProTier | null = null;
            if (isPro) {
              const firstEntitlement = Object.values(activeEntitlements)[0] as any;
              const productId: string = firstEntitlement?.productIdentifier ?? '';
              if (productId.includes('monthly')) tier = 'monthly';
              else if (productId.includes('quarterly')) tier = 'quarterly';
              else if (productId.includes('annual')) tier = 'annual';
            }
            const firstActive = Object.values(activeEntitlements)[0] as any;
            const expiresAt = isPro
              ? new Date(firstActive?.expirationDate ?? '')
              : null;
            set({ isPro, tier, expiresAt });
            await saveSubscriptionToFirestore(uid, { isPro, tier, expiresAt });
          }
        } catch {
          // Fall back to Firestore
          await get().syncFromFirestore(uid);
        }
      } else {
        await get().syncFromFirestore(uid);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  refreshDaily: async () => {
    if (get().isPro) return;
    const daily = await loadDailyState();
    const maxSearches = FREE_DAILY_LIMIT + (daily.bonusGranted ? REWARDED_BONUS : 0);
    set({
      dailySearchCount: daily.count,
      dailyBonusGranted: daily.bonusGranted,
      searchesRemaining: Math.max(0, maxSearches - daily.count),
    });
  },

  syncFromFirestore: async (uid: string) => {
    try {
      const record = await getSubscriptionFromFirestore(uid);
      if (record) {
        const expiresAt = record.expiresAt ? new Date(record.expiresAt) : null;
        const isPro = record.isPro && (!expiresAt || expiresAt > new Date());
        set({ isPro, tier: record.tier ?? null, expiresAt });
      }
    } catch {
      // Non-critical
    }
  },

  refreshFromStore: async () => {
    if (!RC_AVAILABLE) return;
    try {
      const Purchases = require('react-native-purchases').default;
      const info = await Purchases.getCustomerInfo();
      const activeEntitlements = info.entitlements.active;
      const isPro = !!activeEntitlements['pro'];
      let tier: ProTier | null = null;
      if (isPro) {
        const firstEntitlement = Object.values(activeEntitlements)[0] as any;
        const productId: string = firstEntitlement?.productIdentifier ?? '';
        if (productId.includes('monthly')) tier = 'monthly';
        else if (productId.includes('quarterly')) tier = 'quarterly';
        else if (productId.includes('annual')) tier = 'annual';
      }
      set({ isPro, tier });
    } catch {
      // Non-critical
    }
  },

  purchase: async (tier: ProTier) => {
    if (!RC_AVAILABLE) throw new Error('Purchases not available');
    const Purchases = require('react-native-purchases').default;
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.find(
      (p: any) => p.product.productIdentifier === RC_PRODUCTS[tier]
    );
    if (!pkg) throw new Error('Product not found');
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPro = !!customerInfo.entitlements.active['pro'];
    set({ isPro, tier });
  },

  restore: async () => {
    if (!RC_AVAILABLE) return;
    const Purchases = require('react-native-purchases').default;
    const info = await Purchases.restorePurchases();
    const isPro = !!info.entitlements.active['pro'];
    set({ isPro });
  },

  recordSearch: async () => {
    if (get().isPro) return true; // Pro: unlimited
    const daily = await loadDailyState();
    const today = todayISO();
    const state = daily.date === today ? daily : { count: 0, date: today, bonusGranted: false };
    const maxSearches = FREE_DAILY_LIMIT + (state.bonusGranted ? REWARDED_BONUS : 0);

    if (state.count >= maxSearches) {
      set({ searchesRemaining: 0 });
      return false;
    }

    const updated = { ...state, count: state.count + 1 };
    await saveDailyState(updated);
    const remaining = Math.max(0, maxSearches - updated.count);
    set({ dailySearchCount: updated.count, searchesRemaining: remaining });
    return true;
  },

  grantSearchBonus: async () => {
    if (get().isPro || get().dailyBonusGranted) return;
    const daily = await loadDailyState();
    if (daily.bonusGranted) return;
    const updated = { ...daily, bonusGranted: true };
    await saveDailyState(updated);
    const newMax = FREE_DAILY_LIMIT + REWARDED_BONUS;
    set({
      dailyBonusGranted: true,
      searchesRemaining: Math.max(0, newMax - updated.count),
    });
  },

  restoreSearches: async (n: number) => {
    const daily = await loadDailyState();
    const updated = { ...daily, count: Math.max(0, daily.count - n) };
    await saveDailyState(updated);
    const maxSearches = FREE_DAILY_LIMIT + (updated.bonusGranted ? REWARDED_BONUS : 0);
    set({
      dailySearchCount: updated.count,
      searchesRemaining: Math.max(0, maxSearches - updated.count),
    });
  },
}));
