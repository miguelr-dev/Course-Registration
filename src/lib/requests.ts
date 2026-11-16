import type { Db, Student } from '../data/types';
import { courseOf, currentRegistrations, offeringOf } from './rules';

/**
 * Student requests: a student writes to their major advisor, the registrar, or the instructor of a
 * course they are taking (staff could already write to students through notes, but not the other way
 * round). A request is saved as an advising note on the student's own record, so it is append-only and
 * stamped like every other note (ER-03, GEN-08) and staff read it where they already read notes.
 */
export type RequestKind = 'drop' | 'meeting' | 'other';
export type RequestField = 'to' | 'kind' | 'courseId' | 'message';

export const REQUEST_KINDS: Record<RequestKind, string> = { drop: 'Drop a course', meeting: 'Schedule a meeting', other: 'Other request' };
export const MESSAGE_MAX = 500;

/** Someone a student may send a request to. `id` is the recipient's SignMeUp user ID. */
export interface Recipient { id: string; name: string; label: string; }

export interface StudentRequest { to: string; kind: RequestKind; courseId: string; message: string; }

/** The student's major advisors first, then the instructors of their current courses, then the registrar's office. Each person appears once. */
export function requestRecipients(db: Db, student: Student): Recipient[] {
  const out: Recipient[] = [];
  const add = (id: string | undefined, label: string) => {
    const u = id ? db.users.find((x) => x.id === id) : undefined;
    if (u && !out.some((r) => r.id === u.id)) out.push({ id: u.id, name: u.name, label });
  };
  const major = db.majors.find((m) => m.id === student.majorId);
  for (const id of major?.advisors ?? []) add(id, `Major advisor, ${major!.title}`);
  for (const r of currentRegistrations(db, student.id)) {
    const o = offeringOf(db, r.scheduleNo);
    if (o) add(db.users.find((u) => u.facultyId === o.instructorId)?.id, `Instructor, ${o.courseId}`);
  }
  // The registrar's office: the accounts that can carry out a drop (registrar or administrator with REG access).
  for (const u of db.users.filter((x) => (x.role === 'registrar' || x.role === 'admin') && x.access.includes('REG'))) add(u.id, u.jobTitle || 'Registrar');
  return out;
}

/** The first problem with a request, in screen order, or null (GEN-30: the reason and what is needed). */
export function requestIssue(db: Db, student: Student, req: StudentRequest): { field: RequestField; reason: string; requirement: string } | null {
  if (!requestRecipients(db, student).some((r) => r.id === req.to)) return { field: 'to', reason: 'Choose who the request is for.', requirement: 'Pick your major advisor, one of your instructors, or the registrar.' };
  if (!(req.kind in REQUEST_KINDS)) return { field: 'kind', reason: 'Choose what you are asking for.', requirement: 'Pick drop a course, schedule a meeting, or other request.' };
  const enrolled = currentRegistrations(db, student.id).some((r) => offeringOf(db, r.scheduleNo)?.courseId === req.courseId);
  if (req.kind === 'drop' && !enrolled) return { field: 'courseId', reason: 'Choose the course you want to drop.', requirement: 'Pick one of the courses on your current schedule.' };
  if (req.courseId && !enrolled) return { field: 'courseId', reason: `You are not registered in ${req.courseId} this term.`, requirement: 'Pick one of your current courses, or leave the course blank.' };
  const message = req.message.trim();
  if (!message) return { field: 'message', reason: 'A message is required.', requirement: req.kind === 'drop' ? 'Explain why you want to drop the course.' : 'Describe what you need in a sentence or two.' };
  if (message.length > MESSAGE_MAX) return { field: 'message', reason: `The message is ${message.length} characters long.`, requirement: `Shorten it to ${MESSAGE_MAX} characters or fewer.` };
  return null;
}

/** The note text staff see on the student record, e.g. "Request to Rosa Delgado (Major advisor, …) · Drop a course · CS 310 Data Structures: …". */
export function requestNoteText(db: Db, student: Student, req: StudentRequest): string {
  const to = requestRecipients(db, student).find((r) => r.id === req.to);
  const course = req.courseId ? ` · ${req.courseId} ${courseOf(db, req.courseId)?.title ?? ''}`.trimEnd() : '';
  return `Request to ${to?.name ?? req.to} (${to?.label ?? 'staff'}) · ${REQUEST_KINDS[req.kind]}${course}: ${req.message.trim()}`;
}

/** True for notes created by requestNoteText, so screens can show them as requests. */
export const isRequestNote = (text: string) => text.startsWith('Request to ');
