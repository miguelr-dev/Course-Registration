import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../data/store';
import type { Role, Subsystem, User } from '../data/types';
import { Shell, PageHeader, useToast } from '../components/Shell';
import { Banner, Chip, Empty, Stamp } from '../components/ui';
import { Plus, Search, X } from '../components/icons';
import { useProgressive } from '../components/progressive';
import { ReportsButton } from '../components/Reports';
import { authorizedUsersReport } from '../lib/reports';
import { HelpEditor, ValueListsEditor } from '../components/Settings';
import { formatDateTime } from '../lib/format';
import { wildcardMatch } from '../lib/wildcard';
import { ALLOWED_DOMAINS, STUDENT_ACCESS } from '../lib/auth';
import { passwordIssue, temporaryPassword } from '../lib/passwords';

const AREAS: Subsystem[] = ['ER', 'REG', 'MAJOR', 'FCI', 'GRADE', 'USERS'];
const COLS = '1fr 84px 170px 190px 116px';
const ROLES: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' }, { value: 'faculty', label: 'Faculty' }, { value: 'advisor', label: 'Advisor' },
  { value: 'registrar', label: 'Registrar staff' }, { value: 'admin', label: 'System administrator' },
];
type Fail = { reason: string; requirement: string };

export default function AuthorizedUsers() {
  const { db, user, addUser, updateUser, setPassword, resetDemo, mode: storeMode } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [mode, setMode] = useState<{ kind: 'edit'; id: string } | { kind: 'add' } | null>(null);
  // Framework administration: users, the user-maintained value lists (GEN-11, GEN-12) and the help screens.
  const [params, setParams] = useSearchParams();
  const tab = (['users', 'lists', 'help'] as const).find((t) => t === params.get('tab')) ?? 'users';
  const showTab = (t: 'users' | 'lists' | 'help') => { setMode(null); setParams(t === 'users' ? {} : { tab: t }, { replace: true }); };

  const users = useMemo(() => db.users.filter((u) => (!area || u.access.includes(area as Subsystem)) && (wildcardMatch(q, u.name) || wildcardMatch(q, u.id) || wildcardMatch(q, u.email))), [db.users, q, area]);
  const page = useProgressive(users, `${q}|${area}`);
  const target = mode?.kind === 'edit' ? db.users.find((u) => u.id === mode.id) : undefined;
  const lastChange = [...db.transactions].reverse().find((t) => t.subsystem === 'FRAMEWORK' && /^(Updated|Added|Reset|Initialized)/.test(t.text));
  const shared = storeMode === 'shared';

  const panel = mode?.kind === 'edit' && target
    ? <UserPanel key={target.id} target={target} shared={shared} onClose={() => setMode(null)} last={lastChange}
        onSave={(c) => { const r = updateUser(target.id, c); if (r.ok) { toast(`Saved ${c.name} · recorded under ${user!.name}`); setMode(null); } return r; }}
        onPassword={async (pw) => { const r = await setPassword(target.id, pw); if (r.ok) toast(`Password ${r.created ? 'initialized' : 'reset'} for ${target.name}`); return r; }} />
    : mode?.kind === 'add'
      ? <AddPanel shared={shared} onClose={() => setMode(null)} onAdd={async (u, pw) => {
          const r = addUser(u);
          if (!r.ok) return r;
          setMode(null);
          if (!pw) { toast(`Added ${u.name}`); return r; }
          const p = await setPassword(u.id, pw);
          toast(p.ok ? `Added ${u.name} and initialized the password` : `Added ${u.name}, but the password was not set: ${p.reason}`);
          return r;
        }} />
      : undefined;

  return (
    <Shell helpKey="users" screen="Framework · Authorized users" panel={tab === 'users' ? panel : undefined}>
      <PageHeader title={tab === 'users' ? 'Authorized users' : tab === 'lists' ? 'Value lists' : 'Help screens'} meta={<span>{tab === 'users' ? `${db.users.length} users · passwords are kept by the sign-in service and are never stored, shown or printed here` : tab === 'lists' ? 'Allowed values and validation limits used across SignMeUp · changes apply right away and are recorded under your name' : 'Context-sensitive help shown on each screen · edits are recorded under your name'}</span>}>
        {tab === 'users' && <>
        <button className="btn secondary no-print" onClick={resetDemo} title={shared ? 'Restores the sample university for everyone; your admin account is kept' : 'Restores the sample university in this browser'}>Reset sample data</button>
        <ReportsButton label="Print user report" reports={[{ id: 'users', label: 'Authorized users', params: [{ key: 'area', label: 'Scope', options: [['', 'Whole system'], ...AREAS.map((a): [string, string] => [a, `${a} subsystem`])] }], build: (v) => authorizedUsersReport(db, (v.area || null) as Subsystem | null) }]} />
        <button className="btn" onClick={() => setMode({ kind: 'add' })}><Plus />Add user</button>
        </>}
      </PageHeader>

      <div className="tabs page-tabs no-print" role="tablist">
        {([['users', 'Users'], ['lists', 'Value lists'], ['help', 'Help screens']] as const).map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => showTab(t)}>{l}</button>)}
      </div>

      {tab === 'lists' && <ValueListsEditor />}
      {tab === 'help' && <HelpEditor initialKey={params.get('screen')} />}
      {tab === 'users' && <>
      <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field grow" style={{ minWidth: 200 }}><label className="label" htmlFor="q">Name, email or employee number</label><div className="input-wrap"><Search /><input id="q" className="input" placeholder="Use * as a wildcard, e.g. Delgado-*" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <div className="field" style={{ width: 200 }}><label className="label" htmlFor="area">Access area</label><select id="area" className="input" value={area} onChange={(e) => setArea(e.target.value)}><option value="">All subsystems</option>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
      </div>

      <div className="card">
        <div className="rows">
          <div className="row head" style={{ gridTemplateColumns: COLS }}><span>Name · email</span><span>Emp / student #</span><span>Job title</span><span>Access areas</span><span></span></div>
          {users.length === 0 && <Empty>No users match.</Empty>}
          {page.visible.map((u) => (
            <div key={u.id} className={`row lead-first${target?.id === u.id ? ' selected' : ''}`} style={{ gridTemplateColumns: COLS }}>
              <div><div className="title">{u.name}</div><div className="detail">{u.email} · {u.lastSignIn ? `last sign-in ${formatDateTime(u.lastSignIn)}` : 'never signed in'}</div></div>
              <span className="sub">{u.id}{u.role === 'student' && <><br /><span className="xs">Student</span></>}</span>
              <span>{u.jobTitle}</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{u.access.map((a) => <Chip key={a} kind={a === 'USERS' ? 'indigo' : 'neutral'}><span className="xs">{a}</span></Chip>)}</div>
              <button className="btn secondary sm no-print" onClick={() => setMode({ kind: 'edit', id: u.id })}>Manage user</button>
            </div>
          ))}
          {page.more}
        </div>
        <div className="stamp no-print"><span>{users.length} of {db.users.length} users match · Print user report covers the whole system or one subsystem</span></div>
      </div>
      </>}
    </Shell>
  );
}

