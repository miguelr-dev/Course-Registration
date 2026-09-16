import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { conflicts, eligibleMajorOfferings, gpa, gradeStats, registrationIssues, seatsOpen, unitsRegistered } from './rules';

const db = createSeed();
const maria = db.students.find((s) => s.id === '20231847')!;
const offering = (no: string) => db.offerings.find((o) => o.scheduleNo === no)!;

describe('registration rules', () => {
  it('computes units registered for the current term', () => {
    expect(unitsRegistered(db, maria.id)).toBe(11);
  });
  it('rejects CS 360 because CS 310 is in progress, with reason and requirement', () => {
    const issues = registrationIssues(db, maria, offering('12102'));
    expect(issues.map((i) => i.code)).toContain('prereq');
    const prereq = issues.find((i) => i.code === 'prereq')!;
    expect(prereq.reason).toMatch(/CS 310 not completed/);
    expect(prereq.requirement).toMatch(/advisor waiver/);
  });
  it('accepts CS 335 (prereqs completed, seats open, no conflict)', () => {
    expect(registrationIssues(db, maria, offering('12061'))).toEqual([]);
  });
  it('rejects a duplicate registration', () => {
    expect(registrationIssues(db, maria, offering('12011')).some((i) => i.code === 'duplicate')).toBe(true);
  });
  it('rejects graduate courses for undergraduates', () => {
    expect(registrationIssues(db, maria, offering('12150')).some((i) => i.code === 'graduate')).toBe(true);
  });
  it('detects time conflicts across shared days', () => {
    expect(conflicts(offering('12011'), offering('15005'))).toBe(false); // 9:00 vs 10:00
    expect(conflicts(offering('13102'), offering('14032'))).toBe(false); // TTh 11:00 vs 9:30–10:45
    expect(conflicts(offering('12061'), offering('13135'))).toBe(true); // MWF 1:00 vs MW 1:00
  });
  it('lists eligible major courses: on outline, prereqs done, seats open, not yet registered', () => {
    const ids = eligibleMajorOfferings(db, maria).map((o) => o.courseId).sort();
    expect(ids).toEqual(['CS 335', 'CS 351', 'MATH 310']);
  });
  it('reports 2 seats left in CS 335', () => {
    expect(seatsOpen(db, offering('12061'))).toBe(2);
  });
});

describe('records and statistics', () => {
  it('computes GPA from this-university grades only', () => {
    expect(gpa(maria)).toBe(3.62);
  });
  it('computes course statistics', () => {
    const s = gradeStats([
      { studentId: '1', scheduleNo: 'x', type: 'letter', registeredBy: 'a', registeredAt: 't', grade: 'A' },
      { studentId: '2', scheduleNo: 'x', type: 'letter', registeredBy: 'a', registeredAt: 't', grade: 'F' },
      { studentId: '3', scheduleNo: 'x', type: 'crnc', registeredBy: 'a', registeredAt: 't', grade: 'CR' },
      { studentId: '4', scheduleNo: 'x', type: 'letter', registeredBy: 'a', registeredAt: 't' },
    ]);
    expect(s.registered).toBe(4);
    expect(s.passing).toBe(2);
    expect(s.average).toBe(2);
    expect(s.distribution).toEqual({ A: 1, B: 0, C: 0, D: 0, F: 1 });
  });
});
