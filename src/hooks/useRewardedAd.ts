import { useCallback } from 'react';

export type AdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useRewardedAd() {
  const show = useCallback(() => {}, []);
  const retry = useCallback(async () => {}, []);
  return { status: 'unavailable' as AdStatus, show, retry };
}
