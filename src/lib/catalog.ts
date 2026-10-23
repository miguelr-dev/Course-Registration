import type { Course, Db } from '../data/types';

/**
 * FCI-03: FCI maintains each course's ID, title, description, prerequisites, units, and the
 * faculty qualified to teach it. These helpers validate an add or edit before it is saved;
 * messages state the reason and what is needed (GEN-30). The registrar and administrators make
 * these changes; the server enforces that through object-based security (GEN-05).
 */
export type CourseField = 'id' | 'title' | 'description' | 'units' | 'deptId' | 'level' | 'prereqs' | 'qualifiedFaculty';
export interface CourseIssue { field: CourseField; reason: string; requirement: string; }

/** "cs  310" → "CS 310"; trims text and drops duplicate or blank list entries. */
export function normalizeCourse(c: Course): Course {
  const id = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ').replace(/^([A-Z]+)(\d)/, '$1 $2');
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  return {
    ...c,
    id: id(c.id),
    title: c.title.trim().replace(/\s+/g, ' '),
    description: c.description.trim(),
    prereqs: uniq(c.prereqs.map(id)),
    qualifiedFaculty: uniq(c.qualifiedFaculty),
  };
}

/** True when following prerequisites from `start` leads back to `target` (would create a loop). */
function reaches(db: Db, overrides: Map<string, string[]>, start: string, target: string, seen = new Set<string>()): boolean {
  if (start === target) return true;
  if (seen.has(start)) return false;
  seen.add(start);
  const next = overrides.get(start) ?? db.courses.find((c) => c.id === start)?.prereqs ?? [];
  return next.some((p) => reaches(db, overrides, p, target, seen));
}

/**
 * The first problem with a course entry, in screen order, or null.
 * `originalId` is the course's ID before editing, or null when adding a new course.
 */
export function courseIssue(db: Db, draft: Course, originalId: string | null): CourseIssue | null {
  const c = normalizeCourse(draft);
  if (!/^[A-Z]{2,5} \d{3}[A-Z]?$/.test(c.id)) return { field: 'id', reason: 'Course ID is not in the catalog format.', requirement: 'Use the department code, a space and a 3-digit number, e.g. CS 310 or MATH 151A.' };
  if (c.id !== originalId && db.courses.some((x) => x.id === c.id)) return { field: 'id', reason: `${c.id} is already in the catalog.`, requirement: 'Choose a different course ID, or edit the existing course.' };
  if (originalId !== null && c.id !== originalId) return { field: 'id', reason: 'A course ID cannot be changed once it is in the catalog.', requirement: `Keep ${originalId}, or add the new ID as a separate course.` };
  if (!c.title) return { field: 'title', reason: 'Title is required.', requirement: 'Enter the course title, e.g. Data Structures.' };
  if (c.title.length > 80) return { field: 'title', reason: 'Title is longer than 80 characters.', requirement: 'Shorten it to 80 characters or fewer.' };
  if (!c.description) return { field: 'description', reason: 'Description is required.', requirement: 'Enter one or two sentences describing the course.' };
  if (!Number.isInteger(c.units) || c.units < 0 || c.units > 12) return { field: 'units', reason: 'Units must be a whole number from 0 to 12.', requirement: 'Enter the number of units, e.g. 3.' };
  if (!db.departments.some((d) => d.id === c.deptId)) return { field: 'deptId', reason: 'Department is not in the catalog.', requirement: 'Choose the department from the list.' };
  if (!['lower', 'upper', 'graduate'].includes(c.level)) return { field: 'level', reason: 'Course level is not valid.', requirement: 'Choose lower division, upper division or graduate.' };
  for (const p of c.prereqs) {
    if (p === c.id) return { field: 'prereqs', reason: 'A course cannot be its own prerequisite.', requirement: `Remove ${p} from the prerequisites.` };
    if (!db.courses.some((x) => x.id === p)) return { field: 'prereqs', reason: `Prerequisite ${p} is not in the catalog.`, requirement: 'Choose prerequisites from existing courses.' };
    if (reaches(db, new Map([[c.id, c.prereqs]]), p, c.id)) return { field: 'prereqs', reason: `${p} already requires ${c.id}, so this would create a prerequisite loop.`, requirement: `Remove ${p} from the prerequisites.` };
  }
  for (const f of c.qualifiedFaculty) {
    if (!db.faculty.some((x) => x.id === f)) return { field: 'qualifiedFaculty', reason: `Faculty ${f} is not in the faculty directory.`, requirement: 'Choose qualified faculty from the list.' };
  }
  return null;
}

/** Field names that differ between two versions of a course, for the transaction log. */
export function changedCourseFields(a: Course, b: Course): CourseField[] {
  const fields: CourseField[] = ['title', 'description', 'units', 'deptId', 'level', 'prereqs', 'qualifiedFaculty'];
  return fields.filter((f) => JSON.stringify(Array.isArray(a[f]) ? [...(a[f] as string[])].sort() : a[f]) !== JSON.stringify(Array.isArray(b[f]) ? [...(b[f] as string[])].sort() : b[f]));
}
