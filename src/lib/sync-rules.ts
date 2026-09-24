import type { Db, User } from '../data/types';
import { ALL_ACCESS, STUDENT_ACCESS } from './auth';

/**
 * Server-side guard for writes to the shared document. Any signed-in SDSU user may
 * change registrations, notes, grades and so on (as the prototype always allowed),
 * but the list of users and their roles is protected: only an administrator can
 * change it, apart from the one change every account makes for itself on first
 * sign-in (creating its own student or bootstrap-admin record) and sign-in stamps.
 */
export type WriteCheck = { ok: true } | { ok: false; reason: string };

export function isAdminCaller(email: string, before: Db | null, adminEmails: string[]): boolean {
  const e = email.toLowerCase();
  if (adminEmails.includes(e)) return true;
  const me = before?.users.find((u) => u.email.toLowerCase() === e);
  return me?.role === 'admin';
}

const sameArray = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function sameExceptSignIn(a: User, b: User): boolean {
  return a.id === b.id && a.name === b.name && a.email.toLowerCase() === b.email.toLowerCase() && a.jobTitle === b.jobTitle
    && a.role === b.role && sameArray(a.access, b.access) && a.studentId === b.studentId && a.facultyId === b.facultyId;
}

export function validateWrite(email: string, before: Db | null, after: Db, adminEmails: string[]): WriteCheck {
  const e = email.toLowerCase();
  if (isAdminCaller(e, before, adminEmails)) return { ok: true };
  if (!before) return { ok: true }; // first document: whoever signs in first seeds it

  const afterByEmail = new Map(after.users.map((u) => [u.email.toLowerCase(), u]));
  for (const prev of before.users) {
    const next = afterByEmail.get(prev.email.toLowerCase());
    if (!next) return { ok: false, reason: `Removing user ${prev.email} requires an administrator.` };
    if (!sameExceptSignIn(prev, next)) {
      return { ok: false, reason: `Changing the account for ${prev.email} requires an administrator.` };
    }
    afterByEmail.delete(prev.email.toLowerCase());
  }
  // Whatever is left was added in this write.
  for (const [addedEmail, added] of afterByEmail) {
    if (addedEmail !== e) return { ok: false, reason: `Adding user ${added.email} requires an administrator.` };
    const wantsAdmin = adminEmails.includes(e);
    const okRole = wantsAdmin ? added.role === 'admin' && sameArray(added.access, ALL_ACCESS) : added.role === 'student' && sameArray(added.access, STUDENT_ACCESS);
    if (!okRole) return { ok: false, reason: 'A new account can only be created as a student.' };
  }
  return { ok: true };
}
