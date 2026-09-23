import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import { compose, decompose, withoutPasswords } from './relational';

describe('relational mapping', () => {
  const db = createSeed();
  const dump = decompose(db);

  it('round-trips the sample university', () => {
    expect(compose(dump)).toEqual(db);
  });

  it('leaves passwords out of the browser copy', () => {
    expect(withoutPasswords(db).users.every((user) => user.password === '')).toBe(true);
    expect(db.users.every((user) => user.password === 'signmeup')).toBe(true);
  });

  it('satisfies the foreign keys in db/schema.sql', () => {
    const dept = new Set(dump.departments.map((row) => row.id));
    const faculty = new Set(dump.faculty.map((row) => row.id));
    const courses = new Set(dump.courses.map((row) => row.id));
    const majors = new Set(dump.majors.map((row) => row.id));
    const students = new Set(dump.students.map((row) => row.id));
    const users = new Set(dump.users.map((row) => row.id));
    const schedules = new Set(dump.offerings.map((row) => row.schedule_no));

    for (const row of dump.faculty) expect(dept.has(row.dept_id)).toBe(true);
    for (const row of dump.faculty_departments) {
      expect(faculty.has(row.faculty_id)).toBe(true);
      expect(dept.has(row.dept_id)).toBe(true);
    }
    for (const row of dump.courses) expect(dept.has(row.dept_id)).toBe(true);
    for (const row of dump.course_prerequisites) {
      expect(courses.has(row.course_id)).toBe(true);
      expect(courses.has(row.prereq_id)).toBe(true);
    }
    for (const row of dump.course_qualified_faculty) {
      expect(courses.has(row.course_id)).toBe(true);
      expect(faculty.has(row.faculty_id)).toBe(true);
    }
    for (const row of dump.majors) expect(dept.has(row.dept_id)).toBe(true);
    for (const row of dump.major_courses) {
      expect(majors.has(row.major_id)).toBe(true);
      expect(courses.has(row.course_id)).toBe(true);
    }
    for (const row of dump.students) {
      expect(majors.has(row.major_id)).toBe(true);
      if (row.minor_id) expect(majors.has(row.minor_id)).toBe(true);
    }
    for (const row of [...dump.completed_courses, ...dump.transfer_courses, ...dump.student_notes]) {
      expect(students.has(row.student_id)).toBe(true);
    }
    for (const row of dump.users) {
      if (row.student_id) expect(students.has(row.student_id)).toBe(true);
      if (row.faculty_id) expect(faculty.has(row.faculty_id)).toBe(true);
    }
    for (const row of dump.major_advisors) {
      expect(majors.has(row.major_id)).toBe(true);
      expect(users.has(row.employee_id)).toBe(true);
    }
    for (const row of dump.offerings) {
      expect(courses.has(row.course_id)).toBe(true);
      expect(faculty.has(row.instructor_id)).toBe(true);
    }
    for (const row of dump.registrations) expect(schedules.has(row.schedule_no)).toBe(true);
    for (const row of dump.outlines) {
      expect(students.has(row.student_id)).toBe(true);
      expect(majors.has(row.major_id)).toBe(true);
    }
    for (const row of dump.outline_entries) {
      expect(students.has(row.student_id)).toBe(true);
      expect(courses.has(row.course_id)).toBe(true);
    }
    for (const row of dump.outline_history) expect(students.has(row.student_id)).toBe(true);
    for (const row of dump.grade_notes) expect(schedules.has(row.schedule_no)).toBe(true);
  });
});
