import type { Db, Offering, Student, Subsystem } from '../data/types';
import { completedCourseIds, courseOf, currentRegistrations, gpa, gradeStats, isPassing, letterFor, offeringOf, seatsOpen } from './rules';
import { formatDate, formatDateTime, formatTimeRange } from './format';
import { fullName } from './names';
import { classLevel } from './classLevel';

/**
 * The SignMeUp reports (GEN-18 and the report requirements of each subsystem). Each builder turns
 * the document into titled sections of rows; the report viewer previews them on screen and prints
 * all of them or only the sections the user keeps (reports "as a whole or in parts").
 */
export type Cell = string | number;
export interface ReportSection { id: string; title: string; note?: string; columns: string[]; numeric?: number[]; rows: Cell[][]; summary?: [string, string][]; empty?: string; }
export interface Report { title: string; subtitle: string; meta: [string, string][]; sections: ReportSection[]; }

const deptName = (db: Db, id: string) => db.departments.find((d) => d.id === id)?.name ?? id;
const facultyName = (db: Db, id: string) => db.faculty.find((f) => f.id === id)?.name ?? '—';
const levelLabel = (l: string) => (l === 'upper' ? 'Upper division' : l === 'graduate' ? 'Graduate' : 'Lower division');
const when = (o: Offering) => `${o.days} ${formatTimeRange(o.start, o.end)}`;
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
/** First sentence of a description, trimmed: the "short description" reports ask for. */
export function shortDescription(text: string, max = 90): string {
  const first = text.split(/(?<=\.)\s/)[0] ?? text;
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}
const currentOfferings = (db: Db) => db.offerings.filter((o) => o.term === db.term);
const departmentsWith = (db: Db, ids: Iterable<string>) => { const set = new Set(ids); return db.departments.filter((d) => set.has(d.id)); };

// ------------------------------------------------------------------ GRADE: course, department and university statistics
const STATS_COLUMNS = ['Course', 'Section', 'Instructor', 'Registered', 'Passing', 'Average', 'A', 'B', 'C', 'D', 'F'];
function statsRow(label: string, section: string, instructor: string, regs: Db['registrations']): Cell[] {
  const s = gradeStats(regs);
  const graded = Object.values(s.distribution).reduce((a, b) => a + b, 0);
  return [label, section, instructor, s.registered, `${s.passing} · ${pct(s.passing, s.registered)}`, s.average === null ? '—' : `${s.average.toFixed(2)} ${letterFor(s.average)}`,
    ...(['A', 'B', 'C', 'D', 'F'] as const).map((g) => pct(s.distribution[g], graded))];
}

/** Course, department and university grade statistics for the current term (GRADE reports). */
export function gradeStatisticsReport(db: Db, deptId: string | null): Report {
  const offerings = currentOfferings(db);
  const regsOf = (os: Offering[]) => { const nos = new Set(os.map((o) => o.scheduleNo)); return db.registrations.filter((r) => nos.has(r.scheduleNo)); };
  const byDept = departmentsWith(db, offerings.map((o) => courseOf(db, o.courseId)?.deptId ?? '')).filter((d) => !deptId || d.id === deptId);
  const sections: ReportSection[] = byDept.map((d) => {
    const os = offerings.filter((o) => courseOf(db, o.courseId)?.deptId === d.id).sort((a, b) => a.courseId.localeCompare(b.courseId));
    return {
      id: `dept-${d.id}`, title: `${d.name} · course statistics`, columns: STATS_COLUMNS, numeric: [3],
      rows: [...os.map((o) => statsRow(o.courseId, o.scheduleNo, facultyName(db, o.instructorId), regsOf([o]))), statsRow(`${d.name} total`, `${os.length} sections`, '', regsOf(os))],
    };
  });
  if (!deptId) sections.push({ id: 'university', title: 'University statistics', columns: STATS_COLUMNS, numeric: [3], rows: [statsRow('All courses', `${offerings.length} sections`, '', regsOf(offerings))] });
  return {
    title: deptId ? `Department grade statistics · ${deptName(db, deptId)}` : 'University grade statistics',
    subtitle: `${db.term} · number registered, completing with a passing grade, average grade, and the share of A, B, C, D and F grades`,
    meta: [['Term', db.term], ['Scope', deptId ? deptName(db, deptId) : 'All departments']],
    sections,
  };
}

