/**
 * Clears avatarUrl for all seed users so they show the default in-app avatar.
 * Run from the SoundMatch root:
 *   node scripts/clear-seed-avatars.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.mjs';

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const SEED_UIDS = ['seed_user_1', 'seed_user_2', 'seed_user_3', 'seed_user_4', 'seed_user_5'];

const batch = writeBatch(db);
for (const uid of SEED_UIDS) {
  batch.update(doc(db, 'users', uid), { avatarUrl: null });
}
await batch.commit();

console.log('✅ Cleared avatarUrl for all seed users');
process.exit(0);
