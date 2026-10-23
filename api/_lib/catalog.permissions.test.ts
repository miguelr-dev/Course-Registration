import { describe, expect, it } from 'vitest';
import { createSeed } from '../../src/data/seed';
import type { Course, Db } from '../../src/data/types';
import { applyCourseSave } from '../../src/lib/catalog';
import { checkObjectPermissions } from './permissions';
import { docToTables, tablesToDoc } from './mapping';

/** FCI-03 end to end: what the screen saves must pass the server's object-based security and survive storage. */
const db = createSeed();
const email = (id: string) => db.users.find((u) => u.id === id)!.email;
const nameOf = (id: string) => db.users.find((u) => u.id === id)!.name;
const ADMIN = '10093';
const PRIYA = '41208'; // registrar
const ROSA = '30117'; // advisor
const MARIA = '20231847'; // student
const NAKAMURA = '28804'; // faculty
const course: Course = { id: 'CS 399', title: 'Special Topics', description: 'Selected topics in computing.', units: 3, prereqs: ['CS 310', 'CS 250'], deptId: 'CS', level: 'upper', qualifiedFaculty: ['F-10231', 'F-10702'] };
const log = (d: Db, by: string, text: string): Db => ({ ...d, transactions: [...d.transactions, { at: '2026-10-22T10:00:00', by, subsystem: 'FCI', text }] });
const saved = (userId: string, c: Course, originalId: string | null): Db => {
  const r = applyCourseSave(db, { role: 'admin', access: ['FCI'] }, c, originalId); // build the change; the server decides who may send it
  if (!r.ok || !r.log) throw new Error('fixture course should be valid');
  return log(r.db, nameOf(userId), r.log);
};

describe('FCI-03 course changes against the server', () => {
  it('accepts a new course from the registrar and from an administrator', () => {
    expect(checkObjectPermissions(email(PRIYA), db, saved(PRIYA, course, null), [])).toEqual({ ok: true });
    expect(checkObjectPermissions(email(ADMIN), db, saved(ADMIN, course, null), [])).toEqual({ ok: true });
  });
  it('refuses the same change from an advisor, a faculty member or a student', () => {
    for (const id of [ROSA, NAKAMURA, MARIA]) {
      const r = checkObjectPermissions(email(id), db, saved(id, course, null), []);
      expect(r.ok).toBe(false);
    }
  });
  it('accepts an edit to prerequisites and qualified faculty from the registrar', () => {
    const cs310 = db.courses.find((c) => c.id === 'CS 310')!;
    const edited = { ...cs310, prereqs: [...cs310.prereqs, 'MATH 150'], qualifiedFaculty: [...cs310.qualifiedFaculty, 'F-10702'] };
    expect(checkObjectPermissions(email(PRIYA), db, saved(PRIYA, edited, 'CS 310'), [])).toEqual({ ok: true });
  });
  it('stores a new course with its prerequisites and qualified faculty and reads it back unchanged', () => {
    const back = tablesToDoc(docToTables(saved(PRIYA, course, null)));
    const c = back.courses.find((x) => x.id === 'CS 399')!;
    expect(c.title).toBe(course.title);
    expect(c.description).toBe(course.description);
    expect(c.units).toBe(3);
    expect(c.level).toBe('upper');
    expect([...c.prereqs].sort()).toEqual([...course.prereqs].sort());
    expect([...c.qualifiedFaculty].sort()).toEqual([...course.qualifiedFaculty].sort());
  });
});
