import type { Db, Subsystem, User } from '../../src/data/types.js';
import { isAdminCaller } from '../../src/lib/sync-rules.js';
import { docToTables, TABLES, type Row } from './mapping.js';

/**
 * Object-based security (GEN-05, GEN-07). Every write is compared with the stored document row
 * by row, using the same table mapping as storage, and each added, changed or removed row must be
 * allowed for the signed-in user's role, access areas and relationship to that object: a student
 * may change only their own enrollment and contact details, grades belong to the course's primary
 * instructor, outlines to the major's advisors, the catalog to the registrar. Administrators may
 * change anything. Users and access areas are checked separately by validateWrite.
 */
export type PermissionCheck = { ok: true } | { ok: false; reason: string };

interface Actor { user: User; isNew: boolean; }

type Change = { table: string; before: Row | null; after: Row | null };

const CATALOG = new Set(['departments', 'terms', 'faculty', 'faculty_teaches_in', 'courses', 'course_prerequisites', 'course_qualified_faculty', 'majors', 'major_courses', 'major_advisors', 'offerings', 'value_lists', 'help_topics']);
const CHECKED_ELSEWHERE = new Set(['app_users', 'user_access']);
const GRADE_COLS = ['grade', 'grade_note', 'grade_updated_by', 'grade_updated_at'];
const SELF_EDITABLE_STUDENT_COLS = ['phone', 'address'];

const TABLE_LABEL: Record<string, string> = {
  departments: 'departments', terms: 'the term calendar', faculty: 'faculty information', faculty_teaches_in: 'faculty information', courses: 'the course catalog',
  course_prerequisites: 'the course catalog', course_qualified_faculty: 'the course catalog', majors: 'major requirements', major_courses: 'major requirements',
  major_advisors: 'major requirements', offerings: 'the schedule of classes', value_lists: 'value lists', help_topics: 'help screens',
};

function diff(before: Db, after: Db): Change[] {
  const a = docToTables(before);
  const b = docToTables(after);
  const out: Change[] = [];
  for (const spec of TABLES) {
    const key = (r: Row) => JSON.stringify(spec.keys.map((k) => r[k] ?? null));
    const val = (r: Row) => JSON.stringify(spec.cols.map((c) => r[c] ?? null));
    const was = new Map(a[spec.table].map((r) => [key(r), r]));
    const now = new Map(b[spec.table].map((r) => [key(r), r]));
    for (const [k, r] of now) {
      const prev = was.get(k);
      if (!prev) out.push({ table: spec.table, before: null, after: r });
      else if (val(prev) !== val(r)) out.push({ table: spec.table, before: prev, after: r });
    }
    for (const [k, r] of was) if (!now.has(k)) out.push({ table: spec.table, before: r, after: null });
  }
  return out;
}

const changedCols = (c: Change) => (c.before && c.after ? Object.keys(c.after).filter((k) => (c.before![k] ?? null) !== (c.after![k] ?? null)) : []);

export function checkObjectPermissions(email: string, before: Db | null, after: Db, adminEmails: string[], today = new Date().toISOString().slice(0, 10)): PermissionCheck {
  if (!before || isAdminCaller(email, before, adminEmails)) return { ok: true };
  const e = email.toLowerCase();
  const existing = before.users.find((u) => u.email.toLowerCase() === e);
  const created = existing ? undefined : after.users.find((u) => u.email.toLowerCase() === e);
  const me: Actor | null = existing ? { user: existing, isNew: false } : created ? { user: created, isNew: true } : null;
  if (!me) return { ok: false, reason: 'Your account is not set up yet. Sign out and sign in again.' };
  for (const c of diff(before, after)) {
    if (CHECKED_ELSEWHERE.has(c.table)) continue;
    const reason = refusal(c, me, before, after, today);
    if (reason) return { ok: false, reason };
  }
  return { ok: true };
}

