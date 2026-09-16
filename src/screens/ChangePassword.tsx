import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { FieldError } from '../components/ui';

const RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export default function ChangePassword() {
  const { user, changePassword } = useStore();
  const nav = useNavigate();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<{ reason: string; requirement: string } | null>(null);
  if (!user) return <Navigate to="/login" replace />;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!RULE.test(a)) return setError({ reason: 'New password does not meet the rule.', requirement: 'Use at least 12 characters with a letter, a number and a symbol.' });
    if (a !== b) return setError({ reason: 'The two entries differ.', requirement: 'Type the same new password in both fields.' });
    changePassword(a);
    nav('/', { replace: true });
  }

  return (
    <div className="login">
      <form className="stack" style={{ width: 420, gap: 24 }} onSubmit={submit} noValidate>
        <div className="card">
          <h2 style={{ fontSize: 18 }}>Choose a new password</h2>
          <p className="help">Your password was set by an administrator. Choose your own before continuing, {user.name}.</p>
          <div className="field"><label className="label" htmlFor="a">New password <span className="req">*</span></label><input id="a" type="password" className={`input${error ? ' error' : ''}`} value={a} onChange={(e) => { setA(e.target.value); setError(null); }} autoFocus /></div>
          <div className="field"><label className="label" htmlFor="b">Repeat new password <span className="req">*</span></label><input id="b" type="password" className={`input${error ? ' error' : ''}`} value={b} onChange={(e) => { setB(e.target.value); setError(null); }} />{error && <FieldError reason={error.reason} requirement={error.requirement} />}</div>
          <button className="btn lg" type="submit">Save and continue</button>
        </div>
      </form>
    </div>
  );
}
