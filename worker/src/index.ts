interface Env {
  CACHE: KVNamespace;
  // MusicKit developer-token signing (set via `wrangler secret put`):
  MUSICKIT_TEAM_ID: string;
  MUSICKIT_KEY_ID: string;
  MUSICKIT_PRIVATE_KEY: string; // PKCS#8 PEM contents of the .p8 key
}

const APPLE_BASE  = 'https://api.music.apple.com';

// MusicKit developer token: Apple allows up to 6 months; we rotate at ~5 so the
// KV copy always refreshes well before Apple would reject an expired token.
const TOKEN_KV_KEY       = 'musickit:devtoken';
const TOKEN_TTL_SECONDS  = 150 * 24 * 3600; // ~5 months

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    const url = new URL(request.url);

    if (url.pathname === '/musickit/token')  return handleTokenEndpoint(env);
    if (url.pathname.startsWith('/apple/'))  return handleApple(url, env);

    return new Response('Not found', { status: 404 });
  },
};

// ── MusicKit (Apple Music) ──────────────────────────────────────────────────
//
// Signs the developer token server-side so the .p8 private key never reaches
// the client, and proxies Apple catalog calls with KV caching (per-track ISRC
// lookups are stable, so caching cuts Apple traffic dramatically).

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
