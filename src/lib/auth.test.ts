import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { adminEmails, isAllowedEmail, newStudentId, provisionUser } from './auth';

describe('isAllowedEmail', () => {
  it('accepts sdsu.edu addresses in any case', () => {
    expect(isAllowedEmail('aztec@sdsu.edu')).toBe(true);
    expect(isAllowedEmail('Aztec@SDSU.EDU')).toBe(true);
    expect(isAllowedEmail('staff@mail.sdsu.edu')).toBe(true);
  });
  it('refuses everything else, including look-alikes', () => {
    expect(isAllowedEmail('someone@gmail.com')).toBe(false);
    expect(isAllowedEmail('someone@sdsu.edu.evil.com')).toBe(false);
    expect(isAllowedEmail('someone@notsdsu.edu')).toBe(false);
    expect(isAllowedEmail('sdsu.edu')).toBe(false);
    expect(isAllowedEmail('')).toBe(false);
  });
});

describe('adminEmails', () => {
  it('splits on commas and whitespace and lower-cases', () => {
    expect(adminEmails('A@sdsu.edu, b@sdsu.edu\n c@sdsu.edu')).toEqual(['a@sdsu.edu', 'b@sdsu.edu', 'c@sdsu.edu']);
    expect(adminEmails(undefined)).toEqual([]);
  });
});

describe('newStudentId', () => {
  it('is 8 digits, starts with the year, and skips taken IDs', () => {
    let n = 0;
    const rng = () => [0.0001, 0.0001, 0.5][n++ % 3];
    expect(newStudentId(new Set(['20260001']), 2026, rng)).toBe('20265000');
  });
});

describe('provisionUser', () => {
  it('creates a student user and record for a new sdsu.edu address', () => {
    const { db, user } = provisionUser(createSeed(), { email: 'Jane.Doe@sdsu.edu', name: 'Jane Doe', clerkUserId: 'user_1', admin: false });
    expect(user.role).toBe('student');
    expect(user.email).toBe('jane.doe@sdsu.edu');
    expect(user.access).toEqual(['ER', 'REG', 'MAJOR', 'FCI']);
    const student = db.students.find((s) => s.id === user.studentId);
    expect(student?.firstName).toBe('Jane');
    expect(student?.lastName).toBe('Doe');
    expect(student?.majorId).toBe('UNDECLARED');
    expect(db.majors.some((m) => m.id === 'UNDECLARED')).toBe(true);
  });
  it('creates an administrator with every access area and no student record', () => {
    const seed = createSeed();
    const { db, user } = provisionUser(seed, { email: 'admin@sdsu.edu', name: 'Sam Admin', clerkUserId: 'user_2', admin: true });
    expect(user.role).toBe('admin');
    expect(user.access).toContain('USERS');
    expect(user.studentId).toBeUndefined();
    expect(db.students.length).toBe(seed.students.length);
  });
});
