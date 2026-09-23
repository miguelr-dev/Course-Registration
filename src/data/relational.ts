import type { Db, NoteCategory, OutlineStatus, RegistrationType, Role, Subsystem } from './types';

/** Flat rows for the Postgres tables in db/schema.sql. */
export interface Dump {
  settings: { term: string; registration_closes: string; grade_window_opens: string; grade_window_closes: string };
  departments: { id: string; name: string; position: number }[];
  faculty: { id: string; name: string; position_title: string; office_phone: string; office: string; office_hours: string; dept_id: string; email: string; position: number }[];
  faculty_departments: { faculty_id: string; dept_id: string; position: number }[];
  courses: { id: string; title: string; description: string; units: number; dept_id: string; level: 'lower' | 'upper' | 'graduate'; position: number }[];
  course_prerequisites: { course_id: string; prereq_id: string; position: number }[];
  course_qualified_faculty: { course_id: string; faculty_id: string; position: number }[];
  majors: { id: string; title: string; dept_id: string; units_required: number; major_units: number; position: number }[];
  major_courses: { major_id: string; course_id: string; kind: 'required' | 'elective'; position: number }[];
  major_advisors: { major_id: string; employee_id: string; position: number }[];
  students: { id: string; first_name: string; middle_name: string | null; last_name: string; phone: string; address: string; date_of_birth: string; major_id: string; minor_id: string | null; graduate: boolean; standing: string; position: number }[];
  completed_courses: { student_id: string; course_id: string; title: string; term: string; units: number; grade: string; position: number }[];
  transfer_courses: { student_id: string; course_id: string; title: string; term: string; units: number; grade: string; university: string; location: string; equivalent_course_id: string; position: number }[];
  student_notes: { student_id: string; at: string; by_employee_id: string; category: NoteCategory; body: string; position: number }[];
  users: { id: string; name: string; job_title: string; password: string; must_change_password: boolean; password_set_at: string; role: Role; access: Subsystem[]; last_sign_in: string | null; student_id: string | null; faculty_id: string | null; position: number }[];
  offerings: { schedule_no: string; course_id: string; term: string; days: string; start_time: string; end_time: string; location: string; instructor_id: string; capacity: number; position: number }[];
  registrations: { student_id: string; schedule_no: string; type: RegistrationType; registered_by: string; registered_at: string; grade: string | null; grade_note: string | null; grade_updated_by: string | null; grade_updated_at: string | null; position: number }[];
  outlines: { student_id: string; major_id: string; approved_by: string; approved_at: string; position: number }[];
  outline_entries: { student_id: string; course_id: string; status: OutlineStatus; status_date: string; by_name: string; note: string | null; position: number }[];
  outline_history: { student_id: string; at: string; by_name: string; action: string; position: number }[];
  grade_notes: { schedule_no: string; at: string; by_name: string; body: string; position: number }[];
  transactions: { at: string; by_name: string; subsystem: Subsystem | 'FRAMEWORK'; body: string; position: number }[];
}

