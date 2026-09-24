import type { HelpTopic, Subsystem } from '../data/types';

export type { HelpTopic };

/** Context-sensitive help: one topic per screen, with field-level notes and whether each field is mandatory. */
export const HELP: Record<string, HelpTopic> = {
  login: {
    title: 'Sign in', summary: 'Sign in with your SDSU email address. Anyone with an @sdsu.edu address can create an account; other addresses are refused. New accounts start as students; an administrator can widen access from Authorized Users. Every transaction you complete afterwards is recorded with your name, date and time.',
    fields: [['Email', 'Mandatory. Must end in @sdsu.edu.'], ['Password', 'Mandatory. Managed by the sign-in service; use "Forgot password" on the sign-in page to reset it.']],
  },
  dashboard: {
    title: 'Student dashboard', summary: 'Your schedule for the current term, your running units total, and the major courses you can register for right now: on your approved outline, prerequisites completed, and seats still open. Register one course at a time.',
    fields: [['Register', 'Adds the course after all rules pass: prerequisites, seats, time conflicts, the 18-unit maximum, program restrictions.'], ['Drop', 'Removes a course from your schedule and records who did it.']],
  },
  search: {
    title: 'Course search & registration', summary: 'Search current offerings by course ID or title, filtered by department and term. Use * for any run of characters and ? for one character. Expand a row for the description and your prerequisite status; select a row to confirm registration in the side panel.',
    fields: [['Course ID or title', 'Optional. Wildcards allowed, e.g. CS 3*.'], ['Department', 'Optional. Limits results to one department.'], ['Seats available only', 'Optional. Hides full sections.'], ['Registration type', 'Mandatory on confirm: letter grade, credit/no credit, or audit.']],
  },
  record: {
    title: 'Electronic student record', summary: 'General student information, courses completed here and elsewhere, current enrollment, GPA, and notes. Notes are append-only: each entry is stamped with the date, time and employee ID of its author and can never be deleted.',
    fields: [['Category', 'Mandatory when adding a note.'], ['Note', 'Mandatory. Free text; keep to the facts.'], ['Print record', 'Prints the record with optional course detail, this university only or all courses, and the overall GPA.']],
  },
  outline: {
    title: 'Approved major outline', summary: 'The courses selected from the major for one student, each with a status of approved, dropped or waived and the date of that status. Only a major advisor or authorized department user may change it. Entries are never deleted; every change is added to the history.',
    fields: [['Status', 'Mandatory per entry: approved, dropped or waived.'], ['Reason', 'Optional. Recorded in the change history.'], ['Add course', 'Adds a course from the major as Approved.']],
  },
  fci: {
    title: 'Faculty & course information', summary: 'Query by faculty ID, faculty name, course ID or course title. Faculty results show the courses that person is authorized to teach; course results show the faculty authorized to teach it. Wildcards * and ? are accepted.',
    fields: [['Search by', 'Mandatory. Chooses which field the query matches.'], ['Query', 'Optional. Blank lists everything in the chosen department.']],
  },
  grades: {
    title: 'Course grades', summary: 'Grade entry for a course you are the primary instructor of. Grades may only be entered during the end-of-term window unless you hold special update privileges. If anyone other than the instructor changes a grade, the system records who did it and when.',
    fields: [['Grade', 'Letter grade, CR/NC or AU depending on the registration type.'], ['Note', 'Optional. Attached to that student’s grade.'], ['General notes', 'Optional. Notes about the course not tied to a student.']],
  },
  users: {
    title: 'Authorized users', summary: 'Maintain who can use SignMeUp and which subsystems each user can reach. Passwords are handled by the sign-in service and are never stored, shown or printed here; users reset their own from the sign-in page. Adding a user with an @sdsu.edu address assigns that role the first time the address signs in.',
    fields: [['Employee number', 'Mandatory. 5 to 8 digits; students use their student ID.'], ['Email', 'Mandatory. An @sdsu.edu address not already assigned.'], ['Job title', 'Mandatory.'], ['Access areas', 'Mandatory. At least one subsystem.']],
  },
};

export const SUBSYSTEMS: { code: Subsystem; label: string; path: string }[] = [
  { code: 'ER', label: 'Student Record', path: '/record' },
  { code: 'REG', label: 'Registration', path: '/' },
  { code: 'MAJOR', label: 'Major Requirements', path: '/outline' },
  { code: 'FCI', label: 'Faculty & Courses', path: '/faculty' },
  { code: 'GRADE', label: 'Course Grades', path: '/grades' },
  { code: 'USERS', label: 'Authorized Users', path: '/users' },
];
