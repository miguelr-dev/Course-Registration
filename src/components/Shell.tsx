import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Link, matchPath, useLocation } from 'react-router-dom';
import { RoleSwitcher, ViewingBanner } from './RoleSwitcher';
import { ValueListPicker } from './ValueListPicker';
import { useStore } from '../data/store';
import { MODULES } from '../modules';
import { FloatingWindow, openInNewWindow } from './FloatingWindow';
import { HELP } from './help';
import { Help, Menu, NewWindow, Print, SignOut, UserIcon, X } from './icons';
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
  const [menu, setMenu] = useState(false); // phones and tablets: the subsystem menu folds into the top bar
  const { pathname } = useLocation();
  useEffect(() => { setMenu(false); }, [pathname]);
  useEscapeToCancel(help, () => setHelp(false));
  useEscapeToCancel(menu, () => setMenu(false));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const items = MODULES.filter((m) => user?.access.includes(m.code));
  // Built-in help, unless an administrator edited this screen's topic (older stored copies without an edit stamp are ignored).
  const edited = db.helpTopics?.[helpKey];
  const topic = edited?.editedAt ? edited : HELP[helpKey];

  return (
    <ShellContext.Provider value={{ toast: setToast }}>
      <div className="shell">
        <nav className={`nav${menu ? ' open' : ''}`} aria-label="Subsystems">
          <Link to="/" className="wordmark">SignMeUp<small>Course registration</small></Link>
          <button className="btn secondary sm nav-toggle" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="nav-menu">{menu ? <X /> : <Menu />}{menu ? 'Close' : 'Menu'}</button>
          <div className="nav-list" id="nav-menu">
            {items.map((m) => (
              <NavLink key={m.code} to={m.home} end={m.home === '/'} className={() => `nav-item${m.routes.some((r) => matchPath(r.path, pathname)) ? ' active' : ''}`}>
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
                <h3 className="hide-small">Windows</h3>
                <p className="show-small">On a phone, help opens as a sheet over the screen; close it with ✕ when you are done. Use Menu at the top to move between screens.</p>
                <p className="hide-small">This help window stays open while you work: drag its title bar to move it and its lower-right corner to resize it. New window opens the current screen in a separate browser window, so you can keep several screens side by side; changes saved in one window appear in the others.</p>
                <h3>Fields on this screen</h3>
                <dl>{topic.fields.map(([f, d]) => <><dt key={`${f}-t`}>{f}</dt><dd key={`${f}-d`}>{d}</dd></>)}</dl>
                <h3>Standard controls</h3>
                <p>Help and Print are on every screen. You can cancel any action before you complete it: choose Cancel and restore, close the panel, or press Esc. Every entry you made during that action is put back to how it was before you started, and nothing is recorded. In fields with a list of values (job title, building, university, semester…), press F4 or Alt+↓ to pick from the list. Every completed action is labeled with your name, the date and the time.</p>
                {user?.access.includes('USERS') && <p className="no-print"><Link to={`/users?tab=help&screen=${helpKey}`} onClick={() => setHelp(false)}>Edit this help</Link> · administrators can change the text shown here.</p>}
              </div>
          </FloatingWindow>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
        <ValueListPicker />
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
        <button className="btn secondary icon no-print hide-small" onClick={() => openInNewWindow()} title="Open this screen in a new window" aria-label="Open this screen in a new window"><NewWindow /></button>
        {children}
      </div>
    </div>
  );
}

export function Dot() { return <span aria-hidden>·</span>; }
