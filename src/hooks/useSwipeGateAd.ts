import { useEffect, useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const ADS_AVAILABLE = false;

const AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? TestIds.REWARDED,
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? TestIds.REWARDED,
  default: TestIds.REWARDED,
})!;

export type SwipeGateAdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useSwipeGateAd(onRewarded: () => void) {
  const [status, setStatus] = useState<SwipeGateAdStatus>(ADS_AVAILABLE ? 'loading' : 'unavailable');
  const [ad, setAd] = useState<RewardedAd | null>(null);
  const onRewardedRef = useRef(onRewarded);

  useEffect(() => { onRewardedRef.current = onRewarded; });

  const loadAd = useCallback(() => {
    if (!ADS_AVAILABLE) return;
    setStatus('loading');
    const rewarded = RewardedAd.createForAdRequest(AD_UNIT_ID);

    const unsubEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        onRewardedRef.current();
      },
    );
    const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setStatus('loading');
      setTimeout(() => loadAd(), 1000);
    });
    const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      setStatus('error');
      setTimeout(() => loadAd(), 30000);
    });
    const unsubLoaded = rewarded.addAdEventListener(AdEventType.LOADED, () => {
      setStatus('ready');
    });

    setAd(rewarded);
    rewarded.load();

    return () => {
      unsubEarned();
      unsubClosed();
      unsubError();
      unsubLoaded();
    };
  }, []);

  useEffect(() => { const cleanup = loadAd(); return () => cleanup?.(); }, []);

  const show = useCallback(() => {
    if (!ad || status !== 'ready') return;
    setStatus('showing');
    ad.show();
  }, [ad, status]);

  return { status, show };
}
