jest.mock('../../utils/constants', () => ({ MUSIC_PROXY_URL: 'https://proxy.test' }));
jest.mock('../appleMusicClient');
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn() }));
import * as apple from '../appleMusicClient';
import { buildTasteSeeds } from '../tasteEngine';

it('builds seeds from onboarding genres via Apple search', async () => {
  (apple.searchAppleTracks as jest.Mock).mockResolvedValue([
    { title: 'X', artist: { name: 'ArtistX' } },
  ]);
  const seeds = await buildTasteSeeds([], [], ['pop'], false, new Set<string>(), 1);
  expect(seeds.length).toBeGreaterThan(0);
  expect(seeds[0]).toHaveProperty('name');
  expect(seeds[0]).toHaveProperty('artist');
});
