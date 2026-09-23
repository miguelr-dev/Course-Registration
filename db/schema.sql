-- SignMeUp relational schema.
-- One row per real-world record. Lists keep a position column so the
-- screens see the same order the prototype was seeded with.
-- Timestamps stay text (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS) so the UI
-- clock does not shift when the database session is UTC.

create table if not exists departments (
  id text primary key,
  name text not null,
  position integer not null
);

create table if not exists faculty (
  id text primary key,
  name text not null,
  position_title text not null,
  office_phone text not null,
  office text not null,
  office_hours text not null,
  dept_id text not null references departments (id),
  email text not null,
  position integer not null
);

create table if not exists faculty_departments (
  faculty_id text not null references faculty (id) on delete cascade,
  dept_id text not null references departments (id),
  position integer not null,
  primary key (faculty_id, dept_id)
);

create table if not exists courses (
  id text primary key,
  title text not null,
  description text not null,
  units integer not null,
  dept_id text not null references departments (id),
  level text not null check (level in ('lower', 'upper', 'graduate')),
  position integer not null
);

create table if not exists course_prerequisites (
  course_id text not null references courses (id) on delete cascade,
  prereq_id text not null references courses (id),
  position integer not null,
  primary key (course_id, prereq_id)
);

create table if not exists course_qualified_faculty (
  course_id text not null references courses (id) on delete cascade,
  faculty_id text not null references faculty (id),
  position integer not null,
  primary key (course_id, faculty_id)
);

create table if not exists majors (
  id text primary key,
  title text not null,
  dept_id text not null references departments (id),
  units_required integer not null,
  major_units integer not null,
  position integer not null
);

create table if not exists major_courses (
  major_id text not null references majors (id) on delete cascade,
  course_id text not null references courses (id),
  kind text not null check (kind in ('required', 'elective')),
  position integer not null,
  primary key (major_id, course_id, kind)
);

create table if not exists students (
  id text primary key,
  first_name text not null,
  middle_name text,
  last_name text not null,
  phone text not null,
  address text not null,
  date_of_birth text not null,
  major_id text not null references majors (id),
  minor_id text references majors (id),
  graduate boolean not null,
  standing text not null,
  position integer not null
);

create table if not exists completed_courses (
  student_id text not null references students (id) on delete cascade,
  course_id text not null,
  title text not null,
  term text not null,
  units integer not null,
  grade text not null,
  position integer not null,
  primary key (student_id, position)
);

create table if not exists transfer_courses (
  student_id text not null references students (id) on delete cascade,
  course_id text not null,
  title text not null,
  term text not null,
  units integer not null,
  grade text not null,
  university text not null,
  location text not null,
  equivalent_course_id text not null,
  position integer not null,
  primary key (student_id, position)
);

create table if not exists student_notes (
  student_id text not null references students (id) on delete cascade,
  at text not null,
  by_employee_id text not null,
  category text not null check (category in ('advising', 'commendation', 'issue', 'special-need')),
  body text not null,
  position integer not null,
  primary key (student_id, position)
);

create table if not exists users (
  id text primary key,
  name text not null,
  job_title text not null,
  password text not null,
  must_change_password boolean not null,
  password_set_at text not null,
  role text not null check (role in ('student', 'faculty', 'advisor', 'registrar', 'admin')),
  access text[] not null,
  last_sign_in text,
  student_id text references students (id),
  faculty_id text references faculty (id),
  position integer not null
);

create table if not exists major_advisors (
  major_id text not null references majors (id) on delete cascade,
  employee_id text not null references users (id),
  position integer not null,
  primary key (major_id, employee_id)
);

create table if not exists offerings (
  schedule_no text primary key,
  course_id text not null references courses (id),
  term text not null,
  days text not null,
  start_time text not null,
  end_time text not null,
  location text not null,
  instructor_id text not null references faculty (id),
  capacity integer not null,
  position integer not null
);

create table if not exists registrations (
  student_id text not null,
  schedule_no text not null references offerings (schedule_no) on delete cascade,
  type text not null check (type in ('letter', 'crnc', 'audit')),
  registered_by text not null,
  registered_at text not null,
  grade text,
  grade_note text,
  grade_updated_by text,
  grade_updated_at text,
  position integer not null,
  primary key (student_id, schedule_no)
);

create table if not exists outlines (
  student_id text primary key references students (id) on delete cascade,
  major_id text not null references majors (id),
  approved_by text not null,
  approved_at text not null,
  position integer not null
);

create table if not exists outline_entries (
  student_id text not null references outlines (student_id) on delete cascade,
  course_id text not null references courses (id),
  status text not null check (status in ('approved', 'dropped', 'waived')),
  status_date text not null,
  by_name text not null,
  note text,
  position integer not null,
  primary key (student_id, course_id)
);

create table if not exists outline_history (
  student_id text not null references outlines (student_id) on delete cascade,
  at text not null,
  by_name text not null,
  action text not null,
  position integer not null,
  primary key (student_id, position)
);

create table if not exists grade_notes (
  schedule_no text not null references offerings (schedule_no) on delete cascade,
  at text not null,
  by_name text not null,
  body text not null,
  position integer not null,
  primary key (schedule_no, position)
);

create table if not exists transactions (
  at text not null,
  by_name text not null,
  subsystem text not null check (subsystem in ('ER', 'REG', 'MAJOR', 'FCI', 'GRADE', 'USERS', 'FRAMEWORK')),
  body text not null,
  position integer primary key
);

create table if not exists app_settings (
  id integer primary key default 1 check (id = 1),
  term text not null,
  registration_closes text not null,
  grade_window_opens text not null,
  grade_window_closes text not null
);

create index if not exists registrations_schedule_idx on registrations (schedule_no);
create index if not exists offerings_course_idx on offerings (course_id);
create index if not exists students_major_idx on students (major_id);
