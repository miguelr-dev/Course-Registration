import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import type { Role, Subsystem, User } from '../data/types';
import { Shell, PageHeader, useToast } from '../components/Shell';
import { Banner, Chip, Empty, Stamp } from '../components/ui';
import { Plus, Search, X } from '../components/icons';
import { formatDateTime } from '../lib/format';
import { wildcardMatch } from '../lib/wildcard';
import { ALLOWED_DOMAINS } from '../lib/auth';

const AREAS: Subsystem[] = ['ER', 'REG', 'MAJOR', 'FCI', 'GRADE', 'USERS'];
const COLS = '1fr 64px 170px 190px 116px';

export default function AuthorizedUsers() {
  const { db, user, addUser, updateUserAccess } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [scope, setScope] = useState<'all' | Subsystem>('all');
  const [mode, setMode] = useState<{ kind: 'access'; id: string } | { kind: 'add' } | null>(null);

  const users = useMemo(() => db.users.filter((u) => (!area || u.access.includes(area as Subsystem)) && (wildcardMatch(q, u.name) || wildcardMatch(q, u.id) || wildcardMatch(q, u.email))), [db.users, q, area]);
  const target = mode?.kind === 'access' ? db.users.find((u) => u.id === mode.id) : undefined;
  const lastChange = [...db.transactions].reverse().find((t) => t.subsystem === 'FRAMEWORK' && /Updated access|Added user/.test(t.text));

  const panel = mode?.kind === 'access' && target
    ? <AccessPanel target={target} onClose={() => setMode(null)} onAccess={(a) => { updateUserAccess(target.id, a); toast(`Access updated for ${target.name} · recorded under ${user!.name}`); }} last={lastChange} />
    : mode?.kind === 'add'
      ? <AddPanel onClose={() => setMode(null)} onAdd={(u) => { const r = addUser(u); if (r.ok) { toast(`Added ${u.name}`); setMode(null); } return r; }} />
      : undefined;

  return (
    <Shell helpKey="users" screen="Framework · Authorized users" panel={panel}>
      <PageHeader title="Authorized users" meta={<span>{db.users.length} users · sign-in and passwords are handled by Clerk; passwords are never stored, shown or printed</span>}>
        <button className="btn secondary" onClick={() => window.print()}>Print user report</button>
        <button className="btn" onClick={() => setMode({ kind: 'add' })}><Plus />Add user</button>
      </PageHeader>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field grow" style={{ minWidth: 200 }}><label className="label" htmlFor="q">Name, email or employee number</label><div className="input-wrap"><Search /><input id="q" className="input" placeholder="Use * as a wildcard, e.g. Delgado-*" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <div className="field" style={{ width: 200 }}><label className="label" htmlFor="area">Access area</label><select id="area" className="input" value={area} onChange={(e) => setArea(e.target.value)}><option value="">All subsystems</option>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
      </div>

      <div className="card">
        <div className="rows">
          <div className="row head" style={{ gridTemplateColumns: COLS }}><span>Name · email</span><span>Emp #</span><span>Job title</span><span>Access areas</span><span></span></div>
          {users.length === 0 && <Empty>No users match.</Empty>}
          {users.map((u) => (
            <div key={u.id} className={`row${target?.id === u.id ? ' selected' : ''}`} style={{ gridTemplateColumns: COLS }}>
              <div><div className="title">{u.name}</div><div className="detail">{u.email} · {u.lastSignIn ? `last sign-in ${formatDateTime(u.lastSignIn)}` : 'never signed in'}</div></div>
              <span className="sub">{u.id}</span>
              <span>{u.jobTitle}</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{u.access.map((a) => <Chip key={a} kind={a === 'USERS' ? 'indigo' : 'neutral'}><span className="xs">{a}</span></Chip>)}</div>
              <button className="btn secondary sm no-print" onClick={() => setMode({ kind: 'access', id: u.id })}>Manage access</button>
            </div>
          ))}
        </div>
        <div className="stamp" style={{ gap: 10 }}>
          <span>Showing {users.length} of {db.users.length}</span>
          <span className="right">Report scope:</span>
          <select className="input sm no-print" style={{ width: 160 }} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} aria-label="Report scope"><option value="all">Whole system</option>{AREAS.map((a) => <option key={a} value={a}>{a} only</option>)}</select>
        </div>
      </div>
    </Shell>
  );
}