function AccessChecks({ value, onChange }: { value: Subsystem[]; onChange(a: Subsystem[]): void }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{AREAS.map((a) => <label key={a} className="check"><input type="checkbox" checked={value.includes(a)} onChange={(e) => onChange(e.target.checked ? [...value, a] : value.filter((x) => x !== a))} />{a}</label>)}</div>;
}

/** Initialize or reset a password (FW-05, FW-07). The value goes to the sign-in service and is cleared from the form afterwards. */
function PasswordFields({ value, onChange, confirm, onConfirm }: { value: string; onChange(v: string): void; confirm: string; onConfirm(v: string): void }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <div className="field"><label className="label" htmlFor="pw">New password</label>
        <div className="cluster" style={{ gap: 6 }}>
          <input id="pw" className="input grow" type={show ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="btn secondary sm" onClick={() => { const t = temporaryPassword(); onChange(t); onConfirm(t); setShow(true); }}>Generate</button>
        </div>
        <span className="help">At least 10 characters with letters and digits. Give it to the user directly; it is not shown again.</span>
      </div>
      <div className="field"><label className="label" htmlFor="pw2">Confirm password</label><input id="pw2" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => onConfirm(e.target.value)} /></div>
    </>
  );
}

function checkPassword(pw: string, confirm: string): Fail | null {
  const issue = passwordIssue(pw);
  if (issue) return issue;
  if (pw !== confirm) return { reason: 'The two passwords do not match.', requirement: 'Type the same password in both fields, or choose Generate.' };
  return null;
}