// ------------------------------------------------------------------ FCI: faculty and course lists
/** Faculty list with a short description, for one department or the whole university by department (FCI-07, FCI-08). */
export function facultyListReport(db: Db, deptId: string | null): Report {
  const depts = deptId ? db.departments.filter((d) => d.id === deptId) : departmentsWith(db, db.faculty.map((f) => f.deptId));
  return {
    title: deptId ? `Faculty · ${deptName(db, deptId)}` : 'Faculty · university, by department',
    subtitle: 'Faculty members with position, office, contact and the courses each is authorized to teach',
    meta: [['Scope', deptId ? deptName(db, deptId) : 'All departments'], ['Faculty', String(db.faculty.filter((f) => !deptId || f.deptId === deptId).length)]],
    sections: depts.map((d) => ({
      id: `fac-${d.id}`, title: d.name, columns: ['ID', 'Name', 'Position', 'Office · phone', 'Office hours', 'Authorized to teach'],
      rows: db.faculty.filter((f) => f.deptId === d.id).sort((a, b) => a.name.localeCompare(b.name)).map((f) => [
        f.id, f.name, f.positionTitle, `${f.office} · ${f.officePhone}`, f.officeHours,
        db.courses.filter((c) => c.qualifiedFaculty.includes(f.id)).map((c) => c.id).join(', ') || 'None',
      ]),
      empty: 'No faculty assigned to this department.',
    })),
  };
}

/** Course list with a short description, for one department or the whole university by department (FCI-09, FCI-10). */
export function courseListReport(db: Db, deptId: string | null): Report {
  const depts = deptId ? db.departments.filter((d) => d.id === deptId) : departmentsWith(db, db.courses.map((c) => c.deptId));
  return {
    title: deptId ? `Courses · ${deptName(db, deptId)}` : 'Courses · university, by department',
    subtitle: 'Catalog courses with units, level, prerequisites and a short description',
    meta: [['Scope', deptId ? deptName(db, deptId) : 'All departments'], ['Courses', String(db.courses.filter((c) => !deptId || c.deptId === deptId).length)]],
    sections: depts.map((d) => ({
      id: `crs-${d.id}`, title: d.name, columns: ['Course', 'Title', 'Units', 'Level', 'Prerequisites', 'Description'], numeric: [2],
      rows: db.courses.filter((c) => c.deptId === d.id).sort((a, b) => a.id.localeCompare(b.id)).map((c) => [c.id, c.title, c.units, levelLabel(c.level), c.prereqs.join(', ') || 'None', shortDescription(c.description)]),
      empty: 'No courses in this department.',
    })),
  };
}

// ------------------------------------------------------------------ REG: schedule reports
/** A student's schedule, listing and briefly describing every currently enrolled course (REG-10). */
export function studentScheduleReport(db: Db, studentId: string): Report {
  const s = db.students.find((x) => x.id === studentId);
  const regs = currentRegistrations(db, studentId);
  const rows = regs.map((r) => { const o = offeringOf(db, r.scheduleNo)!; const c = courseOf(db, o.courseId)!; return [c.id, o.scheduleNo, c.title, shortDescription(c.description, 70), when(o), o.location, facultyName(db, o.instructorId), c.units, r.type === 'letter' ? 'Letter' : r.type === 'crnc' ? 'CR/NC' : 'Audit'] as Cell[]; });
  const units = regs.reduce((n, r) => n + (courseOf(db, offeringOf(db, r.scheduleNo)?.courseId ?? '')?.units ?? 0), 0);
  return {
    title: `Student schedule · ${s ? fullName(s) : studentId}`, subtitle: `${db.term} · all currently enrolled courses`,
    meta: [['Student ID', studentId], ['Term', db.term], ['Courses', String(regs.length)], ['Units', String(units)]],
    sections: [{ id: 'schedule', title: 'Enrolled courses', columns: ['Course', 'Schedule #', 'Title', 'Description', 'Days / time', 'Location', 'Instructor', 'Units', 'Type'], numeric: [7], rows, summary: [['Total units', String(units)]], empty: 'Not registered for any course this term.' }],
  };
}

const OFFERING_COLUMNS = ['Course', 'Schedule #', 'Title', 'Days / time', 'Location', 'Instructor', 'Units', 'Prerequisites', 'Seats open'];
const offeringRow = (db: Db, o: Offering): Cell[] => { const c = courseOf(db, o.courseId)!; return [c.id, o.scheduleNo, c.title, when(o), o.location, facultyName(db, o.instructorId), c.units, c.prereqs.join(', ') || 'None', `${seatsOpen(db, o)} of ${o.capacity}`]; };

