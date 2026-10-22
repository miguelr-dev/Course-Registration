import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import type { User } from '../data/types';
import { canSwitchRoles, defaultView, describeView, effectiveUser, ROLE_ORDER, ROLE_VIEWS } from './viewAs';

const db = createSeed();
const admin = db.users.find((u) => u.role === 'admin')!;
const student = db.users.find((u) => u.role === 'student')!;

describe('role switcher', () => {
  it('is available to administrators only', () => {
    expect(canSwitchRoles(admin)).toBe(true);
    expect(canSwitchRoles(student)).toBe(false);
    expect(canSwitchRoles(null)).toBe(false);
  });

  it('covers every role the system defines', () => {
    expect([...ROLE_ORDER].sort()).toEqual(Object.keys(ROLE_VIEWS).sort());
  });

  it('changes role, access and attached record but keeps the real name and ID for the audit trail', () => {
    const v = effectiveUser(admin, defaultView(db, 'student'))!;
    expect(v.role).toBe('student');
    expect(v.access).toEqual(ROLE_VIEWS.student.access);
    expect(db.students.some((s) => s.id === v.studentId)).toBe(true);
    expect(v.name).toBe(admin.name);
    expect(v.id).toBe(admin.id);
    expect(v.email).toBe(admin.email);
  });

  it('attaches faculty to an instructor who has students this term', () => {
    const v = effectiveUser(admin, defaultView(db, 'faculty'))!;
    expect(db.offerings.some((o) => o.instructorId === v.facultyId && o.term === db.term && db.registrations.some((r) => r.scheduleNo === o.scheduleNo))).toBe(true);
    expect(v.access).not.toContain('USERS');
  });

  it('ignores a view for non-administrators and for the admin role itself', () => {
    expect(effectiveUser(student, { role: 'registrar' })).toBe(student);
    expect(effectiveUser(admin, { role: 'admin' })).toBe(admin);
    expect(effectiveUser(admin, null)).toBe(admin);
  });

  it('describes the view for the banner', () => {
    const maria = db.students.find((s) => s.id === defaultView(db, 'student').studentId)!;
    expect(describeView(db, defaultView(db, 'student'))).toBe(`Student · ${maria.firstName} ${maria.lastName}`);
    expect(describeView(db, { role: 'registrar' })).toBe('Department user / registrar');
  });

  it('never grants a viewed role the USERS area', () => {
    for (const r of ROLE_ORDER.filter((x) => x !== 'admin')) expect(effectiveUser(admin as User, { role: r })!.access).not.toContain('USERS');
  });
});
