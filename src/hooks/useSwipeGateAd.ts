import { useCallback } from 'react';

export type SwipeGateAdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useSwipeGateAd(_onRewarded: () => void) {
  const show = useCallback(() => {}, []);
  return { status: 'unavailable' as SwipeGateAdStatus, show };
}
