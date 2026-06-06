import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const ADS_AVAILABLE = false; // interstitial disabled for now

const AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS ?? TestIds.INTERSTITIAL,
  android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID ?? TestIds.INTERSTITIAL,
  default: TestIds.INTERSTITIAL,
})!;

export type InterstitialStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useInterstitialAd() {
  const [status, setStatus] = useState<InterstitialStatus>(ADS_AVAILABLE ? 'loading' : 'unavailable');
  const adRef = useRef<InterstitialAd | null>(null);

  const loadAd = useCallback(() => {
    if (!ADS_AVAILABLE) return;
    setStatus('loading');
    const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID);

    const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setStatus('ready');
    });
    const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setStatus('loading');
      // Pre-load next ad
      setTimeout(() => loadAd(), 1000);
    });
    const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      setStatus('error');
      // Retry after delay
      setTimeout(() => loadAd(), 30000);
    });

    adRef.current = interstitial;
    interstitial.load();

    return () => {
      unsubLoaded();
      unsubClosed();
      unsubError();
    };
  }, []);

  useEffect(() => {
    const cleanup = loadAd();
    return () => cleanup?.();
  }, []);

  const show = useCallback(() => {
    if (!adRef.current || status !== 'ready') return;
    setStatus('showing');
    adRef.current.show();
  }, [status]);

  return { status, show };
}
