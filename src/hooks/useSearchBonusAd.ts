import { useCallback } from 'react';

export type SearchBonusAdStatus = 'loading' | 'ready' | 'showing' | 'error' | 'unavailable';

export function useSearchBonusAd() {
  const show = useCallback(() => {}, []);
  return { status: 'unavailable' as SearchBonusAdStatus, show };
}
