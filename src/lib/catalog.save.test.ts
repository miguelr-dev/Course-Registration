import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import type { Course, Db, User } from '../data/types';
import { applyCourseSave, canMaintainCatalog, courseIssue, normalizeCourse } from './catalog';

const db = createSeed();
const userOf = (role: User['role'], access: User['access']): Pick<User, 'role' | 'access'> => ({ role, access });
const REGISTRAR = userOf('registrar', ['ER', 'REG', 'FCI']);
const ADMIN = userOf('admin', ['ER', 'REG', 'MAJOR', 'FCI', 'GRADE', 'USERS']);
const cs310 = db.courses.find((c) => c.id === 'CS 310')!;
const teaching310 = db.offerings.find((o) => o.courseId === 'CS 310' && o.term === db.term)!;
const newCourse = (over: Partial<Course> = {}): Course => ({
  id: 'CS 399', title: 'Special Topics', description: 'Selected topics in computing.', units: 3, prereqs: ['CS 310'], deptId: 'CS', level: 'upper', qualifiedFaculty: ['F-10231'], ...over,
});

describe('FCI-03 who may change the catalog', () => {
  it('allows administrators and registrars with FCI access', () => {
    expect(canMaintainCatalog(ADMIN)).toBe(true);
    expect(canMaintainCatalog(REGISTRAR)).toBe(true);
  });
  it('refuses a registrar without FCI access, every other role, and nobody signed in', () => {
    expect(canMaintainCatalog(userOf('registrar', ['ER']))).toBe(false);
    for (const role of ['student', 'faculty', 'advisor'] as const) expect(canMaintainCatalog(userOf(role, ['ER', 'REG', 'MAJOR', 'FCI', 'GRADE', 'USERS']))).toBe(false);
    expect(canMaintainCatalog(null)).toBe(false);
    expect(canMaintainCatalog(undefined)).toBe(false);
  });
  it('the seeded registrar has no FCI access, so cannot edit until an admin grants it', () => {
    const priya = db.users.find((u) => u.id === '41208')!;
    expect(canMaintainCatalog(priya)).toBe(priya.access.includes('FCI'));
  });
  it('rejects a save from a user who may not change the catalog and leaves the catalog untouched', () => {
    const r = applyCourseSave(db, userOf('faculty', ['FCI', 'GRADE']), newCourse(), null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/registrar/);
  });
});

describe('FCI-03 adding and editing courses', () => {
  it('adds a new course with every FCI-03 field and logs it', () => {
    const r = applyCourseSave(db, REGISTRAR, newCourse(), null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.db.courses.length).toBe(db.courses.length + 1);
    expect(r.db.courses.find((c) => c.id === 'CS 399')).toEqual(newCourse());
    expect(r.log).toBe('Added course CS 399 Special Topics');
    expect(db.courses.some((c) => c.id === 'CS 399')).toBe(false); // the original document is not mutated
  });
  it('stores the normalized form of what was typed', () => {
    const r = applyCourseSave(db, ADMIN, newCourse({ id: ' cs399 ', title: ' Special  Topics ', prereqs: [' cs 310 ', 'CS310', ''] }), null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.db.courses.find((c) => c.id === 'CS 399')?.prereqs).toEqual(['CS 310']);
  });
  it('edits an existing course in place and lists exactly what changed', () => {
    const r = applyCourseSave(db, REGISTRAR, { ...cs310, title: 'Data Structures and Algorithms', units: 3 }, 'CS 310');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.db.courses.length).toBe(db.courses.length);
    expect(r.db.courses.find((c) => c.id === 'CS 310')?.title).toBe('Data Structures and Algorithms');
    expect(r.log).toBe('Updated title, units for course CS 310');
    expect(r.db.courses.findIndex((c) => c.id === 'CS 310')).toBe(db.courses.findIndex((c) => c.id === 'CS 310'));
  });
  it('records nothing when an edit changes nothing', () => {
    const r = applyCourseSave(db, REGISTRAR, { ...cs310, prereqs: [...cs310.prereqs].reverse() }, 'CS 310');
    expect(r).toEqual({ ok: true, db, log: null });
  });
  it('refuses an edit to a course that was removed meanwhile', () => {
    const gone: Db = { ...db, courses: db.courses.filter((c) => c.id !== 'CS 310') };
    const r = applyCourseSave(gone, REGISTRAR, cs310, 'CS 310');
    expect(r.ok).toBe(false);
  });
  it('refuses a second add of the same ID (e.g. two registrars at once)', () => {
    const first = applyCourseSave(db, REGISTRAR, newCourse(), null);
    expect(first.ok).toBe(true);
    if (first.ok) expect(applyCourseSave(first.db, REGISTRAR, newCourse({ title: 'Other' }), null).ok).toBe(false);
  });
});

