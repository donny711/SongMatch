import { useEffect, useState, useCallback, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';

const ADS_AVAILABLE = false; // disabled: react-native-google-mobile-ads crashes on iOS 26

const AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS ?? 'ca-app-pub-3940256099942544/4411468910',
  android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID ?? 'ca-app-pub-3940256099942544/1033173712',
  default: 'ca-app-pub-3940256099942544/1033173712',
})!;

export type InterstitialStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useInterstitialAd() {
  const [status, setStatus] = useState<InterstitialStatus>(ADS_AVAILABLE ? 'loading' : 'unavailable');
  const adRef = useRef<any>(null);

  const loadAd = useCallback(() => {
    if (!ADS_AVAILABLE) return;
    setStatus('loading');

    const {
      InterstitialAd,
      AdEventType,
    } = require('react-native-google-mobile-ads');

    const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setStatus('ready');
    });

    const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      unsubLoaded();
      unsubClosed();
      unsubError();
      adRef.current = null;
      loadAd(); // pre-load next
    });

    const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      setStatus('error');
    });

    interstitial.load();
    adRef.current = interstitial;
  }, []);

  useEffect(() => {
    loadAd();
  }, []);

  const show = useCallback(() => {
    if (!adRef.current || status !== 'ready') return;
    setStatus('showing');
    adRef.current.show();
  }, [status]);

  return { status, show };
}
