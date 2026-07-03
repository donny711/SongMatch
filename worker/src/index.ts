interface Env {
  CACHE: KVNamespace;
  LASTFM_API_KEY: string;
  // MusicKit developer-token signing (set via `wrangler secret put`):
  MUSICKIT_TEAM_ID: string;
  MUSICKIT_KEY_ID: string;
  MUSICKIT_PRIVATE_KEY: string; // PKCS#8 PEM contents of the .p8 key
}

const DEEZER_BASE = 'https://api.deezer.com';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0';
const APPLE_BASE  = 'https://api.music.apple.com';

// MusicKit developer token: Apple allows up to 6 months; we rotate at ~5 so the
// KV copy always refreshes well before Apple would reject an expired token.
const TOKEN_KV_KEY       = 'musickit:devtoken';
const TOKEN_TTL_SECONDS  = 150 * 24 * 3600; // ~5 months

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
    if (url.pathname === '/musickit/token')  return handleTokenEndpoint(env);
    if (url.pathname.startsWith('/apple/'))  return handleApple(url, env);

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

  // v2 prefix: v1 cached upstream error bodies (Deezer 200-with-error), poisoning
  // radio/search results for hours — bumping the prefix flushes those entries.
  const cacheKey = `deezer:v2:${deezerPath}${url.search}`;
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
  const cacheKey = `lastfm:v2:${method}:${artist}:${track}:${tag}:${limit}`.toLowerCase();

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

  // Deezer (and occasionally Last.fm) return errors as HTTP 200 with an
  // { "error": ... } body. Never cache those — a transient rate limit or a
  // removed endpoint would otherwise be served for hours.
  let isErrorBody = false;
  try {
    const parsed = JSON.parse(body);
    isErrorBody = parsed != null && typeof parsed === 'object' && 'error' in parsed;
  } catch {
    isErrorBody = true; // non-JSON from an API that should return JSON — don't cache
  }
  if (!isErrorBody) {
    await env.CACHE.put(cacheKey, body, { expirationTtl: ttl });
  }

  return new Response(body, {
    headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': isErrorBody ? 'BYPASS' : 'MISS' },
  });
}

// ── MusicKit (Apple Music) ──────────────────────────────────────────────────
//
// Signs the developer token server-side so the .p8 private key never reaches
// the client, and proxies Apple catalog calls with the same KV cache used for
// Deezer/Last.fm (per-track ISRC lookups are stable, so caching cuts Apple
// traffic dramatically).

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function generateDeveloperToken(env: Env): Promise<string> {
  if (!env.MUSICKIT_TEAM_ID || !env.MUSICKIT_KEY_ID || !env.MUSICKIT_PRIVATE_KEY) {
    throw new Error('MusicKit secrets not configured');
  }
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'ES256', kid: env.MUSICKIT_KEY_ID };
  const payload = { iss: env.MUSICKIT_TEAM_ID, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(env.MUSICKIT_PRIVATE_KEY),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // WebCrypto ECDSA outputs IEEE-P1363 (r||s) — exactly what JWS ES256 wants.
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(sig)}`;
}

async function getDeveloperToken(env: Env): Promise<string> {
  const cached = await env.CACHE.get(TOKEN_KV_KEY);
  if (cached) return cached;
  const token = await generateDeveloperToken(env);
  // Rotate a day before the KV entry lapses so a request never races expiry.
  await env.CACHE.put(TOKEN_KV_KEY, token, { expirationTtl: TOKEN_TTL_SECONDS - 24 * 3600 });
  return token;
}

async function handleTokenEndpoint(env: Env): Promise<Response> {
  try {
    const token = await getDeveloperToken(env);
    return new Response(JSON.stringify({ token }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'token error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}

async function handleApple(url: URL, env: Env): Promise<Response> {
  // Client calls e.g. /apple/v1/catalog/us/songs?filter[isrc]=USRC17607839
  const applePath = url.pathname.slice('/apple'.length);
  const upstream   = `${APPLE_BASE}${applePath}${url.search}`;
  const cacheKey   = `apple:${applePath}${url.search}`;

  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  let token: string;
  try {
    token = await getDeveloperToken(env);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'token error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(upstream, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'SongMatch/1.0' },
  });
  if (!res.ok) {
    return new Response(await res.text(), { status: res.status, headers: CORS });
  }

  const body = await res.text();
  // Catalog ISRC→artwork mappings are stable; 24h cache is plenty.
  await env.CACHE.put(cacheKey, body, { expirationTtl: 24 * 3600 });

  return new Response(body, {
    headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}
