import type { CompletedCourse, Db, Student, TransferCourse } from '../data/types';
import { LETTER_GRADES } from './rules';
import { keyInfoBlock } from './student';

/**
 * ER-01, ER-02, ER-04: the student record maintains course completion information, both for
 * courses completed here and for courses completed at another accredited university (with that
 * university's name and location and the equivalent course here). These helpers validate an add
 * or correction; messages state the reason and what is needed (GEN-30).
 */
export type HistoryKind = 'here' | 'transfer';
export type HistoryField = 'courseId' | 'title' | 'term' | 'units' | 'grade' | 'university' | 'location' | 'equivalentCourseId' | 'record';
export interface HistoryIssue { field: HistoryField; reason: string; requirement: string; }

/** Grades that complete a course: letter grades (not Incomplete) and credit / no credit. */
export const COMPLETION_GRADES = [...LETTER_GRADES.filter((g) => g !== 'I'), 'CR', 'NC'];

const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'];
const termKey = (term: string) => { const [s, y] = term.split(' '); return Number(y) * 10 + SEASONS.indexOf(s); };

/** "cs101" → "CS 101", "fall 2025" → "Fall 2025", trimmed text. */
export function normalizeHistory<T extends CompletedCourse>(c: T): T {
  const id = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ').replace(/^([A-Z]+)(\d)/, '$1 $2');
  const term = c.term.trim().replace(/\s+/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase());
  const out: CompletedCourse = { ...c, courseId: id(c.courseId), title: c.title.trim().replace(/\s+/g, ' '), term, grade: c.grade.trim().toUpperCase() };
  if ('university' in c) {
    const t = c as unknown as TransferCourse;
    Object.assign(out, { university: t.university.trim().replace(/\s+/g, ' '), location: t.location.trim().replace(/\s+/g, ' '), equivalentCourseId: t.equivalentCourseId.trim() ? id(t.equivalentCourseId) : '' });
  }
  return out as T;
}

/** The identity of a history entry, matching the table keys (student, course, term[, university]). */
export const historyKey = (kind: HistoryKind, c: CompletedCourse) => kind === 'here' ? `${c.courseId}|${c.term}` : `${c.courseId}|${(c as TransferCourse).university}|${c.term}`;

/**
 * The first problem with a history entry, in screen order, or null. `originalKey` is the entry's
 * key before a correction, or null when adding.
 */
export function historyIssue(db: Db, student: Student, kind: HistoryKind, entry: CompletedCourse | TransferCourse, originalKey: string | null): HistoryIssue | null {
  const block = keyInfoBlock(student);
  if (block) return { field: 'record', ...block };
  const c = normalizeHistory(entry);
  const idRule = /^[A-Z]{2,5} \d{1,4}[A-Z]?$/;
  if (!idRule.test(c.courseId)) return { field: 'courseId', reason: 'Course ID is not in a course-number format.', requirement: kind === 'here' ? 'Use the department code, a space and the number, e.g. CS 310.' : 'Use the other school’s department code and number, e.g. MATH 21.' };
  if (kind === 'here' && !db.courses.some((x) => x.id === c.courseId)) return { field: 'courseId', reason: `${c.courseId} is not in this university’s catalog.`, requirement: 'Choose a catalog course, or record it as a transfer course.' };
  if (!c.title) return { field: 'title', reason: 'Course title is required.', requirement: 'Enter the title as it appears on the transcript.' };
  if (!/^(Winter|Spring|Summer|Fall) (19|20)\d\d$/.test(c.term)) return { field: 'term', reason: 'Semester is not in the expected format.', requirement: 'Enter the season and year, e.g. Fall 2025.' };
  if (termKey(c.term) >= termKey(db.term)) return { field: 'term', reason: `${c.term} is not before the current semester (${db.term}).`, requirement: `Enter a completed semester; current courses are recorded through registration.` };
  if (!Number.isInteger(c.units) || c.units < 0 || c.units > 12) return { field: 'units', reason: 'Units must be a whole number from 0 to 12.', requirement: 'Enter the units earned, e.g. 4.' };
  if (!COMPLETION_GRADES.includes(c.grade)) return { field: 'grade', reason: `${c.grade || 'The grade'} is not a completion grade.`, requirement: `Choose one of ${COMPLETION_GRADES.join(', ')}.` };
  if (kind === 'transfer') {
    const t = c as TransferCourse;
    if (!t.university) return { field: 'university', reason: 'University name is required.', requirement: 'Enter the accredited university where the course was completed.' };
    if (!t.location) return { field: 'location', reason: 'University location is required.', requirement: 'Enter the city and state (or country), e.g. Santa Monica, CA.' };
    if (t.equivalentCourseId && !db.courses.some((x) => x.id === t.equivalentCourseId)) return { field: 'equivalentCourseId', reason: `${t.equivalentCourseId} is not in this university’s catalog.`, requirement: 'Choose the equivalent catalog course, or leave it blank if there is none.' };
  }
  const key = historyKey(kind, c);
  const list = kind === 'here' ? student.completed : student.transfer;
  if (key !== originalKey && list.some((x) => historyKey(kind, x) === key)) return { field: 'courseId', reason: `${c.courseId} in ${c.term} is already on this record.`, requirement: 'Correct the existing entry instead of adding it again.' };
  return null;
}

/** Applies an add or correction to one student's record, without side effects. */
export function applyHistorySave(db: Db, studentId: string, kind: HistoryKind, entry: CompletedCourse | TransferCourse, originalKey: string | null): { ok: true; db: Db; log: string | null } | ({ ok: false } & HistoryIssue) {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return { ok: false, field: 'record', reason: `Student ${studentId} was not found.`, requirement: 'Choose a student from the search.' };
  const issue = historyIssue(db, student, kind, entry, originalKey);
  if (issue) return { ok: false, ...issue };
  const next = normalizeHistory(entry);
  const field = kind === 'here' ? 'completed' : 'transfer';
  const list = student[field] as CompletedCourse[];
  const prev = originalKey ? list.find((x) => historyKey(kind, x) === originalKey) : undefined;
  if (originalKey && !prev) return { ok: false, field: 'record', reason: 'That entry is no longer on the record.', requirement: 'Close this panel and open the record again.' };
  if (prev && JSON.stringify(normalizeHistory(prev)) === JSON.stringify(next)) return { ok: true, db, log: null };
  const updated = prev ? list.map((x) => (x === prev ? next : x)) : [...list, next];
  const label = kind === 'here' ? 'completed course' : 'transfer course';
  return {
    ok: true,
    db: { ...db, students: db.students.map((s) => (s.id === studentId ? { ...s, [field]: updated } : s)) },
    log: `${prev ? 'Corrected' : 'Added'} ${label} ${next.courseId} (${next.term}, ${next.grade}) for student ${studentId}`,
  };
}
