import type { Db, Student, Subsystem, User } from '../data/types.js';

/** Email domains allowed to create an account and sign in. Enforced here and by the Clerk allowlist. */
export const ALLOWED_DOMAINS = ['sdsu.edu'];

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).trim().toLowerCase();
}

/** True for any address on sdsu.edu or one of its subdomains. */
export function isAllowedEmail(email: string): boolean {
  const domain = emailDomain(email);
  return ALLOWED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Parses a comma- or space-separated list of addresses (VITE_ADMIN_EMAILS). */
export function adminEmails(raw: string | undefined): string[] {
  return (raw ?? '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** A fresh 8-digit ID starting with the current year, unused by any user or student. */
export function newStudentId(taken: Set<string>, year = new Date().getFullYear(), random = Math.random): string {
  for (let i = 0; i < 1000; i++) {
    const id = `${year}${String(Math.floor(random() * 10000)).padStart(4, '0')}`;
    if (!taken.has(id)) return id;
  }
  throw new Error('Could not allocate a student ID');
}

export const STUDENT_ACCESS: Subsystem[] = ['ER', 'REG', 'MAJOR', 'FCI'];
export const ALL_ACCESS: Subsystem[] = ['ER', 'REG', 'MAJOR', 'FCI', 'GRADE', 'USERS'];

export interface NewAccount { email: string; name: string; clerkUserId: string; admin: boolean; }

/** First sign-in with an allowed address: create the SignMeUp user, and a student record unless the address is an administrator. */
export function provisionUser(d: Db, a: NewAccount): { db: Db; user: User } {
  const email = a.email.toLowerCase();
  const id = newStudentId(new Set([...d.users.map((u) => u.id), ...d.students.map((s) => s.id)]));
  const name = a.name.trim() || email.split('@')[0];
  if (a.admin) {
    const user: User = { id, name, email, jobTitle: 'System administrator', role: 'admin', access: ALL_ACCESS, clerkUserId: a.clerkUserId };
    return { db: { ...d, users: [...d.users, user] }, user };
  }
  const parts = name.split(/\s+/);
  const student: Student = {
    id, firstName: parts[0], lastName: parts.slice(1).join(' ') || '', phone: '', address: '', dateOfBirth: '',
    majorId: 'UNDECLARED', graduate: false, standing: 'Good standing · New account', completed: [], transfer: [], notes: [],
  };
  const user: User = { id, name, email, jobTitle: 'Student', role: 'student', access: STUDENT_ACCESS, studentId: id, clerkUserId: a.clerkUserId };
  return { db: { ...d, users: [...d.users, user], students: [...d.students, student] }, user };
}
