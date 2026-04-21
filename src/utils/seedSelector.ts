import type { SpotifyTrack } from '../api/types';

/** Pick up to 5 seed track IDs from a playlist, favouring variety */
export function selectSeeds(tracks: SpotifyTrack[]): {
  seedTracks: string[];
  seedArtists: string[];
} {
  if (tracks.length === 0) return { seedTracks: [], seedArtists: [] };

  // Count artist frequency
  const artistCount: Record<string, number> = {};
  for (const t of tracks) {
    const id = t.artists[0]?.id;
    if (id) artistCount[id] = (artistCount[id] ?? 0) + 1;
  }

  // Top 3 artists by frequency
  const topArtists = Object.entries(artistCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  // 2 random tracks
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
  const seedTracks = shuffled.slice(0, 2).map((t) => t.id);

  return { seedTracks, seedArtists: topArtists };
}
