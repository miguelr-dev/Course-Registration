import type { Db, Major, User } from '../data/types';
import { canMaintainCatalog } from './catalog';

/**
 * MAJ-01, MAJ-02: MAJOR maintains, for each major, its ID, title, department, units required,
 * required courses, electives and advisors. Messages state the reason and what is needed (GEN-30).
 * The registrar and administrators make these changes; the server enforces that (GEN-05).
 */
export type MajorField = 'id' | 'title' | 'deptId' | 'unitsRequired' | 'majorUnits' | 'requiredCourses' | 'electives' | 'advisors';
export interface MajorIssue { field: MajorField; reason: string; requirement: string; }

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

export function normalizeMajor(m: Major): Major {
  return { ...m, id: m.id.trim().toUpperCase().replace(/\s+/g, '-'), title: m.title.trim().replace(/\s+/g, ' '), requiredCourses: uniq(m.requiredCourses), electives: uniq(m.electives), advisors: uniq(m.advisors) };
}

/** Advisors are SignMeUp staff accounts (advisors, faculty or the registrar), identified by employee number. */
export const advisorCandidates = (db: Db) => db.users.filter((u) => u.role === 'advisor' || u.role === 'faculty' || u.role === 'registrar');

export function majorIssue(db: Db, entry: Major, originalId: string | null): MajorIssue | null {
  const m = normalizeMajor(entry);
  if (!/^[A-Z][A-Z0-9]{1,7}(-[A-Z0-9]{2,6})?$/.test(m.id)) return { field: 'id', reason: 'Major ID is not in the expected format.', requirement: 'Use a department code and degree, e.g. CS-BS or MATH-MIN.' };
  if (originalId !== null && m.id !== originalId) return { field: 'id', reason: 'A major ID cannot be changed once saved.', requirement: `Keep ${originalId}, or add the new major separately.` };
  if (originalId === null && db.majors.some((x) => x.id === m.id)) return { field: 'id', reason: `${m.id} already exists.`, requirement: 'Choose a different ID, or edit the existing major.' };
  if (!m.title) return { field: 'title', reason: 'Title is required.', requirement: 'Enter the major title, e.g. Computer Science, B.S.' };
  if (!db.departments.some((d) => d.id === m.deptId)) return { field: 'deptId', reason: 'Department is not in the catalog.', requirement: 'Choose the department from the list.' };
  if (!Number.isInteger(m.unitsRequired) || m.unitsRequired < 1 || m.unitsRequired > 240) return { field: 'unitsRequired', reason: 'Units required must be a whole number from 1 to 240.', requirement: 'Enter the units required, e.g. 120.' };
  if (!Number.isInteger(m.majorUnits) || m.majorUnits < 0 || m.majorUnits > m.unitsRequired) return { field: 'majorUnits', reason: 'Units in the major must be from 0 up to the units required.', requirement: `Enter a number from 0 to ${m.unitsRequired}.` };
  const unknown = [...m.requiredCourses, ...m.electives].find((c) => !db.courses.some((x) => x.id === c));
  if (unknown) return { field: m.requiredCourses.includes(unknown) ? 'requiredCourses' : 'electives', reason: `${unknown} is not in the catalog.`, requirement: 'Choose courses from the catalog.' };
  const both = m.requiredCourses.find((c) => m.electives.includes(c));
  if (both) return { field: 'electives', reason: `${both} is listed as both required and elective.`, requirement: 'Keep it in one list only.' };
  const staff = new Set(advisorCandidates(db).map((u) => u.id));
  const bad = m.advisors.find((a) => !staff.has(a));
  if (bad) return { field: 'advisors', reason: `${bad} is not an advisor, faculty or registrar account.`, requirement: 'Choose advisors from the list.' };
  return null;
}

export function applyMajorSave(db: Db, user: Pick<User, 'role' | 'access'> | null | undefined, entry: Major, originalId: string | null): { ok: true; db: Db; log: string | null } | ({ ok: false } & MajorIssue) {
  if (!canMaintainCatalog(user)) return { ok: false, field: 'id', reason: 'Changing major requirements requires the registrar or a system administrator.', requirement: 'Ask the registrar to make this change.' };
  const issue = majorIssue(db, entry, originalId);
  if (issue) return { ok: false, ...issue };
  const next = normalizeMajor(entry);
  const prev = originalId ? db.majors.find((x) => x.id === originalId) : undefined;
  if (!prev) return { ok: true, db: { ...db, majors: [...db.majors, next] }, log: `Added major ${next.id} ${next.title}` };
  const same = (a: unknown, b: unknown) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b);
  const changed = (['title', 'deptId', 'unitsRequired', 'majorUnits', 'requiredCourses', 'electives', 'advisors'] as const).filter((k) => !same(prev[k], next[k]));
  if (!changed.length) return { ok: true, db, log: null };
  return { ok: true, db: { ...db, majors: db.majors.map((x) => (x.id === next.id ? next : x)) }, log: `Updated ${changed.join(', ')} for major ${next.id}` };
}
