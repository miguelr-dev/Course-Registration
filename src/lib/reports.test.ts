import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { gradeStats } from './rules';
import {
  authorizedUsersReport, completedRequiredReport, courseListReport, departmentChoices, departmentOfferingsReport, facultyListReport, gradeStatisticsReport,
  majorChoices, majorRequirementsReport, outlineHistoryReport, outlineStatusReport, seatsAvailableReport, shortDescription, studentRecordReport, studentScheduleReport,
} from './reports';

const db = createSeed();
const MARIA = '20231847';
const sectionIds = (r: { sections: { id: string }[] }) => r.sections.map((s) => s.id);

describe('reports', () => {
  it('shortens descriptions to their first sentence', () => {
    expect(shortDescription('Arrays and lists. Then trees.')).toBe('Arrays and lists.');
    expect(shortDescription('x'.repeat(120)).length).toBe(90);
  });

  it('grade statistics: one section per department plus university totals that match the raw data', () => {
    const u = gradeStatisticsReport(db, null);
    expect(sectionIds(u).at(-1)).toBe('university');
    const termRegs = db.registrations.filter((r) => db.offerings.find((o) => o.scheduleNo === r.scheduleNo)?.term === db.term);
    expect(u.sections.at(-1)!.rows[0][3]).toBe(gradeStats(termRegs).registered);
    const cs = gradeStatisticsReport(db, 'CS');
    expect(sectionIds(cs)).toEqual(['dept-CS']);
    expect(String(cs.sections[0].rows.at(-1)![0])).toBe('Computer Science total');
  });

  it('faculty and course lists by department or for the whole university', () => {
    expect(facultyListReport(db, 'CS').sections).toHaveLength(1);
    expect(facultyListReport(db, null).sections.length).toBeGreaterThan(1);
    const courses = courseListReport(db, null);
    expect(courses.sections.flatMap((s) => s.rows)).toHaveLength(db.courses.length);
    expect(courseListReport(db, 'MATH').sections[0].rows.every((r) => String(r[0]).startsWith('MATH'))).toBe(true);
  });

  it('student schedule lists every current enrollment with a description and total units', () => {
    const r = studentScheduleReport(db, MARIA);
    const enrolled = db.registrations.filter((x) => x.studentId === MARIA && db.offerings.find((o) => o.scheduleNo === x.scheduleNo)?.term === db.term);
    expect(r.sections[0].rows).toHaveLength(enrolled.length);
    expect(r.sections[0].rows[0][3]).not.toBe('');
  });

  it('courses offered by a department and courses with seats available', () => {
    expect(departmentOfferingsReport(db, 'CS').sections[0].rows.every((row) => String(row[0]).startsWith('CS'))).toBe(true);
    const seats = seatsAvailableReport(db, null);
    expect(seats.sections.flatMap((s) => s.rows).every((row) => !String(row[8]).startsWith('0 of'))).toBe(true);
  });

  it('MAJOR reports for a major and for one student', () => {
    const m = majorRequirementsReport(db, 'CS-BS');
    expect(sectionIds(m)).toEqual(['required', 'electives']);
    expect(m.sections[0].rows).toHaveLength(db.majors.find((x) => x.id === 'CS-BS')!.requiredCourses.length);
    expect(completedRequiredReport(db, MARIA).sections[0].rows.some((r) => r[2] === 'Completed')).toBe(true);
    const status = outlineStatusReport(db, MARIA);
    expect(status.sections[0].rows).toHaveLength(db.outlines.find((o) => o.studentId === MARIA)!.entries.length);
    expect(outlineHistoryReport(db, MARIA).sections[0].rows.length).toBeGreaterThan(0);
  });

  it('student record report honours course detail and this-university-only scope, and shows GPA', () => {
    expect(sectionIds(studentRecordReport(db, MARIA, { detail: true, scope: 'all' }))).toEqual(['info', 'here', 'transfer', 'current', 'notes']);
    expect(sectionIds(studentRecordReport(db, MARIA, { detail: true, scope: 'here' }))).toEqual(['info', 'here', 'current', 'notes']);
    expect(sectionIds(studentRecordReport(db, MARIA, { detail: false, scope: 'all' }))).toEqual(['info', 'notes']);
    expect(studentRecordReport(db, MARIA, { detail: false, scope: 'all' }).meta.find(([k]) => k === 'Overall GPA')![1]).toMatch(/^\d\.\d\d$/);
  });

  it('authorized user report never includes passwords and filters by subsystem', () => {
    const r = authorizedUsersReport(db, 'GRADE');
    expect(r.sections[0].columns.join(' ')).not.toMatch(/password/i);
    expect(r.sections[0].rows.every((row) => String(row[3]).includes('GRADE'))).toBe(true);
  });

  it('offers department and major choices for the viewer', () => {
    expect(departmentChoices(db, 'All')[0]).toEqual(['', 'All']);
    expect(majorChoices(db, 'MATH-MIN')[0][0]).toBe('MATH-MIN');
  });
});
