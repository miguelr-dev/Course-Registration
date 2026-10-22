import { describe, expect, it } from 'vitest';
import { createSeed } from '../../src/data/seed';
import { provisionUser } from '../../src/lib/auth';
import type { Db } from '../../src/data/types';
import { checkObjectPermissions } from './permissions';

const IN_WINDOW = '2026-12-15';
const MID_TERM = '2026-10-21';
const db = createSeed();
const email = (id: string) => db.users.find((u) => u.id === id)!.email;
const MARIA = '20231847'; // student
const TOMAS = '20230419'; // student
const ROSA = '30117'; // advisor for CS-BS
const LENA = '27310'; // faculty, advisor for MATH-MIN only
const PRIYA = '41208'; // registrar staff (ER only)
const ADMIN = '10093';
const nameOf = (id: string) => db.users.find((u) => u.id === id)!.name;
const nakamuraOffering = db.offerings.find((o) => o.instructorId === 'F-10231' && db.registrations.some((r) => r.scheduleNo === o.scheduleNo))!;
const nakamura = db.users.find((u) => u.facultyId === 'F-10231')!;

const check = (id: string, after: Db, today = MID_TERM) => checkObjectPermissions(email(id), db, after, [], today);
const stamp = (d: Db, by: string, text = 'did something'): Db => ({ ...d, transactions: [...d.transactions, { at: '2026-10-21T10:00:00', by, subsystem: 'REG', text }] });
const editStudent = (id: string, change: Partial<Db['students'][number]>): Db => ({ ...db, students: db.students.map((s) => (s.id === id ? { ...s, ...change } : s)) });
const addNote = (studentId: string, by: string): Db => ({ ...db, students: db.students.map((s) => (s.id === studentId ? { ...s, notes: [...s.notes, { at: '2026-10-21T10:00:00', byEmployeeId: by, category: 'advising' as const, text: 'Met to discuss' }] } : s)) });
const register = (studentId: string, scheduleNo: string): Db => ({ ...db, registrations: [...db.registrations, { studentId, scheduleNo, type: 'letter' as const, registeredBy: 'x', registeredAt: '2026-10-21T10:00:00' }] });
const grade = (scheduleNo: string, g: string, note?: string): Db => {
  const target = db.registrations.find((r) => r.scheduleNo === scheduleNo)!;
  return { ...db, registrations: db.registrations.map((r) => (r === target ? { ...r, grade: g, gradeNote: note } : r)) };
};