function refusal(c: Change, { user: me, isNew }: Actor, before: Db, after: Db, today: string): string | null {
  const has = (a: Subsystem) => me.access.includes(a);
  const staff = me.role !== 'student';
  const row = (c.after ?? c.before)!;
  const ownStudent = !!me.studentId && row.student_id === me.studentId;

  if (CATALOG.has(c.table)) {
    return me.role === 'registrar' ? null : `Changing ${TABLE_LABEL[c.table]} requires the registrar or a system administrator.`;
  }

  switch (c.table) {
    case 'transactions':
      if (!c.after || c.before) return 'The transaction log is append-only; entries cannot be changed or removed.';
      return c.after.by === me.name ? null : `Transactions must be labeled with your own name (${me.name}).`;

    case 'students': {
      if (!c.after) return 'Student records cannot be deleted.';
      if (!c.before) {
        if (isNew && c.after.id === me.studentId) return null; // first sign-in creates the student's own record
        return staff && has('ER') ? null : 'Adding a student record requires staff access to Student Record (ER).';
      }
      if (staff && has('ER')) return null;
      if (me.studentId === c.after.id && changedCols(c).every((k) => SELF_EDITABLE_STUDENT_COLS.includes(k))) return null;
      return me.studentId === c.after.id
        ? 'Students can change only their own telephone and address. Ask the registrar to change the rest of your record.'
        : 'You can change only your own student record.';
    }

    case 'completed_courses':
    case 'transfer_courses':
      return staff && has('ER') ? null : 'Course history is maintained by staff with Student Record (ER) access.';

    case 'student_notes':
      if (!c.after || c.before) return 'Student notes are append-only; they cannot be changed or deleted.';
      if (c.after.by_employee_id !== me.id) return `A note must be stamped with your own ID (${me.id}).`;
      return (staff && has('ER')) || ownStudent ? null : 'Adding a note requires staff access to Student Record (ER).';

    case 'outlines':
    case 'outline_entries':
    case 'outline_history': {
      if (!c.after) return c.table === 'outlines' ? 'Approved outlines cannot be deleted.' : 'Approved outline entries and their history cannot be deleted.';
      if (c.table === 'outline_history' && c.before) return 'Outline history is append-only.';
      const majorId = String(c.table === 'outlines' ? c.after.major_id : (after.outlines.find((o) => o.studentId === row.student_id) ?? before.outlines.find((o) => o.studentId === row.student_id))?.majorId ?? '');
      const major = before.majors.find((m) => m.id === majorId);
      if (me.role === 'registrar' && has('MAJOR')) return null;
      if (me.role === 'advisor' && has('MAJOR') && major?.advisors.includes(me.id)) return null;
      return `Only an advisor for ${major?.title ?? 'this major'} or an authorized department user can change an approved outline.`;
    }

    case 'registrations': {
      const offering = before.offerings.find((o) => o.scheduleNo === row.schedule_no);
      const canGrade = has('GRADE') && (me.role === 'registrar' || (!!me.facultyId && me.facultyId === offering?.instructorId));
      if (c.before && c.after) {
        const cols = changedCols(c);
        if (cols.every((k) => GRADE_COLS.includes(k))) {
          if (!canGrade) return 'Only the course’s primary instructor, or a user with grade update privileges, can enter grades.';
          const inWindow = today >= before.gradeWindow.opens && today <= before.gradeWindow.closes;
          return cols.includes('grade') && me.role !== 'registrar' && !inWindow ? `Grades can be entered only from ${before.gradeWindow.opens} to ${before.gradeWindow.closes} without special update privileges.` : null;
        }
        return staff && has('REG') ? null : 'You can change only your own registrations.';
      }
      if (GRADE_COLS.some((k) => (c.before ?? c.after)![k] != null) && !canGrade) return 'A graded registration can be changed only by the instructor or a user with grade update privileges.';
      return ownStudent || (staff && has('REG')) ? null : 'You can register or drop courses only for yourself.';
    }

    case 'grade_notes': {
      if (!c.after || c.before) return 'Grade notes are append-only.';
      const offering = before.offerings.find((o) => o.scheduleNo === c.after!.schedule_no);
      return has('GRADE') && (me.role === 'registrar' || (!!me.facultyId && me.facultyId === offering?.instructorId)) ? null : 'Only the course’s primary instructor can add notes to its grade sheet.';
    }
  }
  return `Changes to ${c.table} are not allowed for your role.`;
}
