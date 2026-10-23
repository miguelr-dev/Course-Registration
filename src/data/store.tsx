import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth, useClerk, useSession, useUser } from '@clerk/react';
import { createSeed } from './seed';
import { canSwitchRoles, effectiveUser, type ViewAs } from '../lib/viewAs';
import { SyncClient } from './sync';
import type { CompletedCourse, Course, Db, NoteCategory, OutlineStatus, RegistrationType, Student, Subsystem, TransferCourse, User } from './types';
import { applyCourseSave, type CourseIssue } from '../lib/catalog';
import { nowIso } from '../lib/format';
import { registrationIssues, type EligibilityIssue } from '../lib/rules';
import { adminEmails, isAllowedEmail, provisionUser } from '../lib/auth';
import { changedFields, keyInfoBlock, LABELS, normalizeStudentInfo, selfEditableFields, studentInfoIssue, type StudentInfo } from '../lib/student';
import { applyHistorySave, type HistoryIssue, type HistoryKind } from '../lib/courseHistory';

const STORAGE_KEY = 'signmeup.db.v4'; // local cache of the shared document (and the whole store when the API is unavailable)
const STAMP_KEY = 'signmeup.stamped.v4';
const VIEW_KEY = 'signmeup.viewAs'; // role switcher choice, kept for this browser tab only

function loadView(): ViewAs | null {
  try { return JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? 'null') as ViewAs | null; } catch { return null; }
}
const POLL_MS = 15000;
// Tells this user's other SignMeUp windows that the shared document changed, so they reload it at once (GEN-01).
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('signmeup.db') : null;

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      return { ...parsed, valueLists: parsed.valueLists ?? {}, helpTopics: parsed.helpTopics ?? {} };
    }
  } catch { /* fall through to a fresh seed */ }
  return createSeed();
}

export type Result = { ok: true } | { ok: false; issues: EligibilityIssue[] };

/** What Clerk knows about the browser session, independent of the SignMeUp user record. */
export interface Session {
  ready: boolean; // Clerk has loaded, and for a signed-in user the shared document has been fetched (or found unavailable)
  email: string | null; // primary address of the signed-in Clerk user, lower-cased
  denied: boolean; // signed in, but the address is outside the allowed domain
}

/** 'shared': every change goes to the Supabase-backed API; 'local': the API is unavailable and changes stay in this browser. */
export type StoreMode = 'loading' | 'shared' | 'local';

type Mutation = (d: Db) => Db;

interface StoreApi {
  db: Db;
  user: User | null; // who the screens act as: the signed-in user, or the role an administrator is viewing as (FW-09)
  realUser: User | null; // always the signed-in user
  viewAs: ViewAs | null;
  setViewAs(v: ViewAs | null): void;
  session: Session;
  mode: StoreMode;
  syncError: string | null;
  lastSaveMs: number | null; // round-trip time of the last accepted write (GEN-02: under 5 seconds)
  dismissSyncError(): void;
  signOut(): void;
  resetDemo(): void;
  register(studentId: string, scheduleNo: string, type: RegistrationType): Result;
  drop(studentId: string, scheduleNo: string): void;
  requestWaiver(studentId: string, courseId: string, note: string): void;
  appendNote(studentId: string, category: NoteCategory, text: string): void;
  updateStudent(studentId: string, info: StudentInfo): { ok: true } | { ok: false; field: keyof StudentInfo; reason: string; requirement: string };
  saveCourse(course: Course, originalId: string | null): { ok: true } | ({ ok: false } & CourseIssue);
  saveCourseHistory(studentId: string, kind: HistoryKind, entry: CompletedCourse | TransferCourse, originalKey: string | null): { ok: true } | ({ ok: false } & HistoryIssue);
  setOutlineStatus(studentId: string, courseId: string, status: OutlineStatus, note?: string): void;
  addOutlineCourse(studentId: string, courseId: string): void;
  setGrade(scheduleNo: string, studentId: string, grade: string, note?: string): void;
  addGradeNote(scheduleNo: string, text: string): void;
  addUser(u: Omit<User, 'lastSignIn' | 'clerkUserId'>): { ok: true } | { ok: false; reason: string; requirement: string };
  updateUserAccess(userId: string, access: Subsystem[]): void;
  updateUser(userId: string, changes: Pick<User, 'name' | 'jobTitle' | 'role' | 'access'>): { ok: true } | { ok: false; reason: string; requirement: string };
  setPassword(userId: string, password: string): Promise<{ ok: true; created: boolean } | { ok: false; reason: string }>;
}

