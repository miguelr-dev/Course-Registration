# SignMeUp — Course Registration Project Requirements

> Converted from `CourseRegReqs.docx` (CS 532 project requirements). The original
> Word document is kept alongside this file at [`docs/CourseRegReqs.docx`](CourseRegReqs.docx).

A team from CS 532 is tasked to develop an integrated set of functions to support
the university course registration process. The system is being developed for a
small university with **2,000 students**. The application is referred to as
**SignMeUp**. The team must provide an initial integrated, functional prototype
by the end of the semester, providing the following capabilities:

1. Electronic Student Record
2. Course Registration
3. Major Course Requirements
4. Faculty and Course Information
5. Course Grades

---

## 1. General Requirements

- **Graphical User Interface (GUI):** SignMeUp shall utilize a full graphical
  user interface that provides multiple, moveable, and sizeable windows. When a
  user completes all required steps in a transaction and commits it to the
  database, SignMeUp shall respond within **5 seconds**.
- **Operational Environment:** Designed to support multiple users in a web
  environment. The initial prototype may be single-user, but any embedded
  database applications must be able to migrate to a multi-user/shared
  environment accessible over a network.
- **Security Access:** Security depends primarily on object-based security. A
  password shall be required to sign on and shall be validated before the user
  gains access.
- **Roles and Privileges:** After validation, pre-assigned roles and privileges
  determine which objects a user can access and what actions they can take.
  SignMeUp shall label all transactions with the user's name and the date and time.
- **Single Entry of Information:** All information is entered only once; once
  entered, it is available to all subsequent SignMeUp transactions.
- **Validation of Inputs:** Information is validated on entry, and identified
  errors must be resolved before additional information can be entered. Edits
  are controlled by user-defined and user-maintained parameters. A list of
  possible values for each entry field is available via a key sequence; these
  values are user-maintained.
- **Entry and Processing of Names:** Hyphenated names must be accepted and
  correctly processed in any name component (first, middle, last). Name searches
  must support standard wild card characters.
- **Modular Design:** The system shall be modular, permitting new capabilities
  to be added and modules to be added, upgraded, or replaced with relative ease.
- **Data Structure:** The system maintains information for multiple students,
  departments, courses, and course advisors, with both one-to-many and
  many-to-many structures, consistent with a relational database.
- **Display Printing:** Any display presented to a user can be printed,
  including all header information.
- **Reporting Requirements:** All printed reports can be previewed on the
  workstation before printing, and are accessible as a whole or in parts.
- **On-Line Help Function:** Context-sensitive online help covering system
  functions, transaction descriptions, screen descriptions, and data fields.
  Users can update help screens under system security control.
  - Help shall be available for each entry or inquiry module/screen while the
    user is in that module or screen.
  - Field-level help shall be available while the cursor is in a field,
    including whether the field is mandatory.
- **Screens/User Interface:** Menu-driven, with standardized movement from
  screen to screen without returning to the main menu, and standardized system
  messages.
- **Ability to Access Any Screen:** Any screen is reachable with minimal
  sub-menuing.
- **Prototype Design / Process:** All customization, modification, or new
  development uses JAD (Joint Application Design) methodology, with intermediate
  prototypes to ensure desired functionality.
- **Control of Information Entry Sequence:** Data collection normally occurs in
  a predetermined sequence, but a user may select any desired screen to enter
  information out of sequence in typical cases.
- **Error Messages:** Out-of-sequence or invalid entries are rejected with a
  message indicating (1) the reason for the rejection and (2) the minimum
  requirements for the entry to be accepted.
- **Processing Blocks Until Errors Corrected:** e.g., failure to complete key
  student information causes most other functions to fail, because there is no
  student record to attach information to.
- **Control Entry Modification:** A user can return to an already-processed
  screen (at minimum via menu selection) to add optional information or modify
  previous entries.
- **User Cancellation:** A user can cancel an action at any time before
  completing it.
- **Restoration of Previous Data:** On cancellation, interim entries are
  restored to their status prior to the initiation of the action.

## 2. SignMeUp Framework

- Provides a structure for the integration of the SignMeUp subsystems.
- Manages the user logon process.
- Allows system-level authorized users to maintain authorized user information,
  which includes:
  - User name
  - User employee number
  - User's job title
  - User password
  - Allowable access areas (subsystems)
- Provides a menu allowing authorized users access to their projects' databases
  and tools.
- Allows printing an authorized-user report for the whole system or a specified
  subsystem, containing all user information above **except passwords**.
