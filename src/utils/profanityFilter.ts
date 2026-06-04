/**
 * Client-side profanity filter for username validation.
 * Case-insensitive check against a blocked word list.
 */

const BLOCKED_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'cock', 'pussy', 'cunt',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'whore', 'slut',
  'bastard', 'damn', 'piss', 'penis', 'vagina', 'anus', 'dildo',
  'porn', 'nazi', 'hitler', 'rape', 'molest', 'pedo', 'pedophile',
  'kill', 'murder', 'suicide', 'terrorist', 'kys',
];

/**
 * Returns true if the username contains a blocked word.
 */
export function containsProfanity(input: string): boolean {
  const lower = input.toLowerCase();
  return BLOCKED_WORDS.some((word) => lower.includes(word));
}

/**
 * Validates a username:
 * - Min 3 characters
 * - Alphanumeric + underscores only
 * - No profanity
 *
 * Returns null if valid, or an error message string.
 */
export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 20) return 'Username must be 20 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Only letters, numbers, and underscores';
  if (containsProfanity(username)) return 'That username is not allowed';
  return null;
}
