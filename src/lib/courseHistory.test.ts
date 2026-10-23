import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import type { CompletedCourse, TransferCourse } from '../data/types';
import { applyHistorySave, historyIssue, historyKey, normalizeHistory } from './courseHistory';
import { eligibleMajorOfferings, registrationIssues } from './rules';
import { keyInfoBlock, selfEditableFields } from './student';

const db = createSeed();
const maria = db.students.find((s) => s.id === '20231847')!;
const done: CompletedCourse = { courseId: 'cs101', title: 'Programming I', term: 'spring 2024', units: 4, grade: 'b+' };
const smc: TransferCourse = { courseId: 'MATH 21', title: 'Finite Mathematics', term: 'Fall 2023', units: 3, grade: 'A', university: 'Santa Monica College', location: 'Santa Monica, CA', equivalentCourseId: 'MATH 150' };
const incomplete = { ...maria, dateOfBirth: '', phone: '' };

describe('course history (ER-01, ER-04)', () => {
  it('normalizes course IDs, semesters and grades', () => {
    expect(normalizeHistory(done)).toEqual({ courseId: 'CS 101', title: 'Programming I', term: 'Spring 2024', units: 4, grade: 'B+' });
  });

  it('adds a completed course and a transfer course, logging each', () => {
    const here = applyHistorySave(db, maria.id, 'here', { ...done, term: 'Winter 2023' }, null);
    expect(here.ok && here.log).toBe(`Added completed course CS 101 (Winter 2023, B+) for student ${maria.id}`);
    const t = applyHistorySave(db, maria.id, 'transfer', { ...smc, courseId: 'ENGL 1' }, null);
    expect(t.ok).toBe(true);
    if (t.ok) expect(t.db.students.find((s) => s.id === maria.id)!.transfer.at(-1)).toMatchObject({ courseId: 'ENGL 1', university: 'Santa Monica College' });
  });

  it('corrects an existing entry in place and refuses duplicates', () => {
    const first = maria.completed[0];
    const fixed = applyHistorySave(db, maria.id, 'here', { ...first, grade: first.grade === 'A' ? 'B' : 'A' }, historyKey('here', first));
    expect(fixed.ok && fixed.log).toMatch(/^Corrected completed course/);
    if (fixed.ok) expect(fixed.db.students.find((s) => s.id === maria.id)!.completed).toHaveLength(maria.completed.length);
    expect(historyIssue(db, maria, 'here', first, null)?.reason).toMatch(/already on this record/);
  });

  it('rejects bad entries with the field, reason and requirement', () => {
    expect(historyIssue(db, maria, 'here', { ...done, courseId: 'XX 999' }, null)?.field).toBe('courseId'); // not in the catalog
    expect(historyIssue(db, maria, 'here', { ...done, title: '' }, null)?.field).toBe('title');
    expect(historyIssue(db, maria, 'here', { ...done, term: '2024' }, null)?.field).toBe('term');
    expect(historyIssue(db, maria, 'here', { ...done, term: db.term }, null)?.reason).toMatch(/not before the current semester/);
    expect(historyIssue(db, maria, 'here', { ...done, units: 13 }, null)?.field).toBe('units');
    expect(historyIssue(db, maria, 'here', { ...done, grade: 'I' }, null)?.field).toBe('grade');
    expect(historyIssue(db, maria, 'transfer', { ...smc, university: '' }, null)?.field).toBe('university');
    expect(historyIssue(db, maria, 'transfer', { ...smc, location: ' ' }, null)?.field).toBe('location');
    expect(historyIssue(db, maria, 'transfer', { ...smc, equivalentCourseId: 'ZZ 100' }, null)?.field).toBe('equivalentCourseId');
    expect(historyIssue(db, maria, 'transfer', { ...smc, equivalentCourseId: '' }, null)).toBeNull(); // no equivalent is allowed
  });
});

describe('processing block (GEN-31)', () => {
  it('flags a record missing key information with the reason and what is needed', () => {
    expect(keyInfoBlock(maria)).toBeNull();
    const b = keyInfoBlock(incomplete)!;
    expect(b.reason).toMatch(/incomplete \(missing telephone, date of birth\)/);
    expect(b.requirement).toMatch(/Complete the key student information/);
  });

  it('blocks registration and course history for an incomplete record', () => {
    const open = db.offerings.find((o) => registrationIssues(db, maria, o).length === 0)!;
    expect(registrationIssues(db, incomplete, open)).toEqual([expect.objectContaining({ code: 'record' })]);
    expect(eligibleMajorOfferings(db, incomplete)).toEqual([]);
    expect(historyIssue(db, incomplete, 'here', done, null)?.field).toBe('record');
  });

  it('lets a student fill in their own blank key information once', () => {
    expect(selfEditableFields(maria).sort()).toEqual(['address', 'phone']);
    expect(selfEditableFields({ ...maria, lastName: '', dateOfBirth: '' }).sort()).toEqual(['address', 'dateOfBirth', 'lastName', 'phone']);
  });
});
