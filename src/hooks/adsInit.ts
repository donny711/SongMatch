import { Platform } from 'react-native';

let _initialized = false;
let _initializing: Promise<void> | null = null;
let _failed = false;

export function adsInitialized() {
  return _initialized;
}

export function adsFailed() {
  return _failed;
}

export async function initializeAds(): Promise<void> {
  if (_initialized) return;
  if (_failed) throw new Error('Ads unavailable');
  if (_initializing) return _initializing;

  _initializing = (async () => {
    try {
      const { default: mobileAds } = await import('react-native-google-mobile-ads');
      await mobileAds().initialize();
      _initialized = true;
    } catch (e) {
      console.warn('[SongMatch] Failed to initialize ads:', e);
      _initialized = false;
      _failed = true;
      _initializing = null;
      throw e;
    }
  })();

  return _initializing;
}
