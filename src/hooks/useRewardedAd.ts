import { useEffect, useState, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';
import { grantAdReward } from '../firebase/profileService';
import { useProfileStore } from '../store/profileStore';
import { useToastStore } from '../store/toastStore';

// Guard: module only exists in compiled (non-Expo-Go) builds
const ADS_AVAILABLE = !!NativeModules.RNGoogleMobileAdsModule;

// Set EXPO_PUBLIC_ADMOB_REWARDED_IOS / EXPO_PUBLIC_ADMOB_REWARDED_ANDROID in .env
// (and EAS Secrets for production builds) to use real ad unit IDs.
// Falls back to Google test IDs when env vars are not set.
const AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? 'ca-app-pub-3940256099942544/1712485313',
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? 'ca-app-pub-3940256099942544/5224354917',
  default: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? 'ca-app-pub-3940256099942544/5224354917',
})!;

export type AdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useRewardedAd() {
  const uid = useProfileStore((s) => s.uid);
  const [status, setStatus] = useState<AdStatus>(ADS_AVAILABLE ? 'loading' : 'unavailable');
  const [ad, setAd] = useState<any | null>(null);

  const loadAd = useCallback(() => {
    if (!ADS_AVAILABLE) return;
    setStatus('loading');

    // Dynamic require so the module is never imported in Expo Go
    const {
      RewardedAd,
      RewardedAdEventType,
      AdEventType,
    } = require('react-native-google-mobile-ads');

    const rewarded = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setStatus('ready');
    });

    const unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
      if (!uid) return;
      try {
        const result = await grantAdReward(uid);
        if (result.granted) {
          useToastStore.getState().push(30, 'Ad Reward');
        }
      } catch {
        // Non-critical
      }
    });

    const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubError();
      setAd(null);
      loadAd(); // pre-load next
    });

    const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      setStatus('error');
    });

    rewarded.load();
    setAd(rewarded);
  }, [uid]);

  useEffect(() => {
    loadAd();
  }, []);

  const show = useCallback(() => {
    if (!ad || status !== 'ready') return;
    setStatus('showing');
    ad.show();
  }, [ad, status]);

  return { status, show };
}
