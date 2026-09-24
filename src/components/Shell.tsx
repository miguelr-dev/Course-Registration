import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { HELP, SUBSYSTEMS } from './help';
import { Help, Print, SignOut, UserIcon, X } from './icons';
import { Banner } from './ui';

interface ShellCtx { toast(msg: string): void; }
const ShellContext = createContext<ShellCtx>({ toast: () => {} });
export const useToast = () => useContext(ShellContext).toast;

export function Shell({ children, panel, helpKey, screen }: { children: ReactNode; panel?: ReactNode; helpKey: keyof typeof HELP; screen: string }) {
  const { db, user, signOut, mode, syncError, dismissSyncError, lastSaveMs } = useStore();
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const items = SUBSYSTEMS.filter((s) => user?.access.includes(s.code));
  const topic = db.helpTopics?.[helpKey] ?? HELP[helpKey];

  return (
    <ShellContext.Provider value={{ toast: setToast }}>
      <div className="shell">
        <nav className="nav" aria-label="Subsystems">
          <Link to="/" className="wordmark">SignMeUp<small>Course registration</small></Link>
          <div className="nav-list">
            {items.map((s) => (
              <NavLink key={s.code} to={s.path} end={s.path === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-code">{s.code}</span><span>{s.label}</span>
              </NavLink>
            ))}
          </div>
          <div className="nav-user">
            <UserIcon />
            <span className="grow"><span className="name">{user?.name}</span><br />{user?.jobTitle} · {user?.id}</span>
            <button className="btn ghost sm icon" onClick={signOut} title="Sign out" aria-label="Sign out"><SignOut /></button>
          </div>
        </nav>
        <div className={`main${panel ? ' narrow' : ''}`}>
          <HeaderActionsContext.Provider value={{ openHelp: () => setHelp(true) }}>
            {syncError && (
              <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div className="grow"><Banner kind={mode === 'local' ? 'warn' : 'error'}>{syncError}</Banner></div>
                <button className="btn ghost sm icon" onClick={dismissSyncError} aria-label="Dismiss"><X /></button>
              </div>
            )}
            {children}
          </HeaderActionsContext.Provider>
          <div className="foot"><span>{screen}</span><span>SignMeUp · CS 532 prototype{mode === 'shared' ? ` · shared database${lastSaveMs !== null ? ` · last save ${lastSaveMs} ms` : ''}` : mode === 'local' ? ' · local mode' : ''}</span></div>
        </div>
        {panel}
        {help && (
          <div className="overlay" onClick={() => setHelp(false)}>
            <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Help">
              <div className="panel-head"><h2>Help · {topic.title}</h2><button className="btn ghost sm icon" onClick={() => setHelp(false)} aria-label="Close help"><X /></button></div>
              <div className="drawer-body">
                <p>{topic.summary}</p>
                <h3>Fields on this screen</h3>
                <dl>{topic.fields.map(([f, d]) => <><dt key={`${f}-t`}>{f}</dt><dd key={`${f}-d`}>{d}</dd></>)}</dl>
                <h3>Standard controls</h3>
                <p>Help and Print are on every screen. Cancel restores the entries you were changing to how they were before you started. Every completed action is labeled with your name, the date and the time.</p>
              </div>
            </aside>
          </div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </ShellContext.Provider>
  );
}

const HeaderActionsContext = createContext<{ openHelp(): void }>({ openHelp: () => {} });

export function PageHeader({ title, meta, children }: { title: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  const { openHelp } = useContext(HeaderActionsContext);
  return (
    <div className="header">
      <div className="grow">
        <h1>{title}</h1>
        {meta && <div className="meta">{meta}</div>}
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={openHelp}><Help />Help</button>
        <button className="btn secondary" onClick={() => window.print()}><Print />Print</button>
        {children}
      </div>
    </div>
  );
}

export function Dot() { return <span aria-hidden>·</span>; }
