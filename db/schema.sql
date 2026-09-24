-- SignMeUp relational schema for Supabase (PostgreSQL).
-- Paste into the Supabase SQL editor (Database → SQL Editor → New query) and run.
--
-- Two layers live side by side:
--   1. signmeup_state  — the one-row JSON document the deployed app reads and writes today
--                        through api/db.ts. The API creates it on first use, so nothing to do.
--   2. the normalized tables below — the proper relational design the requirements call for
--      (GEN-16: one-to-many and many-to-many structures for students, departments, courses
--      and advisors). Load these once the team migrates the API off the single document.
--
-- Conventions: text primary keys mirror the IDs users see (student/employee numbers, "CS 310",
-- schedule numbers). Append-only tables (notes, outline history, transactions) are protected by
-- a trigger so rows can be added but never changed or deleted (ER-03, MAJ-07, GEN-08).

-- ---------------------------------------------------------------- Framework: users and roles
create table if not exists departments (
  id   text primary key,            -- 'CS', 'MATH', 'BIO', 'PHYS', 'ENGL', 'HIST', 'UNIV'
  name text not null
);

create table if not exists app_users (
  id            text primary key,   -- employee number or student ID, 5–8 digits
  name          text not null,
  email         text not null unique,                 -- the @sdsu.edu address used with Clerk
  job_title     text not null,
  role          text not null check (role in ('student','faculty','advisor','registrar','admin')),
  clerk_user_id text unique,
  last_sign_in  timestamptz,
  created_at    timestamptz not null default now()
);

-- Which subsystems a user may open (FW-03). One row per user per area.
create table if not exists user_access (
  user_id   text not null references app_users(id) on delete cascade,
  subsystem text not null check (subsystem in ('ER','REG','MAJOR','FCI','GRADE','USERS')),
  primary key (user_id, subsystem)
);

-- Semesters and their windows (REG registration deadline, GRD-13 grade-entry window).
create table if not exists terms (
  id                  text primary key,  -- 'Fall 2026'
  registration_closes date not null,
  grade_window_opens  date not null,
  grade_window_closes date not null,
  is_current          boolean not null default false
);

-- ---------------------------------------------------------------- FCI: faculty and catalog
create table if not exists faculty (
  id             text primary key,   -- 'F-10231'
  name           text not null,
  position_title text not null,
  office_phone   text,
  office         text,
  office_hours   text,
  dept_id        text not null references departments(id),
  email          text,
  user_id        text references app_users(id)      -- the sign-in account, if any
);

create table if not exists faculty_teaches_in (      -- many-to-many faculty ↔ departments
  faculty_id text not null references faculty(id) on delete cascade,
  dept_id    text not null references departments(id),
  primary key (faculty_id, dept_id)
);

create table if not exists courses (
  id          text primary key,      -- 'CS 310'
  title       text not null,
  description text not null default '',
  units       integer not null check (units between 0 and 12),
  dept_id     text not null references departments(id),
  level       text not null check (level in ('lower','upper','graduate'))
);

create table if not exists course_prerequisites (    -- many-to-many courses ↔ courses
  course_id  text not null references courses(id) on delete cascade,
  prereq_id  text not null references courses(id),
  primary key (course_id, prereq_id),
  check (course_id <> prereq_id)
);

create table if not exists course_qualified_faculty ( -- many-to-many courses ↔ faculty (FCI-03)
  course_id  text not null references courses(id) on delete cascade,
  faculty_id text not null references faculty(id) on delete cascade,
  primary key (course_id, faculty_id)
);

-- ---------------------------------------------------------------- MAJOR: majors and outlines
create table if not exists majors (
  id             text primary key,   -- 'CS-BS', 'MATH-MIN', 'UNDECLARED'
  title          text not null,
  dept_id        text not null references departments(id),
  units_required integer not null,
  major_units    integer not null
);

create table if not exists major_courses (           -- required and elective courses per major
  major_id  text not null references majors(id) on delete cascade,
  course_id text not null references courses(id),
  kind      text not null check (kind in ('required','elective')),
  primary key (major_id, course_id)
);

create table if not exists major_advisors (          -- many-to-many majors ↔ advisors
  major_id    text not null references majors(id) on delete cascade,
  employee_id text not null references app_users(id),
  primary key (major_id, employee_id)
);

