import type { Db, Faculty, User } from '../data/types';
import { canMaintainCatalog } from './catalog';
import { nameIssue, normalizeName } from './names';

/**
 * FCI-01, FCI-02: FCI maintains general faculty information (ID, name, position title, office
 * phone, office number, office hours, assigned department, departments taught in) and the courses
 * each faculty member is qualified to teach. These helpers validate an add or edit before it is
 * saved; messages state the reason and what is needed (GEN-30). The registrar and administrators
 * make these changes, and the server enforces that through object-based security (GEN-05).
 */
export type FacultyField = 'id' | 'name' | 'positionTitle' | 'officePhone' | 'office' | 'officeHours' | 'deptId' | 'teachesIn' | 'email' | 'courses';
export interface FacultyIssue { field: FacultyField; reason: string; requirement: string; }

/** A faculty entry plus the catalog courses they are qualified to teach (stored on each course). */
export interface FacultyEntry { faculty: Faculty; courses: string[]; }

/** "f10231" → "F-10231"; phone as (310) 555-0171; the assigned department always counts as taught in. */
export function normalizeFaculty(f: Faculty): Faculty {
  const digits = f.officePhone.replace(/\D/g, '');
  const id = f.id.trim().toUpperCase().replace(/^F-?(\d)/, 'F-$1');
  return {
    ...f,
    id,
    name: normalizeName(f.name),
    positionTitle: f.positionTitle.trim().replace(/\s+/g, ' '),
    officePhone: digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : f.officePhone.trim(),
    office: f.office.trim().replace(/\s+/g, ' '),
    officeHours: f.officeHours.trim().replace(/\s+/g, ' '),
    teachesIn: [...new Set([f.deptId, ...f.teachesIn].filter(Boolean))],
    email: f.email.trim().toLowerCase(),
  };
}

/** Sections this term the faculty member is the instructor of, by course ID. */
function teachingThisTerm(db: Db, facultyId: string): Map<string, string> {
  return new Map(db.offerings.filter((o) => o.instructorId === facultyId && o.term === db.term).map((o) => [o.courseId, o.scheduleNo]));
}

/** The first problem with a faculty entry, in screen order, or null. `originalId` is null when adding. */
export function facultyIssue(db: Db, entry: FacultyEntry, originalId: string | null): FacultyIssue | null {
  const f = normalizeFaculty(entry.faculty);
  if (!/^F-\d{5}$/.test(f.id)) return { field: 'id', reason: 'Faculty ID is not in the directory format.', requirement: 'Use F- followed by 5 digits, e.g. F-10231.' };
  if (originalId !== null && f.id !== originalId) return { field: 'id', reason: 'A faculty ID cannot be changed once it is in the directory.', requirement: `Keep ${originalId}.` };
  if (originalId === null && db.faculty.some((x) => x.id === f.id)) return { field: 'id', reason: `${f.id} is already in the faculty directory.`, requirement: 'Choose an unused ID, or edit the existing faculty member.' };
  const words = f.name.split(' ');
  if (words.length < 2) return { field: 'name', reason: 'Enter both a first and a last name.', requirement: 'Hyphenated names are accepted, e.g. Lena Hwang-Baptiste.' };
  for (const w of words) { const issue = nameIssue(w, 'Name', true); if (issue) return { field: 'name', ...issue }; }
  if (!f.positionTitle) return { field: 'positionTitle', reason: 'Position title is required.', requirement: 'Enter the position, e.g. Associate Professor.' };
  if (f.officePhone.replace(/\D/g, '').length !== 10) return { field: 'officePhone', reason: 'Office telephone is not complete.', requirement: 'Enter 10 digits including the area code, e.g. (310) 555-0171.' };
  if (!f.office) return { field: 'office', reason: 'Office number is required.', requirement: 'Enter the building and room, e.g. Boelter 4531.' };
  if (!f.officeHours) return { field: 'officeHours', reason: 'Office hours are required.', requirement: 'Enter days and times, e.g. Mon 2:00–4:00 PM.' };
  if (!db.departments.some((d) => d.id === f.deptId)) return { field: 'deptId', reason: 'Assigned department is not in the catalog.', requirement: 'Choose the department from the list.' };
  const unknownDept = f.teachesIn.find((d) => !db.departments.some((x) => x.id === d));
  if (unknownDept) return { field: 'teachesIn', reason: `Department ${unknownDept} is not in the catalog.`, requirement: 'Choose departments from the list.' };
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return { field: 'email', reason: 'Email address is not valid.', requirement: 'Enter an address like name@sdsu.edu, or leave it blank.' };
  const unknownCourse = entry.courses.find((c) => !db.courses.some((x) => x.id === c));
  if (unknownCourse) return { field: 'courses', reason: `Course ${unknownCourse} is not in the catalog.`, requirement: 'Choose courses from the catalog list.' };
  // Keep the schedule consistent: a faculty member teaching a section this term must stay qualified for it.
  if (originalId) {
    for (const [courseId, scheduleNo] of teachingThisTerm(db, originalId)) {
      if (!entry.courses.includes(courseId)) return { field: 'courses', reason: `${f.name} is teaching ${courseId} (section ${scheduleNo}) in ${db.term}.`, requirement: 'Keep that course, or reassign the section first.' };
    }
  }
  return null;
}