/** Maintain a user's name, job title, role, access areas and password (FW-04). Nothing changes until Save; Cancel restores. */
function UserPanel({ target, shared, onClose, onSave, onPassword, last }: {
  target: User; shared: boolean; onClose(): void; last?: { text: string; by: string; at: string };
  onSave(c: Pick<User, 'name' | 'jobTitle' | 'role' | 'access'>): { ok: true } | ({ ok: false } & Fail);
  onPassword(pw: string): Promise<{ ok: true; created: boolean } | { ok: false; reason: string }>;
}) {
  const [draft, setDraft] = useState({ name: target.name, jobTitle: target.jobTitle, role: target.role, access: target.access });
  const [err, setErr] = useState<Fail | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = onSave(draft);
    if (!r.ok) setErr(r);
  }
  async function savePassword() {
    const issue = checkPassword(pw, pw2);
    if (issue) return setPwMsg({ kind: 'error', text: `${issue.reason} ${issue.requirement}` });
    setBusy(true);
    const r = await onPassword(pw);
    setBusy(false);
    setPw(''); setPw2('');
    setPwMsg(r.ok ? { kind: 'success', text: r.created ? 'Password initialized. The user can sign in with it now.' : 'Password reset. The user was signed out everywhere and must use the new password.' } : { kind: 'error', text: r.reason });
  }

  return (
    <aside className="panel" aria-label="Manage user">
      <div className="panel-head"><h2>Manage user</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="edituser">
        <div className="kv">
          <span className="k">{target.role === 'student' ? 'Student ID' : 'Employee #'}</span><span>{target.id}</span>
          <span className="k">Signs in as</span><span>{target.email}</span>
          <span className="k">Last sign-in</span><span>{target.lastSignIn ? formatDateTime(target.lastSignIn) : 'Never'}</span>
        </div>
        <div className="field"><label className="label" htmlFor="eu-name">Full name <span className="req">*</span></label><input id="eu-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
        <div className="field"><label className="label" htmlFor="eu-title">Job title <span className="req">*</span></label><input id="eu-title" className="input" list="vl-jobTitles" data-list="jobTitles" title="Press F4 or Alt+↓ for the list of values" value={draft.jobTitle} onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })} /></div>
        <div className="field"><label className="label" htmlFor="eu-role">Role <span className="req">*</span></label><select id="eu-role" className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
        <div className="field"><span className="label">Access areas <span className="req">*</span></span><AccessChecks value={draft.access} onChange={(access) => setDraft({ ...draft, access })} /><span className="help">Changes apply the next time this user opens a screen and are recorded under your name.</span></div>
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}

        <div className="divider" />
        <h3>Password</h3>
        {shared
          ? <PasswordFields value={pw} onChange={(v) => { setPw(v); setPwMsg(null); }} confirm={pw2} onConfirm={(v) => { setPw2(v); setPwMsg(null); }} />
          : <Banner kind="info">Passwords can be set only while connected to the shared database.</Banner>}
        {shared && <div><button type="button" className="btn secondary" disabled={busy || !pw} onClick={savePassword}>{busy ? 'Saving…' : target.lastSignIn ? 'Reset password' : 'Set password'}</button></div>}
        {pwMsg && <Banner kind={pwMsg.kind}>{pwMsg.text}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="edituser">Save changes</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
        {last && <Stamp bare action={`Last: ${last.text}`} by={last.by} at={last.at} />}
      </div>
    </aside>
  );
}

function AddPanel({ shared, onClose, onAdd }: { shared: boolean; onClose(): void; onAdd(u: Omit<User, 'lastSignIn' | 'clerkUserId'>, password: string): Promise<{ ok: true } | ({ ok: false } & Fail)> }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<Role>('faculty');
  const [access, setAccess] = useState<Subsystem[]>(['FCI', 'GRADE']);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<Fail | null>(null);
  const isStudent = role === 'student';

  function chooseRole(r: Role) {
    setRole(r);
    if (r === 'student') { setAccess(STUDENT_ACCESS); if (!jobTitle) setJobTitle('Student'); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!jobTitle.trim()) return setErr({ reason: 'Job title is required.', requirement: 'Enter the user’s position, e.g. Lecturer, Biology.' });
    if (access.length === 0) return setErr({ reason: 'No access areas selected.', requirement: 'Choose at least one subsystem.' });
    if (pw || pw2) { const issue = checkPassword(pw, pw2); if (issue) return setErr(issue); }
    const r = await onAdd({ id: id.trim(), name: name.trim(), email: email.trim(), jobTitle: jobTitle.trim(), role, access }, pw);
    if (!r.ok) setErr(r);
  }
  return (
    <aside className="panel" aria-label="Add user">
      <div className="panel-head"><h2>Add user</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="adduser">
        <div className="field"><label className="label">Role <span className="req">*</span></label><select className="input" value={role} onChange={(e) => chooseRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
        <div className="field"><label className="label">Full name <span className="req">*</span></label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hyphenated names are accepted" /></div>
        <div className="field"><label className="label">{isStudent ? 'Student ID' : 'Employee number'} <span className="req">*</span></label><input className="input" inputMode="numeric" value={id} onChange={(e) => setId(e.target.value)} placeholder={isStudent ? '8 digits' : '5 to 8 digits'} />{isStudent && <span className="help">The account is identified by the student ID and opens that student’s record; a new record is started if none exists.</span>}</div>
        <div className="field"><label className="label">SDSU email <span className="req">*</span></label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${ALLOWED_DOMAINS[0]}`} /><span className="help">The role takes effect the first time this address signs in.</span></div>
        <div className="field"><label className="label">Job title <span className="req">*</span></label><input className="input" list="vl-jobTitles" data-list="jobTitles" title="Press F4 or Alt+↓ for the list of values" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
        <div className="field"><span className="label">Access areas <span className="req">*</span></span><AccessChecks value={access} onChange={setAccess} /></div>
        {shared && <>
          <div className="divider" />
          <h3>Initial password <span className="sub">(optional)</span></h3>
          <PasswordFields value={pw} onChange={setPw} confirm={pw2} onConfirm={setPw2} />
        </>}
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="adduser">Add user</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
      </div>
    </aside>
  );
}
