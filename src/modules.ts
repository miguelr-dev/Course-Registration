import type { ComponentType } from 'react';
import type { Subsystem } from './data/types';

/**
 * The SignMeUp subsystem modules (GEN-15). The framework (App, Shell, the store) knows nothing
 * about individual screens: it reads this list to build the menu, the routes and each user's
 * home screen. To add a module, add an entry here (and its access code to `Subsystem`); to
 * upgrade or replace one, point its routes at different screen files. Each screen is loaded on
 * demand, so modules ship as separate bundles. See docs/ARCHITECTURE.md.
 */
export interface ModuleRoute {
  path: string;
  load: () => Promise<{ default: ComponentType }>;
}

export interface SubsystemModule {
  code: Subsystem; // access area a user needs to open the module
  label: string; // menu label
  home: string; // path the menu item opens
  routes: ModuleRoute[];
}

export const MODULES: SubsystemModule[] = [
  {
    code: 'ER', label: 'Student Record', home: '/record',
    routes: [{ path: '/record', load: () => import('./screens/StudentRecord') }, { path: '/record/:studentId', load: () => import('./screens/StudentRecord') }],
  },
  {
    code: 'REG', label: 'Registration', home: '/',
    routes: [{ path: '/', load: () => import('./screens/Dashboard') }, { path: '/search', load: () => import('./screens/CourseSearch') }, { path: '/schedule', load: () => import('./screens/ClassSchedule') }],
  },
  {
    code: 'MAJOR', label: 'Major Requirements', home: '/outline',
    routes: [{ path: '/outline', load: () => import('./screens/MajorOutline') }, { path: '/outline/:studentId', load: () => import('./screens/MajorOutline') }, { path: '/majors', load: () => import('./screens/Majors') }],
  },
  {
    code: 'FCI', label: 'Faculty & Courses', home: '/faculty',
    routes: [{ path: '/faculty', load: () => import('./screens/FacultyCourses') }],
  },
  {
    code: 'GRADE', label: 'Course Grades', home: '/grades',
    routes: [{ path: '/grades', load: () => import('./screens/GradeEntry') }, { path: '/grades/:scheduleNo', load: () => import('./screens/GradeEntry') }],
  },
  {
    code: 'USERS', label: 'Authorized Users', home: '/users',
    routes: [{ path: '/users', load: () => import('./screens/AuthorizedUsers') }],
  },
];

export const HOME_PATH = Object.fromEntries(MODULES.map((m) => [m.code, m.home])) as Record<Subsystem, string>;
