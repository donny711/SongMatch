jest.mock('../../utils/constants', () => ({ MUSIC_PROXY_URL: 'https://proxy.test' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
}));

import { resolveArtwork, resolveArtworkForTracks, buildArtworkUrl } from '../musicKitService';
import type { DeezerTrack } from '../types';

const TEMPLATE = 'https://is1.mzstatic.com/image/thumb/abc/{w}x{h}bb.jpg';

function songByIsrc(id: string, template: string) {
  return { ok: true, json: async () => ({ data: [{ id, attributes: { artwork: { url: template } } }] }) };
}
function songBySearch(id: string, template: string) {
  return { ok: true, json: async () => ({ results: { songs: { data: [{ id, attributes: { artwork: { url: template } } }] } } }) };
}
const empty = { ok: true, json: async () => ({ data: [], results: {} }) };

function track(over: Partial<DeezerTrack> = {}): DeezerTrack {
  return {
    id: 1, title: 'Song', artist: { id: 1, name: 'Artist' },
    album: { id: 1, title: 'Alb', cover_xl: 'deezer-url' },
    preview: 'p', duration: 100, link: '', ...over,
  };
}

describe('buildArtworkUrl', () => {
  it('interpolates the {w}x{h} template', () => {
    expect(buildArtworkUrl(TEMPLATE, 500)).toBe('https://is1.mzstatic.com/image/thumb/abc/500x500bb.jpg');
  });
  it('defaults to 1000px', () => {
    expect(buildArtworkUrl(TEMPLATE)).toContain('1000x1000');
  });
});

describe('resolveArtwork', () => {
  it('matches by ISRC when the track already carries one', async () => {
    global.fetch = jest.fn(async (url) =>
      String(url).includes('filter[isrc]') ? songByIsrc('am1', TEMPLATE) : empty) as any;

    const r = await resolveArtwork(track({ id: 201, isrc: 'ISRC1' }));

    expect(r.appleMusicId).toBe('am1');
    expect(r.artworkUrl).toBe(buildArtworkUrl(TEMPLATE));
  });

  it('falls back to title+artist search when no ISRC match', async () => {
    global.fetch = jest.fn(async (url) =>
      String(url).includes('/search') ? songBySearch('am3', TEMPLATE) : empty) as any;

    const r = await resolveArtwork(track({ id: 203 }));

    expect(r.appleMusicId).toBe('am3');
  });

  it('returns empty artwork on a total miss', async () => {
    global.fetch = jest.fn(async () => empty) as any;

    const r = await resolveArtwork(track({ id: 204 }));

    expect(r.artworkUrl).toBeNull();
    expect(r.appleMusicId).toBeNull();
  });

  it('caches results and does not refetch the same track', async () => {
    const f = jest.fn(async () => songByIsrc('am5', TEMPLATE));
    global.fetch = f as any;
    const t = track({ id: 205, isrc: 'ISRC5' });

    await resolveArtwork(t);
    const afterFirst = f.mock.calls.length;
    await resolveArtwork(t);

    expect(f.mock.calls.length).toBe(afterFirst);
  });
});

describe('resolveArtworkForTracks', () => {
  it('enriches matched tracks and leaves unmatched ones unchanged', async () => {
    global.fetch = jest.fn(async (url) =>
      String(url).includes('filter[isrc]=ISRCA') ? songByIsrc('amA', TEMPLATE) : empty) as any;

    const [a, b] = await resolveArtworkForTracks([
      track({ id: 301, isrc: 'ISRCA' }),
      track({ id: 302, isrc: 'ISRCB' }),
    ]);

    expect(a.artworkUrl).toBe(buildArtworkUrl(TEMPLATE));
    expect(a.appleMusicId).toBe('amA');
    expect(b.artworkUrl).toBeUndefined();
  });
});
