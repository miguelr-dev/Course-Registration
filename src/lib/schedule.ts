import type { Db, Offering, User } from '../data/types';
import { canMaintainCatalog } from './catalog';
import { conflicts, courseOf } from './rules';
import { formatDate } from './format';

/**
 * REG-01, REG-02, REG-03, REG-13: the schedule of classes for the current term, maintained by
 * department, and the term calendar (registration deadline and grade-entry window). Messages state
 * the reason and what is needed (GEN-30). The registrar and administrators make these changes;
 * the server enforces that through object-based security (GEN-05).
 */
export interface Issue<F extends string> { field: F; reason: string; requirement: string; }
export type OfferingField = 'scheduleNo' | 'courseId' | 'days' | 'start' | 'end' | 'location' | 'instructorId' | 'capacity';
export type TermField = 'registrationCloses' | 'opens' | 'closes';

/** Today as YYYY-MM-DD in the user's time zone. */
export const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** True once the registration deadline has passed; students can no longer register (staff still can). */
export const registrationClosed = (db: Pick<Db, 'registrationCloses'>, today = localToday()) => !!db.registrationCloses && today > db.registrationCloses;

export function registrationClosedIssue(db: Pick<Db, 'registrationCloses' | 'term'>) {
  return { code: 'closed' as const, reason: `Registration for ${db.term} closed on ${formatDate(db.registrationCloses)}.`, requirement: 'Ask the registrar to register you or to extend the deadline.' };
}

const DAYS = /^(M)?(T(?!h))?(W)?(Th)?(F)?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const enrolled = (db: Db, scheduleNo: string) => db.registrations.filter((r) => r.scheduleNo === scheduleNo).length;

export function normalizeOffering(o: Offering): Offering {
  return { ...o, scheduleNo: o.scheduleNo.trim(), courseId: o.courseId.trim().toUpperCase().replace(/\s+/g, ' '), days: o.days.replace(/\s+/g, '').toUpperCase().replace(/TH/g, 'Th'), location: o.location.trim().replace(/\s+/g, ' ') };
}

/** The first problem with a section, in screen order, or null. `originalNo` is null when adding. */
export function offeringIssue(db: Db, entry: Offering, originalNo: string | null): Issue<OfferingField> | null {
  const o = normalizeOffering(entry);
  if (!/^\d{5}$/.test(o.scheduleNo)) return { field: 'scheduleNo', reason: 'Schedule number must be 5 digits.', requirement: 'Enter an unused 5-digit number, e.g. 12340.' };
  if (originalNo !== null && o.scheduleNo !== originalNo) return { field: 'scheduleNo', reason: 'A schedule number cannot be changed.', requirement: `Keep ${originalNo}, or add a new section.` };
  if (originalNo === null && db.offerings.some((x) => x.scheduleNo === o.scheduleNo)) return { field: 'scheduleNo', reason: `Schedule number ${o.scheduleNo} is already used.`, requirement: 'Choose an unused number.' };
  const course = courseOf(db, o.courseId);
  if (!course) return { field: 'courseId', reason: `${o.courseId || 'The course'} is not in the catalog.`, requirement: 'Choose a catalog course; add it under Faculty & Courses first if it is new.' };
  const m = o.days.match(DAYS);
  if (!o.days || !m || !m[0]) return { field: 'days', reason: 'Meeting days are not valid.', requirement: 'Use M, T, W, Th and F in weekday order, e.g. MWF or TTh.' };
  if (!TIME.test(o.start)) return { field: 'start', reason: 'Start time is not valid.', requirement: 'Choose a time between 7:00 AM and 10:00 PM.' };
  if (!TIME.test(o.end) || minutes(o.end) <= minutes(o.start)) return { field: 'end', reason: 'End time must be after the start time.', requirement: 'Choose a later end time.' };
  if (minutes(o.start) < 7 * 60 || minutes(o.end) > 22 * 60) return { field: 'start', reason: 'The section meets outside teaching hours.', requirement: 'Schedule it between 7:00 AM and 10:00 PM.' };
  if (!o.location) return { field: 'location', reason: 'Location is required.', requirement: 'Enter the building and room, e.g. Boelter 3400.' };
  if (!db.faculty.some((f) => f.id === o.instructorId)) return { field: 'instructorId', reason: 'Instructor is not in the faculty directory.', requirement: 'Choose an instructor from the list.' };
  if (!course.qualifiedFaculty.includes(o.instructorId)) return { field: 'instructorId', reason: `${db.faculty.find((f) => f.id === o.instructorId)?.name} is not authorized to teach ${course.id}.`, requirement: 'Choose a qualified instructor, or add them to the course under Faculty & Courses.' };
  if (!Number.isInteger(o.capacity) || o.capacity < 1 || o.capacity > 500) return { field: 'capacity', reason: 'Capacity must be a whole number from 1 to 500.', requirement: 'Enter the number of seats.' };
  const taken = originalNo ? enrolled(db, originalNo) : 0;
  if (o.capacity < taken) return { field: 'capacity', reason: `${taken} students are already registered.`, requirement: `Keep at least ${taken} seats.` };
  const others = db.offerings.filter((x) => x.term === db.term && x.scheduleNo !== originalNo);
  const room = others.find((x) => x.location.toLowerCase() === o.location.toLowerCase() && conflicts(x, { ...o, term: db.term }));
  if (room) return { field: 'location', reason: `${o.location} is already in use by ${room.courseId} (${room.scheduleNo}) at that time.`, requirement: 'Choose another room or time.' };
  const busy = others.find((x) => x.instructorId === o.instructorId && conflicts(x, { ...o, term: db.term }));
  if (busy) return { field: 'instructorId', reason: `The instructor already teaches ${busy.courseId} (${busy.scheduleNo}) at that time.`, requirement: 'Choose another instructor or time.' };
  return null;
}

