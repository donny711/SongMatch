interface Env {
  CACHE: KVNamespace;
  LASTFM_API_KEY: string;
}

const DEEZER_BASE = 'https://api.deezer.com';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Cache TTLs in seconds
function ttlFor(type: string): number {
  switch (type) {
    case 'radio':  return 6 * 3600;   // radio results are stable for hours
    case 'track':  return 24 * 3600;  // individual track metadata rarely changes
    case 'chart':  return 6 * 3600;
    case 'lastfm': return 24 * 3600;  // similar tracks / tags change very slowly
    default:       return 3600;       // search: 1h
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    const url = new URL(request.url);

    if (url.pathname.startsWith('/deezer/'))  return handleDeezer(url, env);
    if (url.pathname.startsWith('/lastfm'))  return handleLastFm(url, env);

    return new Response('Not found', { status: 404 });
  },
};

async function handleDeezer(url: URL, env: Env): Promise<Response> {
  const deezerPath = url.pathname.slice('/deezer'.length); // e.g. /search, /track/123/radio
  const upstream   = `${DEEZER_BASE}${deezerPath}${url.search}`;

  let type = 'search';
  if (deezerPath.includes('/radio'))          type = 'radio';
  else if (/^\/track\/\d+$/.test(deezerPath)) type = 'track';
  else if (deezerPath.includes('/chart'))     type = 'chart';

  const cacheKey = `deezer:${deezerPath}${url.search}`;
  return proxyWithCache(upstream, cacheKey, ttlFor(type), env);
}

async function handleLastFm(url: URL, env: Env): Promise<Response> {
  const params = new URLSearchParams(url.search);
  params.set('api_key', env.LASTFM_API_KEY);
  params.set('format', 'json');
  const upstream = `${LASTFM_BASE}/?${params.toString()}`;

  // Cache key is stable regardless of api_key value
  const method = params.get('method') ?? '';
  const artist = params.get('artist') ?? '';
  const track  = params.get('track')  ?? '';
  const tag    = params.get('tag')    ?? '';
  const limit  = params.get('limit')  ?? '';
  const cacheKey = `lastfm:${method}:${artist}:${track}:${tag}:${limit}`.toLowerCase();

  return proxyWithCache(upstream, cacheKey, ttlFor('lastfm'), env);
}

async function proxyWithCache(
  upstream: string,
  cacheKey: string,
  ttl: number,
  env: Env,
): Promise<Response> {
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  const res = await fetch(upstream, { headers: { 'User-Agent': 'SongMatch/1.0' } });
  if (!res.ok) {
    return new Response(await res.text(), { status: res.status, headers: CORS });
  }

  const body = await res.text();
  await env.CACHE.put(cacheKey, body, { expirationTtl: ttl });

  return new Response(body, {
    headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}
