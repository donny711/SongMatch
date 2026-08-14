import { MUSIC_PROXY_URL } from '../utils/constants';
import type { Track } from './types';

const STOREFRONT = 'us';
const APPLE_PROXY = MUSIC_PROXY_URL ? `${MUSIC_PROXY_URL}/apple` : '';
const ART_SIZE = 1000;

export interface AppleSong {
  id: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    isrc?: string;
    url?: string;
    artwork?: { url?: string };
    previews?: { url?: string }[];
  };
  relationships?: { artists?: { data?: { id: string }[] } };
}

function artUrl(tmpl?: string): string | undefined {
  if (!tmpl) return undefined;
  return tmpl.replace('{w}', String(ART_SIZE)).replace('{h}', String(ART_SIZE));
}

/** Normalize one Apple catalog song into the app's Track shape. */
export function mapAppleSong(song: AppleSong): Track {
  const a = song.attributes ?? {};
  return {
    id: Number(song.id),
    title: a.name ?? '',
    artist: { id: Number(song.relationships?.artists?.data?.[0]?.id ?? 0), name: a.artistName ?? '' },
    album: { id: 0, title: a.albumName ?? '', coverArt: artUrl(a.artwork?.url) ?? '' },
    preview: a.previews?.[0]?.url ?? '',
    duration: a.durationInMillis ? Math.round(a.durationInMillis / 1000) : 0,
    link: a.url ?? '',
    isrc: a.isrc,
    artworkUrl: artUrl(a.artwork?.url),
    appleMusicId: song.id,
    appleArtistId: song.relationships?.artists?.data?.[0]?.id,
  };
}

async function appleGet(path: string): Promise<any> {
  if (!APPLE_PROXY) throw new Error('music proxy not configured');
  const res = await fetch(`${APPLE_PROXY}${path}`);
  if (!res.ok) throw new Error(`apple ${res.status}`);
  return res.json();
}

/** Full-text catalog search → tracks with previews. */
export async function searchAppleTracks(query: string, limit = 5): Promise<Track[]> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/search?term=${encodeURIComponent(query)}&types=songs&limit=${limit}`
    );
    return (data?.results?.songs?.data ?? []).map(mapAppleSong);
  } catch {
    return [];
  }
}

export async function getAppleSongByIsrc(isrc: string): Promise<Track | null> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/songs?filter[isrc]=${encodeURIComponent(isrc)}&limit=1`
    );
    const song = data?.data?.[0];
    return song ? mapAppleSong(song) : null;
  } catch {
    return null;
  }
}

export async function getSimilarArtistIds(artistId: string, limit = 10): Promise<string[]> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/artists/${artistId}/view/similar-artists?limit=${limit}`
    );
    return (data?.data ?? []).map((a: { id: string }) => a.id);
  } catch {
    return [];
  }
}

export async function getArtistTopSongs(artistId: string, limit = 10): Promise<Track[]> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/artists/${artistId}/view/top-songs?limit=${limit}`
    );
    return (data?.data ?? []).map(mapAppleSong);
  } catch {
    return [];
  }
}

export async function getAppleCharts(limit = 20): Promise<Track[]> {
  try {
    const data = await appleGet(
      `/v1/catalog/${STOREFRONT}/charts?types=songs&limit=${limit}`
    );
    return (data?.results?.songs?.[0]?.data ?? []).map(mapAppleSong);
  } catch {
    return [];
  }
}

/** Resolve a track's Apple artist id (used to fan out to similar-artists). */
export async function getArtistIdForTrack(track: Track): Promise<string | null> {
  if (track.appleArtistId) return track.appleArtistId;
  if (track.isrc) {
    const song = await getAppleSongByIsrc(track.isrc);
    return song?.appleArtistId ?? null;
  }
  const [hit] = await searchAppleTracks(`${track.title} ${track.artist.name}`, 1);
  return hit?.appleArtistId ?? null;
}
