// ── Spotify types (used for playlist browsing and save-to-playlist) ──────────

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
  external_urls: { spotify: string };
  images?: SpotifyImage[];
  genres?: string[];
  followers?: { total: number };
  popularity?: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  preview_url: string | null;
  duration_ms: number;
  popularity: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  external_urls: { spotify: string };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[] | null;
  tracks: { total: number } | null;
  owner: { display_name: string };
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  // Only present with the user-read-email scope, which we no longer request.
  email?: string;
  images: SpotifyImage[] | null;
  product: 'free' | 'premium' | string;
  followers: { total: number };
}

export interface SpotifyPaginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
}

export interface SpotifyPlaylistTrackItem {
  track: SpotifyTrack | null;
  added_at: string;
}

// ── Deezer types (used for track cards and previews) ─────────────────────────

export interface DeezerArtist {
  id: number;
  name: string;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  cover_xl: string;
}

export interface DeezerTrack {
  id: number;
  title: string;
  artist: DeezerArtist;
  album: DeezerAlbum;
  preview: string;
  duration: number;
  link: string;
}

// ── Shared card type ──────────────────────────────────────────────────────────

export interface RecommendationCard {
  type: 'track';
  track: DeezerTrack;
}
