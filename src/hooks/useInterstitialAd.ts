import { useState, useCallback } from 'react';

export type InterstitialStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useInterstitialAd() {
  const [status] = useState<InterstitialStatus>('unavailable');
  const show = useCallback(() => {}, []);
  return { status, show };
}
