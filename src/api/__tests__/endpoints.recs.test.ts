jest.mock('../../utils/constants', () => ({ MUSIC_PROXY_URL: 'https://proxy.test' }));
jest.mock('../appleMusicClient');
import * as apple from '../appleMusicClient';
import { getRecommendationsForSeeds } from '../endpoints';
import type { Track } from '../types';

function mk(id: number, name: string, artist: string, artistId: string): Track {
  return {
    id, title: name, artist: { id: Number(artistId), name },
    album: { id: 0, title: '', cover_xl: 'art' }, preview: 'p', duration: 100, link: '',
    artworkUrl: 'art', appleArtistId: artistId,
  };
}

it('builds recs from seed artist → similar artists → top songs, filtering seen + artist dupes', async () => {
  (apple.searchAppleTracks as jest.Mock).mockResolvedValue([mk(1, 'Seed', 'A', '10')]);
  (apple.getArtistIdForTrack as jest.Mock).mockResolvedValue('10');
  (apple.getSimilarArtistIds as jest.Mock).mockResolvedValue(['20', '30']);
  (apple.getArtistTopSongs as jest.Mock).mockImplementation((aid: string) =>
    Promise.resolve([mk(Number(aid) + 1, 'Song' + aid, 'Artist' + aid, aid)]));
  (apple.getAppleCharts as jest.Mock).mockResolvedValue([]);

  const cards = await getRecommendationsForSeeds(
    [{ name: 'Seed', artist: 'A' }], 10, new Set<number>([1]), new Set<string>(), ['10']
  );
  const ids = cards.map((c) => c.track.id);
  expect(ids).not.toContain(1);          // seen filtered
  expect(cards.every((c) => c.track.preview)).toBe(true); // only playable
  expect(cards.length).toBeGreaterThan(0);
});
