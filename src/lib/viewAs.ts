import type { Db, Role, Subsystem, User } from '../data/types.js';
import { ALL_ACCESS, STUDENT_ACCESS } from './auth.js';
import { fullName } from './names.js';

/**
 * Role switcher (FW-09): lets a system administrator see SignMeUp as each user type the
 * requirements define, without signing in to separate accounts. Only the role, access areas and
 * the student or faculty record the screens attach to change; the name and ID stay the
 * administrator's, so every transaction is still labeled with the real user (GEN-08).
 */
export interface ViewAs { role: Role; studentId?: string; facultyId?: string; }

export const ROLE_VIEWS: Record<Role, { label: string; jobTitle: string; access: Subsystem[]; summary: string }> = {
  student: { label: 'Student', jobTitle: 'Student', access: STUDENT_ACCESS, summary: 'Own record, registration, own outline, faculty & courses' },
  faculty: { label: 'Faculty', jobTitle: 'Faculty', access: ['FCI', 'GRADE'], summary: 'Grades for courses they teach, faculty & courses' },
  advisor: { label: 'Major advisor', jobTitle: 'Major advisor', access: ['ER', 'REG', 'MAJOR', 'FCI'], summary: 'Student records and approved outlines' },
  registrar: { label: 'Department user / registrar', jobTitle: 'Registrar staff', access: ['ER', 'REG', 'MAJOR', 'FCI', 'GRADE'], summary: 'Records, outlines, grade updates, catalog' },
  admin: { label: 'System administrator', jobTitle: 'System administrator', access: ALL_ACCESS, summary: 'Everything, including authorized users' },
};

export const ROLE_ORDER: Role[] = ['student', 'faculty', 'advisor', 'registrar', 'admin'];

/** The record a role views by default: a student with an outline, an instructor with a current class, a listed advisor. */
export function defaultView(db: Db, role: Role): ViewAs {
  if (role === 'student') return { role, studentId: (db.outlines.find((o) => db.students.some((s) => s.id === o.studentId)) ?? db.outlines[0])?.studentId ?? db.students[0]?.id };
  if (role === 'faculty') return { role, facultyId: db.offerings.find((o) => o.term === db.term && db.registrations.some((r) => r.scheduleNo === o.scheduleNo))?.instructorId ?? db.faculty[0]?.id };
  if (role === 'advisor') return { role, facultyId: db.users.find((u) => u.role === 'advisor')?.facultyId };
  return { role };
}

/** True when this user may use the switcher: only real system administrators. */
export const canSwitchRoles = (real: User | null) => real?.role === 'admin';

/** The user the screens see. Without a view, or for anyone but an administrator, that is the real user. */
export function effectiveUser(real: User | null, view: ViewAs | null): User | null {
  if (!real || !view || !canSwitchRoles(real) || view.role === 'admin') return real;
  const r = ROLE_VIEWS[view.role];
  return { ...real, role: view.role, access: r.access, jobTitle: `${r.jobTitle} (viewing as)`, studentId: view.studentId, facultyId: view.facultyId };
}

/** Who the view is attached to, for the banner: "Student · Maria Okafor-Reyes". */
export function describeView(db: Db, view: ViewAs): string {
  const label = ROLE_VIEWS[view.role].label;
  const s = view.studentId ? db.students.find((x) => x.id === view.studentId) : undefined;
  if (s) return `${label} · ${fullName(s)}`;
  const f = view.facultyId ? db.faculty.find((x) => x.id === view.facultyId) : undefined;
  return f ? `${label} · ${f.name}` : label;
}
