jest.mock('../../utils/constants', () => ({ MUSIC_PROXY_URL: 'https://proxy.test' }));
import { mapAppleSong } from '../appleMusicClient';

const sample = {
  id: '1440811561',
  attributes: {
    name: 'Blinding Lights',
    artistName: 'The Weeknd',
    albumName: 'After Hours',
    durationInMillis: 200040,
    isrc: 'USUG11904206',
    url: 'https://music.apple.com/us/album/x/1',
    artwork: { url: 'https://ex/{w}x{h}bb.jpg' },
    previews: [{ url: 'https://audio/preview.m4a' }],
  },
  relationships: { artists: { data: [{ id: '479756766' }] } },
};

describe('mapAppleSong', () => {
  it('normalizes an Apple song into the Track shape', () => {
    const t = mapAppleSong(sample as any);
    expect(t.id).toBe(1440811561);
    expect(t.title).toBe('Blinding Lights');
    expect(t.artist.name).toBe('The Weeknd');
    expect(t.album.title).toBe('After Hours');
    expect(t.preview).toBe('https://audio/preview.m4a');
    expect(t.duration).toBe(200); // ms → seconds
    expect(t.isrc).toBe('USUG11904206');
    expect(t.appleMusicId).toBe('1440811561');
    expect(t.appleArtistId).toBe('479756766');
    expect(t.artworkUrl).toBe('https://ex/1000x1000bb.jpg');
  });

  it('returns empty preview when Apple has no preview', () => {
    const noPrev = { ...sample, attributes: { ...sample.attributes, previews: [] } };
    expect(mapAppleSong(noPrev as any).preview).toBe('');
  });
});
