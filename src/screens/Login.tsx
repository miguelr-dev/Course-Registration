import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { FieldError } from '../components/ui';

export default function Login() {
  const { user, signIn, resetDemo, storage, saveError } = useStore();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ field: 'id' | 'password'; reason: string; requirement: string } | null>(null);

  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : loc.state?.from ?? '/'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await signIn(id, password);
    if (r.ok) nav(loc.state?.from ?? '/', { replace: true });
    else setError(r);
  }

  return (
    <div className="login">
      <form className="stack" style={{ width: 420, gap: 24 }} onSubmit={submit} noValidate>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>SignMeUp</div>
          <div className="help" style={{ fontSize: 13, marginTop: 4 }}>University course registration</div>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 18 }}>Sign in</h2>
          <div className="field">
            <label className="label" htmlFor="id">Student or employee ID <span className="req">*</span></label>
            <input id="id" className={`input${error?.field === 'id' ? ' error' : ''}`} inputMode="numeric" autoComplete="username" value={id} onChange={(e) => { setId(e.target.value); setError(null); }} autoFocus />
            {error?.field === 'id' && <FieldError reason={error.reason} requirement={error.requirement} />}
          </div>
          <div className="field">
            <label className="label" htmlFor="pw">Password <span className="req">*</span></label>
            <input id="pw" type="password" className={`input${error?.field === 'password' ? ' error' : ''}`} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
            {error?.field === 'password' && <FieldError reason={error.reason} requirement={error.requirement} />}
          </div>
          <button className="btn lg" type="submit">Sign in</button>
          <div className="help" style={{ textAlign: 'center' }}>Forgot your password? A system administrator can reset it for you.</div>
        </div>
        <div className="help" style={{ textAlign: 'center', lineHeight: 1.6 }}>
          Every transaction is recorded with your name, date and time.<br />
          Prototype accounts (password <code>signmeup</code>): student 20231847 · advisor 30117 · faculty 28804 · administrator 10093.
          {' '}{storage === 'database' ? 'Records are stored in the shared course database.' : 'Records are stored in this browser until a database is connected.'}
          {saveError ? ` ${saveError}` : ''}{' '}
          <button type="button" className="btn ghost sm" style={{ display: 'inline-flex', height: 22 }} onClick={resetDemo}>Reset sample data</button>
        </div>
      </form>
    </div>
  );
}
