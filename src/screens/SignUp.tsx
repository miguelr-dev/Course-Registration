import { SignUp } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { AuthFrame, Loading, NotAllowed, clerkAppearance } from '../components/auth';

export default function SignUpScreen() {
  const { user, session } = useStore();
  if (!session.ready) return <Loading />;
  if (session.denied) return <NotAllowed />;
  if (user) return <Navigate to="/" replace />;
  if (session.email) return <Loading text="Setting up your account…" />;

  return (
    <AuthFrame below={<><br />Only @sdsu.edu addresses are accepted. New accounts start as students; an administrator can widen access.</>}>
      <SignUp routing="path" path="/sign-up" signInUrl="/login" fallbackRedirectUrl="/" appearance={clerkAppearance} />
    </AuthFrame>
  );
}
