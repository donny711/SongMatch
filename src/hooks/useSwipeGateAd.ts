import { useEffect, useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { initializeAds } from './adsInit';

const AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? 'ca-app-pub-3940256099942544/1712485313',
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? 'ca-app-pub-3940256099942544/5224354917',
  default: 'ca-app-pub-3940256099942544/5224354917',
})!;

export type SwipeGateAdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useSwipeGateAd(onRewarded: () => void) {
  const [status, setStatus] = useState<SwipeGateAdStatus>('loading');
  const [ad, setAd] = useState<any>(null);
  const onRewardedRef = useRef(onRewarded);

  useEffect(() => { onRewardedRef.current = onRewarded; });

  const loadAd = useCallback(async () => {
    try {
      await initializeAds();
      const { RewardedAd, RewardedAdEventType, AdEventType } =
        await import('react-native-google-mobile-ads');

      setStatus('loading');
      const rewarded = RewardedAd.createForAdRequest(AD_UNIT_ID);

      rewarded.addAdEventListener(AdEventType.LOADED, () => setStatus('ready'));
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        setStatus('loading');
        setTimeout(() => loadAd(), 1000);
      });
      rewarded.addAdEventListener(AdEventType.ERROR, () => {
        setStatus('error');
        setTimeout(() => loadAd(), 30000);
      });
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        onRewardedRef.current();
      });

      setAd(rewarded);
      rewarded.load();
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => { loadAd(); }, []);

  const show = useCallback(() => {
    if (!ad || status !== 'ready') return;
    setStatus('showing');
    ad.show();
  }, [ad, status]);

  return { status, show };
}