/** Courses offered this term by a specified department (REG-11). */
export function departmentOfferingsReport(db: Db, deptId: string): Report {
  const os = currentOfferings(db).filter((o) => courseOf(db, o.courseId)?.deptId === deptId).sort((a, b) => a.courseId.localeCompare(b.courseId) || a.scheduleNo.localeCompare(b.scheduleNo));
  return {
    title: `Courses offered · ${deptName(db, deptId)}`, subtitle: `${db.term} · every scheduled section in the department`,
    meta: [['Department', deptName(db, deptId)], ['Term', db.term], ['Sections', String(os.length)]],
    sections: [{ id: 'offered', title: deptName(db, deptId), columns: OFFERING_COLUMNS, numeric: [6], rows: os.map((o) => offeringRow(db, o)), empty: 'No sections scheduled this term.' }],
  };
}

/** Courses with seats currently available, for one department or all departments (REG-12). */
export function seatsAvailableReport(db: Db, deptId: string | null): Report {
  const open = currentOfferings(db).filter((o) => seatsOpen(db, o) > 0 && (!deptId || courseOf(db, o.courseId)?.deptId === deptId));
  const depts = departmentsWith(db, open.map((o) => courseOf(db, o.courseId)?.deptId ?? ''));
  return {
    title: deptId ? `Seats available · ${deptName(db, deptId)}` : 'Seats available · all departments', subtitle: `${db.term} · sections with at least one open seat`,
    meta: [['Scope', deptId ? deptName(db, deptId) : 'All departments'], ['Term', db.term], ['Open sections', String(open.length)]],
    sections: depts.length ? depts.map((d) => ({ id: `open-${d.id}`, title: d.name, columns: OFFERING_COLUMNS, numeric: [6], rows: open.filter((o) => courseOf(db, o.courseId)?.deptId === d.id).sort((a, b) => a.courseId.localeCompare(b.courseId)).map((o) => offeringRow(db, o)) }))
      : [{ id: 'open', title: 'Open sections', columns: OFFERING_COLUMNS, rows: [], empty: 'No sections have open seats.' }],
  };
}

// ------------------------------------------------------------------ MAJOR reports
/** All required courses (and electives) for a specific major; available to all users (MAJ-08). */
export function majorRequirementsReport(db: Db, majorId: string): Report {
  const m = db.majors.find((x) => x.id === majorId);
  if (!m) return { title: 'Major requirements', subtitle: '', meta: [], sections: [] };
  const row = (id: string): Cell[] => { const c = courseOf(db, id); return [id, c?.title ?? '—', c?.units ?? '—', c?.prereqs.join(', ') || 'None']; };
  const units = m.requiredCourses.reduce((n, id) => n + (courseOf(db, id)?.units ?? 0), 0);
  return {
    title: `Major requirements · ${m.title}`, subtitle: `${m.id} · ${deptName(db, m.deptId)} Department`,
    meta: [['Major ID', m.id], ['Department', deptName(db, m.deptId)], ['Units required', `${m.unitsRequired} (${m.majorUnits} in the major)`], ['Advisors', m.advisors.map((id) => db.users.find((u) => u.id === id)?.name ?? id).join(', ') || '—']],
    sections: [
      { id: 'required', title: 'Required courses', columns: ['Course', 'Title', 'Units', 'Prerequisites'], numeric: [2], rows: m.requiredCourses.map(row), summary: [['Required units', String(units)]], empty: 'No required courses.' },
      { id: 'electives', title: 'Electives within the major', columns: ['Course', 'Title', 'Units', 'Prerequisites'], numeric: [2], rows: m.electives.map(row), empty: 'No electives listed.' },
    ],
  };
}

function completion(db: Db, s: Student, courseId: string): { done: boolean; where: string; term: string; grade: string } {
  const here = s.completed.find((c) => c.courseId === courseId && isPassing(c.grade));
  if (here) return { done: true, where: 'This university', term: here.term, grade: here.grade };
  const t = s.transfer.find((c) => c.equivalentCourseId === courseId && isPassing(c.grade));
  if (t) return { done: true, where: `Transfer · ${t.university}`, term: t.term, grade: t.grade };
  const now = currentRegistrations(db, s.id).some((r) => offeringOf(db, r.scheduleNo)?.courseId === courseId);
  return { done: false, where: now ? `In progress · ${db.term}` : 'Not completed', term: '—', grade: '—' };
}

