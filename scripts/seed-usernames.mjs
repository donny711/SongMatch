/**
 * Patches the 5 seed users with usernames.
 * Run: node scripts/seed-usernames.mjs
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

const USERS = [
  { uid: 'seed_user_1', username: 'alex_rivers' },
  { uid: 'seed_user_2', username: 'maya_chen' },
  { uid: 'seed_user_3', username: 'jordan_blake' },
  { uid: 'seed_user_4', username: 'sam_torres' },
  { uid: 'seed_user_5', username: 'riley_kim' },
];

const batch = writeBatch(db);

for (const { uid, username } of USERS) {
  batch.update(doc(db, 'users', uid), { username });
  batch.set(doc(db, 'usernames', username), { uid });
}

await batch.commit();
console.log('✅ Usernames set:');
USERS.forEach(({ username }) => console.log(`   @${username}`));
process.exit(0);
