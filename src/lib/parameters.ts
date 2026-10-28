import type { Db } from '../data/types';

/**
 * User-defined, user-maintained parameters (GEN-11) and value lists (GEN-12). They are stored in
 * the document's valueLists (the value_lists table) and edited by system administrators under
 * Authorized Users. Validation reads them from here; when a list has never been edited, the
 * defaults below apply.
 */
export interface ParameterDef { key: string; label: string; help: string; kind: 'number' | 'list'; fixed?: boolean; defaults: string[]; }

/** Grades the GPA calculation understands; a maintained grade list may only use these. */
export const KNOWN_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'I', 'CR', 'NC', 'AU'];

export const PARAMETERS: ParameterDef[] = [
  { key: 'maxUnits', label: 'Maximum units per term', help: 'Registration refuses a course that would take a student past this many units.', kind: 'number', defaults: ['18'] },
  { key: 'grades', label: 'Grades', help: 'Grades instructors can enter and the registrar can record for completed courses. Only standard grades are accepted.', kind: 'list', defaults: KNOWN_GRADES },
  { key: 'semesters', label: 'Semesters', help: 'Offered when entering the semester of a completed or transfer course.', kind: 'list', defaults: ['Fall 2026', 'Summer 2026', 'Spring 2026', 'Fall 2025', 'Summer 2025', 'Spring 2025', 'Fall 2024', 'Spring 2024', 'Fall 2023'] },
  { key: 'universities', label: 'Universities', help: 'Accredited universities offered for transfer courses.', kind: 'list', defaults: ['Santa Monica College', 'Pasadena City College', 'UC Irvine', 'Cal State Long Beach', 'San Diego Mesa College'] },
  { key: 'locations', label: 'Buildings and rooms', help: 'Offered for class locations and faculty offices.', kind: 'list', defaults: ['Boelter 2444', 'Boelter 3400', 'Boelter 3760', 'Boelter 5249', 'Boelter 5419', 'LS 2147', 'LS 2320', 'MS 5200', 'MS 6118', 'PAB 1425'] },
  { key: 'positionTitles', label: 'Faculty position titles', help: 'Offered for a faculty member’s position.', kind: 'list', defaults: ['Professor', 'Associate Professor', 'Assistant Professor', 'Senior Lecturer', 'Lecturer'] },
  { key: 'jobTitles', label: 'User job titles', help: 'Offered for an authorized user’s job title.', kind: 'list', defaults: ['Student', 'Registrar', 'Registrar staff', 'Major advisor', 'Professor', 'Lecturer', 'System administrator'] },
  { key: 'noteCategories', label: 'Note categories', help: 'Fixed by the database: advising, commendation, issue, special need.', kind: 'list', fixed: true, defaults: ['advising', 'commendation', 'issue', 'special-need'] },
  { key: 'registrationTypes', label: 'Registration types', help: 'Fixed by the database: letter grade, credit/no credit, audit.', kind: 'list', fixed: true, defaults: ['letter', 'crnc', 'audit'] },
  { key: 'outlineStatuses', label: 'Outline statuses', help: 'Fixed by the requirements: approved, dropped, waived.', kind: 'list', fixed: true, defaults: ['approved', 'dropped', 'waived'] },
];

const def = (key: string) => PARAMETERS.find((p) => p.key === key);

/** The maintained values for a list, or its defaults. */
export function listOf(db: Pick<Db, 'valueLists'>, key: string): string[] {
  const v = db.valueLists?.[key];
  return v && v.length ? v : def(key)?.defaults ?? [];
}

export function maxUnits(db: Pick<Db, 'valueLists'>): number {
  const n = Number(listOf(db, 'maxUnits')[0]);
  return Number.isInteger(n) && n > 0 ? n : 18;
}

/** Letter grades for letter-graded registrations (the grade list without CR, NC and AU). */
export const letterGrades = (db: Pick<Db, 'valueLists'>) => listOf(db, 'grades').filter((g) => !['CR', 'NC', 'AU'].includes(g));
/** Grades that complete a course: everything in the grade list except Incomplete and Audit. */
export const completionGrades = (db: Pick<Db, 'valueLists'>) => listOf(db, 'grades').filter((g) => g !== 'I' && g !== 'AU');

/** Checks an edited list before it is saved; the message states the reason and what is needed. */
export function valueListIssue(key: string, values: string[]): { reason: string; requirement: string } | null {
  const d = def(key);
  if (!d) return { reason: `${key} is not a maintained list.`, requirement: 'Choose a list from the menu.' };
  if (d.fixed) return { reason: `${d.label} are fixed.`, requirement: d.help };
  const v = values.map((x) => x.trim()).filter(Boolean);
  if (!v.length) return { reason: `${d.label} cannot be empty.`, requirement: 'Keep at least one value.' };
  if (new Set(v.map((x) => x.toLowerCase())).size !== v.length) return { reason: 'The list has duplicate values.', requirement: 'Remove the repeated entries.' };
  if (d.kind === 'number') {
    const n = Number(v[0]);
    if (v.length !== 1 || !Number.isInteger(n) || n < 1 || n > 30) return { reason: `${d.label} must be one whole number.`, requirement: 'Enter a number from 1 to 30.' };
  }
  if (key === 'grades') {
    const unknown = v.find((g) => !KNOWN_GRADES.includes(g.toUpperCase()));
    if (unknown) return { reason: `${unknown} is not a standard grade.`, requirement: `Use grades from ${KNOWN_GRADES.join(', ')}.` };
    if (!v.some((g) => ['A', 'A+', 'A-'].includes(g.toUpperCase())) || !v.map((g) => g.toUpperCase()).includes('F')) return { reason: 'The grade list must keep at least one A grade and F.', requirement: 'Add them back before saving.' };
  }
  if (v.some((x) => x.length > 60)) return { reason: 'A value is longer than 60 characters.', requirement: 'Shorten it.' };
  return null;
}

/** Normalizes an edited list the way it will be stored. */
export const normalizeList = (key: string, values: string[]) => values.map((x) => (key === 'grades' ? x.trim().toUpperCase() : x.trim().replace(/\s+/g, ' '))).filter(Boolean);