describe('FCI-03 keeps the catalog consistent', () => {
  it('blocks removing a faculty member who is teaching a section of the course this term', () => {
    const r = applyCourseSave(db, REGISTRAR, { ...cs310, qualifiedFaculty: cs310.qualifiedFaculty.filter((f) => f !== teaching310.instructorId) }, 'CS 310');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe('qualifiedFaculty');
      expect(r.reason).toContain(teaching310.scheduleNo);
    }
  });
  it('allows removing a qualified faculty member who is not teaching it this term', () => {
    const idle = db.faculty.find((f) => !db.offerings.some((o) => o.courseId === 'CS 310' && o.instructorId === f.id && o.term === db.term))!;
    const withIdle = { ...cs310, qualifiedFaculty: [...cs310.qualifiedFaculty, idle.id] };
    const added = applyCourseSave(db, REGISTRAR, withIdle, 'CS 310');
    expect(added.ok).toBe(true);
    if (added.ok) expect(applyCourseSave(added.db, REGISTRAR, cs310, 'CS 310').ok).toBe(true);
  });
  it('detects a three-step prerequisite loop (A → B → C → A)', () => {
    const loopDb: Db = { ...db, courses: [...db.courses, newCourse({ id: 'CS 401', prereqs: ['CS 310'] }), newCourse({ id: 'CS 402', prereqs: ['CS 401'] })] };
    const r = courseIssue(loopDb, { ...cs310, prereqs: [...cs310.prereqs, 'CS 402'] }, 'CS 310');
    expect(r?.field).toBe('prereqs');
    expect(r?.reason).toMatch(/loop/);
  });
  it('every seeded course still validates, and no seeded prerequisite chain loops', () => {
    for (const c of db.courses) expect(courseIssue(db, c, c.id)).toBeNull();
  });
  it('accepts IDs with a letter suffix and 0-unit courses, rejects other formats', () => {
    expect(courseIssue(db, newCourse({ id: 'MATH 151A', units: 0 }), null)).toBeNull();
    for (const id of ['', 'CS', 'CS 31', 'CS 3100', 'C 310', 'COMPSC 310', '310', 'CS-310', 'CS 310 A']) {
      expect(courseIssue(db, newCourse({ id }), null)?.field).toBe('id');
    }
  });
  it('rejects non-numeric, negative, fractional and NaN units', () => {
    for (const units of [NaN, -1, 1.5, 13, Infinity]) expect(courseIssue(db, newCourse({ units }), null)?.field).toBe('units');
  });
  it('rejects an unknown department and level', () => {
    expect(courseIssue(db, newCourse({ deptId: 'NOPE' }), null)?.field).toBe('deptId');
    expect(courseIssue(db, newCourse({ level: 'phd' as Course['level'] }), null)?.field).toBe('level');
  });
  it('accepts an 80-character title and rejects 81', () => {
    expect(courseIssue(db, newCourse({ title: 'x'.repeat(80) }), null)).toBeNull();
    expect(courseIssue(db, newCourse({ title: 'x'.repeat(81) }), null)?.field).toBe('title');
  });
});

describe('FCI-03 random input never crashes and normalizing is stable', () => {
  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const junk = () => Array.from({ length: Math.floor(rand() * 12) }, () => pick([...'aZ 09-_ ,.\'"<>\\/'.split(''), 'CS', '310', 'é', '\n', '\t'])).join('');
  it('validates 2,000 random entries without throwing; any accepted entry saves and re-validates cleanly', () => {
    let accepted = 0;
    for (let i = 0; i < 2000; i++) {
      const c: Course = {
        id: pick([junk(), pick(db.courses).id, `CS ${100 + Math.floor(rand() * 900)}`, junk().toUpperCase()]),
        title: pick([junk(), 'Intro', '']), description: pick([junk(), 'A course.', '']),
        units: pick([Math.floor(rand() * 15) - 1, rand() * 5, NaN]),
        prereqs: Array.from({ length: Math.floor(rand() * 3) }, () => pick([pick(db.courses).id, junk()])),
        deptId: pick([pick(db.departments).id, junk()]), level: pick(['lower', 'upper', 'graduate', junk()]) as Course['level'],
        qualifiedFaculty: Array.from({ length: Math.floor(rand() * 3) }, () => pick([pick(db.faculty).id, junk()])),
      };
      const original = rand() < 0.5 && db.courses.some((x) => x.id === c.id) ? c.id : null;
      const r = applyCourseSave(db, ADMIN, c, original);
      if (r.ok && r.log) {
        accepted++;
        const n = normalizeCourse(c);
        expect(normalizeCourse(n)).toEqual(n); // normalizing twice changes nothing
        expect(courseIssue(r.db, n, n.id)).toBeNull(); // what was saved is valid
      }
    }
    expect(accepted).toBeGreaterThan(0);
  });
});
