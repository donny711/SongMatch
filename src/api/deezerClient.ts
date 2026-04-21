import type { DeezerTrack } from './types';

const DEEZER_API = 'https://api.deezer.com';

export async function searchDeezer(query: string, limit = 1): Promise<DeezerTrack[]> {
  const url = `${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.data ?? []) as DeezerTrack[];
}

export async function getDeezerTrackById(id: number): Promise<DeezerTrack | null> {
  try {
    const res = await fetch(`${DEEZER_API}/track/${id}`);
    const data = await res.json();
    return data.id ? (data as DeezerTrack) : null;
  } catch {
    return null;
  }
}

export async function getDeezerChart(limit = 20): Promise<DeezerTrack[]> {
  const url = `${DEEZER_API}/chart/0/tracks?limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.data ?? []) as DeezerTrack[];
}
