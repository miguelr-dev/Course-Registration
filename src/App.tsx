import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { StoreProvider, useStore } from './data/store';
import type { Subsystem } from './data/types';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import CourseSearch from './screens/CourseSearch';
import StudentRecord from './screens/StudentRecord';
import MajorOutline from './screens/MajorOutline';
import FacultyCourses from './screens/FacultyCourses';
import GradeEntry from './screens/GradeEntry';
import AuthorizedUsers from './screens/AuthorizedUsers';
import ChangePassword from './screens/ChangePassword';

const HOME_PATH: Record<Subsystem, string> = { REG: '/', ER: '/record', MAJOR: '/outline', FCI: '/faculty', GRADE: '/grades', USERS: '/users' };

function Guard({ area, children }: { area: Subsystem; children: ReactNode }) {
  const { user } = useStore();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.mustChangePassword && loc.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (!user.access.includes(area)) {
    const first = user.access.find((a) => HOME_PATH[a] !== loc.pathname) ?? user.access[0];
    return first ? <Navigate to={HOME_PATH[first]} replace /> : <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function Home() {
  const { user } = useStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.access.includes('REG')) return <Guard area="REG"><Dashboard /></Guard>;
  const first = user.access.find((a) => a !== 'REG');
  return first ? <Navigate to={HOME_PATH[first]} replace /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Guard area="REG"><CourseSearch /></Guard>} />
          <Route path="/record" element={<Guard area="ER"><StudentRecord /></Guard>} />
          <Route path="/record/:studentId" element={<Guard area="ER"><StudentRecord /></Guard>} />
          <Route path="/outline" element={<Guard area="MAJOR"><MajorOutline /></Guard>} />
          <Route path="/outline/:studentId" element={<Guard area="MAJOR"><MajorOutline /></Guard>} />
          <Route path="/faculty" element={<Guard area="FCI"><FacultyCourses /></Guard>} />
          <Route path="/grades" element={<Guard area="GRADE"><GradeEntry /></Guard>} />
          <Route path="/grades/:scheduleNo" element={<Guard area="GRADE"><GradeEntry /></Guard>} />
          <Route path="/users" element={<Guard area="USERS"><AuthorizedUsers /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
