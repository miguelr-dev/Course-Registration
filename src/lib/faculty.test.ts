import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import type { Faculty, User } from '../data/types';
import { applyFacultySave, changedFacultyFields, facultyIssue, normalizeFaculty, type FacultyEntry } from './faculty';

const db = createSeed();
const registrar: Pick<User, 'role' | 'access'> = { role: 'registrar', access: ['ER', 'FCI'] };
const admin: Pick<User, 'role' | 'access'> = { role: 'admin', access: ['USERS'] };
const advisor: Pick<User, 'role' | 'access'> = { role: 'advisor', access: ['ER', 'REG', 'MAJOR', 'FCI'] };
const nakamura = db.faculty.find((f) => f.id === 'F-10231')!;
const nakamuraCourses = db.courses.filter((c) => c.qualifiedFaculty.includes(nakamura.id)).map((c) => c.id);
const teachingNow = db.offerings.find((o) => o.instructorId === nakamura.id && o.term === db.term)!.courseId;
const newcomer: Faculty = { id: 'f12345', name: ' Ana  Ruiz-Soto ', positionTitle: 'Lecturer', officePhone: '310.555.0199', office: 'Boelter 2100', officeHours: 'Wed 1:00–2:00 PM', deptId: 'CS', teachesIn: ['MATH'], email: 'ARuiz@sdsu.edu' };
const entry = (faculty: Faculty, courses: string[] = []): FacultyEntry => ({ faculty, courses });

describe('faculty information (FCI-01, FCI-02)', () => {
  it('normalizes the ID, name, phone, email and always includes the assigned department', () => {
    const n = normalizeFaculty(newcomer);
    expect(n).toMatchObject({ id: 'F-12345', name: 'Ana Ruiz-Soto', officePhone: '(310) 555-0199', email: 'aruiz@sdsu.edu' });
    expect(n.teachesIn.sort()).toEqual(['CS', 'MATH']);
  });

  it('adds a faculty member and records them as qualified for the chosen courses', () => {
    const r = applyFacultySave(db, registrar, entry(newcomer, ['CS 101', 'CS 201']), null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.db.faculty.find((f) => f.id === 'F-12345')?.name).toBe('Ana Ruiz-Soto');
    expect(r.db.courses.filter((c) => c.qualifiedFaculty.includes('F-12345')).map((c) => c.id).sort()).toEqual(['CS 101', 'CS 201']);
    expect(r.log).toBe('Added faculty Ana Ruiz-Soto (F-12345)');
  });

  it('edits an existing record and logs only what changed', () => {
    const r = applyFacultySave(db, admin, entry({ ...nakamura, officeHours: 'Tue 9:00–11:00 AM' }, nakamuraCourses), nakamura.id);
    expect(r.ok && r.log).toBe('Updated officeHours for faculty F-10231');
    const same = applyFacultySave(db, admin, entry(nakamura, nakamuraCourses), nakamura.id);
    expect(same.ok && same.log).toBeNull();
    expect(changedFacultyFields(nakamura, { ...nakamura, teachesIn: [...nakamura.teachesIn].reverse() })).toEqual([]);
  });

  it('rejects bad entries with the field, the reason and what is needed', () => {
    expect(facultyIssue(db, entry({ ...newcomer, id: '12345' }), null)?.field).toBe('id');
    expect(facultyIssue(db, entry({ ...newcomer, id: nakamura.id }), null)?.reason).toMatch(/already/);
    expect(facultyIssue(db, entry({ ...nakamura, id: 'F-99999' }, nakamuraCourses), nakamura.id)?.reason).toMatch(/cannot be changed/);
    expect(facultyIssue(db, entry({ ...newcomer, name: 'Cher' }), null)?.field).toBe('name');
    expect(facultyIssue(db, entry({ ...newcomer, name: 'Ana Ruiz--Soto' }), null)?.field).toBe('name');
    expect(facultyIssue(db, entry({ ...newcomer, officePhone: '555-0199' }), null)?.field).toBe('officePhone');
    expect(facultyIssue(db, entry({ ...newcomer, office: ' ' }), null)?.field).toBe('office');
    expect(facultyIssue(db, entry({ ...newcomer, deptId: 'NOPE' }), null)?.field).toBe('deptId');
    expect(facultyIssue(db, entry({ ...newcomer, email: 'not-an-email' }), null)?.field).toBe('email');
    expect(facultyIssue(db, entry(newcomer, ['XX 999']), null)?.field).toBe('courses');
  });

  it('keeps an instructor qualified for a course they are teaching this term', () => {
    const r = facultyIssue(db, entry(nakamura, nakamuraCourses.filter((c) => c !== teachingNow)), nakamura.id);
    expect(r?.field).toBe('courses');
    expect(r?.reason).toContain(teachingNow);
  });

  it('is limited to the registrar (with FCI) and administrators', () => {
    expect(applyFacultySave(db, advisor, entry(newcomer), null)).toMatchObject({ ok: false, reason: expect.stringMatching(/registrar/) });
    expect(applyFacultySave(db, { role: 'registrar', access: ['ER'] }, entry(newcomer), null).ok).toBe(false);
    expect(applyFacultySave(db, null, entry(newcomer), null).ok).toBe(false);
  });
});
