import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import type { Major, Offering, User } from '../data/types';
import { applyOfferingRemove, applyOfferingSave, applyTermSave, offeringIssue, registrationClosed, termIssue } from './schedule';
import { applyMajorSave, majorIssue } from './majors';

const db = createSeed();
const registrar: Pick<User, 'role' | 'access'> = { role: 'registrar', access: ['REG', 'FCI', 'MAJOR'] };
const student: Pick<User, 'role' | 'access'> = { role: 'student', access: ['REG'] };
const cs201 = db.courses.find((c) => c.id === 'CS 201')!;
const section: Offering = { scheduleNo: '19001', courseId: 'CS 201', term: db.term, days: 'f', start: '15:00', end: '16:50', location: 'Boelter 9999', instructorId: cs201.qualifiedFaculty[0], capacity: 30 };
const existing = db.offerings.find((o) => o.term === db.term && db.registrations.some((r) => r.scheduleNo === o.scheduleNo))!;
const empty = (): typeof db => { const d = applyOfferingSave(db, registrar, section, null); if (!d.ok) throw new Error(d.reason); return d.db; };

describe('class schedule (REG-01, REG-02, REG-03)', () => {
  it('adds a section for the current term, normalizing days, and logs it', () => {
    const r = applyOfferingSave(db, registrar, section, null);
    expect(r.ok && r.log).toBe('Added section 19001 of CS 201');
    if (r.ok) expect(r.db.offerings.find((o) => o.scheduleNo === '19001')).toMatchObject({ days: 'F', term: db.term });
  });

  it('rejects bad sections with the field, reason and requirement', () => {
    expect(offeringIssue(db, { ...section, scheduleNo: '123' }, null)?.field).toBe('scheduleNo');
    expect(offeringIssue(db, { ...section, scheduleNo: existing.scheduleNo }, null)?.reason).toMatch(/already used/);
    expect(offeringIssue(db, { ...section, courseId: 'XX 999' }, null)?.field).toBe('courseId');
    expect(offeringIssue(db, { ...section, days: 'Sat' }, null)?.field).toBe('days');
    expect(offeringIssue(db, { ...section, days: 'WM' }, null)?.field).toBe('days'); // weekday order
    expect(offeringIssue(db, { ...section, end: '14:00' }, null)?.field).toBe('end');
    expect(offeringIssue(db, { ...section, start: '06:00', end: '07:00' }, null)?.field).toBe('start');
    expect(offeringIssue(db, { ...section, instructorId: db.faculty.find((f) => !cs201.qualifiedFaculty.includes(f.id))!.id }, null)?.reason).toMatch(/not authorized/);
    expect(offeringIssue(db, { ...section, capacity: 0 }, null)?.field).toBe('capacity');
  });

  it('refuses room and instructor double-booking', () => {
    const clash = { ...section, days: existing.days, start: existing.start, end: existing.end };
    expect(offeringIssue(db, { ...clash, location: existing.location }, null)?.reason).toMatch(/already in use/);
    const sameTeacher = db.courses.find((c) => c.qualifiedFaculty.includes(existing.instructorId))!;
    expect(offeringIssue(db, { ...clash, courseId: sameTeacher.id, instructorId: existing.instructorId }, null)?.reason).toMatch(/already teaches/);
  });

  it('keeps capacity at or above current enrollment and cancels only empty sections', () => {
    const taken = db.registrations.filter((r) => r.scheduleNo === existing.scheduleNo).length;
    expect(offeringIssue(db, { ...existing, capacity: taken - 1 }, existing.scheduleNo)?.reason).toMatch(/already registered/);
    expect(applyOfferingRemove(db, registrar, existing.scheduleNo).ok).toBe(false);
    const withNew = empty();
    expect(applyOfferingRemove(withNew, registrar, '19001')).toMatchObject({ ok: true, log: 'Cancelled section 19001 of CS 201' });
  });

  it('is limited to the registrar and administrators', () => {
    expect(applyOfferingSave(db, student, section, null).ok).toBe(false);
    expect(applyTermSave(db, student, { registrationCloses: '2026-12-01', opens: '2026-12-14', closes: '2026-12-21' }).ok).toBe(false);
  });
});

describe('term calendar and registration deadline', () => {
  it('closes registration the day after the deadline', () => {
    expect(registrationClosed({ registrationCloses: '2026-12-11' }, '2026-12-11')).toBe(false);
    expect(registrationClosed({ registrationCloses: '2026-12-11' }, '2026-12-12')).toBe(true);
  });
  it('validates the calendar and saves it', () => {
    expect(termIssue({ registrationCloses: '2026-12-20', opens: '2026-12-14', closes: '2026-12-21' })?.field).toBe('registrationCloses');
    expect(termIssue({ registrationCloses: '2026-12-01', opens: '2026-12-14', closes: '2026-12-10' })?.field).toBe('closes');
    const r = applyTermSave(db, registrar, { registrationCloses: '2026-11-30', opens: '2026-12-14', closes: '2026-12-21' });
    expect(r.ok && r.db.registrationCloses).toBe('2026-11-30');
  });
});

describe('majors (MAJ-01, MAJ-02)', () => {
  const bio: Major = { id: 'bio-bs', title: 'Biology, B.S.', deptId: 'BIO', unitsRequired: 120, majorUnits: 60, requiredCourses: ['BIO 101', 'BIO 220'], electives: [], advisors: ['31855'] };
  it('adds a major and logs it', () => {
    const r = applyMajorSave(db, registrar, bio, null);
    expect(r.ok && r.log).toBe('Added major BIO-BS Biology, B.S.');
  });
  it('rejects bad majors with the field, reason and requirement', () => {
    expect(majorIssue(db, { ...bio, id: 'CS-BS' }, null)?.reason).toMatch(/already exists/);
    expect(majorIssue(db, { ...bio, majorUnits: 130 }, null)?.field).toBe('majorUnits');
    expect(majorIssue(db, { ...bio, requiredCourses: ['XX 1'] }, null)?.field).toBe('requiredCourses');
    expect(majorIssue(db, { ...bio, electives: ['BIO 101'] }, null)?.reason).toMatch(/both required and elective/);
    expect(majorIssue(db, { ...bio, advisors: ['20231847'] }, null)?.field).toBe('advisors'); // a student cannot advise
  });
  it('edits an existing major and keeps its ID', () => {
    const cs = db.majors.find((m) => m.id === 'CS-BS')!;
    expect(applyMajorSave(db, registrar, { ...cs, unitsRequired: 124 }, 'CS-BS')).toMatchObject({ ok: true, log: 'Updated unitsRequired for major CS-BS' });
    expect(majorIssue(db, { ...cs, id: 'CS-BA' }, 'CS-BS')?.reason).toMatch(/cannot be changed/);
    expect(applyMajorSave(db, student, cs, 'CS-BS').ok).toBe(false);
  });
});
