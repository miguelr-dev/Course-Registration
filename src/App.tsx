import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { ClerkProvider } from '@clerk/react';
import { ui } from '@clerk/ui';
import { StoreProvider, useStore } from './data/store';
import type { Subsystem } from './data/types';
import { Loading, MissingConfig, NotAllowed } from './components/auth';
import Login from './screens/Login';
import SignUpScreen from './screens/SignUp';
import { HOME_PATH, MODULES } from './modules';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

// One lazily loaded screen per module route, created once so React keeps the component identity.
const ROUTES = MODULES.flatMap((m) => m.routes.map((r) => ({ area: m.code, path: r.path, Screen: lazy(r.load) as ComponentType })));

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

/** "/" is the home screen of the module that owns it (REG); users without that area go to their first module instead. */
function Home({ area, children }: { area: Subsystem; children: ReactNode }) {
  const { user, session } = useStore();
  if (!session.ready) return <Loading />;
  if (session.denied) return <NotAllowed />;
  if (!user) return session.email ? <Loading text="Setting up your account…" /> : <Navigate to="/login" replace />;
  if (user.access.includes(area)) return <Guard area={area}>{children}</Guard>;
  const first = user.access.find((a) => HOME_PATH[a] !== '/');
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
            {ROUTES.map(({ area, path, Screen }) => {
              const screen = <Suspense fallback={<Loading />}><Screen /></Suspense>;
              return <Route key={path} path={path} element={path === '/' ? <Home area={area}>{screen}</Home> : <Guard area={area}>{screen}</Guard>} />;
            })}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </StoreProvider>
      </ClerkWithRouter>
    </BrowserRouter>
  );
}
