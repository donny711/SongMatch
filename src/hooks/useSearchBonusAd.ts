import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useSubscriptionStore } from '../store/subscriptionStore';

const ADS_AVAILABLE = true;

const AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? TestIds.REWARDED,
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? TestIds.REWARDED,
  default: TestIds.REWARDED,
})!;

export type SearchBonusAdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useSearchBonusAd() {
  const grantSearchBonus = useSubscriptionStore((s) => s.grantSearchBonus);
  const [status, setStatus] = useState<SearchBonusAdStatus>(ADS_AVAILABLE ? 'loading' : 'unavailable');
  const [ad, setAd] = useState<RewardedAd | null>(null);

  const loadAd = useCallback(() => {
    if (!ADS_AVAILABLE) return;
    setStatus('loading');
    const rewarded = RewardedAd.createForAdRequest(AD_UNIT_ID);

    const unsubEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        grantSearchBonus();
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
  }, [grantSearchBonus]);

  useEffect(() => {
    const cleanup = loadAd();
    return () => cleanup?.();
  }, []);

  const show = useCallback(() => {
    if (!ad || status !== 'ready') return;
    setStatus('showing');
    ad.show();
  }, [ad, status]);

  return { status, show };
}
