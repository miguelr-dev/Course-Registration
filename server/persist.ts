import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { createSeed } from '../src/data/seed';
import { compose, decompose, type Dump } from '../src/data/relational';
import type { Db } from '../src/data/types';

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql<Record<string, never>>;

let client: Sql | null = null;
let ready: Promise<void> | null = null;

export function databaseUrl(): string | undefined {
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  return url || undefined;
}

function getSql(): Sql {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set.');
  if (!client) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    client = postgres(url, {
      max: 1,
      ssl: local ? false : 'require',
      prepare: false,
      idle_timeout: 20,
    });
  }
  return client;
}

function valueSlots(rowIndex: number, width: number): string {
  const slots: string[] = [];
  for (let col = 0; col < width; col++) slots.push(`$${rowIndex * width + col + 1}`);
  return `(${slots.join(', ')})`;
}

async function insert<T extends object>(tx: Tx, table: string, rows: T[], columns: (keyof T & string)[]) {
  if (rows.length === 0) return;
  const values: (string | number | boolean | null)[] = [];
  for (const row of rows) {
    for (const column of columns) {
      const value = row[column];
      values.push(value === undefined || value === null ? null : value as string | number | boolean);
    }
  }
  const tuples = rows.map((row, index) => {
    void row;
    return valueSlots(index, columns.length);
  });
  await tx.unsafe(
    `insert into ${table} (${columns.join(', ')}) values ${tuples.join(', ')}`,
    values,
  );
}

async function writeAll(tx: Tx, database: Db) {
  const dump = decompose(database);
  await tx.unsafe(`truncate table
    app_settings,
    departments,
    faculty,
    faculty_departments,
    courses,
    course_prerequisites,
    course_qualified_faculty,
    majors,
    major_courses,
    major_advisors,
    students,
    completed_courses,
    transfer_courses,
    student_notes,
    users,
    offerings,
    registrations,
    outlines,
    outline_entries,
    outline_history,
    grade_notes,
    transactions
    restart identity cascade`);

  await insert(tx, 'departments', dump.departments, ['id', 'name', 'position']);
  await insert(tx, 'faculty', dump.faculty, ['id', 'name', 'position_title', 'office_phone', 'office', 'office_hours', 'dept_id', 'email', 'position']);
  await insert(tx, 'faculty_departments', dump.faculty_departments, ['faculty_id', 'dept_id', 'position']);
  await insert(tx, 'courses', dump.courses, ['id', 'title', 'description', 'units', 'dept_id', 'level', 'position']);
  await insert(tx, 'course_prerequisites', dump.course_prerequisites, ['course_id', 'prereq_id', 'position']);
  await insert(tx, 'course_qualified_faculty', dump.course_qualified_faculty, ['course_id', 'faculty_id', 'position']);
  await insert(tx, 'majors', dump.majors, ['id', 'title', 'dept_id', 'units_required', 'major_units', 'position']);
  await insert(tx, 'major_courses', dump.major_courses, ['major_id', 'course_id', 'kind', 'position']);
  await insert(tx, 'students', dump.students, ['id', 'first_name', 'middle_name', 'last_name', 'phone', 'address', 'date_of_birth', 'major_id', 'minor_id', 'graduate', 'standing', 'position']);
  await insert(tx, 'completed_courses', dump.completed_courses, ['student_id', 'course_id', 'title', 'term', 'units', 'grade', 'position']);
  await insert(tx, 'transfer_courses', dump.transfer_courses, ['student_id', 'course_id', 'title', 'term', 'units', 'grade', 'university', 'location', 'equivalent_course_id', 'position']);
  await insert(tx, 'student_notes', dump.student_notes, ['student_id', 'at', 'by_employee_id', 'category', 'body', 'position']);
  for (const user of dump.users) {
    await tx`
      insert into users (
        id, name, job_title, password, must_change_password, password_set_at, role, access,
        last_sign_in, student_id, faculty_id, position
      ) values (
        ${user.id}, ${user.name}, ${user.job_title}, ${user.password}, ${user.must_change_password},
        ${user.password_set_at}, ${user.role}, ${tx.array(user.access)}, ${user.last_sign_in},
        ${user.student_id}, ${user.faculty_id}, ${user.position}
      )
    `;
  }
  await insert(tx, 'major_advisors', dump.major_advisors, ['major_id', 'employee_id', 'position']);
  await insert(tx, 'offerings', dump.offerings, ['schedule_no', 'course_id', 'term', 'days', 'start_time', 'end_time', 'location', 'instructor_id', 'capacity', 'position']);
  await insert(tx, 'registrations', dump.registrations, ['student_id', 'schedule_no', 'type', 'registered_by', 'registered_at', 'grade', 'grade_note', 'grade_updated_by', 'grade_updated_at', 'position']);
  await insert(tx, 'outlines', dump.outlines, ['student_id', 'major_id', 'approved_by', 'approved_at', 'position']);
  await insert(tx, 'outline_entries', dump.outline_entries, ['student_id', 'course_id', 'status', 'status_date', 'by_name', 'note', 'position']);
  await insert(tx, 'outline_history', dump.outline_history, ['student_id', 'at', 'by_name', 'action', 'position']);
  await insert(tx, 'grade_notes', dump.grade_notes, ['schedule_no', 'at', 'by_name', 'body', 'position']);
  await insert(tx, 'transactions', dump.transactions, ['at', 'by_name', 'subsystem', 'body', 'position']);
  await tx`
    insert into app_settings (id, term, registration_closes, grade_window_opens, grade_window_closes)
    values (1, ${dump.settings.term}, ${dump.settings.registration_closes}, ${dump.settings.grade_window_opens}, ${dump.settings.grade_window_closes})
  `;
}

