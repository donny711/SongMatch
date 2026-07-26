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
  isrc?: string;          // present on Deezer /track/{id}; used to match Apple catalog
  // Apple Music artwork enrichment (populated by musicKitService; album.cover_xl
  // is the legacy Deezer fallback only). appleMusicId kept for Firestore/rollback.
  artworkUrl?: string;
  appleMusicId?: string;
  appleArtistId?: string; // Apple catalog artist id, for similar-artists chaining
}

/** Canonical in-app track shape. Populated from Apple Music (was Deezer). */
export type Track = DeezerTrack;

// ── Shared card type ──────────────────────────────────────────────────────────

export interface RecommendationCard {
  type: 'track';
  track: DeezerTrack;
}
