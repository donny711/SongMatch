import * as Crypto from 'expo-crypto';

export function generateCodeVerifier(length = 128): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = new Uint8Array(length);
  // expo-crypto fills via getRandomValues
  crypto.getRandomValues(randomValues);
  for (const v of randomValues) {
    result += chars[v % chars.length];
  }
  return result;
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  // Base64url encode (no padding, replace + / with - _)
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
