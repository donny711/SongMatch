/**
 * Clears avatarUrl for all seed users so they show the default in-app avatar.
 * Run from the SoundMatch root:
 *   node scripts/clear-seed-avatars.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDs-YfseH3oC3cecffoqZFI1sHGivUeb5E',
  authDomain: 'soundmatch-d5496.firebaseapp.com',
  projectId: 'soundmatch-d5496',
  messagingSenderId: '794930413474',
  appId: '1:794930413474:web:d045f6ec46952fd7547cfb',
});

const db = getFirestore(app);

const SEED_UIDS = ['seed_user_1', 'seed_user_2', 'seed_user_3', 'seed_user_4', 'seed_user_5'];

const batch = writeBatch(db);
for (const uid of SEED_UIDS) {
  batch.update(doc(db, 'users', uid), { avatarUrl: null });
}
await batch.commit();

console.log('✅ Cleared avatarUrl for all seed users');
process.exit(0);
