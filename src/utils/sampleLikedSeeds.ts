import type { DeezerTrack } from '../api/types';

/**
 * Randomly sample seeds directly from the user's liked tracks.
 * More recently liked songs get higher weight so the feed reflects
 * current taste rather than all-time history.
 */
export function sampleLikedSeeds(
  likedTracks: DeezerTrack[],
  count: number
): Array<{ name: string; artist: string }> {
  const pool = likedTracks.slice(0, 30); // focus on recent 30
  if (pool.length === 0) return [];

  const available = pool.map((track, i) => ({
    item: { name: track.title, artist: track.artist.name },
    weight: pool.length - i, // index 0 (most recent) = highest weight
  }));

  const results: Array<{ name: string; artist: string }> = [];
  while (results.length < count && available.length > 0) {
    const total = available.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * total;
    let idx = available.length - 1;
    for (let i = 0; i < available.length; i++) {
      r -= available[i].weight;
      if (r <= 0) { idx = i; break; }
    }
    results.push(available[idx].item);
    available.splice(idx, 1);
  }
  return results;
}