describe('object-based security', () => {
  it('lets administrators change anything', () => {
    expect(check(ADMIN, { ...db, courses: [], students: [] })).toEqual({ ok: true });
  });

  it('lets a new account create only its own student record on first sign-in', () => {
    const created = provisionUser(db, { email: 'new@sdsu.edu', name: 'Ana Ruiz-Soto', clerkUserId: 'u1', admin: false });
    const after = stamp(created.db, created.user.name, 'Signed in');
    expect(checkObjectPermissions('new@sdsu.edu', db, after, [])).toEqual({ ok: true });
    const extra = { ...after, students: [...after.students, { ...after.students.at(-1)!, id: '99999999' }] };
    expect(checkObjectPermissions('new@sdsu.edu', db, extra, []).ok).toBe(false);
  });

  it('labels transactions with the signed-in user only, and never rewrites them', () => {
    expect(check(MARIA, stamp(db, nameOf(MARIA)))).toEqual({ ok: true });
    expect(check(MARIA, stamp(db, nameOf(ROSA))).ok).toBe(false);
    expect(check(MARIA, { ...db, transactions: db.transactions.slice(1) }).ok).toBe(false);
  });

  it('lets a student register and drop only for themself', () => {
    const open = db.offerings.find((o) => !db.registrations.some((r) => r.studentId === MARIA && r.scheduleNo === o.scheduleNo))!;
    expect(check(MARIA, register(MARIA, open.scheduleNo))).toEqual({ ok: true });
    expect(check(MARIA, register(TOMAS, open.scheduleNo)).ok).toBe(false);
    const mine = db.registrations.find((r) => r.studentId === MARIA && !r.grade)!;
    expect(check(MARIA, { ...db, registrations: db.registrations.filter((r) => r !== mine) })).toEqual({ ok: true });
    const theirs = db.registrations.find((r) => r.studentId === TOMAS)!;
    expect(check(MARIA, { ...db, registrations: db.registrations.filter((r) => r !== theirs) }).ok).toBe(false);
  });

  it('lets a student change their own telephone and address, nothing else', () => {
    expect(check(MARIA, editStudent(MARIA, { phone: '(619) 555-0100', address: '5500 Campanile Dr, San Diego, CA 92182' }))).toEqual({ ok: true });
    expect(check(MARIA, editStudent(MARIA, { graduate: true })).ok).toBe(false);
    expect(check(MARIA, editStudent(TOMAS, { phone: '(619) 555-0100' })).ok).toBe(false);
    expect(check(ROSA, editStudent(TOMAS, { majorId: 'UNDECLARED', minorId: 'MATH-MIN' }))).toEqual({ ok: true });
  });

  it('keeps notes append-only and stamped with the author’s own ID', () => {
    expect(check(PRIYA, addNote(TOMAS, PRIYA))).toEqual({ ok: true });
    expect(check(PRIYA, addNote(TOMAS, ROSA)).ok).toBe(false);
    expect(check(MARIA, addNote(MARIA, MARIA))).toEqual({ ok: true }); // waiver request on her own record
    expect(check(MARIA, addNote(TOMAS, MARIA)).ok).toBe(false);
    const withNote = db.students.find((s) => s.notes.length)!;
    expect(check(PRIYA, editStudent(withNote.id, { notes: withNote.notes.slice(1) })).ok).toBe(false);
  });

  it('gives grades to the primary instructor, inside the grade window', () => {
    expect(check(nakamura.id, grade(nakamuraOffering.scheduleNo, 'A'), IN_WINDOW)).toEqual({ ok: true });
    expect(check(nakamura.id, grade(nakamuraOffering.scheduleNo, 'A'), MID_TERM).ok).toBe(false);
    expect(check(nakamura.id, grade(nakamuraOffering.scheduleNo, '', 'Extension to Jan 15'), MID_TERM)).toEqual({ ok: true }); // notes any time
    expect(check(LENA, grade(nakamuraOffering.scheduleNo, 'A'), IN_WINDOW).ok).toBe(false);
    expect(check(MARIA, grade(nakamuraOffering.scheduleNo, 'A'), IN_WINDOW).ok).toBe(false);
  });

  it('gives approved outlines to the major’s advisors and never deletes entries', () => {
    const maria = db.outlines.find((o) => o.studentId === MARIA)!;
    const changed: Db = { ...db, outlines: db.outlines.map((o) => (o === maria ? { ...o, entries: o.entries.map((e, i) => (i === 0 ? { ...e, status: 'waived' as const } : e)), history: [...o.history, { at: '2026-10-21T10:00:00', by: nameOf(ROSA), action: 'waived' }] } : o)) };
    expect(check(ROSA, changed)).toEqual({ ok: true });
    expect(check(LENA, changed).ok).toBe(false); // advisor, but not for CS-BS
    expect(check(MARIA, changed).ok).toBe(false);
    const removed: Db = { ...db, outlines: db.outlines.map((o) => (o === maria ? { ...o, entries: o.entries.slice(1) } : o)) };
    expect(check(ROSA, removed).ok).toBe(false);
  });

  it('keeps the catalog with the registrar', () => {
    const renamed: Db = { ...db, courses: db.courses.map((c, i) => (i === 0 ? { ...c, title: 'Renamed' } : c)) };
    expect(check(PRIYA, renamed)).toEqual({ ok: true });
    expect(check(ROSA, renamed).ok).toBe(false);
    expect(check(MARIA, renamed)).toMatchObject({ ok: false, reason: expect.stringMatching(/registrar/) });
  });

  it('accepts a document whose arrays come back from storage in a different order', () => {
    const reordered: Db = { ...db, registrations: [...db.registrations].reverse(), students: [...db.students].reverse(), users: db.users.map((u) => ({ ...u, access: [...u.access].reverse() })) };
    expect(check(MARIA, reordered)).toEqual({ ok: true });
  });
});
