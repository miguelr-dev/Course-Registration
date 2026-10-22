import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { canSwitchRoles, defaultView, describeView, ROLE_ORDER, ROLE_VIEWS } from '../lib/viewAs';
import { Check } from './icons';

/** Bottom-left switcher (FW-09): administrators view SignMeUp as each user type without separate accounts. */
export function RoleSwitcher() {
  const { db, realUser, viewAs, setViewAs } = useStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!canSwitchRoles(realUser)) return null;
  const active = viewAs?.role ?? 'admin';
  const advisors = db.users.filter((u) => u.role === 'advisor' && u.facultyId);

  function choose(role: typeof active, pick?: { studentId?: string; facultyId?: string }) {
    setViewAs(role === 'admin' ? null : { ...defaultView(db, role), ...pick });
    setOpen(false);
    nav('/');
  }

  return (
    <div className="role-switch no-print">
      <button className={`btn ${viewAs ? '' : 'secondary '}sm`} style={{ width: '100%' }} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        {viewAs ? `Viewing as ${ROLE_VIEWS[viewAs.role].label}` : 'View as role…'}
      </button>
      {open && <>
        <div className="role-scrim" onClick={() => setOpen(false)} />
        <div className="role-menu" role="menu" aria-label="View as role">
          <div className="role-menu-head">See SignMeUp as each user type. Your saves are still recorded under {realUser!.name}.</div>
          {ROLE_ORDER.map((r) => (
            <div key={r} className={`role-item${active === r ? ' active' : ''}`}>
              <button role="menuitemradio" aria-checked={active === r} onClick={() => choose(r)}>
                <span className="title">{ROLE_VIEWS[r].label}{r === 'admin' ? ' (you)' : ''}</span>
                <span className="detail">{ROLE_VIEWS[r].summary} · {ROLE_VIEWS[r].access.join(', ')}</span>
                {active === r && <Check />}
              </button>
              {r === 'student' && (
                <select className="input sm" aria-label="Student to view as" value={viewAs?.role === 'student' ? viewAs.studentId : ''} onChange={(e) => choose('student', { studentId: e.target.value })}>
                  <option value="" disabled>Choose student…</option>
                  {db.students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} · {s.id}</option>)}
                </select>
              )}
              {r === 'faculty' && (
                <select className="input sm" aria-label="Instructor to view as" value={viewAs?.role === 'faculty' ? viewAs.facultyId : ''} onChange={(e) => choose('faculty', { facultyId: e.target.value })}>
                  <option value="" disabled>Choose instructor…</option>
                  {db.faculty.map((f) => <option key={f.id} value={f.id}>{f.name} · {db.offerings.filter((o) => o.instructorId === f.id && o.term === db.term).length} sections</option>)}
                </select>
              )}
              {r === 'advisor' && advisors.length > 1 && (
                <select className="input sm" aria-label="Advisor to view as" value={viewAs?.role === 'advisor' ? viewAs.facultyId : ''} onChange={(e) => choose('advisor', { facultyId: e.target.value })}>
                  <option value="" disabled>Choose advisor…</option>
                  {advisors.map((u) => <option key={u.id} value={u.facultyId}>{u.name}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

/** Shown on every screen while an administrator is viewing as another role. */
export function ViewingBanner() {
  const { db, realUser, viewAs, setViewAs } = useStore();
  const nav = useNavigate();
  if (!viewAs || !realUser) return null;
  return (
    <div className="viewing-bar no-print" role="status">
      <span className="grow"><strong>Viewing as {describeView(db, viewAs)}.</strong> Menus and screens match that role; anything you save is recorded under {realUser.name}.</span>
      <button className="btn secondary sm" onClick={() => { setViewAs(null); nav('/'); }}>Return to my account</button>
    </div>
  );
}
