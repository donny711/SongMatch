import * as FileSystem from 'expo-file-system/legacy';

const PROXY_URL = 'https://auddd.radupopa214.workers.dev';

export interface AuddResult {
  title: string;
  artist: string;
}

export async function recognizeSong(audioUri: string): Promise<AuddResult | null> {
  try {
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64 }),
    });

    const data = await res.json();
    console.log('[ACRCloud] response:', JSON.stringify(data));
    if (data?.status?.code !== 0) return null;
    const track = data?.metadata?.music?.[0];
    if (!track) return null;
    return { title: track.title, artist: track.artists?.[0]?.name ?? '' };
  } catch (e) {
    console.log('[AudD] error:', e);
    return null;
  }
}
