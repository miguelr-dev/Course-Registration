import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createSeed } from './seed';
import type { Db, NoteCategory, OutlineStatus, RegistrationType, Subsystem, User } from './types';
import { nowIso } from '../lib/format';
import { registrationIssues, type EligibilityIssue } from '../lib/rules';

const STORAGE_KEY = 'signmeup.db.v1';
const SESSION_KEY = 'signmeup.session.v1';

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch { /* fall through to a fresh seed */ }
  return createSeed();
}

export type Result = { ok: true } | { ok: false; issues: EligibilityIssue[] };

interface StoreApi {
  db: Db;
  user: User | null;
  signIn(id: string, password: string): { ok: true } | { ok: false; field: 'id' | 'password'; reason: string; requirement: string };
  signOut(): void;
  changePassword(next: string): void;
  resetDemo(): void;
  register(studentId: string, scheduleNo: string, type: RegistrationType): Result;
  drop(studentId: string, scheduleNo: string): void;
  requestWaiver(studentId: string, courseId: string, note: string): void;
  appendNote(studentId: string, category: NoteCategory, text: string): void;
  setOutlineStatus(studentId: string, courseId: string, status: OutlineStatus, note?: string): void;
  addOutlineCourse(studentId: string, courseId: string): void;
  setGrade(scheduleNo: string, studentId: string, grade: string, note?: string): void;
  addGradeNote(scheduleNo: string, text: string): void;
  resetPassword(userId: string, temporary: string, mustChange: boolean): void;
  addUser(u: Omit<User, 'mustChangePassword' | 'passwordSetAt'>): { ok: true } | { ok: false; reason: string; requirement: string };
  updateUserAccess(userId: string, access: Subsystem[]): void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(loadDb);
  const [userId, setUserId] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }, [db]);
  useEffect(() => { if (userId) sessionStorage.setItem(SESSION_KEY, userId); else sessionStorage.removeItem(SESSION_KEY); }, [userId]);

  const user = useMemo(() => db.users.find((u) => u.id === userId) ?? null, [db.users, userId]);

  const stamp = useCallback((d: Db, subsystem: Subsystem | 'FRAMEWORK', text: string, by?: string): Db => ({
    ...d, transactions: [...d.transactions, { at: nowIso(), by: by ?? user?.name ?? 'System', subsystem, text }],
  }), [user]);

  const api: StoreApi = {
    db, user,

    signIn(id, password) {
      const clean = id.trim();
      if (!/^\d{5,8}$/.test(clean)) {
        return { ok: false, field: 'id', reason: 'ID not found.', requirement: 'Enter your 5- to 8-digit student or employee number, digits only.' };
      }
      const u = db.users.find((x) => x.id === clean);
      if (!u) return { ok: false, field: 'id', reason: 'ID not found.', requirement: 'Enter the student or employee number issued to you.' };
      if (u.password !== password) return { ok: false, field: 'password', reason: 'Password does not match this ID.', requirement: 'Enter the current password for this ID, or ask a system administrator to reset it.' };
      setDb((d) => stamp({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, lastSignIn: nowIso() } : x)) }, 'FRAMEWORK', `Signed in`, u.name));
      setUserId(u.id);
      return { ok: true };
    },

    signOut() { setUserId(null); },

    changePassword(next) {
      if (!user) return;
      setDb((d) => stamp({ ...d, users: d.users.map((x) => (x.id === user.id ? { ...x, password: next, mustChangePassword: false, passwordSetAt: nowIso().slice(0, 10) } : x)) }, 'FRAMEWORK', 'Changed own password'));
    },

    resetDemo() { setDb(createSeed()); setUserId(null); },

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

    resetPassword(userId, temporary, mustChange) {
      const target = db.users.find((u) => u.id === userId);
      setDb((d) => stamp({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, password: temporary, mustChangePassword: mustChange, passwordSetAt: nowIso().slice(0, 10) } : u)) }, 'FRAMEWORK', `Reset password for ${target?.name ?? userId} (${userId})`));
    },

    addUser(u) {
      if (!/^\d{5,8}$/.test(u.id)) return { ok: false, reason: 'Employee number is not valid.', requirement: 'Enter 5 to 8 digits, no letters or spaces.' };
      if (db.users.some((x) => x.id === u.id)) return { ok: false, reason: `Employee number ${u.id} already exists.`, requirement: 'Enter a number that is not assigned to another user.' };
      if (!u.name.trim()) return { ok: false, reason: 'Name is required.', requirement: 'Enter the user’s full name; hyphenated names are accepted.' };
      if (u.password.length < 12) return { ok: false, reason: 'Temporary password is too short.', requirement: 'Use at least 12 characters with a letter, a number and a symbol.' };
      setDb((d) => stamp({ ...d, users: [...d.users, { ...u, mustChangePassword: true, passwordSetAt: nowIso().slice(0, 10) }] }, 'FRAMEWORK', `Added user ${u.name} (${u.id})`));
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
