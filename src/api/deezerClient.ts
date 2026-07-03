import type { DeezerTrack } from './types';
import { MUSIC_PROXY_URL } from '../utils/constants';

// Route through proxy when configured (keeps API key server-side + caches responses).
// Falls back to direct Deezer API in local dev when MUSIC_PROXY_URL is not set.
const DEEZER_API = MUSIC_PROXY_URL ? `${MUSIC_PROXY_URL}/deezer` : 'https://api.deezer.com';

export async function searchDeezer(query: string, limit = 1): Promise<DeezerTrack[]> {
  const url = `${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []) as DeezerTrack[];
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    return [];
  }
}

export async function getDeezerTrackById(id: number): Promise<DeezerTrack | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${DEEZER_API}/track/${id}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ? (data as DeezerTrack) : null;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    return null;
  }
}

export async function getDeezerChart(limit = 20): Promise<DeezerTrack[]> {
  const url = `${DEEZER_API}/chart/0/tracks?limit=${limit}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []) as DeezerTrack[];
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    return [];
  }
}

export async function getDeezerRadio(trackId: number, limit = 40): Promise<DeezerTrack[]> {
  // Deezer removed /track/{id}/radio (returns InvalidQueryException 600 as of
  // 2026-07). Resolve the track's artist and use /artist/{id}/radio instead —
  // still audio-similarity radio, one extra (worker-cached) lookup. Same
  // signature so all callers keep passing track IDs.
  const track = await getDeezerTrackById(trackId).catch(() => null);
  const artistId = track?.artist?.id;
  if (!artistId) return [];

  const url = `${DEEZER_API}/artist/${artistId}/radio?limit=${limit}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []) as DeezerTrack[];
  } catch (e: any) {
    clearTimeout(timeoutId);
    return [];
  }
}