async function readDump(sql: Tx | Sql): Promise<Dump> {
  const [settings] = await sql<Dump['settings'][]>`
    select term, registration_closes, grade_window_opens, grade_window_closes from app_settings where id = 1
  `;
  if (!settings) throw new Error('The course database has no settings row.');
  const departments = await sql<Dump['departments']>`select id, name, position from departments order by position`;
  const faculty = await sql<Dump['faculty']>`select id, name, position_title, office_phone, office, office_hours, dept_id, email, position from faculty order by position`;
  const faculty_departments = await sql<Dump['faculty_departments']>`select faculty_id, dept_id, position from faculty_departments order by position`;
  const courses = await sql<Dump['courses']>`select id, title, description, units, dept_id, level, position from courses order by position`;
  const course_prerequisites = await sql<Dump['course_prerequisites']>`select course_id, prereq_id, position from course_prerequisites order by position`;
  const course_qualified_faculty = await sql<Dump['course_qualified_faculty']>`select course_id, faculty_id, position from course_qualified_faculty order by position`;
  const majors = await sql<Dump['majors']>`select id, title, dept_id, units_required, major_units, position from majors order by position`;
  const major_courses = await sql<Dump['major_courses']>`select major_id, course_id, kind, position from major_courses order by position`;
  const major_advisors = await sql<Dump['major_advisors']>`select major_id, employee_id, position from major_advisors order by position`;
  const students = await sql<Dump['students']>`select id, first_name, middle_name, last_name, phone, address, date_of_birth, major_id, minor_id, graduate, standing, position from students order by position`;
  const completed_courses = await sql<Dump['completed_courses']>`select student_id, course_id, title, term, units, grade, position from completed_courses order by position`;
  const transfer_courses = await sql<Dump['transfer_courses']>`select student_id, course_id, title, term, units, grade, university, location, equivalent_course_id, position from transfer_courses order by position`;
  const student_notes = await sql<Dump['student_notes']>`select student_id, at, by_employee_id, category, body, position from student_notes order by position`;
  const users = await sql<Dump['users']>`select id, name, job_title, password, must_change_password, password_set_at, role, access, last_sign_in, student_id, faculty_id, position from users order by position`;
  const offerings = await sql<Dump['offerings']>`select schedule_no, course_id, term, days, start_time, end_time, location, instructor_id, capacity, position from offerings order by position`;
  const registrations = await sql<Dump['registrations']>`select student_id, schedule_no, type, registered_by, registered_at, grade, grade_note, grade_updated_by, grade_updated_at, position from registrations order by position`;
  const outlines = await sql<Dump['outlines']>`select student_id, major_id, approved_by, approved_at, position from outlines order by position`;
  const outline_entries = await sql<Dump['outline_entries']>`select student_id, course_id, status, status_date, by_name, note, position from outline_entries order by position`;
  const outline_history = await sql<Dump['outline_history']>`select student_id, at, by_name, action, position from outline_history order by position`;
  const grade_notes = await sql<Dump['grade_notes']>`select schedule_no, at, by_name, body, position from grade_notes order by position`;
  const transactions = await sql<Dump['transactions']>`select at, by_name, subsystem, body, position from transactions order by position`;
  return {
    settings, departments, faculty, faculty_departments, courses, course_prerequisites, course_qualified_faculty,
    majors, major_courses, major_advisors, students, completed_courses, transfer_courses, student_notes, users,
    offerings, registrations, outlines, outline_entries, outline_history, grade_notes, transactions,
  };
}

