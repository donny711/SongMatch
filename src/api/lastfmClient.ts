const LASTFM_API_BASE = 'https://ws.audioscrobbler.com/2.0';

interface LastFmSimilarTrack {
  name: string;
  artist: { name: string };
  match?: string | number;
}

interface LastFmSimilarResponse {
  similartracks?: { track: LastFmSimilarTrack[] | LastFmSimilarTrack };
  error?: number;
}

interface LastFmTopTracksResponse {
  toptracks?: { track: LastFmSimilarTrack[] | LastFmSimilarTrack };
  error?: number;
}

// Tags that indicate personal annotations rather than genre/mood
const NON_GENRE_TAGS = new Set([
  'seen live', 'favorites', 'favourite', 'love', 'awesome', 'beautiful',
  'great', 'amazing', 'cool', 'good', 'best', 'favorite', 'all time favorites',
  'male vocalists', 'female vocalists', 'artists i've seen live',
  'american', 'british', 'german', 'swedish', 'norwegian', 'french',
  'under 2000 listeners', 'check', 'todo', 'owob', 'spotify', 'youtube',
]);

export function cleanTitle(title: string): string {
  return title
    .replace(/\(.*?(slowed|reverb|sped.?up|nightcore|remix|acoustic|live|radio.?edit|lofi|lo-fi|bass.?boost).*?\)/gi, '')
    .replace(/\s*[-–]\s*(slowed|reverb|sped.?up|nightcore|remix|acoustic|live|lofi).*$/gi, '')
    .trim();
}

function apiKey() {
  return process.env.EXPO_PUBLIC_LASTFM_API_KEY ?? '';
}

export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = 15
): Promise<Array<{ name: string; artist: string; match: number }>> {
  const cleaned = cleanTitle(track);
  const url =
    `${LASTFM_API_BASE}/?method=track.getsimilar` +
    `&artist=${encodeURIComponent(artist)}` +
    `&track=${encodeURIComponent(cleaned)}` +
    `&api_key=${encodeURIComponent(apiKey())}` +
    `&format=json&limit=${limit}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data: LastFmSimilarResponse = await res.json();

    if (data.error || !data.similartracks) return [];

    const tracks = Array.isArray(data.similartracks.track)
      ? data.similartracks.track
      : [data.similartracks.track];

    return tracks.map((t) => ({ name: t.name, artist: t.artist.name, match: Number(t.match ?? 0) }));
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
}

export async function getArtistTopTracks(
  artist: string,
  limit = 15
): Promise<Array<{ name: string; artist: string }>> {
  const url =
    `${LASTFM_API_BASE}/?method=artist.gettoptracks` +
    `&artist=${encodeURIComponent(artist)}` +
    `&format=json&limit=${limit}` +
    `&api_key=${encodeURIComponent(apiKey())}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data: LastFmTopTracksResponse = await res.json();

    if (data.error || !data.toptracks) return [];

    const tracks = Array.isArray(data.toptracks.track)
      ? data.toptracks.track
      : [data.toptracks.track];

    return tracks.map((t) => ({ name: t.name, artist: t.artist.name }));
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
}

export async function getArtistSimilar(artist: string, limit = 10): Promise<string[]> {
  const url =
    `${LASTFM_API_BASE}/?method=artist.getsimilar` +
    `&artist=${encodeURIComponent(artist)}` +
    `&api_key=${encodeURIComponent(apiKey())}` +
    `&format=json&limit=${limit}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error || !data.similarartists?.artist) return [];
    const artists = Array.isArray(data.similarartists.artist)
      ? data.similarartists.artist
      : [data.similarartists.artist];
    return artists.map((a: { name: string }) => a.name);
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') return [];
    return [];
  }
}

export async function getTrackTags(artist: string, track: string): Promise<string[]> {
  const url =
    `${LASTFM_API_BASE}/?method=track.gettoptags` +
    `&artist=${encodeURIComponent(artist)}` +
    `&track=${encodeURIComponent(cleanTitle(track))}` +
    `&api_key=${encodeURIComponent(apiKey())}` +
    `&format=json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error || !data.toptags?.tag) return [];

    const tags = Array.isArray(data.toptags.tag) ? data.toptags.tag : [data.toptags.tag];
    return tags
      .filter((t: { name: string; count: number }) =>
        t.count >= 5 && !NON_GENRE_TAGS.has(t.name.toLowerCase())
      )
      .slice(0, 5)
      .map((t: { name: string }) => t.name.toLowerCase());
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') return [];
    return [];
  }
}

export async function getTagTopTracks(
  tag: string,
  limit = 20
): Promise<Array<{ name: string; artist: string }>> {
  const url =
    `${LASTFM_API_BASE}/?method=tag.gettoptracks` +
    `&tag=${encodeURIComponent(tag)}` +
    `&api_key=${encodeURIComponent(apiKey())}` +
    `&format=json&limit=${limit}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error || !data.tracks?.track) return [];

    const tracks = Array.isArray(data.tracks.track)
      ? data.tracks.track
      : [data.tracks.track];

    return tracks.map((t: { name: string; artist: { name: string } }) => ({
      name: t.name,
      artist: t.artist.name,
    }));
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') return [];
    return [];
  }
}
