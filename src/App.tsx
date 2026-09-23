import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/react';
import { ui } from '@clerk/ui';
import { StoreProvider, useStore } from './data/store';
import type { Subsystem } from './data/types';
import { Loading, MissingConfig, NotAllowed } from './components/auth';
import Login from './screens/Login';
import SignUpScreen from './screens/SignUp';
import Dashboard from './screens/Dashboard';
import CourseSearch from './screens/CourseSearch';
import StudentRecord from './screens/StudentRecord';
import MajorOutline from './screens/MajorOutline';
import FacultyCourses from './screens/FacultyCourses';
import GradeEntry from './screens/GradeEntry';
import AuthorizedUsers from './screens/AuthorizedUsers';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const HOME_PATH: Record<Subsystem, string> = { REG: '/', ER: '/record', MAJOR: '/outline', FCI: '/faculty', GRADE: '/grades', USERS: '/users' };

/** Clerk's prebuilt UI is bundled (`ui` from @clerk/ui) rather than fetched from its CDN, and Clerk drives its own routes (sign-in steps, password reset) through React Router so the SPA never hard-reloads. */
function ClerkWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY!}
      ui={ui}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/login"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/login"
    >
      {children}
    </ClerkProvider>
  );
}

function Guard({ area, children }: { area: Subsystem; children: ReactNode }) {
  const { user, session } = useStore();
  const loc = useLocation();
  if (!session.ready) return <Loading />;
  if (session.denied) return <NotAllowed />;
  if (!user) return session.email ? <Loading text="Setting up your account…" /> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!user.access.includes(area)) {
    const first = user.access.find((a) => HOME_PATH[a] !== loc.pathname) ?? user.access[0];
    return first ? <Navigate to={HOME_PATH[first]} replace /> : <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function Home() {
  const { user, session } = useStore();
  if (!session.ready) return <Loading />;
  if (session.denied) return <NotAllowed />;
  if (!user) return session.email ? <Loading text="Setting up your account…" /> : <Navigate to="/login" replace />;
  if (user.access.includes('REG')) return <Guard area="REG"><Dashboard /></Guard>;
  const first = user.access.find((a) => a !== 'REG');
  return first ? <Navigate to={HOME_PATH[first]} replace /> : <Navigate to="/login" replace />;
}

export default function App() {
  if (!PUBLISHABLE_KEY) return <MissingConfig />;
  return (
    <BrowserRouter>
      <ClerkWithRouter>
        <StoreProvider>
          <Routes>
            <Route path="/login/*" element={<Login />} />
            <Route path="/sign-up/*" element={<SignUpScreen />} />
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
        </StoreProvider>
      </ClerkWithRouter>
    </BrowserRouter>
  );
}
