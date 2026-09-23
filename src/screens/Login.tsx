import { SignIn } from '@clerk/react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../data/store';
import { AuthFrame, Loading, NotAllowed, clerkAppearance } from '../components/auth';

export default function Login() {
  const { user, session, resetDemo } = useStore();
  const loc = useLocation() as { state?: { from?: string } };

  if (!session.ready) return <Loading />;
  if (session.denied) return <NotAllowed />;
  if (user) return <Navigate to={loc.state?.from ?? '/'} replace />;
  if (session.email) return <Loading text="Setting up your account…" />;

  return (
    <AuthFrame below={<><br />New here? Create an account with your SDSU email; it starts with student access.{' '}<button type="button" className="btn ghost sm" style={{ display: 'inline-flex', height: 22 }} onClick={resetDemo}>Reset sample data</button></>}>
      <SignIn routing="path" path="/login" signUpUrl="/sign-up" fallbackRedirectUrl={loc.state?.from ?? '/'} appearance={clerkAppearance} />
    </AuthFrame>
  );
}