function sortPos<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function decompose(db: Db): Dump {
  return {
    settings: {
      term: db.term,
      registration_closes: db.registrationCloses,
      grade_window_opens: db.gradeWindow.opens,
      grade_window_closes: db.gradeWindow.closes,
    },
    departments: db.departments.map((d, position) => ({ id: d.id, name: d.name, position })),
    faculty: db.faculty.map((f, position) => ({
      id: f.id, name: f.name, position_title: f.positionTitle, office_phone: f.officePhone, office: f.office,
      office_hours: f.officeHours, dept_id: f.deptId, email: f.email, position,
    })),
    faculty_departments: db.faculty.flatMap((f) => f.teachesIn.map((deptId, position) => ({ faculty_id: f.id, dept_id: deptId, position }))),
    courses: db.courses.map((c, position) => ({
      id: c.id, title: c.title, description: c.description, units: c.units, dept_id: c.deptId, level: c.level, position,
    })),
    course_prerequisites: db.courses.flatMap((c) => c.prereqs.map((prereqId, position) => ({ course_id: c.id, prereq_id: prereqId, position }))),
    course_qualified_faculty: db.courses.flatMap((c) => c.qualifiedFaculty.map((facultyId, position) => ({ course_id: c.id, faculty_id: facultyId, position }))),
    majors: db.majors.map((m, position) => ({
      id: m.id, title: m.title, dept_id: m.deptId, units_required: m.unitsRequired, major_units: m.majorUnits, position,
    })),
    major_courses: db.majors.flatMap((m) => [
      ...m.requiredCourses.map((courseId, position) => ({ major_id: m.id, course_id: courseId, kind: 'required' as const, position })),
      ...m.electives.map((courseId, position) => ({ major_id: m.id, course_id: courseId, kind: 'elective' as const, position })),
    ]),
    major_advisors: db.majors.flatMap((m) => m.advisors.map((employeeId, position) => ({ major_id: m.id, employee_id: employeeId, position }))),
    students: db.students.map((s, position) => ({
      id: s.id, first_name: s.firstName, middle_name: s.middleName ?? null, last_name: s.lastName, phone: s.phone,
      address: s.address, date_of_birth: s.dateOfBirth, major_id: s.majorId, minor_id: s.minorId ?? null,
      graduate: s.graduate, standing: s.standing, position,
    })),
    completed_courses: db.students.flatMap((s) => s.completed.map((c, position) => ({
      student_id: s.id, course_id: c.courseId, title: c.title, term: c.term, units: c.units, grade: c.grade, position,
    }))),
    transfer_courses: db.students.flatMap((s) => s.transfer.map((c, position) => ({
      student_id: s.id, course_id: c.courseId, title: c.title, term: c.term, units: c.units, grade: c.grade,
      university: c.university, location: c.location, equivalent_course_id: c.equivalentCourseId, position,
    }))),
    student_notes: db.students.flatMap((s) => s.notes.map((n, position) => ({
      student_id: s.id, at: n.at, by_employee_id: n.byEmployeeId, category: n.category, body: n.text, position,
    }))),
    users: db.users.map((u, position) => ({
      id: u.id, name: u.name, job_title: u.jobTitle, password: u.password, must_change_password: u.mustChangePassword,
      password_set_at: u.passwordSetAt, role: u.role, access: u.access, last_sign_in: u.lastSignIn ?? null,
      student_id: u.studentId ?? null, faculty_id: u.facultyId ?? null, position,
    })),
    offerings: db.offerings.map((o, position) => ({
      schedule_no: o.scheduleNo, course_id: o.courseId, term: o.term, days: o.days, start_time: o.start, end_time: o.end,
      location: o.location, instructor_id: o.instructorId, capacity: o.capacity, position,
    })),
    registrations: db.registrations.map((r, position) => ({
      student_id: r.studentId, schedule_no: r.scheduleNo, type: r.type, registered_by: r.registeredBy, registered_at: r.registeredAt,
      grade: r.grade ?? null, grade_note: r.gradeNote ?? null, grade_updated_by: r.gradeUpdatedBy ?? null, grade_updated_at: r.gradeUpdatedAt ?? null, position,
    })),
    outlines: db.outlines.map((o, position) => ({
      student_id: o.studentId, major_id: o.majorId, approved_by: o.approvedBy, approved_at: o.approvedAt, position,
    })),
    outline_entries: db.outlines.flatMap((o) => o.entries.map((e, position) => ({
      student_id: o.studentId, course_id: e.courseId, status: e.status, status_date: e.statusDate, by_name: e.by, note: e.note ?? null, position,
    }))),
    outline_history: db.outlines.flatMap((o) => o.history.map((h, position) => ({
      student_id: o.studentId, at: h.at, by_name: h.by, action: h.action, position,
    }))),
    grade_notes: db.gradeNotes.map((n, position) => ({ schedule_no: n.scheduleNo, at: n.at, by_name: n.by, body: n.text, position })),
    transactions: db.transactions.map((t, position) => ({ at: t.at, by_name: t.by, subsystem: t.subsystem, body: t.text, position })),
  };
}