export function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const sql = getSql();
      const schema = readFileSync(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8');
      await sql.unsafe(schema);
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(532001)`;
        const found = await tx`select 1 from app_settings limit 1`;
        if (found.length > 0) return;
        await writeAll(tx, createSeed());
      });
    })().catch((err: unknown) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export async function loadState(): Promise<Db> {
  await ensureReady();
  return compose(await readDump(getSql()));
}

/** Blank passwords keep the stored value. A non-blank password replaces it. */
export async function saveSnapshot(incoming: Db): Promise<void> {
  await ensureReady();
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(532001)`;
    const existing = await tx<{ id: string; password: string }[]>`select id, password from users`;
    const passwords = new Map(existing.map((row) => [row.id, row.password]));
    const merged: Db = {
      ...incoming,
      users: incoming.users.map((user) => ({
        ...user,
        password: user.password || passwords.get(user.id) || '',
      })),
    };
    if (merged.users.some((user) => !user.password)) {
      throw new Error('Every user needs a password before the record can be saved.');
    }
    await writeAll(tx, merged);
  });
}

export async function authenticate(id: string, password: string, at: string): Promise<
  { ok: true } | { ok: false; field: 'id' | 'password'; reason: string; requirement: string }
> {
  if (!/^\d{5,8}$/.test(id)) {
    return { ok: false, field: 'id', reason: 'ID not found.', requirement: 'Enter your 5- to 8-digit student or employee number, digits only.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(at)) {
    return { ok: false, field: 'id', reason: 'Sign-in time was not recorded.', requirement: 'Try signing in again.' };
  }
  await ensureReady();
  const sql = getSql();
  const [user] = await sql<{ id: string; name: string; password: string }[]>`select id, name, password from users where id = ${id}`;
  if (!user) return { ok: false, field: 'id', reason: 'ID not found.', requirement: 'Enter the student or employee number issued to you.' };
  if (user.password !== password) {
    return { ok: false, field: 'password', reason: 'Password does not match this ID.', requirement: 'Enter the current password for this ID, or ask a system administrator to reset it.' };
  }
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(532001)`;
    await tx`update users set last_sign_in = ${at} where id = ${id}`;
    const [pos] = await tx<{ next: number }[]>`select coalesce(max(position), -1) + 1 as next from transactions`;
    await tx`
      insert into transactions (at, by_name, subsystem, body, position)
      values (${at}, ${user.name}, 'FRAMEWORK', 'Signed in', ${pos.next})
    `;
  });
  return { ok: true };
}
