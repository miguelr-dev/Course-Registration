import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { RoleSwitcher, ViewingBanner } from './RoleSwitcher';
import { useStore } from '../data/store';
import { MODULES } from '../modules';
import { FloatingWindow, openInNewWindow } from './FloatingWindow';
import { HELP } from './help';
import { Help, NewWindow, Print, SignOut, UserIcon, X } from './icons';
import { Banner } from './ui';
import { useEscapeToCancel } from './draft';
import { saveTimeLabel } from '../lib/performance';

interface ShellCtx { toast(msg: string): void; }
const ShellContext = createContext<ShellCtx>({ toast: () => {} });
export const useToast = () => useContext(ShellContext).toast;

export function Shell({ children, panel, helpKey, screen }: { children: ReactNode; panel?: ReactNode; helpKey: keyof typeof HELP; screen: string }) {
  const { db, user, signOut, mode, syncError, dismissSyncError, lastSaveMs } = useStore();
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEscapeToCancel(help, () => setHelp(false));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const items = MODULES.filter((m) => user?.access.includes(m.code));
  const topic = db.helpTopics?.[helpKey] ?? HELP[helpKey];

  return (
    <ShellContext.Provider value={{ toast: setToast }}>
      <div className="shell">
        <nav className="nav" aria-label="Subsystems">
          <Link to="/" className="wordmark">SignMeUp<small>Course registration</small></Link>
          <div className="nav-list">
            {items.map((m) => (
              <NavLink key={m.code} to={m.home} end={m.home === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-code">{m.code}</span><span>{m.label}</span>
              </NavLink>
            ))}
          </div>
          <RoleSwitcher />
          <div className="nav-user">
            <UserIcon />
            <span className="grow"><span className="name">{user?.name}</span><br />{user?.jobTitle} · {user?.id}</span>
            <button className="btn ghost sm icon" onClick={signOut} title="Sign out" aria-label="Sign out"><SignOut /></button>
          </div>
        </nav>
        <div className={`main${panel ? ' narrow' : ''}`}>
          <HeaderActionsContext.Provider value={{ openHelp: () => setHelp(true) }}>
            <ViewingBanner />
            {syncError && (
              <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div className="grow"><Banner kind={mode === 'local' ? 'warn' : 'error'}>{syncError}</Banner></div>
                <button className="btn ghost sm icon" onClick={dismissSyncError} aria-label="Dismiss"><X /></button>
              </div>
            )}
            {children}
          </HeaderActionsContext.Provider>
          <div className="foot"><span>{screen}</span><span>SignMeUp · CS 532 prototype{mode === 'shared' ? ` · shared database${lastSaveMs !== null ? ` · ${saveTimeLabel(lastSaveMs)}` : ''}` : mode === 'local' ? ' · local mode' : ''}</span></div>
        </div>
        {panel}
        {help && (
          <FloatingWindow id="help" title={`Help · ${topic.title}`} onClose={() => setHelp(false)}>
              <div className="drawer-body">
                <p>{topic.summary}</p>
                <h3>Windows</h3>
                <p>This help window stays open while you work: drag its title bar to move it and its lower-right corner to resize it. New window opens the current screen in a separate browser window, so you can keep several screens side by side; changes saved in one window appear in the others.</p>
                <h3>Fields on this screen</h3>
                <dl>{topic.fields.map(([f, d]) => <><dt key={`${f}-t`}>{f}</dt><dd key={`${f}-d`}>{d}</dd></>)}</dl>
                <h3>Standard controls</h3>
                <p>Help and Print are on every screen. You can cancel any action before you complete it: choose Cancel and restore, close the panel, or press Esc. Every entry you made during that action is put back to how it was before you started, and nothing is recorded. Every completed action is labeled with your name, the date and the time.</p>
              </div>
          </FloatingWindow>
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
        <button className="btn secondary icon no-print" onClick={() => openInNewWindow()} title="Open this screen in a new window" aria-label="Open this screen in a new window"><NewWindow /></button>
        {children}
      </div>
    </div>
  );
}

export function Dot() { return <span aria-hidden>·</span>; }
