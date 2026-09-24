import type { Db } from './types';
import { HELP } from '../components/help';

/** User-maintained value lists for entry fields (GEN-11, GEN-12). Administrators can extend these in the database. */
export const VALUE_LISTS: Record<string, string[]> = {
  grades: ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'I', 'CR', 'NC', 'AU'],
  noteCategories: ['advising', 'commendation', 'issue', 'special-need'],
  registrationTypes: ['letter', 'crnc', 'audit'],
  outlineStatuses: ['approved', 'dropped', 'waived'],
  subsystems: ['ER', 'REG', 'MAJOR', 'FCI', 'GRADE', 'USERS'],
  roles: ['student', 'faculty', 'advisor', 'registrar', 'admin'],
};

const T = '2026-09-12T14:41:00';

export function createSeed(): Db {
  return {
    term: 'Fall 2026',
    registrationCloses: '2026-09-26',
    gradeWindow: { opens: '2026-12-14', closes: '2026-12-21' },

    departments: [
      { id: 'CS', name: 'Computer Science' },
      { id: 'MATH', name: 'Mathematics' },
      { id: 'BIO', name: 'Biology' },
      { id: 'PHYS', name: 'Physics' },
      { id: 'ENGL', name: 'English' },
      { id: 'HIST', name: 'History' },
      { id: 'UNIV', name: 'University (undeclared)' },
    ],

    users: [
      { id: '10093', name: 'Kenji Ibarra-Novak', email: 'kibarra-novak@signmeup.example', jobTitle: 'Registrar, System administrator', role: 'admin', access: ['ER', 'REG', 'MAJOR', 'FCI', 'GRADE', 'USERS'], lastSignIn: '2026-09-15T08:55:00' },
      { id: '30117', name: 'Rosa Delgado-Munoz', email: 'rdelgado-munoz@signmeup.example', jobTitle: 'Major advisor, Computer Science', role: 'advisor', access: ['ER', 'REG', 'MAJOR', 'FCI'], lastSignIn: '2026-09-15T09:10:00', facultyId: 'F-10510' },
      { id: '28804', name: 'Daniel Nakamura', email: 'dnakamura@signmeup.example', jobTitle: 'Professor, Computer Science', role: 'faculty', access: ['FCI', 'GRADE'], lastSignIn: '2026-09-14T16:32:00', facultyId: 'F-10231' },
      { id: '27310', name: 'Lena Hwang-Baptiste', email: 'lhwang-baptiste@signmeup.example', jobTitle: 'Associate Professor, Mathematics', role: 'faculty', access: ['FCI', 'GRADE'], lastSignIn: '2026-09-12T13:05:00', facultyId: 'F-10422' },
      { id: '31855', name: 'Samuel Okonkwo', email: 'sokonkwo@signmeup.example', jobTitle: 'Lecturer, Biology', role: 'faculty', access: ['FCI', 'GRADE'], lastSignIn: '2026-09-11T10:48:00', facultyId: 'F-11290' },
      { id: '41208', name: 'Priya Anand-Whitfield', email: 'panand-whitfield@signmeup.example', jobTitle: 'Disability Services coordinator', role: 'registrar', access: ['ER'], lastSignIn: '2026-09-09T14:20:00' },
      { id: '20231847', name: 'Maria Okafor-Reyes', email: 'mokafor-reyes@signmeup.example', jobTitle: 'Student', role: 'student', access: ['ER', 'REG', 'MAJOR', 'FCI'], lastSignIn: '2026-09-12T14:38:00', studentId: '20231847' },
      { id: '20230419', name: 'Tomás Bravo', email: 'tbravo@signmeup.example', jobTitle: 'Student', role: 'student', access: ['ER', 'REG', 'MAJOR', 'FCI'], lastSignIn: '2026-09-10T11:02:00', studentId: '20230419' },
    ],

    faculty: [
      { id: 'F-10231', name: 'Daniel Nakamura', positionTitle: 'Professor', officePhone: '(310) 555-0171', office: 'Boelter 4531', officeHours: 'Mon 2:00–4:00 PM', deptId: 'CS', teachesIn: ['CS'], email: 'dnakamura@university.edu' },
      { id: 'F-10422', name: 'Lena Hwang-Baptiste', positionTitle: 'Associate Professor', officePhone: '(310) 555-0198', office: 'MS 6118', officeHours: 'Tue 1:00–3:00 PM · Thu 9:00–10:30 AM', deptId: 'MATH', teachesIn: ['MATH', 'CS'], email: 'lhwangbaptiste@university.edu' },
      { id: 'F-10510', name: 'Rosa Delgado-Munoz', positionTitle: 'Senior Lecturer', officePhone: '(310) 555-0133', office: 'Boelter 3532', officeHours: 'Wed 10:00 AM–12:00 PM', deptId: 'CS', teachesIn: ['CS'], email: 'rdelgadomunoz@university.edu' },
      { id: 'F-10644', name: 'Pilar Vasquez', positionTitle: 'Professor', officePhone: '(310) 555-0107', office: 'Boelter 4802', officeHours: 'Tue 3:00–5:00 PM', deptId: 'CS', teachesIn: ['CS'], email: 'pvasquez@university.edu' },
      { id: 'F-10702', name: 'Anders Ferreira-Lund', positionTitle: 'Assistant Professor', officePhone: '(310) 555-0164', office: 'Boelter 3714', officeHours: 'Mon 11:00 AM–1:00 PM', deptId: 'CS', teachesIn: ['CS'], email: 'aferreiralund@university.edu' },
      { id: 'F-10877', name: 'Daniel Hwang-Park', positionTitle: 'Lecturer', officePhone: '(310) 555-0119', office: 'Boelter 2760', officeHours: 'Thu 2:00–4:00 PM', deptId: 'CS', teachesIn: ['CS'], email: 'dhwangpark@university.edu' },
      { id: 'F-10915', name: 'Nils Achterberg', positionTitle: 'Professor', officePhone: '(310) 555-0182', office: 'Boelter 4405', officeHours: 'Fri 9:00–11:00 AM', deptId: 'CS', teachesIn: ['CS'], email: 'nachterberg@university.edu' },
      { id: 'F-10990', name: 'Julia Alvarez-Smith', positionTitle: 'Associate Professor', officePhone: '(310) 555-0126', office: 'Boelter 3256', officeHours: 'Tue 10:00 AM–12:00 PM', deptId: 'CS', teachesIn: ['CS'], email: 'jalvarezsmith@university.edu' },
      { id: 'F-11290', name: 'Samuel Okonkwo', positionTitle: 'Lecturer', officePhone: '(310) 555-0150', office: 'LS 3120', officeHours: 'Mon 1:00–3:00 PM', deptId: 'BIO', teachesIn: ['BIO'], email: 'sokonkwo@university.edu' },
      { id: 'F-11302', name: 'Sun-Hee Hwang-Okoro', positionTitle: 'Professor', officePhone: '(310) 555-0144', office: 'LS 4410', officeHours: 'Wed 2:00–4:00 PM', deptId: 'BIO', teachesIn: ['BIO'], email: 'shwangokoro@university.edu' },
      { id: 'F-11480', name: 'Marcus Feld', positionTitle: 'Associate Professor', officePhone: '(310) 555-0138', office: 'PAB 2314', officeHours: 'Thu 10:00 AM–12:00 PM', deptId: 'PHYS', teachesIn: ['PHYS'], email: 'mfeld@university.edu' },
    ],

    courses: [
      { id: 'CS 101', title: 'Programming I', description: 'Introduction to programming in Python: expressions, control flow, functions, collections and simple I/O.', units: 4, prereqs: [], deptId: 'CS', level: 'lower', qualifiedFaculty: ['F-10510', 'F-10877', 'F-10990'] },
      { id: 'CS 201', title: 'Programming II', description: 'Object-oriented programming in Java, recursion, basic data structures and unit testing.', units: 4, prereqs: ['CS 101'], deptId: 'CS', level: 'lower', qualifiedFaculty: ['F-10510', 'F-10877'] },
      { id: 'CS 210', title: 'Computer Organization', description: 'Number representation, digital logic, assembly language, the memory hierarchy and pipelining.', units: 4, prereqs: ['CS 101'], deptId: 'CS', level: 'lower', qualifiedFaculty: ['F-10702', 'F-10231'] },
      { id: 'CS 250', title: 'Discrete Mathematics', description: 'Logic, proofs, sets, relations, combinatorics and graphs for computer science.', units: 4, prereqs: ['MATH 150'], deptId: 'CS', level: 'lower', qualifiedFaculty: ['F-10422', 'F-10644'] },
      { id: 'CS 310', title: 'Data Structures', description: 'Lists, trees, hash tables, heaps and graphs; algorithm analysis and implementation in C++.', units: 4, prereqs: ['CS 201', 'CS 250'], deptId: 'CS', level: 'upper', qualifiedFaculty: ['F-10231', 'F-10644'] },
      { id: 'CS 320', title: 'Algorithms', description: 'Divide and conquer, dynamic programming, greedy algorithms, graph algorithms and NP-completeness.', units: 4, prereqs: ['CS 310'], deptId: 'CS', level: 'upper', qualifiedFaculty: ['F-10644', 'F-10915'] },
      { id: 'CS 335', title: 'Operating Systems', description: 'Processes and threads, scheduling, synchronization, memory management, file systems and device I/O. Weekly lab in C on a teaching kernel. Letter grade only.', units: 4, prereqs: ['CS 210', 'MATH 150'], deptId: 'CS', level: 'upper', qualifiedFaculty: ['F-10702', 'F-10231'] },
      { id: 'CS 351', title: 'Database Systems', description: 'Relational model, SQL, normalization, transactions, indexing and query processing.', units: 4, prereqs: ['CS 201'], deptId: 'CS', level: 'upper', qualifiedFaculty: ['F-10510', 'F-10990'] },
      { id: 'CS 360', title: 'Computer Networks', description: 'Protocol layering, TCP/IP, routing, congestion control and application protocols.', units: 4, prereqs: ['CS 310'], deptId: 'CS', level: 'upper', qualifiedFaculty: ['F-10915'] },
      { id: 'CS 375', title: 'Software Engineering', description: 'Requirements, design, testing and team project delivery using modern tooling.', units: 4, prereqs: ['CS 310'], deptId: 'CS', level: 'upper', qualifiedFaculty: ['F-10990', 'F-10510'] },
      { id: 'CS 520', title: 'Advanced Operating Systems', description: 'Graduate seminar on distributed and virtualized operating systems research.', units: 4, prereqs: ['CS 335'], deptId: 'CS', level: 'graduate', qualifiedFaculty: ['F-10702'] },
      { id: 'MATH 150', title: 'Calculus I', description: 'Limits, derivatives and applications; introduction to integration.', units: 4, prereqs: [], deptId: 'MATH', level: 'lower', qualifiedFaculty: ['F-10422'] },
      { id: 'MATH 151', title: 'Calculus II', description: 'Techniques of integration, sequences and series, parametric curves.', units: 4, prereqs: ['MATH 150'], deptId: 'MATH', level: 'lower', qualifiedFaculty: ['F-10422'] },
      { id: 'MATH 240', title: 'Linear Algebra', description: 'Vector spaces, linear maps, eigenvalues and applications.', units: 4, prereqs: ['MATH 151'], deptId: 'MATH', level: 'lower', qualifiedFaculty: ['F-10422'] },
      { id: 'MATH 310', title: 'Probability', description: 'Probability spaces, random variables, distributions, expectation and limit theorems.', units: 3, prereqs: ['MATH 151'], deptId: 'MATH', level: 'upper', qualifiedFaculty: ['F-10422'] },
      { id: 'MATH 320', title: 'Numerical Analysis', description: 'Floating point, root finding, interpolation, numerical integration and linear systems.', units: 3, prereqs: ['MATH 240', 'CS 201'], deptId: 'MATH', level: 'upper', qualifiedFaculty: ['F-10422'] },
      { id: 'BIO 101', title: 'Introduction to Biology', description: 'Cells, genetics, evolution and ecology with a weekly laboratory.', units: 3, prereqs: [], deptId: 'BIO', level: 'lower', qualifiedFaculty: ['F-11290', 'F-11302'] },
      { id: 'BIO 220', title: 'Genetics', description: 'Mendelian and molecular genetics, gene regulation and genomics.', units: 4, prereqs: ['BIO 101'], deptId: 'BIO', level: 'lower', qualifiedFaculty: ['F-11302'] },
      { id: 'PHYS 110', title: 'General Physics I', description: 'Mechanics, waves and thermodynamics with laboratory.', units: 4, prereqs: ['MATH 150'], deptId: 'PHYS', level: 'lower', qualifiedFaculty: ['F-11480'] },
      { id: 'ENGL 110', title: 'College Writing', description: 'Expository and argumentative writing across disciplines.', units: 3, prereqs: [], deptId: 'ENGL', level: 'lower', qualifiedFaculty: [] },
      { id: 'HIST 120', title: 'World History since 1500', description: 'Global survey of political, social and economic change since 1500.', units: 3, prereqs: [], deptId: 'HIST', level: 'lower', qualifiedFaculty: [] },
    ],

    offerings: [
      { scheduleNo: '12011', courseId: 'CS 310', term: 'Fall 2026', days: 'MWF', start: '09:00', end: '09:50', location: 'Boelter 3400', instructorId: 'F-10231', capacity: 45 },
      { scheduleNo: '12044', courseId: 'CS 320', term: 'Fall 2026', days: 'TTh', start: '09:30', end: '10:45', location: 'Boelter 5419', instructorId: 'F-10644', capacity: 40 },
      { scheduleNo: '12061', courseId: 'CS 335', term: 'Fall 2026', days: 'MWF', start: '13:00', end: '13:50', location: 'Boelter 3400', instructorId: 'F-10702', capacity: 40 },
      { scheduleNo: '12088', courseId: 'CS 351', term: 'Fall 2026', days: 'MW', start: '16:00', end: '17:15', location: 'Boelter 2444', instructorId: 'F-10510', capacity: 45 },
      { scheduleNo: '12102', courseId: 'CS 360', term: 'Fall 2026', days: 'TTh', start: '12:30', end: '13:45', location: 'Boelter 5249', instructorId: 'F-10915', capacity: 40 },
      { scheduleNo: '12117', courseId: 'CS 375', term: 'Fall 2026', days: 'TTh', start: '15:30', end: '16:45', location: 'Boelter 3760', instructorId: 'F-10990', capacity: 30 },
      { scheduleNo: '12130', courseId: 'CS 201', term: 'Fall 2026', days: 'MWF', start: '11:00', end: '11:50', location: 'Boelter 3760', instructorId: 'F-10877', capacity: 60 },
      { scheduleNo: '12150', courseId: 'CS 520', term: 'Fall 2026', days: 'W', start: '18:00', end: '20:50', location: 'Boelter 4760', instructorId: 'F-10702', capacity: 15 },
      { scheduleNo: '13102', courseId: 'MATH 240', term: 'Fall 2026', days: 'TTh', start: '11:00', end: '12:15', location: 'MS 5200', instructorId: 'F-10422', capacity: 50 },
      { scheduleNo: '13120', courseId: 'MATH 310', term: 'Fall 2026', days: 'TTh', start: '14:00', end: '15:15', location: 'MS 4000A', instructorId: 'F-10422', capacity: 35 },
      { scheduleNo: '13135', courseId: 'MATH 320', term: 'Fall 2026', days: 'MW', start: '13:00', end: '14:15', location: 'MS 5217', instructorId: 'F-10422', capacity: 30 },
      { scheduleNo: '14010', courseId: 'BIO 101', term: 'Fall 2026', days: 'MW', start: '14:00', end: '15:15', location: 'LS 2147', instructorId: 'F-11290', capacity: 120 },
      { scheduleNo: '14032', courseId: 'BIO 220', term: 'Fall 2026', days: 'TTh', start: '09:30', end: '10:45', location: 'LS 2320', instructorId: 'F-11302', capacity: 60 },
      { scheduleNo: '15005', courseId: 'PHYS 110', term: 'Fall 2026', days: 'MWF', start: '10:00', end: '10:50', location: 'PAB 1425', instructorId: 'F-11480', capacity: 80 },
    ],

    registrations: [
      { studentId: '20231847', scheduleNo: '12011', type: 'letter', registeredBy: 'Maria Okafor-Reyes', registeredAt: '2026-09-08T10:15:00' },
      { studentId: '20231847', scheduleNo: '13102', type: 'letter', registeredBy: 'Maria Okafor-Reyes', registeredAt: '2026-09-08T10:19:00' },
      { studentId: '20231847', scheduleNo: '14010', type: 'letter', registeredBy: 'Maria Okafor-Reyes', registeredAt: T },
      { studentId: '20230419', scheduleNo: '12011', type: 'letter', registeredBy: 'Tomás Bravo', registeredAt: '2026-09-09T09:02:00' },
      { studentId: '20230419', scheduleNo: '12130', type: 'letter', registeredBy: 'Tomás Bravo', registeredAt: '2026-09-09T09:05:00' },
      // Filler enrollments so seat counts are realistic
      ...seatFiller('12011', 40), ...seatFiller('12044', 26), ...seatFiller('12061', 38), ...seatFiller('12088', 36),
      ...seatFiller('12102', 22), ...seatFiller('12117', 24), ...seatFiller('12130', 41), ...seatFiller('12150', 9),
      ...seatFiller('13102', 31), ...seatFiller('13120', 13), ...seatFiller('13135', 18), ...seatFiller('14010', 87),
      ...seatFiller('14032', 44), ...seatFiller('15005', 52),
    ],

    students: [
      {
        id: '20231847', firstName: 'Maria', lastName: 'Okafor-Reyes', phone: '(310) 555-0142', address: '1187 Veteran Ave, Apt 3, Los Angeles, CA 90024', dateOfBirth: '2005-03-04', majorId: 'CS-BS', minorId: 'MATH-MIN', graduate: false, standing: "Good standing · Dean's list Spring 2026",
        completed: [
          { courseId: 'CS 210', title: 'Computer Organization', term: 'Spring 2026', units: 4, grade: 'A' },
          { courseId: 'CS 201', title: 'Programming II', term: 'Spring 2026', units: 4, grade: 'A-' },
          { courseId: 'MATH 151', title: 'Calculus II', term: 'Spring 2026', units: 4, grade: 'B+' },
          { courseId: 'ENGL 110', title: 'College Writing', term: 'Spring 2026', units: 3, grade: 'A' },
          { courseId: 'CS 101', title: 'Programming I', term: 'Fall 2025', units: 4, grade: 'A' },
          { courseId: 'MATH 150', title: 'Calculus I', term: 'Fall 2025', units: 4, grade: 'B+' },
          { courseId: 'HIST 120', title: 'World History since 1500', term: 'Fall 2025', units: 3, grade: 'B' },
        ],
        transfer: [
          { courseId: 'MATH 21', title: 'Finite Mathematics', term: 'Spring 2025', units: 4, grade: 'A', university: 'Santa Monica College', location: 'Santa Monica, CA', equivalentCourseId: 'CS 250' },
          { courseId: 'CHEM 11', title: 'General Chemistry I', term: 'Fall 2024', units: 5, grade: 'B+', university: 'Santa Monica College', location: 'Santa Monica, CA', equivalentCourseId: 'CHEM 101' },
          { courseId: 'SPAN 2', title: 'Elementary Spanish II', term: 'Fall 2024', units: 3, grade: 'A', university: 'Santa Monica College', location: 'Santa Monica, CA', equivalentCourseId: 'SPAN 102' },
        ],
        notes: [
          { at: '2026-02-11T09:40:00', byEmployeeId: '41208', category: 'special-need', text: 'Extended-time testing accommodation (1.5x) on file with Disability Services through Spring 2027.' },
          { at: '2026-08-28T11:02:00', byEmployeeId: '30117', category: 'advising', text: 'Approved Fall 2026 outline. CS 250 waived on transfer credit from Santa Monica College (MATH 21). PHYS 110 dropped at student request.' },
          { at: '2026-09-03T16:18:00', byEmployeeId: '30117', category: 'commendation', text: "Dean's list for Spring 2026 (term GPA 3.85). Letter mailed to home address." },
        ],
      },
      {
        id: '20230419', firstName: 'Tomás', lastName: 'Bravo', phone: '(310) 555-0177', address: '520 Landfair Ave, Los Angeles, CA 90024', dateOfBirth: '2004-11-19', majorId: 'CS-BS', graduate: false, standing: 'Good standing',
        completed: [
          { courseId: 'CS 101', title: 'Programming I', term: 'Spring 2026', units: 4, grade: 'B' },
          { courseId: 'MATH 150', title: 'Calculus I', term: 'Spring 2026', units: 4, grade: 'B-' },
        ],
        transfer: [],
        notes: [],
      },
    ],

    majors: [
      { id: 'CS-BS', title: 'Computer Science, B.S.', deptId: 'CS', unitsRequired: 120, majorUnits: 72, requiredCourses: ['CS 101', 'CS 201', 'CS 210', 'CS 250', 'CS 310', 'CS 320', 'CS 335', 'CS 351', 'MATH 150', 'MATH 151', 'MATH 240', 'MATH 310', 'PHYS 110', 'CS 375'], electives: ['CS 360', 'MATH 320', 'CS 520'], advisors: ['30117'] },
      { id: 'UNDECLARED', title: 'Undeclared', deptId: 'UNIV', unitsRequired: 120, majorUnits: 0, requiredCourses: [], electives: [], advisors: ['30117'] },
      { id: 'MATH-MIN', title: 'Mathematics minor', deptId: 'MATH', unitsRequired: 20, majorUnits: 20, requiredCourses: ['MATH 150', 'MATH 151', 'MATH 240'], electives: ['MATH 310', 'MATH 320'], advisors: ['27310'] },
    ],

    outlines: [
      {
        studentId: '20231847', majorId: 'CS-BS', approvedBy: 'Rosa Delgado-Munoz', approvedAt: '2026-08-28T11:02:00',
        entries: [
          { courseId: 'CS 101', status: 'approved', statusDate: '2025-09-02', by: 'Rosa Delgado-Munoz' },
          { courseId: 'CS 201', status: 'approved', statusDate: '2025-09-02', by: 'Rosa Delgado-Munoz' },
          { courseId: 'MATH 150', status: 'approved', statusDate: '2025-09-02', by: 'Rosa Delgado-Munoz' },
          { courseId: 'MATH 151', status: 'approved', statusDate: '2026-01-12', by: 'Rosa Delgado-Munoz' },
          { courseId: 'CS 210', status: 'approved', statusDate: '2026-01-12', by: 'Rosa Delgado-Munoz' },
          { courseId: 'CS 250', status: 'waived', statusDate: '2026-08-28', by: 'Rosa Delgado-Munoz', note: 'Transfer credit · SMC MATH 21' },
          { courseId: 'CS 310', status: 'approved', statusDate: '2026-08-28', by: 'Rosa Delgado-Munoz' },
          { courseId: 'MATH 240', status: 'approved', statusDate: '2026-08-28', by: 'Rosa Delgado-Munoz' },
          { courseId: 'CS 320', status: 'approved', statusDate: '2026-08-28', by: 'Rosa Delgado-Munoz' },
          { courseId: 'CS 335', status: 'approved', statusDate: '2026-08-28', by: 'Rosa Delgado-Munoz' },
          { courseId: 'CS 351', status: 'approved', statusDate: '2026-08-28', by: 'Rosa Delgado-Munoz' },
          { courseId: 'MATH 310', status: 'approved', statusDate: '2026-08-28', by: 'Rosa Delgado-Munoz' },
          { courseId: 'PHYS 110', status: 'dropped', statusDate: '2026-08-28', by: 'Rosa Delgado-Munoz', note: 'Replaced by MATH 310' },
        ],
        history: [
          { at: '2025-09-02T15:20:00', by: 'Rosa Delgado-Munoz', action: 'Outline created with CS 101, CS 201, MATH 150 as Approved' },
          { at: '2026-01-12T10:05:00', by: 'Rosa Delgado-Munoz', action: 'Added MATH 151, CS 210 as Approved' },
          { at: '2026-01-12T10:06:00', by: 'Rosa Delgado-Munoz', action: 'Added CS 250, PHYS 110 as Approved' },
          { at: '2026-08-28T10:58:00', by: 'Rosa Delgado-Munoz', action: 'Added CS 310, MATH 240, CS 320, CS 335, CS 351, MATH 310 as Approved' },
          { at: '2026-08-28T11:01:00', by: 'Rosa Delgado-Munoz', action: 'CS 250 status Approved → Waived (transfer credit)' },
          { at: '2026-08-28T11:02:00', by: 'Rosa Delgado-Munoz', action: 'PHYS 110 status Approved → Dropped' },
          { at: '2026-08-28T11:02:00', by: 'Rosa Delgado-Munoz', action: 'Outline approved' },
        ],
      },
      {
        studentId: '20230419', majorId: 'CS-BS', approvedBy: 'Rosa Delgado-Munoz', approvedAt: '2026-08-30T09:15:00',
        entries: [
          { courseId: 'CS 101', status: 'approved', statusDate: '2026-01-10', by: 'Rosa Delgado-Munoz' },
          { courseId: 'MATH 150', status: 'approved', statusDate: '2026-01-10', by: 'Rosa Delgado-Munoz' },
          { courseId: 'CS 201', status: 'approved', statusDate: '2026-08-30', by: 'Rosa Delgado-Munoz' },
          { courseId: 'CS 310', status: 'approved', statusDate: '2026-08-30', by: 'Rosa Delgado-Munoz' },
        ],
        history: [
          { at: '2026-01-10T13:00:00', by: 'Rosa Delgado-Munoz', action: 'Outline created with CS 101, MATH 150 as Approved' },
          { at: '2026-08-30T09:15:00', by: 'Rosa Delgado-Munoz', action: 'Added CS 201, CS 310 as Approved · outline approved' },
        ],
      },
    ],

    valueLists: VALUE_LISTS,
    helpTopics: HELP,
    gradeNotes: [],
    transactions: [
      { at: '2026-08-28T11:02:00', by: 'Rosa Delgado-Munoz', subsystem: 'MAJOR', text: 'Approved outline for Maria Okafor-Reyes (20231847)' },
      { at: '2026-09-08T10:15:00', by: 'Maria Okafor-Reyes', subsystem: 'REG', text: 'Registered CS 310 (12011)' },
      { at: '2026-09-08T10:19:00', by: 'Maria Okafor-Reyes', subsystem: 'REG', text: 'Registered MATH 240 (13102)' },
      { at: T, by: 'Maria Okafor-Reyes', subsystem: 'REG', text: 'Registered BIO 101 (14010)' },
      { at: '2026-09-15T09:02:00', by: 'Kenji Ibarra-Novak', subsystem: 'FRAMEWORK', text: 'Reset password for Samuel Okonkwo (31855)' },
    ],
  };
}

