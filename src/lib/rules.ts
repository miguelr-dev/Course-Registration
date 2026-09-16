import type { Course, Db, Offering, Registration, Student } from '../data/types';

export const MAX_UNITS = 18;

const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0,
};

export const LETTER_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'I'];

export function gradePoints(grade: string): number | undefined {
  return GRADE_POINTS[grade];
}

export function isPassing(grade: string | undefined): boolean {
  if (!grade) return false;
  if (grade === 'CR') return true;
  const p = GRADE_POINTS[grade];
  return p !== undefined && p >= 1.0;
}

/** GPA over graded courses completed at this university. */
export function gpa(student: Student): number | null {
  let pts = 0;
  let units = 0;
  for (const c of student.completed) {
    const p = GRADE_POINTS[c.grade];
    if (p === undefined) continue;
    pts += p * c.units;
    units += c.units;
  }
  return units ? Math.round((pts / units) * 100) / 100 : null;
}

export function completedCourseIds(student: Student): Set<string> {
  const ids = new Set<string>();
  for (const c of student.completed) if (isPassing(c.grade)) ids.add(c.courseId);
  for (const t of student.transfer) if (isPassing(t.grade)) ids.add(t.equivalentCourseId);
  return ids;
}

export function currentRegistrations(db: Db, studentId: string): Registration[] {
  return db.registrations.filter((r) => r.studentId === studentId && offeringOf(db, r.scheduleNo)?.term === db.term);
}

export function offeringOf(db: Db, scheduleNo: string): Offering | undefined {
  return db.offerings.find((o) => o.scheduleNo === scheduleNo);
}

export function courseOf(db: Db, courseId: string): Course | undefined {
  return db.courses.find((c) => c.id === courseId);
}

export function seatsTaken(db: Db, scheduleNo: string): number {
  return db.registrations.filter((r) => r.scheduleNo === scheduleNo).length;
}

export function seatsOpen(db: Db, offering: Offering): number {
  return Math.max(0, offering.capacity - seatsTaken(db, offering.scheduleNo));
}

export function unitsRegistered(db: Db, studentId: string): number {
  return currentRegistrations(db, studentId).reduce((sum, r) => {
    const o = offeringOf(db, r.scheduleNo);
    const c = o && courseOf(db, o.courseId);
    return sum + (c?.units ?? 0);
  }, 0);
}

