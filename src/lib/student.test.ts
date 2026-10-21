import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { changedFields, missingKeyInfo, normalizeStudentInfo, studentInfoIssue, type StudentInfo } from './student';

const db = createSeed();
const maria = db.students.find((s) => s.id === '20231847')!;
const info = (over: Partial<StudentInfo> = {}): StudentInfo => ({
  firstName: maria.firstName, middleName: maria.middleName, lastName: maria.lastName, phone: maria.phone, address: maria.address,
  dateOfBirth: maria.dateOfBirth, majorId: maria.majorId, minorId: maria.minorId, graduate: maria.graduate, ...over,
});
const TODAY = '2026-10-21';

describe('student information', () => {
  it('accepts the seeded record unchanged', () => {
    expect(studentInfoIssue(db, info(), TODAY)).toBeNull();
  });
  it('accepts hyphenated first, middle and last names', () => {
    expect(studentInfoIssue(db, info({ firstName: 'Ana-Sofía', middleName: 'Luz-Marie', lastName: 'Okafor - Reyes' }), TODAY)).toBeNull();
  });
  it('normalizes names and phone numbers before storing', () => {
    const n = normalizeStudentInfo(info({ lastName: ' Okafor - Reyes ', phone: '310.555.0199', middleName: ' ', minorId: '' }));
    expect(n.lastName).toBe('Okafor-Reyes');
    expect(n.phone).toBe('(310) 555-0199');
    expect(n.middleName).toBeUndefined();
    expect(n.minorId).toBeUndefined();
  });
  it('rejects bad entries in screen order, naming the field', () => {
    expect(studentInfoIssue(db, info({ lastName: '' }), TODAY)?.field).toBe('lastName');
    expect(studentInfoIssue(db, info({ phone: '555-0199' }), TODAY)?.field).toBe('phone');
    expect(studentInfoIssue(db, info({ dateOfBirth: '2030-01-01' }), TODAY)?.field).toBe('dateOfBirth');
    expect(studentInfoIssue(db, info({ majorId: 'NOPE' }), TODAY)?.field).toBe('majorId');
    expect(studentInfoIssue(db, info({ majorId: 'MATH-MIN' }), TODAY)?.field).toBe('majorId');
    expect(studentInfoIssue(db, info({ minorId: 'CS-BS' }), TODAY)?.field).toBe('minorId');
  });
  it('checks only the fields a student may change on their own record', () => {
    const incomplete = info({ dateOfBirth: '', phone: '6195550100', address: '5500 Campanile Dr, San Diego, CA 92182' });
    expect(studentInfoIssue(db, incomplete, TODAY)?.field).toBe('dateOfBirth');
    expect(studentInfoIssue(db, incomplete, TODAY, ['phone', 'address'])).toBeNull();
    expect(studentInfoIssue(db, info({ phone: '555' }), TODAY, ['phone', 'address'])?.field).toBe('phone');
  });
  it('lists key information missing from a new account', () => {
    expect(missingKeyInfo(maria)).toEqual([]);
    expect(missingKeyInfo({ ...maria, phone: '', dateOfBirth: '' })).toEqual(['phone', 'dateOfBirth']);
  });
  it('reports only the fields that changed', () => {
    expect(changedFields(info(), info({ phone: '(619) 555-0100', minorId: undefined }))).toEqual(maria.minorId ? ['phone', 'minorId'] : ['phone']);
  });
});