/** Completed required courses for one student (MAJ-09; major advisors and that student only). */
export function completedRequiredReport(db: Db, studentId: string): Report {
  const s = db.students.find((x) => x.id === studentId);
  const outline = db.outlines.find((o) => o.studentId === studentId);
  const m = db.majors.find((x) => x.id === (outline?.majorId ?? s?.majorId));
  if (!s || !m) return { title: 'Completed required courses', subtitle: 'No major on file for this student.', meta: [], sections: [] };
  const rows = m.requiredCourses.map((id) => { const c = completion(db, s, id); return [id, courseOf(db, id)?.title ?? '—', c.done ? 'Completed' : c.where, c.done ? c.where : '', c.term, c.grade] as Cell[]; });
  const done = rows.filter((r) => r[2] === 'Completed').length;
  return {
    title: `Completed required courses · ${fullName(s)}`, subtitle: `${m.title} · ${done} of ${m.requiredCourses.length} required courses completed`,
    meta: [['Student ID', s.id], ['Major', `${m.id} · ${m.title}`], ['Completed', `${done} of ${m.requiredCourses.length}`]],
    sections: [{ id: 'required', title: 'Required courses', columns: ['Course', 'Title', 'Status', 'Where', 'Semester', 'Grade'], rows }],
  };
}

/** Student status against the approved major outline (MAJ-10; major advisors and that student only). */
export function outlineStatusReport(db: Db, studentId: string): Report {
  const s = db.students.find((x) => x.id === studentId);
  const outline = db.outlines.find((o) => o.studentId === studentId);
  const m = db.majors.find((x) => x.id === outline?.majorId);
  if (!s || !outline || !m) return { title: 'Status against approved outline', subtitle: 'No approved outline on file for this student.', meta: [], sections: [] };
  const done = completedCourseIds(s);
  const rows = outline.entries.map((e) => { const c = completion(db, s, e.courseId); return [e.courseId, courseOf(db, e.courseId)?.title ?? '—', e.status[0].toUpperCase() + e.status.slice(1), formatDate(e.statusDate), e.status !== 'approved' ? '—' : done.has(e.courseId) ? `Completed ${c.term} · ${c.grade}` : c.where] as Cell[]; });
  const approved = outline.entries.filter((e) => e.status === 'approved');
  const completedCount = approved.filter((e) => done.has(e.courseId)).length;
  return {
    title: `Status against approved outline · ${fullName(s)}`, subtitle: `${m.title} · last approved ${formatDate(outline.approvedAt)} by ${outline.approvedBy}`,
    meta: [['Student ID', s.id], ['Major', `${m.id} · ${m.title}`], ['Approved by', `${outline.approvedBy}, ${formatDate(outline.approvedAt)}`], ['Approved courses completed', `${completedCount} of ${approved.length}`]],
    sections: [{ id: 'outline', title: 'Outline entries', columns: ['Course', 'Title', 'Outline status', 'Status date', 'Progress'], rows, summary: [['Approved', String(approved.length)], ['Completed', String(completedCount)], ['Remaining', String(approved.length - completedCount)]] }],
  };
}

/** History of changes to a specific major outline (MAJOR reports; major advisors and that student only). */
export function outlineHistoryReport(db: Db, studentId: string): Report {
  const s = db.students.find((x) => x.id === studentId);
  const outline = db.outlines.find((o) => o.studentId === studentId);
  if (!s || !outline) return { title: 'Outline change history', subtitle: 'No approved outline on file for this student.', meta: [], sections: [] };
  return {
    title: `Outline change history · ${fullName(s)}`, subtitle: 'Every change to the approved outline, oldest first; entries are never deleted',
    meta: [['Student ID', s.id], ['Major', outline.majorId], ['Changes', String(outline.history.length)]],
    sections: [{ id: 'history', title: 'Changes', columns: ['Date and time', 'Change', 'By'], rows: [...outline.history].sort((a, b) => a.at.localeCompare(b.at)).map((h) => [formatDateTime(h.at), h.action, h.by]), empty: 'No changes recorded.' }],
  };
}

