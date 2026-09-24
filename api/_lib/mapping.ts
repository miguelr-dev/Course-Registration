import type { Db, HelpTopic, NoteCategory, OutlineStatus, RegistrationType, Role, Subsystem } from '../../src/data/types.js';

/**
 * Translates the SignMeUp document (what the browser holds) to and from the relational tables in
 * db/schema.sql. Pure functions: state.ts does the SQL, this file decides which rows exist.
 *
 * Column kinds drive the SELECT text so dates, times and timestamps come back as the exact
 * strings the document uses ('2026-09-12', '09:00', '2026-09-12T14:41:00').
 */
export type Row = Record<string, unknown>;
type Kind = 'date' | 'time' | 'ts';

export interface TableSpec {
  table: string;
  cols: string[];
  keys: string[];                 // natural key: the ON CONFLICT target and the identity used for diffs
  kinds?: Record<string, Kind>;
  appendOnly?: boolean;           // rows are only ever inserted (notes, history, audit trail)
  serial?: boolean;               // has a bigserial id used for stable ordering
}

/** Parents before children: inserts run in this order, deletes in reverse. */
export const TABLES: TableSpec[] = [
  { table: 'departments', cols: ['id', 'name'], keys: ['id'] },
  { table: 'terms', cols: ['id', 'registration_closes', 'grade_window_opens', 'grade_window_closes', 'is_current'], kinds: { registration_closes: 'date', grade_window_opens: 'date', grade_window_closes: 'date' }, keys: ['id'] },
  { table: 'app_users', cols: ['id', 'name', 'email', 'job_title', 'role', 'clerk_user_id', 'last_sign_in', 'student_id', 'faculty_id'], kinds: { last_sign_in: 'ts' }, keys: ['id'] },
  { table: 'user_access', cols: ['user_id', 'subsystem'], keys: ['user_id', 'subsystem'] },
  { table: 'faculty', cols: ['id', 'name', 'position_title', 'office_phone', 'office', 'office_hours', 'dept_id', 'email'], keys: ['id'] },
  { table: 'faculty_teaches_in', cols: ['faculty_id', 'dept_id'], keys: ['faculty_id', 'dept_id'] },
  { table: 'courses', cols: ['id', 'title', 'description', 'units', 'dept_id', 'level'], keys: ['id'] },
  { table: 'course_prerequisites', cols: ['course_id', 'prereq_id'], keys: ['course_id', 'prereq_id'] },
  { table: 'course_qualified_faculty', cols: ['course_id', 'faculty_id'], keys: ['course_id', 'faculty_id'] },
  { table: 'majors', cols: ['id', 'title', 'dept_id', 'units_required', 'major_units'], keys: ['id'] },
  { table: 'major_courses', cols: ['major_id', 'course_id', 'kind'], keys: ['major_id', 'course_id'] },
  { table: 'major_advisors', cols: ['major_id', 'employee_id'], keys: ['major_id', 'employee_id'] },
  { table: 'students', cols: ['id', 'first_name', 'middle_name', 'last_name', 'phone', 'address', 'date_of_birth', 'major_id', 'minor_id', 'graduate', 'standing'], kinds: { date_of_birth: 'date' }, keys: ['id'] },
  { table: 'completed_courses', cols: ['student_id', 'course_id', 'title', 'term', 'units', 'grade'], keys: ['student_id', 'course_id', 'term'] },
  { table: 'transfer_courses', cols: ['student_id', 'course_id', 'title', 'term', 'units', 'grade', 'university', 'location', 'equivalent_course_id'], keys: ['student_id', 'course_id', 'university', 'term'] },
  { table: 'student_notes', cols: ['student_id', 'at', 'by_employee_id', 'category', 'text'], kinds: { at: 'ts' }, keys: ['student_id', 'at', 'by_employee_id', 'text'], appendOnly: true, serial: true },
  { table: 'outlines', cols: ['student_id', 'major_id', 'approved_by', 'approved_at'], kinds: { approved_at: 'ts' }, keys: ['student_id'] },
  { table: 'outline_entries', cols: ['student_id', 'course_id', 'status', 'status_date', 'by', 'note'], kinds: { status_date: 'date' }, keys: ['student_id', 'course_id'] },
  { table: 'outline_history', cols: ['student_id', 'at', 'by', 'action'], kinds: { at: 'ts' }, keys: ['student_id', 'at', 'by', 'action'], appendOnly: true, serial: true },
  { table: 'offerings', cols: ['schedule_no', 'course_id', 'term_id', 'days', 'start_time', 'end_time', 'location', 'instructor_id', 'capacity'], kinds: { start_time: 'time', end_time: 'time' }, keys: ['schedule_no'] },
  { table: 'registrations', cols: ['student_id', 'schedule_no', 'type', 'registered_by', 'registered_at', 'grade', 'grade_note', 'grade_updated_by', 'grade_updated_at'], kinds: { registered_at: 'ts', grade_updated_at: 'ts' }, keys: ['student_id', 'schedule_no'] },
  { table: 'grade_notes', cols: ['schedule_no', 'at', 'by', 'text'], kinds: { at: 'ts' }, keys: ['schedule_no', 'at', 'by', 'text'], appendOnly: true, serial: true },
  { table: 'transactions', cols: ['at', 'by', 'subsystem', 'text'], kinds: { at: 'ts' }, keys: ['at', 'by', 'subsystem', 'text'], appendOnly: true, serial: true },
  { table: 'value_lists', cols: ['field', 'value', 'position'], keys: ['field', 'value'] },
  { table: 'help_topics', cols: ['key', 'title', 'summary', 'fields'], keys: ['key'] },
];

