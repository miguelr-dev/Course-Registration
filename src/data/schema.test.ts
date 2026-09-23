import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import { compose, decompose, type Dump } from './relational';

async function insertRows(pg: PGlite, table: string, rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const columns = Object.keys(row);
    const slots = columns.map((_, index) => `$${index + 1}`).join(', ');
    await pg.query(
      `insert into ${table} (${columns.join(', ')}) values (${slots})`,
      columns.map((column) => row[column]),
    );
  }
}

describe('postgres schema', () => {
  it('loads the sample university and reads it back', async () => {
    const pg = new PGlite();
    await pg.exec(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8'));
    const seed = createSeed();
    const dump = decompose(seed);

    await insertRows(pg, 'departments', dump.departments);
    await insertRows(pg, 'faculty', dump.faculty);
    await insertRows(pg, 'faculty_departments', dump.faculty_departments);
    await insertRows(pg, 'courses', dump.courses);
    await insertRows(pg, 'course_prerequisites', dump.course_prerequisites);
    await insertRows(pg, 'course_qualified_faculty', dump.course_qualified_faculty);
    await insertRows(pg, 'majors', dump.majors);
    await insertRows(pg, 'major_courses', dump.major_courses);
    await insertRows(pg, 'students', dump.students);
    await insertRows(pg, 'completed_courses', dump.completed_courses);
    await insertRows(pg, 'transfer_courses', dump.transfer_courses);
    await insertRows(pg, 'student_notes', dump.student_notes);
    await insertRows(pg, 'users', dump.users);
    await insertRows(pg, 'major_advisors', dump.major_advisors);
    await insertRows(pg, 'offerings', dump.offerings);
    await insertRows(pg, 'registrations', dump.registrations);
    await insertRows(pg, 'outlines', dump.outlines);
    await insertRows(pg, 'outline_entries', dump.outline_entries);
    await insertRows(pg, 'outline_history', dump.outline_history);
    await insertRows(pg, 'grade_notes', dump.grade_notes);
    await insertRows(pg, 'transactions', dump.transactions);
    await pg.query(
      `insert into app_settings (id, term, registration_closes, grade_window_opens, grade_window_closes)
       values (1, $1, $2, $3, $4)`,
      [dump.settings.term, dump.settings.registration_closes, dump.settings.grade_window_opens, dump.settings.grade_window_closes],
    );

    const read = async <T>(sql: string) => (await pg.query<T>(sql)).rows;
    const loaded: Dump = {
      settings: (await read<Dump['settings']>('select term, registration_closes, grade_window_opens, grade_window_closes from app_settings'))[0],
      departments: await read('select id, name, position from departments'),
      faculty: await read('select id, name, position_title, office_phone, office, office_hours, dept_id, email, position from faculty'),
      faculty_departments: await read('select faculty_id, dept_id, position from faculty_departments'),
      courses: await read('select id, title, description, units, dept_id, level, position from courses'),
      course_prerequisites: await read('select course_id, prereq_id, position from course_prerequisites'),
      course_qualified_faculty: await read('select course_id, faculty_id, position from course_qualified_faculty'),
      majors: await read('select id, title, dept_id, units_required, major_units, position from majors'),
      major_courses: await read('select major_id, course_id, kind, position from major_courses'),
      major_advisors: await read('select major_id, employee_id, position from major_advisors'),
      students: await read('select id, first_name, middle_name, last_name, phone, address, date_of_birth, major_id, minor_id, graduate, standing, position from students'),
      completed_courses: await read('select student_id, course_id, title, term, units, grade, position from completed_courses'),
      transfer_courses: await read('select student_id, course_id, title, term, units, grade, university, location, equivalent_course_id, position from transfer_courses'),
      student_notes: await read('select student_id, at, by_employee_id, category, body, position from student_notes'),
      users: await read('select id, name, job_title, password, must_change_password, password_set_at, role, access, last_sign_in, student_id, faculty_id, position from users'),
      offerings: await read('select schedule_no, course_id, term, days, start_time, end_time, location, instructor_id, capacity, position from offerings'),
      registrations: await read('select student_id, schedule_no, type, registered_by, registered_at, grade, grade_note, grade_updated_by, grade_updated_at, position from registrations'),
      outlines: await read('select student_id, major_id, approved_by, approved_at, position from outlines'),
      outline_entries: await read('select student_id, course_id, status, status_date, by_name, note, position from outline_entries'),
      outline_history: await read('select student_id, at, by_name, action, position from outline_history'),
      grade_notes: await read('select schedule_no, at, by_name, body, position from grade_notes'),
      transactions: await read('select at, by_name, subsystem, body, position from transactions'),
    };

    expect(compose(loaded)).toEqual(seed);
    expect((await pg.query<{ n: number }>('select count(*)::int as n from registrations')).rows[0].n).toBe(seed.registrations.length);
  });
});