const DAY_TOKENS = ['M', 'T', 'W', 'Th', 'F'];
function daysOf(days: string): Set<string> {
  const out = new Set<string>();
  let i = 0;
  while (i < days.length) {
    if (days.startsWith('Th', i)) { out.add('Th'); i += 2; } else { out.add(days[i]); i += 1; }
  }
  return out;
}
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function conflicts(a: Offering, b: Offering): boolean {
  const da = daysOf(a.days); const db_ = daysOf(b.days);
  const shared = DAY_TOKENS.some((d) => da.has(d) && db_.has(d));
  if (!shared) return false;
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

export interface EligibilityIssue {
  code: 'prereq' | 'seats' | 'conflict' | 'units' | 'duplicate' | 'level' | 'graduate' | 'waiver';
  /** Reason the registration is rejected. */
  reason: string;
  /** Minimum requirement for the entry to be accepted. */
  requirement: string;
}

/** Prerequisite status for a student and course. */
export function prereqStatus(db: Db, student: Student, course: Course): { met: boolean; missing: string[]; inProgress: string[] } {
  const done = completedCourseIds(student);
  const current = new Set(currentRegistrations(db, student.id).map((r) => offeringOf(db, r.scheduleNo)?.courseId));
  const missing = course.prereqs.filter((p) => !done.has(p));
  return { met: missing.length === 0, missing, inProgress: missing.filter((p) => current.has(p)) };
}

/**
 * Every rule that can reject a registration, with the message pair the
 * requirements ask for: (1) the reason and (2) the minimum requirement.
 */
export function registrationIssues(db: Db, student: Student, offering: Offering): EligibilityIssue[] {
  const course = courseOf(db, offering.courseId);
  if (!course) return [{ code: 'level', reason: 'Course not found in the catalog.', requirement: 'Choose a course from the current offerings.' }];
  const issues: EligibilityIssue[] = [];
  const regs = currentRegistrations(db, student.id);

  if (regs.some((r) => r.scheduleNo === offering.scheduleNo)) {
    issues.push({ code: 'duplicate', reason: `You are already registered in ${course.id} (schedule ${offering.scheduleNo}).`, requirement: 'Choose a course you are not yet registered in.' });
  }
  if (regs.some((r) => offeringOf(db, r.scheduleNo)?.courseId === course.id)) {
    if (!issues.length) issues.push({ code: 'duplicate', reason: `You are already registered in another section of ${course.id}.`, requirement: 'Drop the other section before registering in this one.' });
  }

  const pre = prereqStatus(db, student, course);
  if (!pre.met) {
    const list = pre.missing.join(', ');
    const inProg = pre.inProgress.length ? ` You are enrolled in ${pre.inProgress.join(', ')} this term, but it must be completed with a passing grade first.` : '';
    issues.push({ code: 'prereq', reason: `Prerequisite ${list} not completed.${inProg}`, requirement: `Complete ${list} with a passing grade, or request an advisor waiver to register.` });
  }

  if (course.level === 'graduate' && !student.graduate) {
    issues.push({ code: 'graduate', reason: `${course.id} is a graduate-level course.`, requirement: 'Only students accepted into the graduate program may register.' });
  }
  if (course.level === 'upper') {
    const major = db.majors.find((m) => m.id === student.majorId);
    const minor = db.majors.find((m) => m.id === student.minorId);
    const declared = [major, minor].some((m) => m && (m.requiredCourses.includes(course.id) || m.electives.includes(course.id)) );
    const requiredBySomeMajor = db.majors.some((m) => m.requiredCourses.includes(course.id) || m.electives.includes(course.id));
    if (requiredBySomeMajor && !declared) {
      issues.push({ code: 'level', reason: `${course.id} is an upper-division course reserved for declared majors and minors in its program.`, requirement: 'Declare the major or minor, or choose a course open to your program.' });
    }
  }

  if (seatsOpen(db, offering) === 0) {
    issues.push({ code: 'seats', reason: `No seats remain in schedule ${offering.scheduleNo}.`, requirement: 'Choose a section with at least one open seat.' });
  }

  for (const r of regs) {
    const other = offeringOf(db, r.scheduleNo);
    if (other && conflicts(other, offering)) {
      issues.push({ code: 'conflict', reason: `Meets at the same time as ${other.courseId} (${other.days} ${other.start}–${other.end}).`, requirement: 'Choose a section that does not overlap a course you are registered in.' });
    }
  }

  const after = unitsRegistered(db, student.id) + course.units;
  if (after > MAX_UNITS) {
    issues.push({ code: 'units', reason: `Adding ${course.units} units would bring you to ${after} units.`, requirement: `Stay at or below ${MAX_UNITS} units for the term.` });
  }
  return issues;
}

/** Major courses that are on the approved outline, have prerequisites completed, and still have seats. */
export function eligibleMajorOfferings(db: Db, student: Student): Offering[] {
  const outline = db.outlines.find((o) => o.studentId === student.id);
  if (!outline) return [];
  const approved = new Set(outline.entries.filter((e) => e.status === 'approved').map((e) => e.courseId));
  const done = completedCourseIds(student);
  const registered = new Set(currentRegistrations(db, student.id).map((r) => offeringOf(db, r.scheduleNo)?.courseId));
  return db.offerings.filter((o) => {
    if (o.term !== db.term || !approved.has(o.courseId) || done.has(o.courseId) || registered.has(o.courseId)) return false;
    const c = courseOf(db, o.courseId);
    if (!c) return false;
    return prereqStatus(db, student, c).met && seatsOpen(db, o) > 0;
  });
}

export interface GradeStats { registered: number; passing: number; average: number | null; distribution: Record<'A' | 'B' | 'C' | 'D' | 'F', number>; }

export function gradeStats(regs: Registration[]): GradeStats {
  const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let pts = 0; let graded = 0; let passing = 0;
  for (const r of regs) {
    if (!r.grade) continue;
    if (isPassing(r.grade)) passing++;
    const p = GRADE_POINTS[r.grade];
    if (p === undefined) continue;
    pts += p; graded++;
    const letter = r.grade[0] as keyof typeof dist;
    if (letter in dist) dist[letter]++;
  }
  return { registered: regs.length, passing, average: graded ? Math.round((pts / graded) * 100) / 100 : null, distribution: dist };
}

export function letterFor(avg: number): string {
  if (avg >= 3.85) return 'A'; if (avg >= 3.5) return 'A-'; if (avg >= 3.15) return 'B+'; if (avg >= 2.85) return 'B';
  if (avg >= 2.5) return 'B-'; if (avg >= 2.15) return 'C+'; if (avg >= 1.85) return 'C'; if (avg >= 1.5) return 'C-';
  if (avg >= 1.15) return 'D+'; if (avg >= 0.85) return 'D'; if (avg >= 0.5) return 'D-'; return 'F';
}
