import type { ReactNode } from 'react';
import { useStore } from '../data/store';
import { ALLOWED_DOMAINS } from '../lib/auth';
import { Banner } from './ui';

/** Clerk components styled to the Clean SaaS tokens in global.css. */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#4F46E5',
    colorText: '#0F172A',
    colorTextSecondary: '#64748B',
    colorBackground: '#FFFFFF',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#0F172A',
    colorDanger: '#DC2626',
    colorSuccess: '#065F46',
    colorWarning: '#92400E',
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: '14px',
    borderRadius: '8px',
  },
  elements: {
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: 'none', border: '1px solid #E2E8F0', borderRadius: '8px' },
    card: { boxShadow: 'none', padding: '28px' },
    formButtonPrimary: { height: '40px', fontSize: '13px', fontWeight: 600, textTransform: 'none', boxShadow: 'none' },
    formFieldInput: { height: '36px', borderColor: '#E2E8F0' },
    footer: { background: '#F8FAFC' },
  },
} as const;

export function AuthFrame({ children, below }: { children: ReactNode; below?: ReactNode }) {
  return (
    <div className="login">
      <div className="stack" style={{ width: 420, gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>SignMeUp</div>
          <div className="help" style={{ fontSize: 13, marginTop: 4 }}>University course registration</div>
        </div>
        {children}
        <div className="help" style={{ textAlign: 'center', lineHeight: 1.6 }}>
          Use your <strong>@{ALLOWED_DOMAINS[0]}</strong> email address. Every transaction is recorded with your name, date and time.
          {below}
        </div>
      </div>
    </div>
  );
}

/** Signed in through Clerk with an address outside the allowed domain. */
export function NotAllowed() {
  const { session, signOut } = useStore();
  return (
    <AuthFrame>
      <div className="card">
        <h2 style={{ fontSize: 18 }}>This address cannot use SignMeUp</h2>
        <Banner kind="error">
          <strong>Signed in as {session.email}, which is not an @{ALLOWED_DOMAINS[0]} address.</strong> SignMeUp accepts SDSU addresses only. Sign out, then sign in or create an account with your @{ALLOWED_DOMAINS[0]} email.
        </Banner>
        <button className="btn lg" onClick={signOut}>Sign out</button>
      </div>
    </AuthFrame>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return <div className="login"><div className="help" role="status">{text}</div></div>;
}

export function MissingConfig() {
  return (
    <AuthFrame>
      <div className="card">
        <h2 style={{ fontSize: 18 }}>Sign-in is not configured</h2>
        <Banner kind="error"><strong>VITE_CLERK_PUBLISHABLE_KEY is not set.</strong> Copy .env.example to .env.local and add the Clerk publishable key, then restart the dev server.</Banner>
      </div>
    </AuthFrame>
  );
}
