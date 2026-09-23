import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useClerk, useSession, useUser } from '@clerk/react';
import { createSeed } from './seed';
import type { Db, NoteCategory, OutlineStatus, RegistrationType, Subsystem, User } from './types';
import { nowIso } from '../lib/format';
import { registrationIssues, type EligibilityIssue } from '../lib/rules';
import { adminEmails, isAllowedEmail, provisionUser } from '../lib/auth';

const STORAGE_KEY = 'signmeup.db.v2';
const STAMP_KEY = 'signmeup.stamped.v2';

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch { /* fall through to a fresh seed */ }
  return createSeed();
}

export type Result = { ok: true } | { ok: false; issues: EligibilityIssue[] };

/** What Clerk knows about the browser session, independent of the SignMeUp user record. */
export interface Session {
  ready: boolean; // Clerk has loaded and we know whether someone is signed in
  email: string | null; // primary address of the signed-in Clerk user, lower-cased
  denied: boolean; // signed in, but the address is outside the allowed domain
}

interface StoreApi {
  db: Db;
  user: User | null;
  session: Session;
  signOut(): void;
  resetDemo(): void;
  register(studentId: string, scheduleNo: string, type: RegistrationType): Result;
  drop(studentId: string, scheduleNo: string): void;
  requestWaiver(studentId: string, courseId: string, note: string): void;
  appendNote(studentId: string, category: NoteCategory, text: string): void;
  setOutlineStatus(studentId: string, courseId: string, status: OutlineStatus, note?: string): void;
  addOutlineCourse(studentId: string, courseId: string): void;
  setGrade(scheduleNo: string, studentId: string, grade: string, note?: string): void;
  addGradeNote(scheduleNo: string, text: string): void;
  addUser(u: Omit<User, 'lastSignIn' | 'clerkUserId'>): { ok: true } | { ok: false; reason: string; requirement: string };
  updateUserAccess(userId: string, access: Subsystem[]): void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(loadDb);
  const clerk = useClerk();
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { session: clerkSession } = useSession();

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }, [db]);

  const email = clerkUser?.primaryEmailAddress?.emailAddress.trim().toLowerCase() ?? null;
  const denied = !!email && !isAllowedEmail(email);
  const session: Session = { ready: isLoaded, email, denied };
  const user = useMemo(() => (email && !denied ? db.users.find((u) => u.email.toLowerCase() === email) ?? null : null), [db.users, email, denied]);

  // Once per Clerk session: stamp the sign-in, and on a first sign-in create the SignMeUp user (plus a student record).
  const clerkUserId = clerkUser?.id ?? null;
  const clerkName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ');
  const sessionId = clerkSession?.id ?? null;
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !email || !clerkUserId || !sessionId || denied) return;
    if (sessionStorage.getItem(STAMP_KEY) === sessionId) return;
    sessionStorage.setItem(STAMP_KEY, sessionId);
    const at = nowIso();
    setDb((d) => {
      const existing = d.users.find((u) => u.email.toLowerCase() === email);
      if (existing) {
        return {
          ...d,
          users: d.users.map((u) => (u.id === existing.id ? { ...u, lastSignIn: at, clerkUserId } : u)),
          transactions: [...d.transactions, { at, by: existing.name, subsystem: 'FRAMEWORK', text: 'Signed in' }],
        };
      }
      const admin = adminEmails(import.meta.env.VITE_ADMIN_EMAILS as string | undefined).includes(email);
      const created = provisionUser(d, { email, name: clerkName, clerkUserId, admin });
      return {
        ...created.db,
        users: created.db.users.map((u) => (u.id === created.user.id ? { ...u, lastSignIn: at } : u)),
        transactions: [
          ...created.db.transactions,
          { at, by: created.user.name, subsystem: 'FRAMEWORK', text: `Created ${admin ? 'administrator' : 'student'} account for ${email}` },
          { at, by: created.user.name, subsystem: 'FRAMEWORK', text: 'Signed in' },
        ],
      };
    });
  }, [isLoaded, isSignedIn, email, clerkUserId, clerkName, sessionId, denied]);

  const stamp = useCallback((d: Db, subsystem: Subsystem | 'FRAMEWORK', text: string, by?: string): Db => ({
    ...d, transactions: [...d.transactions, { at: nowIso(), by: by ?? user?.name ?? 'System', subsystem, text }],
  }), [user]);

  const api: StoreApi = {
    db, user, session,

    signOut() { void clerk.signOut({ redirectUrl: '/login' }); },

    resetDemo() {
      if (!confirm('Reset the sample data? Registrations, notes and grades entered in this browser are discarded.')) return;
      setDb(createSeed());
    },

    register(studentId, scheduleNo, type) {
      const student = db.students.find((s) => s.id === studentId);
      const offering = db.offerings.find((o) => o.scheduleNo === scheduleNo);
      if (!student || !offering) return { ok: false, issues: [{ code: 'level', reason: 'Course or student not found.', requirement: 'Choose a current offering.' }] };
      const issues = registrationIssues(db, student, offering);
      if (issues.length) return { ok: false, issues };
      const by = user?.name ?? `${student.firstName} ${student.lastName}`;
      setDb((d) => stamp({ ...d, registrations: [...d.registrations, { studentId, scheduleNo, type, registeredBy: by, registeredAt: nowIso() }] }, 'REG', `Registered ${offering.courseId} (${scheduleNo}) for ${student.firstName} ${student.lastName}`));
      return { ok: true };
    },

    drop(studentId, scheduleNo) {
      const offering = db.offerings.find((o) => o.scheduleNo === scheduleNo);
      setDb((d) => stamp({ ...d, registrations: d.registrations.filter((r) => !(r.studentId === studentId && r.scheduleNo === scheduleNo)) }, 'REG', `Dropped ${offering?.courseId ?? scheduleNo} (${scheduleNo})`));
    },

    requestWaiver(studentId, courseId, note) {
      const at = nowIso();
      setDb((d) => stamp({
        ...d,
        students: d.students.map((s) => (s.id === studentId ? { ...s, notes: [...s.notes, { at, byEmployeeId: user?.id ?? studentId, category: 'advising', text: `Waiver requested for ${courseId}. ${note}`.trim() }] } : s)),
      }, 'REG', `Requested advisor waiver for ${courseId}`));
    },

    appendNote(studentId, category, text) {
      const at = nowIso();
      setDb((d) => stamp({
        ...d,
        students: d.students.map((s) => (s.id === studentId ? { ...s, notes: [...s.notes, { at, byEmployeeId: user?.id ?? '0', category, text }] } : s)),
      }, 'ER', `Appended ${category} note to student ${studentId}`));
    },

    setOutlineStatus(studentId, courseId, status, note) {
      const at = nowIso();
      const by = user?.name ?? 'System';
      setDb((d) => stamp({
        ...d,
        outlines: d.outlines.map((o) => {
          if (o.studentId !== studentId) return o;
          const prev = o.entries.find((e) => e.courseId === courseId);
          const label = (s: OutlineStatus) => s[0].toUpperCase() + s.slice(1);
          return {
            ...o,
            entries: o.entries.map((e) => (e.courseId === courseId ? { ...e, status, statusDate: at.slice(0, 10), by, note } : e)),
            history: [...o.history, { at, by, action: `${courseId} status ${prev ? label(prev.status) : '—'} → ${label(status)}${note ? ` (${note})` : ''}` }],
          };
        }),
      }, 'MAJOR', `Set ${courseId} to ${status} on outline for ${studentId}`));
    },

    addOutlineCourse(studentId, courseId) {
      const at = nowIso();
      const by = user?.name ?? 'System';
      setDb((d) => stamp({
        ...d,
        outlines: d.outlines.map((o) => (o.studentId !== studentId || o.entries.some((e) => e.courseId === courseId) ? o : {
          ...o,
          entries: [...o.entries, { courseId, status: 'approved', statusDate: at.slice(0, 10), by }],
          history: [...o.history, { at, by, action: `Added ${courseId} as Approved` }],
          approvedBy: by, approvedAt: at,
        })),
      }, 'MAJOR', `Added ${courseId} to outline for ${studentId}`));
    },

    setGrade(scheduleNo, studentId, grade, note) {
      const offering = db.offerings.find((o) => o.scheduleNo === scheduleNo);
      const instructorUser = db.users.find((u) => u.facultyId === offering?.instructorId);
      const byOther = user && instructorUser && user.id !== instructorUser.id;
      setDb((d) => stamp({
        ...d,
        registrations: d.registrations.map((r) => (r.scheduleNo === scheduleNo && r.studentId === studentId
          ? { ...r, grade: grade || undefined, gradeNote: note ?? r.gradeNote, ...(byOther ? { gradeUpdatedBy: user!.name, gradeUpdatedAt: nowIso() } : {}) }
          : r)),
      }, 'GRADE', `Set grade ${grade || '(cleared)'} for ${studentId} in ${offering?.courseId ?? scheduleNo}`));
    },

    addGradeNote(scheduleNo, text) {
      setDb((d) => stamp({ ...d, gradeNotes: [...d.gradeNotes, { scheduleNo, at: nowIso(), by: user?.name ?? 'System', text }] }, 'GRADE', `Added general note to ${scheduleNo}`));
    },

    addUser(u) {
      const email = u.email.trim().toLowerCase();
      if (!/^\d{5,8}$/.test(u.id)) return { ok: false, reason: 'Employee number is not valid.', requirement: 'Enter 5 to 8 digits, no letters or spaces.' };
      if (db.users.some((x) => x.id === u.id)) return { ok: false, reason: `Employee number ${u.id} already exists.`, requirement: 'Enter a number that is not assigned to another user.' };
      if (!u.name.trim()) return { ok: false, reason: 'Name is required.', requirement: 'Enter the user’s full name; hyphenated names are accepted.' };
      if (!isAllowedEmail(email)) return { ok: false, reason: 'Email address is not an SDSU address.', requirement: 'Enter the person’s @sdsu.edu address; that is what they sign in with.' };
      if (db.users.some((x) => x.email.toLowerCase() === email)) return { ok: false, reason: `${email} is already assigned to another user.`, requirement: 'Enter an address that no other user has.' };
      setDb((d) => stamp({ ...d, users: [...d.users, { ...u, email }] }, 'FRAMEWORK', `Added user ${u.name} (${u.id}) for ${email}`));
      return { ok: true };
    },

    updateUserAccess(userId, access) {
      setDb((d) => stamp({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, access } : u)) }, 'FRAMEWORK', `Updated access areas for ${userId}: ${access.join(', ') || 'none'}`));
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