/** A student account is identified by its student ID (FW-08); this is the record it attaches to until the registrar completes it. */
function skeletonStudent(id: string, name: string): Student {
  const parts = name.trim().split(/\s+/);
  return {
    id, firstName: parts[0] ?? '', lastName: parts.slice(1).join(' '), phone: '', address: '', dateOfBirth: '',
    majorId: 'UNDECLARED', graduate: false, standing: 'Good standing · New account', completed: [], transfer: [], notes: [],
  };
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(loadDb);
  const [mode, setMode] = useState<StoreMode>('loading');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSaveMs, setLastSaveMs] = useState<number | null>(null);
  const [viewAs, setViewAsState] = useState<ViewAs | null>(loadView);
  const clerk = useClerk();
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { session: clerkSession } = useSession();

  // Shared-document bookkeeping: the last server state we know, its version, and changes not yet accepted by the server.
  const sync = useRef<SyncClient | null>(null);
  sync.current ??= new SyncClient(() => getToken());
  const serverDb = useRef<Db | null>(null);
  const version = useRef(0);
  const pending = useRef<Mutation[]>([]);
  const flushing = useRef(false);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }, [db]);

  const email = clerkUser?.primaryEmailAddress?.emailAddress.trim().toLowerCase() ?? null;
  const denied = !!email && !isAllowedEmail(email);
  const session: Session = { ready: isLoaded && (!email || denied || mode !== 'loading'), email, denied };
  const realUser = useMemo(() => (email && !denied ? db.users.find((u) => u.email.toLowerCase() === email) ?? null : null), [db.users, email, denied]);
  const user = useMemo(() => effectiveUser(realUser, viewAs), [realUser, viewAs]);

  const flush = useCallback(async () => {
    if (flushing.current || !sync.current) return;
    flushing.current = true;
    try {
      for (let attempt = 0; pending.current.length && attempt < 6; attempt++) {
        const batch = pending.current.slice();
        const base = serverDb.current ?? createSeed();
        const candidate = batch.reduce((d, m) => m(d), base);
        const started = performance.now();
        const r = await sync.current.save(version.current, candidate);
        if (r.kind === 'ok') {
          setLastSaveMs(Math.round(performance.now() - started));
          serverDb.current = candidate;
          version.current = r.version;
          pending.current.splice(0, batch.length);
          channel?.postMessage({ version: r.version });
        } else if (r.kind === 'conflict') {
          // Someone else wrote first: rebase our pending changes on their document and try again.
          serverDb.current = r.db ?? createSeed();
          version.current = r.version;
          setDb(pending.current.reduce((d, m) => m(d), serverDb.current));
        } else if (r.kind === 'refused') {
          pending.current = [];
          if (serverDb.current) setDb(serverDb.current);
          setSyncError(r.reason);
          break;
        } else {
          setSyncError(`Could not save to the shared database (${r.reason}). Retrying…`);
          retryTimer.current = window.setTimeout(() => { void flush(); }, 5000);
          break;
        }
      }
    } finally {
      flushing.current = false;
    }
  }, []);

  /** Apply a change locally now, and to the shared document as soon as the server accepts it. */
  const commit = useCallback((m: Mutation) => {
    setDb(m);
    if (mode === 'shared') {
      pending.current.push(m);
      void flush();
    }
  }, [mode, flush]);

  // First load after sign-in: fetch the shared document, or seed it if this is the very first user.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !email || denied || mode !== 'loading' || !sync.current) return;
    let cancelled = false;
    (async () => {
      const r = await sync.current!.load();
      if (cancelled) return;
      if (r.kind === 'ok') {
        if (r.db) {
          serverDb.current = r.db;
          version.current = r.version;
          setDb(r.db);
        } else {
          const seed = createSeed();
          const w = await sync.current!.save(0, seed);
          if (cancelled) return;
          if (w.kind === 'ok') { serverDb.current = seed; version.current = w.version; setDb(seed); }
          else if (w.kind === 'conflict' && w.db) { serverDb.current = w.db; version.current = w.version; setDb(w.db); }
          else {
            setMode('local');
            const why = w.kind === 'refused' ? w.reason : w.kind === 'unavailable' ? `Shared database unavailable (${w.reason}).` : 'Shared database returned an empty document.';
            setSyncError(`${why} Changes stay in this browser.`);
            return;
          }
        }
        setMode('shared');
      } else {
        setMode('local');
        setSyncError(`Shared database unavailable (${r.reason}). Changes stay in this browser.`);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, email, denied, mode]);

  // Local mode: other windows of this browser write the same storage key; follow their changes.
  useEffect(() => {
    if (mode !== 'local') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try { setDb(JSON.parse(e.newValue) as Db); } catch { /* ignore a partial write */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [mode]);

  // Pick up other people's changes while idle.
  useEffect(() => {
    if (mode !== 'shared') return;
    const tick = async (evenIfHidden = false) => {
      if ((!evenIfHidden && document.visibilityState !== 'visible') || pending.current.length || flushing.current || !sync.current) return;
      const r = await sync.current.load();
      if (r.kind === 'ok' && r.db && r.version !== version.current && !pending.current.length) {
        serverDb.current = r.db;
        version.current = r.version;
        setDb(r.db);
      }
    };
    const onVisible = () => { void tick(); };
    const id = window.setInterval(() => { void tick(); }, POLL_MS);
    const onSaved = (e: MessageEvent<{ version?: number }>) => { if (e.data?.version !== version.current) void tick(true); };
    document.addEventListener('visibilitychange', onVisible);
    channel?.addEventListener('message', onSaved);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); channel?.removeEventListener('message', onSaved); if (retryTimer.current) window.clearTimeout(retryTimer.current); };
  }, [mode]);

  // Once per Clerk session: stamp the sign-in, and on a first sign-in create the SignMeUp user (plus a student record).
  const clerkUserId = clerkUser?.id ?? null;
  const clerkName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ');
  const sessionId = clerkSession?.id ?? null;
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !email || !clerkUserId || !sessionId || denied || mode === 'loading') return;
    if (sessionStorage.getItem(STAMP_KEY) === sessionId) return;
    sessionStorage.setItem(STAMP_KEY, sessionId);
    const at = nowIso();
    commit((d) => {
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
  }, [isLoaded, isSignedIn, email, clerkUserId, clerkName, sessionId, denied, mode, commit]);

  const stamp = useCallback((d: Db, subsystem: Subsystem | 'FRAMEWORK', text: string, by?: string): Db => ({
    ...d, transactions: [...d.transactions, { at: nowIso(), by: by ?? user?.name ?? 'System', subsystem, text }],
  }), [user]);

  /** GEN-31: the standard message when a function needs a complete student record, or null. */
  const blockFor = (studentId: string) => {
    const s = db.students.find((x) => x.id === studentId);
    const b = s ? keyInfoBlock(s) : null;
    return b ? `${b.reason} ${b.requirement}` : null;
  };

  const api: StoreApi = {
    db, user, realUser, viewAs: canSwitchRoles(realUser) ? viewAs : null, session, mode, syncError, lastSaveMs,
    dismissSyncError() { setSyncError(null); },

    setViewAs(v) {
      if (v && !canSwitchRoles(realUser)) return;
      const next = v && v.role !== 'admin' ? v : null;
      setViewAsState(next);
      try { if (next) sessionStorage.setItem(VIEW_KEY, JSON.stringify(next)); else sessionStorage.removeItem(VIEW_KEY); } catch { /* not remembered across reloads */ }
    },

    signOut() { try { sessionStorage.removeItem(VIEW_KEY); } catch { /* nothing stored */ } void clerk.signOut({ redirectUrl: '/login' }); },

    resetDemo() {
      if (mode === 'shared' && user?.role !== 'admin') { setSyncError('Only an administrator can reset the shared sample data.'); return; }
      if (!confirm(mode === 'shared' ? 'Reset the shared sample data for everyone? Registrations, notes, grades and non-admin accounts are discarded.' : 'Reset the sample data? Registrations, notes and grades entered in this browser are discarded.')) return;
      const keep = user && user.role === 'admin' ? user : null;
      commit(() => { const seed = createSeed(); return keep ? { ...seed, users: [...seed.users, keep] } : seed; });
    },

    register(studentId, scheduleNo, type) {
      const student = db.students.find((s) => s.id === studentId);
      const offering = db.offerings.find((o) => o.scheduleNo === scheduleNo);
      if (!student || !offering) return { ok: false, issues: [{ code: 'level', reason: 'Course or student not found.', requirement: 'Choose a current offering.' }] };
      const issues = registrationIssues(db, student, offering);
      if (issues.length) return { ok: false, issues };
      const by = user?.name ?? `${student.firstName} ${student.lastName}`;
      commit((d) => stamp({ ...d, registrations: [...d.registrations, { studentId, scheduleNo, type, registeredBy: by, registeredAt: nowIso() }] }, 'REG', `Registered ${offering.courseId} (${scheduleNo}) for ${student.firstName} ${student.lastName}`));
      return { ok: true };
    },

    drop(studentId, scheduleNo) {
      const offering = db.offerings.find((o) => o.scheduleNo === scheduleNo);
      commit((d) => stamp({ ...d, registrations: d.registrations.filter((r) => !(r.studentId === studentId && r.scheduleNo === scheduleNo)) }, 'REG', `Dropped ${offering?.courseId ?? scheduleNo} (${scheduleNo})`));
    },

    requestWaiver(studentId, courseId, note) {
      const at = nowIso();
      commit((d) => stamp({
        ...d,
        students: d.students.map((s) => (s.id === studentId ? { ...s, notes: [...s.notes, { at, byEmployeeId: user?.id ?? studentId, category: 'advising', text: `Waiver requested for ${courseId}. ${note}`.trim() }] } : s)),
      }, 'REG', `Requested advisor waiver for ${courseId}`));
    },

    appendNote(studentId, category, text) {
      const at = nowIso();
      commit((d) => stamp({
        ...d,
        students: d.students.map((s) => (s.id === studentId ? { ...s, notes: [...s.notes, { at, byEmployeeId: user?.id ?? '0', category, text }] } : s)),
      }, 'ER', `Appended ${category} note to student ${studentId}`));
    },

    updateStudent(studentId, info) {
      const student = db.students.find((s) => s.id === studentId);
      if (!student) return { ok: false, field: 'lastName', reason: `Student ${studentId} was not found.`, requirement: 'Choose a student from the search.' };
      // A student may change their own contact details and fill in key information that is still blank; staff entries must leave the whole record valid.
      const own = user?.role === 'student';
      if (own && user?.studentId !== studentId) return { ok: false, field: 'phone', reason: 'You can change only your own record.', requirement: 'Open your own student record.' };
      const allowed = own ? selfEditableFields(student) : undefined;
      const issue = studentInfoIssue(db, info, undefined, allowed);
      if (issue) return { ok: false, ...issue };
      const normalized = normalizeStudentInfo(info);
      const next: StudentInfo = allowed ? { ...student, ...Object.fromEntries(allowed.map((f) => [f, normalized[f]])) } : normalized;
      const changed = changedFields(student, next);
      if (!changed.length) return { ok: true };
      commit((d) => stamp({
        ...d,
        students: d.students.map((s) => (s.id === studentId ? { ...s, ...next } : s)),
      }, 'ER', `Updated ${changed.map((f) => LABELS[f].toLowerCase()).join(', ')} for student ${studentId}`));
      return { ok: true };
    },

    saveCourse(course, originalId) {
      // FCI-03: the registrar (or an administrator) adds and maintains catalog courses; the server enforces the same rule (GEN-05).
      const r = applyCourseSave(db, user, course, originalId);
      if (!r.ok) return r;
      if (r.log) { const log = r.log; commit((d) => { const again = applyCourseSave(d, user, course, originalId); return again.ok && again.log ? stamp(again.db, 'FCI', log) : d; }); }
      return { ok: true };
    },

    saveCourseHistory(studentId, kind, entry, originalKey) {
      // ER-01, ER-04: staff maintain course completion information; the server limits it to staff with ER access (GEN-05).
      if (user?.role === 'student') return { ok: false, field: 'record', reason: 'Course history is entered by the registrar or another staff member.', requirement: 'Ask the registrar to add or correct the course.' };
      const r = applyHistorySave(db, studentId, kind, entry, originalKey);
      if (!r.ok) return r;
      if (r.log) { const log = r.log; commit((d) => { const again = applyHistorySave(d, studentId, kind, entry, originalKey); return again.ok && again.log ? stamp(again.db, 'ER', log) : d; }); }
      return { ok: true };
    },

    setOutlineStatus(studentId, courseId, status, note) {
      const blocked = blockFor(studentId);
      if (blocked) { setSyncError(blocked); return; }
      const at = nowIso();
      const by = user?.name ?? 'System';
      commit((d) => stamp({
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
      const blocked = blockFor(studentId);
      if (blocked) { setSyncError(blocked); return; }
      const at = nowIso();
      const by = user?.name ?? 'System';
      commit((d) => stamp({
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
      commit((d) => stamp({
        ...d,
        registrations: d.registrations.map((r) => (r.scheduleNo === scheduleNo && r.studentId === studentId
          ? { ...r, grade: grade || undefined, gradeNote: note ?? r.gradeNote, ...(byOther ? { gradeUpdatedBy: user!.name, gradeUpdatedAt: nowIso() } : {}) }
          : r)),
      }, 'GRADE', `Set grade ${grade || '(cleared)'} for ${studentId} in ${offering?.courseId ?? scheduleNo}`));
    },

    addGradeNote(scheduleNo, text) {
      commit((d) => stamp({ ...d, gradeNotes: [...d.gradeNotes, { scheduleNo, at: nowIso(), by: user?.name ?? 'System', text }] }, 'GRADE', `Added general note to ${scheduleNo}`));
    },

    addUser(u) {
      const email = u.email.trim().toLowerCase();
      if (!/^\d{5,8}$/.test(u.id)) return { ok: false, reason: 'Employee number is not valid.', requirement: 'Enter 5 to 8 digits, no letters or spaces.' };
      if (db.users.some((x) => x.id === u.id)) return { ok: false, reason: `Employee number ${u.id} already exists.`, requirement: 'Enter a number that is not assigned to another user.' };
      if (!u.name.trim()) return { ok: false, reason: 'Name is required.', requirement: 'Enter the user’s full name; hyphenated names are accepted.' };
      if (!isAllowedEmail(email)) return { ok: false, reason: 'Email address is not an SDSU address.', requirement: 'Enter the person’s @sdsu.edu address; that is what they sign in with.' };
      if (db.users.some((x) => x.email.toLowerCase() === email)) return { ok: false, reason: `${email} is already assigned to another user.`, requirement: 'Enter an address that no other user has.' };
      if (u.role === 'student') {
        if (!/^\d{8}$/.test(u.id)) return { ok: false, reason: 'Student ID is not valid.', requirement: 'Student accounts use the 8-digit student ID as their number.' };
        const added: User = { ...u, email, studentId: u.id };
        commit((d) => stamp({
          ...d,
          users: [...d.users, added],
          students: d.students.some((s) => s.id === u.id) ? d.students : [...d.students, skeletonStudent(u.id, u.name)],
        }, 'FRAMEWORK', `Added student account ${u.name} (${u.id}) for ${email}`));
        return { ok: true };
      }
      commit((d) => stamp({ ...d, users: [...d.users, { ...u, email }] }, 'FRAMEWORK', `Added user ${u.name} (${u.id}) for ${email}`));
      return { ok: true };
    },

    updateUserAccess(userId, access) {
      commit((d) => stamp({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, access } : u)) }, 'FRAMEWORK', `Updated access areas for ${userId}: ${access.join(', ') || 'none'}`));
    },

    updateUser(userId, changes) {
      const prev = db.users.find((u) => u.id === userId);
      if (!prev) return { ok: false, reason: `User ${userId} was not found.`, requirement: 'Choose a user from the list.' };
      const name = changes.name.trim().replace(/\s+/g, ' ');
      const jobTitle = changes.jobTitle.trim();
      if (!name) return { ok: false, reason: 'Name is required.', requirement: 'Enter the user’s full name; hyphenated names are accepted.' };
      if (!jobTitle) return { ok: false, reason: 'Job title is required.', requirement: 'Enter the user’s position, e.g. Lecturer, Biology.' };
      if (!changes.access.length) return { ok: false, reason: 'No access areas selected.', requirement: 'Choose at least one subsystem.' };
      if (userId === user?.id && (changes.role !== 'admin' || !changes.access.includes('USERS'))) return { ok: false, reason: 'You cannot remove your own administrator access.', requirement: 'Keep the System administrator role and the USERS area, or ask another administrator to change it.' };
      if (changes.role === 'student' && !/^\d{8}$/.test(userId)) return { ok: false, reason: 'Only an account numbered with an 8-digit student ID can be a student.', requirement: 'Add a new student account under the student ID instead.' };
      const next: User = { ...prev, name, jobTitle, role: changes.role, access: changes.access, ...(changes.role === 'student' ? { studentId: userId } : {}) };
      const changed = (['name', 'jobTitle', 'role', 'access'] as const).filter((k) => String(prev[k]) !== String(next[k]));
      if (!changed.length) return { ok: true };
      const labels = { name: 'name', jobTitle: 'job title', role: 'role', access: 'access areas' };
      commit((d) => stamp({
        ...d,
        users: d.users.map((u) => (u.id === userId ? next : u)),
        students: next.studentId && !d.students.some((s) => s.id === next.studentId) ? [...d.students, skeletonStudent(next.studentId, name)] : d.students,
      }, 'FRAMEWORK', `Updated ${changed.map((k) => labels[k]).join(', ')} for user ${userId}`));
      return { ok: true };
    },

    async setPassword(userId, password) {
      const target = db.users.find((u) => u.id === userId);
      if (user?.role !== 'admin') return { ok: false, reason: 'Only a system administrator can set passwords.' };
      if (mode !== 'shared' || !sync.current) return { ok: false, reason: 'Passwords can only be set while connected to the shared database.' };
      const r = await sync.current.setPassword(userId, password);
      if (r.ok) commit((d) => stamp(d, 'FRAMEWORK', `${r.created ? 'Initialized' : 'Reset'} password for ${target?.name ?? userId} (${userId})`));
      return r;
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
