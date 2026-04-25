import { useEffect, useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

const ADS_AVAILABLE = false; // disabled: react-native-google-mobile-ads crashes on iOS 26

const AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? 'ca-app-pub-3940256099942544/1712485313',
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? 'ca-app-pub-3940256099942544/5224354917',
  default: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? 'ca-app-pub-3940256099942544/5224354917',
})!;

export type SwipeGateAdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useSwipeGateAd(onRewarded: () => void) {
  const [status, setStatus] = useState<SwipeGateAdStatus>(ADS_AVAILABLE ? 'loading' : 'unavailable');
  const [ad, setAd] = useState<any | null>(null);
  const onRewardedRef = useRef(onRewarded);

  // Keep ref in sync without recreating loadAd
  useEffect(() => { onRewardedRef.current = onRewarded; });

  const loadAd = useCallback(() => {
    if (!ADS_AVAILABLE) return;
  }, []);

  useEffect(() => { loadAd(); }, []);

  const show = useCallback(() => {
    if (!ad || status !== 'ready') return;
    setStatus('showing');
    ad.show();
  }, [ad, status]);

  return { status, show };
}
