import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { claimUsername, getOrCreateUserDoc, updateProfileFields } from './profileService';

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

  // Claim username in Firestore (transactional, enforces uniqueness)
  await claimUsername(uid, username.toLowerCase(), null);

  // Initialise the user profile doc (sets defaults if it doesn't exist)
  await getOrCreateUserDoc(uid);

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
