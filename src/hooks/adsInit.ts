import { Platform } from 'react-native';

let _initialized = false;
let _initializing: Promise<void> | null = null;

export function adsInitialized() {
  return _initialized;
}

export async function initializeAds(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    try {
      const { default: mobileAds } = await import('react-native-google-mobile-ads');
      await mobileAds().initialize();
      _initialized = true;
    } catch (e) {
      console.warn('[SongMatch] Failed to initialize ads:', e);
      _initialized = false;
    }
  })();

  return _initializing;
}
