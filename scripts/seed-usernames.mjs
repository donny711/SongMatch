/**
 * Patches the 5 seed users with usernames.
 * Run: node scripts/seed-usernames.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.mjs';

const app = initializeApp(firebaseConfig);

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
