import type { HelpTopic } from '../data/types';

export type { HelpTopic };

/** Context-sensitive help: one topic per screen, with field-level notes and whether each field is mandatory. */
export const HELP: Record<string, HelpTopic> = {
  login: {
    title: 'Sign in', summary: 'Sign in with your SDSU email address. Anyone with an @sdsu.edu address can create an account; other addresses are refused. New accounts start as students; an administrator can widen access from Authorized Users. Every transaction you complete afterwards is recorded with your name, date and time.',
    fields: [['Email', 'Mandatory. Must end in @sdsu.edu.'], ['Password', 'Mandatory. Validated by the sign-in service before you reach any screen. Use "Forgot password" on the sign-in page, or ask a system administrator to reset it.']],
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
    fields: [['Edit student information', 'Returns to the student information entry to add optional details (middle name, minor) or change earlier entries. Students may update their own telephone and address. Cancel and restore discards the changes.'], ['First, middle and last name', 'First and last are mandatory; middle is optional. Hyphenated names are accepted in any part, e.g. Okafor-Reyes.'], ['Telephone', 'Mandatory. 10 digits including area code.'], ['Address', 'Mandatory. Street, city, state and ZIP.'], ['Date of birth', 'Mandatory.'], ['Major', 'Mandatory. Undeclared is allowed.'], ['Minor', 'Optional. Must be outside the major’s department.'], ['Category', 'Mandatory when adding a note.'], ['Note', 'Mandatory. Free text; keep to the facts. Notes are listed oldest first and can never be changed or deleted.'], ['Print record', 'Prints the record with optional course detail, this university only or all courses, and the overall GPA.']],
  },
  outline: {
    title: 'Approved major outline', summary: 'The courses selected from the major for one student, each with a status of approved, dropped or waived and the date of that status. Only a major advisor or authorized department user may change it. Entries are never deleted; every change is added to the history.',
    fields: [['Status', 'Mandatory per entry: approved, dropped or waived.'], ['Reason', 'Optional. Recorded in the change history.'], ['Add course', 'Adds a course from the major as Approved.']],
  },
  fci: {
    title: 'Faculty & course information', summary: 'Query by faculty ID, faculty name, course ID or course title. Faculty results show the courses that person is authorized to teach; course results show the faculty authorized to teach it. Wildcards * and ? are accepted. The registrar can add a course or edit an existing one (title, description, units, level, department, prerequisites and the faculty qualified to teach it); the course ID cannot be changed once it is in the catalog.',
    fields: [['Search by', 'Mandatory. Chooses which field the query matches.'], ['Query', 'Optional. Blank lists everything in the chosen department.'], ['Course ID', 'Mandatory when adding. Department code, a space and a 3-digit number, e.g. CS 310.'], ['Prerequisites', 'Optional. Existing course IDs separated by commas; a course cannot require itself or create a loop.'], ['Faculty qualified to teach', 'Optional. Tick each faculty member authorized to teach the course.']],
  },
  grades: {
    title: 'Course grades', summary: 'Grade entry for a course you are the primary instructor of. Grades may only be entered during the end-of-term window unless you hold special update privileges. If anyone other than the instructor changes a grade, the system records who did it and when.',
    fields: [['Grade', 'Letter grade, CR/NC or AU depending on the registration type. Changed grades are highlighted and are not recorded until you choose Save grades; Cancel and restore (or Esc) returns them to their saved values.'], ['Note', 'Optional. Attached to that student’s grade.'], ['General notes', 'Optional. Notes about the course not tied to a student.']],
  },
  users: {
    title: 'Authorized users', summary: 'Maintain who can use SignMeUp: name, employee number (students use their student ID), job title, role, allowable access areas, and password. Manage user changes nothing until you choose Save changes; Cancel and restore discards the edits. Passwords go straight to the sign-in service and are never stored, shown again or printed. Adding a user with an @sdsu.edu address assigns that role the first time the address signs in. Print user report prints the whole system or one subsystem, without passwords.',
    fields: [['Role', 'Mandatory. Student accounts are numbered by student ID and open that student’s record.'], ['Employee number / Student ID', 'Mandatory. 5 to 8 digits for employees; exactly 8 for students.'], ['Email', 'Mandatory. An @sdsu.edu address not already assigned.'], ['Job title', 'Mandatory.'], ['Access areas', 'Mandatory. At least one subsystem.'], ['New password', 'Optional when adding; used to initialize or reset a password. At least 10 characters with letters and digits. Generate creates one to give to the user.'], ['Report scope', 'Optional. Whole system, or only users with access to one subsystem.']],
  },
};