export function compose(dump: Dump): Db {
  const teaches = groupBy(dump.faculty_departments, (row) => row.faculty_id);
  const prereqs = groupBy(dump.course_prerequisites, (row) => row.course_id);
  const qualified = groupBy(dump.course_qualified_faculty, (row) => row.course_id);
  const majorCourses = groupBy(dump.major_courses, (row) => row.major_id);
  const advisors = groupBy(dump.major_advisors, (row) => row.major_id);
  const completed = groupBy(dump.completed_courses, (row) => row.student_id);
  const transfer = groupBy(dump.transfer_courses, (row) => row.student_id);
  const notes = groupBy(dump.student_notes, (row) => row.student_id);
  const entries = groupBy(dump.outline_entries, (row) => row.student_id);
  const history = groupBy(dump.outline_history, (row) => row.student_id);

  return {
    term: dump.settings.term,
    registrationCloses: dump.settings.registration_closes,
    gradeWindow: { opens: dump.settings.grade_window_opens, closes: dump.settings.grade_window_closes },
    users: sortPos(dump.users).map((u) => ({
      id: u.id,
      name: u.name,
      jobTitle: u.job_title,
      password: u.password,
      mustChangePassword: u.must_change_password,
      passwordSetAt: u.password_set_at,
      role: u.role,
      access: u.access,
      ...(u.last_sign_in ? { lastSignIn: u.last_sign_in } : {}),
      ...(u.student_id ? { studentId: u.student_id } : {}),
      ...(u.faculty_id ? { facultyId: u.faculty_id } : {}),
    })),
    departments: sortPos(dump.departments).map(({ id, name }) => ({ id, name })),
    courses: sortPos(dump.courses).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      units: c.units,
      prereqs: sortPos(prereqs.get(c.id) ?? []).map((row) => row.prereq_id),
      deptId: c.dept_id,
      level: c.level,
      qualifiedFaculty: sortPos(qualified.get(c.id) ?? []).map((row) => row.faculty_id),
    })),
    offerings: sortPos(dump.offerings).map((o) => ({
      scheduleNo: o.schedule_no,
      courseId: o.course_id,
      term: o.term,
      days: o.days,
      start: o.start_time,
      end: o.end_time,
      location: o.location,
      instructorId: o.instructor_id,
      capacity: o.capacity,
    })),
    registrations: sortPos(dump.registrations).map((r) => ({
      studentId: r.student_id,
      scheduleNo: r.schedule_no,
      type: r.type,
      registeredBy: r.registered_by,
      registeredAt: r.registered_at,
      ...(r.grade ? { grade: r.grade } : {}),
      ...(r.grade_note ? { gradeNote: r.grade_note } : {}),
      ...(r.grade_updated_by ? { gradeUpdatedBy: r.grade_updated_by } : {}),
      ...(r.grade_updated_at ? { gradeUpdatedAt: r.grade_updated_at } : {}),
    })),
    students: sortPos(dump.students).map((s) => ({
      id: s.id,
      firstName: s.first_name,
      ...(s.middle_name ? { middleName: s.middle_name } : {}),
      lastName: s.last_name,
      phone: s.phone,
      address: s.address,
      dateOfBirth: s.date_of_birth,
      majorId: s.major_id,
      ...(s.minor_id ? { minorId: s.minor_id } : {}),
      graduate: s.graduate,
      standing: s.standing,
      completed: sortPos(completed.get(s.id) ?? []).map((c) => ({
        courseId: c.course_id, title: c.title, term: c.term, units: c.units, grade: c.grade,
      })),
      transfer: sortPos(transfer.get(s.id) ?? []).map((c) => ({
        courseId: c.course_id, title: c.title, term: c.term, units: c.units, grade: c.grade,
        university: c.university, location: c.location, equivalentCourseId: c.equivalent_course_id,
      })),
      notes: sortPos(notes.get(s.id) ?? []).map((n) => ({
        at: n.at, byEmployeeId: n.by_employee_id, category: n.category, text: n.body,
      })),
    })),
    faculty: sortPos(dump.faculty).map((f) => ({
      id: f.id,
      name: f.name,
      positionTitle: f.position_title,
      officePhone: f.office_phone,
      office: f.office,
      officeHours: f.office_hours,
      deptId: f.dept_id,
      teachesIn: sortPos(teaches.get(f.id) ?? []).map((row) => row.dept_id),
      email: f.email,
    })),
    majors: sortPos(dump.majors).map((m) => {
      const lists = majorCourses.get(m.id) ?? [];
      return {
        id: m.id,
        title: m.title,
        deptId: m.dept_id,
        unitsRequired: m.units_required,
        majorUnits: m.major_units,
        requiredCourses: sortPos(lists.filter((row) => row.kind === 'required')).map((row) => row.course_id),
        electives: sortPos(lists.filter((row) => row.kind === 'elective')).map((row) => row.course_id),
        advisors: sortPos(advisors.get(m.id) ?? []).map((row) => row.employee_id),
      };
    }),
    outlines: sortPos(dump.outlines).map((o) => ({
      studentId: o.student_id,
      majorId: o.major_id,
      approvedBy: o.approved_by,
      approvedAt: o.approved_at,
      entries: sortPos(entries.get(o.student_id) ?? []).map((e) => ({
        courseId: e.course_id,
        status: e.status,
        statusDate: e.status_date,
        by: e.by_name,
        ...(e.note ? { note: e.note } : {}),
      })),
      history: sortPos(history.get(o.student_id) ?? []).map((h) => ({ at: h.at, by: h.by_name, action: h.action })),
    })),
    gradeNotes: sortPos(dump.grade_notes).map((n) => ({ scheduleNo: n.schedule_no, at: n.at, by: n.by_name, text: n.body })),
    transactions: sortPos(dump.transactions).map((t) => ({ at: t.at, by: t.by_name, subsystem: t.subsystem, text: t.body })),
  };
}

/** Passwords stay in Postgres. The browser copy is blank unless a screen just set a new one. */
export function withoutPasswords(db: Db): Db {
  return { ...db, users: db.users.map((u) => ({ ...u, password: '' })) };
}
