import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './config';
import { claimUsername, getOrCreateUserDoc, updateProfileFields } from './profileService';
import { deleteProfileImage } from './storageService';

/**
 * Sign up with email, password, and username.
 * Creates the Firebase Auth user, claims the username, and initialises the profile doc.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  username: string
): Promise<string> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  // Initialise the user profile doc first (sets defaults if it doesn't exist)
  await getOrCreateUserDoc(uid);

  // Claim username in Firestore (transactional, enforces uniqueness)
  await claimUsername(uid, username.toLowerCase(), null);

  // Store email on the profile doc for username-based login lookup
  await updateProfileFields(uid, { email });

  return uid;
}

/**
 * Log in with email and password.
 */
export async function logInWithEmail(
  emailOrUsername: string,
  password: string
): Promise<string> {
  let email = emailOrUsername;

  // If it doesn't look like an email, treat it as a username → look up email
  if (!emailOrUsername.includes('@')) {
    const usernameDoc = await getDoc(
      doc(db, 'usernames', emailOrUsername.toLowerCase())
    );
    if (!usernameDoc.exists()) {
      throw new Error('Username not found');
    }
    // Get the user's email from the users collection
    const userId = usernameDoc.data().uid;
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('Account not found');
    }
    email = userDoc.data().email;
    if (!email) {
      throw new Error('No email associated with this account');
    }
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user.uid;
}

/**
 * Send a password reset email. Accepts email or username.
 */
export async function resetPassword(emailOrUsername: string): Promise<void> {
  let email = emailOrUsername;

  if (!emailOrUsername.includes('@')) {
    const usernameDoc = await getDoc(
      doc(db, 'usernames', emailOrUsername.toLowerCase())
    );
    if (!usernameDoc.exists()) {
      throw new Error('Username not found');
    }
    const userId = usernameDoc.data().uid;
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('Account not found');
    }
    email = userDoc.data().email;
    if (!email) {
      throw new Error('No email associated with this account');
    }
  }

  await sendPasswordResetEmail(auth, email);
}

/**
 * Check if a username is available (case-insensitive).
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return !snap.exists();
}

/**
 * Permanently delete the signed-in account: Firestore data, profile images,
 * then the Firebase Auth user (App Store guideline 5.1.1(v)).
 *
 * Requires the password — Firebase demands a recent login for deleteUser.
 * Order matters: the auth user goes LAST, because security rules stop
 * authorizing our cleanup writes the moment it's gone.
 */
export async function deleteAccount(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in');
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, password)
  );
  const uid = user.uid;

  const profileSnap = await getDoc(doc(db, 'users', uid));
  const profile = profileSnap.exists()
    ? (profileSnap.data() as Record<string, unknown>)
    : {};

  // Liked tracks + the matching songLikes liker docs and counters.
  // 3 ops per track; Firestore batches cap at 500 ops.
  const tracksSnap = await getDocs(collection(db, 'likedTracks', uid, 'tracks'));
  const trackDocs = tracksSnap.docs;
  for (let i = 0; i < trackDocs.length; i += 150) {
    const batch = writeBatch(db);
    for (const d of trackDocs.slice(i, i + 150)) {
      const trackId = d.data().trackId as number;
      batch.delete(d.ref);
      batch.delete(doc(db, 'songLikes', String(trackId), 'likers', uid));
      batch.set(
        doc(db, 'songLikes', String(trackId)),
        { likerCount: increment(-1), updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
  }

  // Follows I created, with the other side's followerCount decrement (the
  // rules carve-out allows it when the follow doc is deleted in the same batch).
  const followsSnap = await getDocs(
    query(collection(db, 'follows'), where('followerId', '==', uid))
  );
  for (let i = 0; i < followsSnap.docs.length; i += 200) {
    const chunk = followsSnap.docs.slice(i, i + 200);
    try {
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
        batch.update(doc(db, 'users', d.data().followingId as string), {
          followerCount: increment(-1),
        });
      }
      await batch.commit();
    } catch {
      // Counter update can fail (e.g. that account is gone) — still remove
      // the follow docs themselves.
      const batch = writeBatch(db);
      for (const d of chunk) batch.delete(d.ref);
      await batch.commit().catch(() => {});
    }
  }
  // Follows TOWARD me can't be deleted under the rules (only the follower
  // may); they become orphans that every list already filters out.

  const finalBatch = writeBatch(db);
  if (typeof profile.username === 'string' && profile.username) {
    finalBatch.delete(doc(db, 'usernames', profile.username));
  }
  finalBatch.delete(doc(db, 'subscriptions', uid));
  finalBatch.delete(doc(db, 'users', uid));
  await finalBatch.commit();

  // Best-effort: profile images in storage.
  for (const url of [profile.avatarUrl, profile.bannerUrl, profile.gifBgUrl]) {
    if (typeof url === 'string' && url) await deleteProfileImage(url).catch(() => {});
  }

  await deleteUser(user);
}