const q = (id: string) => `"${id}"`;
const FORMAT: Record<Kind, string> = { date: 'YYYY-MM-DD', time: 'HH24:MI', ts: 'YYYY-MM-DD"T"HH24:MI:SS' };

/** SELECT text per table, ordered so arrays come back in a stable order. */
export const SELECTS: Record<string, string> = Object.fromEntries(TABLES.map((s) => {
  const cols = s.cols.map((c) => (s.kinds?.[c] ? `to_char(${q(c)}, '${FORMAT[s.kinds[c]]}') as ${q(c)}` : q(c))).join(', ');
  const order = s.serial ? q('id') : s.keys.map(q).join(', ');
  return [s.table, `select ${cols} from ${q(s.table)} order by ${order}`];
}));

const nul = <T>(v: T | undefined | null): T | null => (v === undefined || v === null || (v as unknown) === '' ? null : v);
const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
function strip<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

export function emptyTables(): Record<string, Row[]> {
  return Object.fromEntries(TABLES.map((s) => [s.table, []]));
}

export function docToTables(d: Db): Record<string, Row[]> {
  const t = emptyTables();
  for (const x of d.departments) t.departments.push({ id: x.id, name: x.name });
  t.terms.push({ id: d.term, registration_closes: d.registrationCloses, grade_window_opens: d.gradeWindow.opens, grade_window_closes: d.gradeWindow.closes, is_current: true });
  for (const u of d.users) {
    t.app_users.push({ id: u.id, name: u.name, email: u.email, job_title: u.jobTitle, role: u.role, clerk_user_id: nul(u.clerkUserId), last_sign_in: nul(u.lastSignIn), student_id: nul(u.studentId), faculty_id: nul(u.facultyId) });
    for (const a of u.access) t.user_access.push({ user_id: u.id, subsystem: a });
  }
  for (const f of d.faculty) {
    t.faculty.push({ id: f.id, name: f.name, position_title: f.positionTitle, office_phone: f.officePhone, office: f.office, office_hours: f.officeHours, dept_id: f.deptId, email: f.email });
    for (const dept of f.teachesIn) t.faculty_teaches_in.push({ faculty_id: f.id, dept_id: dept });
  }
  for (const c of d.courses) {
    t.courses.push({ id: c.id, title: c.title, description: c.description, units: c.units, dept_id: c.deptId, level: c.level });
    for (const p of c.prereqs) t.course_prerequisites.push({ course_id: c.id, prereq_id: p });
    for (const f of c.qualifiedFaculty) t.course_qualified_faculty.push({ course_id: c.id, faculty_id: f });
  }
  for (const m of d.majors) {
    t.majors.push({ id: m.id, title: m.title, dept_id: m.deptId, units_required: m.unitsRequired, major_units: m.majorUnits });
    for (const c of m.requiredCourses) t.major_courses.push({ major_id: m.id, course_id: c, kind: 'required' });
    for (const c of m.electives) t.major_courses.push({ major_id: m.id, course_id: c, kind: 'elective' });
    for (const a of m.advisors) t.major_advisors.push({ major_id: m.id, employee_id: a });
  }
  for (const s of d.students) {
    t.students.push({ id: s.id, first_name: s.firstName, middle_name: nul(s.middleName), last_name: s.lastName, phone: s.phone, address: s.address, date_of_birth: nul(s.dateOfBirth), major_id: s.majorId, minor_id: nul(s.minorId), graduate: s.graduate, standing: s.standing });
    for (const c of s.completed) t.completed_courses.push({ student_id: s.id, course_id: c.courseId, title: c.title, term: c.term, units: c.units, grade: c.grade });
    for (const c of s.transfer) t.transfer_courses.push({ student_id: s.id, course_id: c.courseId, title: c.title, term: c.term, units: c.units, grade: c.grade, university: c.university, location: c.location, equivalent_course_id: nul(c.equivalentCourseId) });
    for (const n of s.notes) t.student_notes.push({ student_id: s.id, at: n.at, by_employee_id: n.byEmployeeId, category: n.category, text: n.text });
  }
  for (const o of d.outlines) {
    t.outlines.push({ student_id: o.studentId, major_id: o.majorId, approved_by: o.approvedBy, approved_at: o.approvedAt });
    for (const e of o.entries) t.outline_entries.push({ student_id: o.studentId, course_id: e.courseId, status: e.status, status_date: e.statusDate, by: e.by, note: nul(e.note) });
    for (const h of o.history) t.outline_history.push({ student_id: o.studentId, at: h.at, by: h.by, action: h.action });
  }
  for (const o of d.offerings) t.offerings.push({ schedule_no: o.scheduleNo, course_id: o.courseId, term_id: o.term, days: o.days, start_time: o.start, end_time: o.end, location: o.location, instructor_id: o.instructorId, capacity: o.capacity });
  for (const r of d.registrations) t.registrations.push({ student_id: r.studentId, schedule_no: r.scheduleNo, type: r.type, registered_by: r.registeredBy, registered_at: r.registeredAt, grade: nul(r.grade), grade_note: nul(r.gradeNote), grade_updated_by: nul(r.gradeUpdatedBy), grade_updated_at: nul(r.gradeUpdatedAt) });
  for (const g of d.gradeNotes) t.grade_notes.push({ schedule_no: g.scheduleNo, at: g.at, by: g.by, text: g.text });
  for (const x of d.transactions) t.transactions.push({ at: x.at, by: x.by, subsystem: x.subsystem, text: x.text });
  for (const [field, values] of Object.entries(d.valueLists ?? {})) values.forEach((value, position) => t.value_lists.push({ field, value, position }));
  for (const [key, h] of Object.entries(d.helpTopics ?? {})) t.help_topics.push({ key, title: h.title, summary: h.summary, fields: JSON.stringify(h.fields) });
  return t;
}

