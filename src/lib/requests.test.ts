import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { currentRegistrations, offeringOf } from './rules';
import { dropClosedIssue, registrationClosed } from './schedule';
import { isRequestNote, requestIssue, requestNoteText, requestRecipients, type StudentRequest } from './requests';

const db = createSeed();
const maria = db.students.find((s) => s.id === '20231847')!; // CS-BS, advisor Rosa Delgado-Munoz (30117)
const myCourse = offeringOf(db, currentRegistrations(db, maria.id)[0].scheduleNo)!.courseId;
const notMine = db.offerings.find((o) => !currentRegistrations(db, maria.id).some((r) => r.scheduleNo === o.scheduleNo))!.courseId;
const req = (r: Partial<StudentRequest>): StudentRequest => ({ to: '30117', kind: 'meeting', courseId: '', message: 'Can we meet this week?', ...r });

describe('student requests', () => {
  it('offers the major advisor first, then instructors, then the registrar, each once', () => {
    const list = requestRecipients(db, maria);
    expect(list[0]).toMatchObject({ id: '30117', label: 'Major advisor, Computer Science, B.S.' });
    expect(list.some((r) => r.label.startsWith('Instructor, '))).toBe(true);
    expect(list.at(-1)).toMatchObject({ id: '10093' }); // the administrator who is the registrar, with REG access
    expect(list.some((r) => r.id === '41208')).toBe(false); // a registrar-role account without REG access cannot carry out a drop
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
  });

  it('accepts a complete request and rejects each missing or wrong field with the reason and what is needed', () => {
    expect(requestIssue(db, maria, req({}))).toBeNull();
    expect(requestIssue(db, maria, req({ to: '28804x' }))?.field).toBe('to');
    expect(requestIssue(db, maria, req({ kind: 'drop' }))).toMatchObject({ field: 'courseId', requirement: expect.stringContaining('current schedule') });
    expect(requestIssue(db, maria, req({ kind: 'drop', courseId: myCourse }))).toBeNull();
    expect(requestIssue(db, maria, req({ courseId: notMine }))?.field).toBe('courseId');
    expect(requestIssue(db, maria, req({ message: '   ' }))?.field).toBe('message');
    expect(requestIssue(db, maria, req({ message: 'x'.repeat(501) }))?.field).toBe('message');
  });

  it('writes a note that names the recipient, the request and the course', () => {
    const text = requestNoteText(db, maria, req({ kind: 'drop', courseId: myCourse, message: ' Too many units. ' }));
    expect(text).toMatch(new RegExp(`^Request to Rosa Delgado-Munoz \\(Major advisor, Computer Science, B\\.S\\.\\) · Drop a course · ${myCourse} .+: Too many units\\.$`));
    expect(isRequestNote(text)).toBe(true);
    expect(isRequestNote('Waiver requested for CS 310.')).toBe(false);
  });
});

describe('drops after the add/drop deadline', () => {
  it('closes self-service drops the day after the deadline and says what to do instead', () => {
    const d = { ...db, registrationCloses: '2026-08-28' };
    expect(registrationClosed(d, '2026-08-28')).toBe(false);
    expect(registrationClosed(d, '2026-08-29')).toBe(true);
    expect(dropClosedIssue(d)).toMatchObject({ code: 'closed', requirement: expect.stringContaining('drop request') });
  });
});
