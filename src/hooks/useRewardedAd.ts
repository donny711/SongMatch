import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { grantAdReward } from '../firebase/profileService';
import { useProfileStore } from '../store/profileStore';
import { useToastStore } from '../store/toastStore';

// Guard: module only exists in compiled (non-Expo-Go) builds
const ADS_AVAILABLE = false; // disabled: react-native-google-mobile-ads crashes on iOS 26

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