- Allows system-level authorized users to initialize and reset user passwords.

## 3. Electronic Student Record (ER)

- Maintains general student information and course completion information:
  - Student ID number, name, telephone number, address, date of birth
  - Student major and minor
  - Course information for courses completed at this university
  - Course information for courses completed at another accredited university
  - Course information for courses in which the student is currently enrolled
  - Notes about student issues (e.g., suspensions or other formal actions),
    special commendations (e.g., honor roll), or special needs
- **Notes are append-only:** maintained in chronological sequence; no entry may
  be deleted. Each entry is identified by the date and time it was input and the
  campus employee ID of the person who made it.
- Course information includes:
  - Course ID, Course Title, semester completed, number of units, grade received
  - For transfer courses: the name and location of the university and the
    equivalent course ID at the current university
- Allows printing the student record as a report, optionally including detailed
  course information, filtered to current-university courses or all courses,
  and indicating the student's overall current GPA.
- Should comply with any known electronic student record standards.

## 4. Course Registration (REG)

- Maintains and tracks current course offerings, associated schedules, and
  seats available.
- For each scheduled course: Course ID, Schedule Number, date and time held,
  location, instructor name, number of units, prerequisite(s).
- Course information is maintained by academic department.
- Upper-division courses required for a major/minor should be limited to
  students with that declared major/minor.
- Graduate-level courses should be limited to students accepted into the
  graduate program.
- Students can register on-line for a set of courses for the upcoming semester,
  one course at a time.
- A student may request a list of major courses that meet **all** of:
  - on their approved outline,
  - required prerequisites completed,
  - space still available —
  and may then register from that list.
- Schedule reports:
  - Student schedule listing and briefly describing all currently enrolled courses
  - Courses offered by a specified department
  - Courses with seats currently available, by department or for all departments

## 5. Major Course Requirements (MAJOR)

- Maintains current required courses for all majors and approved major outlines
  for each student in each department.
- Per academic major: Major ID, Major Title, Department, number of units
  required, list of required courses, list of electives within the major, list
  of advisors.
- Approved major outlines may only be entered by a major advisor or an
  authorized department user, and include:
  - Major ID
  - List of selected courses from the major
  - Status of each "approved" course: approved, dropped, waived
  - The date each status action was entered
  - Name of the advisor who approved the outline and the date it was last approved
- Once reviewed and approved by an authorized advisor, outline entries may
  **not be deleted**; modifications are allowed and a **history of these
  actions** is kept.
- Reports:
  - All required courses for a specific major (all users)
  - All completed required courses for a specific student (major advisors and
    the specific student only)
  - Student status against their approved major outline (major advisors and the
    specific student only)
  - History of changes to a specific major outline (major advisors and the
    specific student only)

## 6. Faculty and Course Information (FCI)

- Maintains general faculty information and the course(s) each faculty member
  teaches.
- Faculty information: Faculty ID number, name, position title, office
  telephone, office number, office hours, assigned department, department(s)
  taught in.
- Course information: Course ID number, title, description, prerequisite(s),
  number of units, faculty members qualified to teach the course.
- Queries by Faculty ID number, faculty name, Course ID number, or course title:
  - Faculty queries return detailed faculty information plus the courses the
    faculty member is authorized to teach.
  - Course queries return detailed course information plus the faculty members
    authorized to teach it.
- Reports: list and short description of faculty members and of courses, by
  university or department, or within a single department.

## 7. Course Grades (GRADES)

- Faculty members enter and maintain grade information for each course for
  which they are the **primary instructor**.
- For each current course, displays student names and ID numbers and allows
  grade entry. Allowed grades: a valid letter grade, credit/no-credit, or
  audit, depending on the registration type.
- Faculty may attach text notes to a specific grade for a specific student, and
  may enter general notes not tied to a specific student/grade.
- Grades may only be entered at the end of the current semester unless the user
  has special privileges. A user with special update privileges may update any
  existing grade; if a grade is updated by anyone other than the faculty member
  who taught the course, the system maintains information about who updated it.
- Grade sheet printout includes: Course ID, department, Schedule Number, date
  and time held, instructor name, number of units, and the list of students,
  their ID numbers, and assigned grades.
- Reports:
  - **Course statistics:** number registered, number completing with a passing
    grade, average grade, percentage receiving A/B/C/D/F
  - **Department statistics:** the same four measures across department courses
  - **University statistics:** the same four measures across all courses
