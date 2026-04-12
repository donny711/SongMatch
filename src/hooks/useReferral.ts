import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useProfileStore } from '../store/profileStore';
import { recordReferralInstall } from '../firebase/referralService';

const PENDING_REFERRAL_KEY = 'sm_pending_referral_code';

function extractCode(url: string | null | undefined): string | null {
  if (!url) return null;
  // Matches: songmatch://invite/ABC12345
  const match = url.match(/invite\/([A-Z0-9]{6,10})/i);
  return match ? match[1].toUpperCase() : null;
}

async function savePendingCode(url: string | null | undefined): Promise<void> {
  const code = extractCode(url);
  if (code) {
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
  }
}

export function useReferral(): void {
  const uid = useProfileStore((s) => s.uid);
  const appliedRef = useRef(false);

  // Capture the URL that cold-started the app
  useEffect(() => {
    Linking.getInitialURL()
      .then(savePendingCode)
      .catch(() => {});

    const sub = Linking.addEventListener('url', ({ url }) => {
      savePendingCode(url).catch(() => {});
    });

    return () => sub.remove();
  }, []);

  // When UID is ready, apply any pending referral code
  useEffect(() => {
    if (!uid || appliedRef.current) return;
    appliedRef.current = true;

    (async () => {
      try {
        // Guard: skip if user was already referred
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists() && userSnap.data().referredBy) return;

        const code = await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
        if (!code) return;

        await recordReferralInstall(uid, code);
        await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
      } catch {
        // Non-critical — silent fail
      }
    })();
  }, [uid]);
}
