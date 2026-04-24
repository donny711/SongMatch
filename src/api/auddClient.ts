import * as FileSystem from 'expo-file-system/legacy';

const PROXY_URL = 'https://auddd.radupopa214.workers.dev';

export interface AuddResult {
  title: string;
  artist: string;
}

export async function recognizeSong(audioUri: string): Promise<AuddResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64 }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (__DEV__) console.log('[AudD] response:', JSON.stringify(data));
    if (data?.status?.code !== 0) return null;
    const track = data?.metadata?.music?.[0];
    if (!track) return null;
    return { title: track.title, artist: track.artists?.[0]?.name ?? '' };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    if (__DEV__) console.log('[AudD] error:', e);
    return null;
  }
}