export type FacultySave = { ok: true; db: Db; log: string | null } | ({ ok: false } & FacultyIssue);

/** Applies an add or edit to the directory and the courses' qualified-faculty lists, without side effects. */
export function applyFacultySave(db: Db, user: Pick<User, 'role' | 'access'> | null | undefined, entry: FacultyEntry, originalId: string | null): FacultySave {
  if (!canMaintainCatalog(user)) return { ok: false, field: 'id', reason: 'Changing faculty information requires the registrar or a system administrator.', requirement: 'Ask the registrar to make this change.' };
  const issue = facultyIssue(db, entry, originalId);
  if (issue) return { ok: false, ...issue };
  const next = normalizeFaculty(entry.faculty);
  const prev = originalId ? db.faculty.find((f) => f.id === originalId) : undefined;
  if (originalId && !prev) return { ok: false, field: 'id', reason: `${originalId} is no longer in the directory.`, requirement: 'Close this panel and search for the faculty member again.' };
  const wanted = new Set(entry.courses);
  const courses = db.courses.map((c) => {
    const has = c.qualifiedFaculty.includes(next.id);
    if (wanted.has(c.id) && !has) return { ...c, qualifiedFaculty: [...c.qualifiedFaculty, next.id] };
    if (!wanted.has(c.id) && has) return { ...c, qualifiedFaculty: c.qualifiedFaculty.filter((x) => x !== next.id) };
    return c;
  });
  const coursesChanged = courses.some((c, i) => c !== db.courses[i]);
  if (!prev) return { ok: true, db: { ...db, faculty: [...db.faculty, next], courses }, log: `Added faculty ${next.name} (${next.id})` };
  const changed = changedFacultyFields(prev, next);
  if (coursesChanged) changed.push('courses');
  if (!changed.length) return { ok: true, db, log: null };
  return { ok: true, db: { ...db, faculty: db.faculty.map((f) => (f.id === next.id ? next : f)), courses }, log: `Updated ${changed.join(', ')} for faculty ${next.id}` };
}

/** Field names that differ between two versions of a faculty record, for the transaction log. */
export function changedFacultyFields(a: Faculty, b: Faculty): FacultyField[] {
  const fields: FacultyField[] = ['name', 'positionTitle', 'officePhone', 'office', 'officeHours', 'deptId', 'teachesIn', 'email'];
  const v = (f: Faculty, k: FacultyField) => JSON.stringify(k === 'teachesIn' ? [...f.teachesIn].sort() : f[k as keyof Faculty]);
  return fields.filter((k) => v(a, k) !== v(b, k));
}
