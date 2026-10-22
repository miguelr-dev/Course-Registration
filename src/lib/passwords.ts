/** Password rules applied before a password is sent to the sign-in service (FW-05, FW-07). */
export interface PasswordIssue { reason: string; requirement: string; }

const REQUIREMENT = 'Use at least 10 characters with at least one letter and one digit.';

export function passwordIssue(pw: string): PasswordIssue | null {
  if (!pw) return { reason: 'Password is required.', requirement: REQUIREMENT };
  if (pw.length < 10) return { reason: 'Password is too short.', requirement: REQUIREMENT };
  if (pw.length > 72) return { reason: 'Password is longer than 72 characters.', requirement: 'Shorten it to 72 characters or fewer.' };
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { reason: 'Password needs both letters and digits.', requirement: REQUIREMENT };
  if (/\s/.test(pw)) return { reason: 'Password contains spaces.', requirement: 'Remove the spaces.' };
  return null;
}

/** A random temporary password the administrator reads to the user once; it is never stored by SignMeUp. */
export function temporaryPassword(random: (n: number) => number = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'; // no l, I, O: easy to read aloud
  const digits = '23456789';
  const pick = (set: string) => set[random(set.length)];
  const chars = [...Array.from({ length: 10 }, () => pick(letters)), pick(digits), pick(digits)];
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}
