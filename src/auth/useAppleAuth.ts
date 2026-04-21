import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import { OAuthProvider, linkWithCredential, signInWithCredential } from 'firebase/auth';
import { auth } from '../firebase/config';

function generateRawNonce(length = 32): string {
  const bytes = getRandomBytes(length);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useAppleAuth() {
  const signIn = async (): Promise<void> => {
    const rawNonce = generateRawNonce();
    const hashedNonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce);

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const provider = new OAuthProvider('apple.com');
    const firebaseCredential = provider.credential({
      idToken: appleCredential.identityToken!,
      rawNonce,
    });

    const currentUser = auth.currentUser;
    if (currentUser?.isAnonymous) {
      try {
        await linkWithCredential(currentUser, firebaseCredential);
      } catch (linkError: any) {
        // Apple account already linked to a different Firebase UID (e.g. reinstall).
        // Sign in with the existing credential to restore that account.
        if (linkError.code === 'auth/credential-already-in-use') {
          const credential = linkError.credential ?? firebaseCredential;
          await signInWithCredential(auth, credential);
        } else {
          throw linkError;
        }
      }
    } else {
      await signInWithCredential(auth, firebaseCredential);
    }
  };

  return { signIn };
}