function AccessPanel({ target, onClose, onAccess, last }: { target: User; onClose(): void; onAccess(a: Subsystem[]): void; last?: { text: string; by: string; at: string } }) {
  return (
    <aside className="panel" aria-label="Manage access">
      <div className="panel-head"><h2>Manage access</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <div className="panel-body">
        <div><div className="title" style={{ fontSize: 16 }}>{target.name}</div><div className="detail" style={{ fontSize: 13, marginTop: 4 }}>{target.id} · {target.jobTitle}</div></div>
        <div className="kv">
          <span className="k">Signs in as</span><span>{target.email}</span>
          <span className="k">Last sign-in</span><span>{target.lastSignIn ? formatDateTime(target.lastSignIn) : 'Never'}</span>
          <span className="k">Role</span><span style={{ textTransform: 'capitalize' }}>{target.role}</span>
        </div>
        <div className="field">
          <span className="label">Access areas <span className="req">*</span></span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{AREAS.map((a) => <label key={a} className="check"><input type="checkbox" checked={target.access.includes(a)} onChange={(e) => onAccess(e.target.checked ? [...target.access, a] : target.access.filter((x) => x !== a))} />{a}</label>)}</div>
          <span className="help">Changes apply the next time this user opens a screen and are recorded under your name.</span>
        </div>
        <Banner kind="info">Passwords are managed by the sign-in service. To reset one, the user chooses “Forgot password” on the sign-in page; nothing is stored or shown here.</Banner>
      </div>
      <div className="panel-foot">
        <button className="btn secondary" onClick={onClose}>Done</button>
        {last && <Stamp bare action={`Last: ${last.text}`} by={last.by} at={last.at} />}
      </div>
    </aside>
  );
}

function AddPanel({ onClose, onAdd }: { onClose(): void; onAdd(u: Omit<User, 'lastSignIn' | 'clerkUserId'>): { ok: true } | { ok: false; reason: string; requirement: string } }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<Role>('faculty');
  const [access, setAccess] = useState<Subsystem[]>(['FCI', 'GRADE']);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<{ reason: string; requirement: string } | null>(null);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!jobTitle.trim()) return setErr({ reason: 'Job title is required.', requirement: 'Enter the user’s position, e.g. Lecturer, Biology.' });
    if (access.length === 0) return setErr({ reason: 'No access areas selected.', requirement: 'Choose at least one subsystem.' });
    const r = onAdd({ id: id.trim(), name: name.trim(), email: email.trim(), jobTitle: jobTitle.trim(), role, access });
    if (!r.ok) setErr(r);
  }
  return (
    <aside className="panel" aria-label="Add user">
      <div className="panel-head"><h2>Add user</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="adduser">
        <div className="field"><label className="label">Full name <span className="req">*</span></label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hyphenated names are accepted" /></div>
        <div className="field"><label className="label">Employee number <span className="req">*</span></label><input className="input" inputMode="numeric" value={id} onChange={(e) => setId(e.target.value)} placeholder="5 to 8 digits" /></div>
        <div className="field"><label className="label">SDSU email <span className="req">*</span></label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${ALLOWED_DOMAINS[0]}`} /><span className="help">The role takes effect the first time this address signs in.</span></div>
        <div className="field"><label className="label">Job title <span className="req">*</span></label><input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
        <div className="field"><label className="label">Role <span className="req">*</span></label><select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="student">Student</option><option value="faculty">Faculty</option><option value="advisor">Advisor</option><option value="registrar">Registrar staff</option><option value="admin">System administrator</option></select></div>
        <div className="field"><span className="label">Access areas <span className="req">*</span></span><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{AREAS.map((a) => <label key={a} className="check"><input type="checkbox" checked={access.includes(a)} onChange={(e) => setAccess(e.target.checked ? [...access, a] : access.filter((x) => x !== a))} />{a}</label>)}</div></div>
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="adduser">Add user</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
      </div>
    </aside>
  );
}