-- ---------------------------------------------------------------- ER: students and records
create table if not exists students (
  id            text primary key,    -- student ID; same value as app_users.id for that person
  first_name    text not null,
  middle_name   text,
  last_name     text not null,
  phone         text not null default '',
  address       text not null default '',
  date_of_birth date,
  major_id      text not null references majors(id),
  minor_id      text references majors(id),
  graduate      boolean not null default false,
  standing      text not null default 'Good standing'
);

create table if not exists completed_courses (       -- taken at this university
  id         bigserial primary key,
  student_id text not null references students(id) on delete cascade,
  course_id  text not null references courses(id),
  term       text not null,
  units      integer not null,
  grade      text not null
);

create table if not exists transfer_courses (        -- taken elsewhere (ER-02)
  id                   bigserial primary key,
  student_id           text not null references students(id) on delete cascade,
  course_id            text not null,               -- the other school's course ID
  title                text not null,
  term                 text not null,
  units                integer not null,
  grade                text not null,
  university           text not null,
  location             text not null,
  equivalent_course_id text references courses(id)
);

create table if not exists student_notes (           -- append-only (ER-03)
  id             bigserial primary key,
  student_id     text not null references students(id) on delete cascade,
  at             timestamptz not null default now(),
  by_employee_id text not null references app_users(id),
  category       text not null check (category in ('advising','commendation','issue','special-need')),
  text           text not null
);

create table if not exists outlines (                -- one approved outline per student
  student_id  text primary key references students(id) on delete cascade,
  major_id    text not null references majors(id),
  approved_by text not null,
  approved_at timestamptz not null
);

create table if not exists outline_entries (
  student_id  text not null references outlines(student_id) on delete cascade,
  course_id   text not null references courses(id),
  status      text not null check (status in ('approved','dropped','waived')),
  status_date date not null,
  by          text not null,
  note        text,
  primary key (student_id, course_id)               -- entries change status; never deleted (MAJ-07)
);

create table if not exists outline_history (         -- append-only (MAJ-07, MAJ-11)
  id         bigserial primary key,
  student_id text not null references outlines(student_id) on delete cascade,
  at         timestamptz not null default now(),
  by         text not null,
  action     text not null
);

-- ---------------------------------------------------------------- REG and GRADE
create table if not exists offerings (               -- a scheduled section (REG-02)
  schedule_no   text primary key,    -- '12011'
  course_id     text not null references courses(id),
  term_id       text not null references terms(id),
  days          text not null,       -- 'MWF', 'TTh'
  start_time    time not null,
  end_time      time not null,
  location      text not null,
  instructor_id text not null references faculty(id),
  capacity      integer not null check (capacity > 0)
);

create table if not exists registrations (           -- enrollment plus the grade for it
  student_id       text not null references students(id) on delete cascade,
  schedule_no      text not null references offerings(schedule_no) on delete cascade,
  type             text not null check (type in ('letter','crnc','audit')),
  registered_by    text not null,
  registered_at    timestamptz not null default now(),
  grade            text,
  grade_note       text,
  grade_updated_by text,             -- set when someone other than the instructor changes it
  grade_updated_at timestamptz,
  primary key (student_id, schedule_no)
);

create table if not exists grade_notes (             -- general notes not tied to a student
  id          bigserial primary key,
  schedule_no text not null references offerings(schedule_no) on delete cascade,
  at          timestamptz not null default now(),
  by          text not null,
  text        text not null
);

-- ---------------------------------------------------------------- Framework: audit trail (GEN-08)
create table if not exists transactions (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  by        text not null,
  subsystem text not null check (subsystem in ('FRAMEWORK','ER','REG','MAJOR','FCI','GRADE')),
  text      text not null
);

-- Seats available is derived, never stored: capacity minus registrations for that section.
create or replace view seats_available as
select o.schedule_no, o.capacity, o.capacity - count(r.student_id) as open_seats
from offerings o left join registrations r on r.schedule_no = o.schedule_no
group by o.schedule_no, o.capacity;

-- Append-only enforcement.
create or replace function reject_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows are append-only and cannot be modified or deleted', tg_table_name;
end $$;

do $$
declare t text;
begin
  foreach t in array array['student_notes','outline_history','transactions'] loop
    execute format('drop trigger if exists %I_append_only on %I', t, t);
    execute format('create trigger %I_append_only before update or delete on %I for each row execute function reject_change()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- the document store used today
create table if not exists signmeup_state (
  id         text primary key,
  version    integer not null default 0,
  doc        jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