function groupBy<T extends Row>(rows: T[], key: string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(r[key]);
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return m;
}
const S = (v: unknown) => String(v);
const N = (v: unknown) => Number(v);

export function tablesToDoc(t: Record<string, Row[]>): Db {
  const rows = (name: string) => t[name] ?? [];
  const term = rows('terms').find((r) => r.is_current) ?? rows('terms')[0];
  const access = groupBy(rows('user_access'), 'user_id');
  const teaches = groupBy(rows('faculty_teaches_in'), 'faculty_id');
  const prereqs = groupBy(rows('course_prerequisites'), 'course_id');
  const qualified = groupBy(rows('course_qualified_faculty'), 'course_id');
  const majorCourses = groupBy(rows('major_courses'), 'major_id');
  const advisors = groupBy(rows('major_advisors'), 'major_id');
  const completed = groupBy(rows('completed_courses'), 'student_id');
  const transfer = groupBy(rows('transfer_courses'), 'student_id');
  const notes = groupBy(rows('student_notes'), 'student_id');
  const entries = groupBy(rows('outline_entries'), 'student_id');
  const history = groupBy(rows('outline_history'), 'student_id');
  const valueLists: Record<string, string[]> = {};
  for (const r of rows('value_lists')) (valueLists[S(r.field)] ??= []).push(S(r.value));
  const helpTopics: Record<string, HelpTopic> = {};
  for (const r of rows('help_topics')) helpTopics[S(r.key)] = { title: S(r.title), summary: S(r.summary), fields: (typeof r.fields === 'string' ? JSON.parse(r.fields) : r.fields) as [string, string][] };

  return {
    term: term ? S(term.id) : '',
    registrationCloses: term ? S(term.registration_closes) : '',
    gradeWindow: { opens: term ? S(term.grade_window_opens) : '', closes: term ? S(term.grade_window_closes) : '' },
    departments: rows('departments').map((r) => ({ id: S(r.id), name: S(r.name) })),
    users: rows('app_users').map((r) => strip({
      id: S(r.id), name: S(r.name), email: S(r.email), jobTitle: S(r.job_title), role: S(r.role) as Role,
      access: (access.get(S(r.id)) ?? []).map((a) => S(a.subsystem) as Subsystem),
      lastSignIn: opt(r.last_sign_in as string | null), clerkUserId: opt(r.clerk_user_id as string | null),
      studentId: opt(r.student_id as string | null), facultyId: opt(r.faculty_id as string | null),
    })),
    faculty: rows('faculty').map((r) => ({
      id: S(r.id), name: S(r.name), positionTitle: S(r.position_title), officePhone: S(r.office_phone ?? ''), office: S(r.office ?? ''), officeHours: S(r.office_hours ?? ''),
      deptId: S(r.dept_id), teachesIn: (teaches.get(S(r.id)) ?? []).map((x) => S(x.dept_id)), email: S(r.email ?? ''),
    })),
    courses: rows('courses').map((r) => ({
      id: S(r.id), title: S(r.title), description: S(r.description), units: N(r.units), deptId: S(r.dept_id), level: S(r.level) as 'lower' | 'upper' | 'graduate',
      prereqs: (prereqs.get(S(r.id)) ?? []).map((x) => S(x.prereq_id)), qualifiedFaculty: (qualified.get(S(r.id)) ?? []).map((x) => S(x.faculty_id)),
    })),
    majors: rows('majors').map((r) => ({
      id: S(r.id), title: S(r.title), deptId: S(r.dept_id), unitsRequired: N(r.units_required), majorUnits: N(r.major_units),
      requiredCourses: (majorCourses.get(S(r.id)) ?? []).filter((x) => x.kind === 'required').map((x) => S(x.course_id)),
      electives: (majorCourses.get(S(r.id)) ?? []).filter((x) => x.kind === 'elective').map((x) => S(x.course_id)),
      advisors: (advisors.get(S(r.id)) ?? []).map((x) => S(x.employee_id)),
    })),
    students: rows('students').map((r) => strip({
      id: S(r.id), firstName: S(r.first_name), middleName: opt(r.middle_name as string | null), lastName: S(r.last_name), phone: S(r.phone), address: S(r.address),
      dateOfBirth: S(r.date_of_birth ?? ''), majorId: S(r.major_id), minorId: opt(r.minor_id as string | null), graduate: Boolean(r.graduate), standing: S(r.standing),
      completed: (completed.get(S(r.id)) ?? []).map((c) => ({ courseId: S(c.course_id), title: S(c.title), term: S(c.term), units: N(c.units), grade: S(c.grade) })),
      transfer: (transfer.get(S(r.id)) ?? []).map((c) => ({ courseId: S(c.course_id), title: S(c.title), term: S(c.term), units: N(c.units), grade: S(c.grade), university: S(c.university), location: S(c.location), equivalentCourseId: S(c.equivalent_course_id ?? '') })),
      notes: (notes.get(S(r.id)) ?? []).map((n) => ({ at: S(n.at), byEmployeeId: S(n.by_employee_id), category: S(n.category) as NoteCategory, text: S(n.text) })),
    })),
    outlines: rows('outlines').map((r) => ({
      studentId: S(r.student_id), majorId: S(r.major_id), approvedBy: S(r.approved_by), approvedAt: S(r.approved_at),
      entries: (entries.get(S(r.student_id)) ?? []).map((e) => strip({ courseId: S(e.course_id), status: S(e.status) as OutlineStatus, statusDate: S(e.status_date), by: S(e.by), note: opt(e.note as string | null) })),
      history: (history.get(S(r.student_id)) ?? []).map((h) => ({ at: S(h.at), by: S(h.by), action: S(h.action) })),
    })),
    offerings: rows('offerings').map((r) => ({ scheduleNo: S(r.schedule_no), courseId: S(r.course_id), term: S(r.term_id), days: S(r.days), start: S(r.start_time), end: S(r.end_time), location: S(r.location), instructorId: S(r.instructor_id), capacity: N(r.capacity) })),
    registrations: rows('registrations').map((r) => strip({
      studentId: S(r.student_id), scheduleNo: S(r.schedule_no), type: S(r.type) as RegistrationType, registeredBy: S(r.registered_by), registeredAt: S(r.registered_at),
      grade: opt(r.grade as string | null), gradeNote: opt(r.grade_note as string | null), gradeUpdatedBy: opt(r.grade_updated_by as string | null), gradeUpdatedAt: opt(r.grade_updated_at as string | null),
    })),
    gradeNotes: rows('grade_notes').map((r) => ({ scheduleNo: S(r.schedule_no), at: S(r.at), by: S(r.by), text: S(r.text) })),
    transactions: rows('transactions').map((r) => ({ at: S(r.at), by: S(r.by), subsystem: S(r.subsystem) as Subsystem | 'FRAMEWORK', text: S(r.text) })),
    valueLists,
    helpTopics,
  };
}