export type Save = { ok: true; db: Db; log: string | null } | ({ ok: false } & Issue<string>);
const denied = (what: string) => ({ ok: false as const, field: 'scheduleNo', reason: `Changing ${what} requires the registrar or a system administrator.`, requirement: 'Ask the registrar to make this change.' });

/** Adds or edits a section of the current term, without side effects. */
export function applyOfferingSave(db: Db, user: Pick<User, 'role' | 'access'> | null | undefined, entry: Offering, originalNo: string | null): Save {
  if (!canMaintainCatalog(user)) return denied('the schedule of classes');
  const issue = offeringIssue(db, entry, originalNo);
  if (issue) return { ok: false, ...issue };
  const next = { ...normalizeOffering(entry), term: originalNo ? db.offerings.find((o) => o.scheduleNo === originalNo)!.term : db.term };
  const prev = originalNo ? db.offerings.find((o) => o.scheduleNo === originalNo) : undefined;
  if (!prev) return { ok: true, db: { ...db, offerings: [...db.offerings, next] }, log: `Added section ${next.scheduleNo} of ${next.courseId}` };
  const changed = (Object.keys(next) as (keyof Offering)[]).filter((k) => prev[k] !== next[k]);
  if (!changed.length) return { ok: true, db, log: null };
  return { ok: true, db: { ...db, offerings: db.offerings.map((o) => (o.scheduleNo === next.scheduleNo ? next : o)) }, log: `Updated ${changed.join(', ')} for section ${next.scheduleNo} of ${next.courseId}` };
}

/** Cancels a section nobody has registered for yet. */
export function applyOfferingRemove(db: Db, user: Pick<User, 'role' | 'access'> | null | undefined, scheduleNo: string): Save {
  if (!canMaintainCatalog(user)) return denied('the schedule of classes');
  const o = db.offerings.find((x) => x.scheduleNo === scheduleNo);
  if (!o) return { ok: false, field: 'scheduleNo', reason: `Section ${scheduleNo} was not found.`, requirement: 'Refresh the schedule.' };
  const n = enrolled(db, scheduleNo);
  if (n) return { ok: false, field: 'scheduleNo', reason: `${n} students are registered in section ${scheduleNo}.`, requirement: 'Only a section with no registrations can be cancelled.' };
  return { ok: true, db: { ...db, offerings: db.offerings.filter((x) => x.scheduleNo !== scheduleNo) }, log: `Cancelled section ${scheduleNo} of ${o.courseId}` };
}

export interface TermDates { registrationCloses: string; opens: string; closes: string; }

/** Checks the term calendar: valid dates, registration closing before grade entry opens, and the window in order. */
export function termIssue(t: TermDates): Issue<TermField> | null {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(t.registrationCloses)) return { field: 'registrationCloses', reason: 'Registration deadline is not a date.', requirement: 'Choose a date.' };
  if (!date.test(t.opens)) return { field: 'opens', reason: 'Grade entry start is not a date.', requirement: 'Choose a date.' };
  if (!date.test(t.closes) || t.closes < t.opens) return { field: 'closes', reason: 'Grade entry must close on or after it opens.', requirement: 'Choose a later closing date.' };
  if (t.registrationCloses >= t.opens) return { field: 'registrationCloses', reason: 'Registration must close before grade entry opens.', requirement: 'Choose an earlier deadline or a later grade window.' };
  return null;
}

export function applyTermSave(db: Db, user: Pick<User, 'role' | 'access'> | null | undefined, t: TermDates): Save {
  if (!canMaintainCatalog(user)) return denied('the term calendar');
  const issue = termIssue(t);
  if (issue) return { ok: false, ...issue };
  if (db.registrationCloses === t.registrationCloses && db.gradeWindow.opens === t.opens && db.gradeWindow.closes === t.closes) return { ok: true, db, log: null };
  return { ok: true, db: { ...db, registrationCloses: t.registrationCloses, gradeWindow: { opens: t.opens, closes: t.closes } }, log: `Set ${db.term} registration deadline ${t.registrationCloses} and grade window ${t.opens} to ${t.closes}` };
}