// ------------------------------------------------------------------ ER: student record report
/** The student record report: all student information, optional course detail, this university or all, and GPA (ER-05, ER-06, ER-07). */
export function studentRecordReport(db: Db, studentId: string, opts: { detail: boolean; scope: 'here' | 'all' }): Report {
  const s = db.students.find((x) => x.id === studentId);
  if (!s) return { title: 'Student record', subtitle: 'Student not found.', meta: [], sections: [] };
  const major = db.majors.find((m) => m.id === s.majorId);
  const minor = db.majors.find((m) => m.id === s.minorId);
  const g = gpa(s);
  const unitsHere = s.completed.reduce((n, c) => n + c.units, 0);
  const unitsTransfer = s.transfer.reduce((n, c) => n + c.units, 0);
  const sections: ReportSection[] = [{
    id: 'info', title: 'Student information', columns: ['Field', 'Value'],
    rows: [['Student ID', s.id], ['Name', fullName(s)], ['Telephone', s.phone || '—'], ['Address', s.address || '—'], ['Date of birth', formatDate(s.dateOfBirth)], ['Major', major?.title ?? s.majorId], ['Minor', minor?.title ?? 'None'],
      ['Class level', classLevel(s)], ['Graduate program', s.graduate ? 'Accepted' : 'No'], ['Standing', s.standing], ['Overall GPA (this university)', g === null ? '—' : g.toFixed(2)],
      ['Units completed', opts.scope === 'all' ? `${unitsHere + unitsTransfer} (${unitsHere} here, ${unitsTransfer} transfer)` : `${unitsHere} at this university`]],
  }];
  if (opts.detail) {
    sections.push({ id: 'here', title: 'Courses completed at this university', columns: ['Course', 'Title', 'Semester', 'Units', 'Grade'], numeric: [3], rows: s.completed.map((c) => [c.courseId, c.title, c.term, c.units, c.grade]), summary: [['Units', String(unitsHere)], ['GPA', g === null ? '—' : g.toFixed(2)]], empty: 'None on file.' });
    if (opts.scope === 'all') sections.push({ id: 'transfer', title: 'Courses completed at other universities', columns: ['Course', 'Title', 'University', 'Location', 'Equivalent here', 'Semester', 'Units', 'Grade'], numeric: [6], rows: s.transfer.map((c) => [c.courseId, c.title, c.university, c.location, c.equivalentCourseId || '—', c.term, c.units, c.grade]), summary: [['Units', String(unitsTransfer)]], empty: 'None on file.' });
    sections.push({ id: 'current', title: `Currently enrolled · ${db.term}`, columns: ['Course', 'Title', 'Days / time', 'Units', 'Type'], numeric: [3], rows: currentRegistrations(db, s.id).map((r) => { const o = offeringOf(db, r.scheduleNo)!; const c = courseOf(db, o.courseId)!; return [c.id, c.title, when(o), c.units, r.type === 'letter' ? 'Letter' : r.type === 'crnc' ? 'CR/NC' : 'Audit']; }), empty: 'Not enrolled this term.' });
  }
  sections.push({ id: 'notes', title: 'Notes', columns: ['Date and time', 'Category', 'Employee', 'Note'], rows: [...s.notes].sort((a, b) => a.at.localeCompare(b.at)).map((n) => [formatDateTime(n.at), n.category, n.byEmployeeId, n.text]), empty: 'No notes on file.' });
  return {
    title: `Student record · ${fullName(s)}`, subtitle: `${opts.scope === 'all' ? 'All courses at all universities' : 'Courses at this university only'}${opts.detail ? ' · with course detail' : ''}`,
    meta: [['Student ID', s.id], ['Overall GPA', g === null ? '—' : g.toFixed(2)], ['Major', major?.title ?? s.majorId]],
    sections,
  };
}

// ------------------------------------------------------------------ Framework: authorized users
/** Authorized users for the whole system or one subsystem, without passwords (FW-06). */
export function authorizedUsersReport(db: Db, area: Subsystem | null): Report {
  const users = db.users.filter((u) => !area || u.access.includes(area)).sort((a, b) => a.name.localeCompare(b.name));
  return {
    title: area ? `Authorized users · ${area}` : 'Authorized users · whole system', subtitle: 'User name, employee number, job title and access areas. Passwords are never included.',
    meta: [['Scope', area ? `${area} subsystem` : 'Whole system'], ['Users', String(users.length)]],
    sections: [{ id: 'users', title: 'Users', columns: ['Name', 'Employee #', 'Job title', 'Access areas'], rows: users.map((u) => [u.name, u.id, u.jobTitle, u.access.join(', ')]) }],
  };
}

// ------------------------------------------------------------------ choices for the report viewer
/** Department choices; with `allLabel`, an empty value for "every department" comes first. */
export function departmentChoices(db: Db, allLabel?: string): [string, string][] {
  const depts = db.departments.filter((d) => d.id !== 'UNIV' || db.courses.some((c) => c.deptId === 'UNIV')).map((d): [string, string] => [d.id, d.name]);
  return allLabel ? [['', allLabel], ...depts] : depts;
}
/** Major and minor choices, with `firstId` (e.g. the student's own major) first. */
export function majorChoices(db: Db, firstId?: string): [string, string][] {
  const all = db.majors.map((m): [string, string] => [m.id, `${m.title} (${m.id})`]);
  return firstId ? [...all.filter(([id]) => id === firstId), ...all.filter(([id]) => id !== firstId)] : all;
}
