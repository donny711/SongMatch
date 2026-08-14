// -- Track types (used for track cards and previews) --

export interface Artist {
  id: number;
  name: string;
}

export interface Album {
  id: number;
  title: string;
  coverArt: string;
}

export interface Track {
  id: number;
  title: string;
  artist: Artist;
  album: Album;
  preview: string;
  duration: number;
  link: string;
  isrc?: string;
  artworkUrl?: string;        // Apple Music artwork (preferred over album.coverArt)
  appleMusicId?: string;
  appleArtistId?: string;     // Apple catalog artist id, for similar-artists chaining
}

// -- Shared card type --

export interface RecommendationCard {
  type: "track";
  track: Track;
}