const FIRST = ['Amara', 'Priya', 'Elijah', 'Wen', 'Samuel', 'Noor', 'Isabel', 'Kwame', 'Hana', 'Diego', 'Lucía', 'Owen', 'Zainab', 'Théo', 'Yara', 'Felix', 'Mei-Ling', 'Arjun', 'Sofia', 'Jonah'];
const LAST = ['Adeyemi-Cole', 'Chandrasekaran', 'Fontaine-Ross', 'Guo', 'Oyelaran', 'Rahimi-Vance', 'Moreno', 'Asante', 'Sato-Lindqvist', 'Paredes', 'Ortega-Ruiz', 'Blackwood', 'Karimi', 'Marchand', 'Haddad', 'Nwosu-Bauer', 'Chen', 'Mehta', 'Petrova', 'Weiss'];

/** Deterministic display name for a synthetic filler student (IDs 2029xxxxx). */
export function fillerName(studentId: string): string {
  const n = parseInt(studentId.slice(-5), 10) || 0;
  return `${FIRST[n % FIRST.length]} ${LAST[Math.floor(n / FIRST.length) % LAST.length]}`;
}

/** Deterministic filler registrations so seat counts look real. Student IDs are synthetic (2029xxxxx). */
function seatFiller(scheduleNo: string, count: number) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = (parseInt(scheduleNo, 10) * 7 + i * 13) % 100000;
    const studentId = `2029${String(n).padStart(5, '0')}`;
    out.push({ studentId, scheduleNo, type: (i % 9 === 4 ? 'crnc' : i % 11 === 6 ? 'audit' : 'letter') as 'letter' | 'crnc' | 'audit', registeredBy: fillerName(studentId), registeredAt: '2026-09-09T12:00:00' });
  }
  return out;
}
