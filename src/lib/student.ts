import type { Db, Student } from '../data/types.js';
import { nameIssue, normalizeName, type NameIssue } from './names.js';

/** The general student information a user can return to and modify (GEN-32, ER-02). */
export type StudentInfo = Pick<Student, 'firstName' | 'middleName' | 'lastName' | 'phone' | 'address' | 'dateOfBirth' | 'majorId' | 'minorId' | 'graduate'>;

/** Fields a student may change on their own record; everything else needs a staff user. */
export const SELF_EDITABLE: (keyof StudentInfo)[] = ['phone', 'address'];

export const LABELS: Record<keyof StudentInfo, string> = {
  firstName: 'First name', middleName: 'Middle name', lastName: 'Last name', phone: 'Telephone', address: 'Address',
  dateOfBirth: 'Date of birth', majorId: 'Major', minorId: 'Minor', graduate: 'Graduate program',
};

export const isMinor = (majorId: string) => /-MIN$/.test(majorId);

/** Normalizes the entry the way it will be stored: trimmed names with hyphens closed up, phone as (310) 555-0142. */
export function normalizeStudentInfo(info: StudentInfo): StudentInfo {
  const digits = info.phone.replace(/\D/g, '');
  const phone = digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : info.phone.trim();
  return {
    ...info,
    firstName: normalizeName(info.firstName),
    middleName: normalizeName(info.middleName ?? '') || undefined,
    lastName: normalizeName(info.lastName),
    phone,
    address: info.address.trim().replace(/\s+/g, ' '),
    minorId: info.minorId || undefined,
  };
}

/** The first problem with the entry, in screen order, or null. Messages state the reason and what is needed (GEN-30). */
export function studentInfoIssue(db: Db, info: StudentInfo, today = new Date().toISOString().slice(0, 10)): (NameIssue & { field: keyof StudentInfo }) | null {
  const n = normalizeStudentInfo(info);
  for (const [field, required] of [['firstName', true], ['middleName', false], ['lastName', true]] as const) {
    const issue = nameIssue(n[field] ?? '', LABELS[field], required);
    if (issue) return { ...issue, field };
  }
  if (n.phone.replace(/\D/g, '').length !== 10) return { field: 'phone', reason: 'Telephone number is not complete.', requirement: 'Enter 10 digits including the area code, e.g. (310) 555-0142.' };
  if (n.address.length < 8) return { field: 'address', reason: 'Address is missing or too short.', requirement: 'Enter street, city, state and ZIP code.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.dateOfBirth) || Number.isNaN(Date.parse(n.dateOfBirth))) return { field: 'dateOfBirth', reason: 'Date of birth is not a valid date.', requirement: 'Choose the date from the calendar (YYYY-MM-DD).' };
  const age = Number(today.slice(0, 4)) - Number(n.dateOfBirth.slice(0, 4));
  if (n.dateOfBirth >= today || age < 13 || age > 100) return { field: 'dateOfBirth', reason: 'Date of birth is outside the accepted range.', requirement: 'Students must be between 13 and 100 years old.' };
  if (!db.majors.some((m) => m.id === n.majorId && !isMinor(m.id))) return { field: 'majorId', reason: 'Major is not in the catalog.', requirement: 'Choose a major from the list, or Undeclared.' };
  if (n.minorId) {
    const minor = db.majors.find((m) => m.id === n.minorId);
    if (!minor || !isMinor(minor.id)) return { field: 'minorId', reason: 'Minor is not in the catalog.', requirement: 'Choose a minor from the list, or None.' };
    if (minor.deptId === db.majors.find((m) => m.id === n.majorId)?.deptId) return { field: 'minorId', reason: 'Minor is in the same department as the major.', requirement: 'Choose a minor outside the major’s department, or None.' };
  }
  return null;
}

/** Key information a record needs before the rest of SignMeUp can use it; blank on a new self-created account. */
export function missingKeyInfo(s: Student): (keyof StudentInfo)[] {
  return (['lastName', 'phone', 'address', 'dateOfBirth'] as const).filter((f) => !String(s[f] ?? '').trim());
}

/** Field names whose stored values differ, for the transaction label. */
export function changedFields(before: StudentInfo, after: StudentInfo): (keyof StudentInfo)[] {
  return (Object.keys(LABELS) as (keyof StudentInfo)[]).filter((k) => (before[k] ?? '') !== (after[k] ?? ''));
}
