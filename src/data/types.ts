export type Subsystem = 'ER' | 'REG' | 'MAJOR' | 'FCI' | 'GRADE' | 'USERS';
export type Role = 'student' | 'faculty' | 'advisor' | 'registrar' | 'admin';
export type OutlineStatus = 'approved' | 'dropped' | 'waived';
export type RegistrationType = 'letter' | 'crnc' | 'audit';
export type NoteCategory = 'advising' | 'commendation' | 'issue' | 'special-need';

export interface User {
  id: string; // student ID or employee number
  name: string;
  jobTitle: string;
  password: string; // prototype only: plain text, never shown
  mustChangePassword: boolean;
  passwordSetAt: string;
  role: Role;
  access: Subsystem[];
  lastSignIn?: string;
  studentId?: string;
  facultyId?: string;
}

export interface Department { id: string; name: string; }

export interface Course {
  id: string; // "CS 310"
  title: string;
  description: string;
  units: number;
  prereqs: string[];
  deptId: string;
  level: 'lower' | 'upper' | 'graduate';
  qualifiedFaculty: string[]; // faculty IDs
}

export interface Offering {
  scheduleNo: string;
  courseId: string;
  term: string;
  days: string; // "MWF"
  start: string; // "09:00"
  end: string; // "09:50"
  location: string;
  instructorId: string;
  capacity: number;
}

export interface Registration {
  studentId: string;
  scheduleNo: string;
  type: RegistrationType;
  registeredBy: string;
  registeredAt: string;
  grade?: string;
  gradeNote?: string;
  gradeUpdatedBy?: string;
  gradeUpdatedAt?: string;
}

export interface CompletedCourse {
  courseId: string;
  title: string;
  term: string;
  units: number;
  grade: string;
}

export interface TransferCourse extends CompletedCourse {
  university: string;
  location: string;
  equivalentCourseId: string;
}

export interface StudentNote {
  at: string;
  byEmployeeId: string;
  category: NoteCategory;
  text: string;
}

export interface Student {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  majorId: string;
  minorId?: string;
  graduate: boolean;
  completed: CompletedCourse[];
  transfer: TransferCourse[];
  notes: StudentNote[];
  standing: string;
}

export interface Faculty {
  id: string;
  name: string;
  positionTitle: string;
  officePhone: string;
  office: string;
  officeHours: string;
  deptId: string;
  teachesIn: string[];
  email: string;
}

export interface Major {
  id: string;
  title: string;
  deptId: string;
  unitsRequired: number;
  majorUnits: number;
  requiredCourses: string[];
  electives: string[];
  advisors: string[]; // employee IDs
}

export interface OutlineEntry {
  courseId: string;
  status: OutlineStatus;
  statusDate: string;
  by: string;
  note?: string;
}

export interface OutlineHistory { at: string; by: string; action: string; }

export interface Outline {
  studentId: string;
  majorId: string;
  approvedBy: string;
  approvedAt: string;
  entries: OutlineEntry[];
  history: OutlineHistory[];
}

export interface GeneralGradeNote { scheduleNo: string; at: string; by: string; text: string; }

export interface Transaction { at: string; by: string; subsystem: Subsystem | 'FRAMEWORK'; text: string; }

export interface Db {
  term: string;
  registrationCloses: string;
  gradeWindow: { opens: string; closes: string };
  users: User[];
  departments: Department[];
  courses: Course[];
  offerings: Offering[];
  registrations: Registration[];
  students: Student[];
  faculty: Faculty[];
  majors: Major[];
  outlines: Outline[];
  gradeNotes: GeneralGradeNote[];
  transactions: Transaction[];
}
