import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import type { Db, Major } from '../data/types';
import { Shell, PageHeader, useToast } from '../components/Shell';
import { Banner, Chip, Empty } from '../components/ui';
import { Plus, X } from '../components/icons';
import { useEscapeToCancel, useWarnBeforeLeaving } from '../components/draft';
import { ReportsButton } from '../components/Reports';
import { canMaintainCatalog } from '../lib/catalog';
import { advisorCandidates, type MajorField, type MajorIssue } from '../lib/majors';
import { majorChoices, majorRequirementsReport } from '../lib/reports';
import { courseOf } from '../lib/rules';
import { wildcardMatch } from '../lib/wildcard';

/** Majors and their requirements (MAJ-01, MAJ-02): everyone with MAJOR access can read them; the registrar maintains them. */
export default function Majors() {
  const { db, user, saveMajor } = useStore();
  const toast = useToast();
  const canEdit = canMaintainCatalog(user);
  const [editing, setEditing] = useState<{ major: Major; originalId: string | null } | null>(null);
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? id;
  const blank: Major = { id: '', title: '', deptId: db.departments[0]?.id ?? '', unitsRequired: 120, majorUnits: 48, requiredCourses: [], electives: [], advisors: [] };

  const panel = editing ? (
    <MajorPanel key={editing.originalId ?? 'new'} db={db} initial={editing.major} originalId={editing.originalId} onClose={() => setEditing(null)}
      onSave={(m) => { const r = saveMajor(m, editing.originalId); if (r.ok) { toast(`${editing.originalId ? 'Major updated' : 'Major added'} · recorded under ${user!.name}`); setEditing(null); } return r; }} />
  ) : undefined;

  return (
    <Shell helpKey="majors" screen="MAJOR · Majors and requirements" panel={panel}>
      <PageHeader title="Majors and requirements" meta={<span>{db.majors.length} majors and minors · required courses, electives and advisors</span>}>
        <Link to="/outline" className="btn secondary no-print">Student outlines</Link>
        <ReportsButton reports={[{ id: 'major', label: 'Required courses for a major', params: [{ key: 'major', label: 'Major', options: majorChoices(db) }], build: (v) => majorRequirementsReport(db, v.major) }]} />
        {canEdit && <button className="btn no-print" onClick={() => setEditing({ major: blank, originalId: null })}><Plus />Add major</button>}
      </PageHeader>
      <div className="major-grid">
        {db.majors.map((m) => {
          const units = m.requiredCourses.reduce((n, c) => n + (courseOf(db, c)?.units ?? 0), 0);
          return (
            <div key={m.id} className="card">
              <div className="card-head">
                <div><h2>{m.title}</h2><div className="sub">{m.id} · {deptName(m.deptId)}</div></div>
                {canEdit && <button className="btn secondary sm no-print" onClick={() => setEditing({ major: m, originalId: m.id })}>Edit</button>}
              </div>
              <div className="card-body">
                <div className="kv">
                  <span className="k">Units required</span><span>{m.unitsRequired} · {m.majorUnits} in the major</span>
                  <span className="k">Required</span><span>{m.requiredCourses.length} courses · {units} units</span>
                  <span className="k">Electives</span><span>{m.electives.length} offered</span>
                  <span className="k">Advisors</span><span>{m.advisors.map((id) => db.users.find((u) => u.id === id)?.name ?? id).join(', ') || '—'}</span>
                </div>
                <div className="cluster" style={{ gap: 4, flexWrap: 'wrap' }}>{m.requiredCourses.map((c) => <Chip key={c} kind="indigo">{c}</Chip>)}{m.electives.map((c) => <Chip key={c} kind="neutral">{c}</Chip>)}</div>
              </div>
            </div>
          );
        })}
        {db.majors.length === 0 && <Empty>No majors yet.</Empty>}
      </div>
    </Shell>
  );
}

/** Pick courses from the catalog with a wildcard filter; chosen courses stay listed. */
function CoursePicker({ db, id, value, exclude, onChange, invalid }: { db: Db; id: string; value: string[]; exclude: string[]; onChange(v: string[]): void; invalid: boolean }) {
  const [q, setQ] = useState('');
  const shown = db.courses.filter((c) => !exclude.includes(c.id) && (value.includes(c.id) || !q || wildcardMatch(q, c.id) || wildcardMatch(q, c.title)));
  return (
    <div className={`picker${invalid ? ' error' : ''}`}>
      <input id={id} className="input sm" placeholder="Filter, e.g. CS 3* or Calculus" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="picker-list">
        {shown.map((c) => <label key={c.id} className="check"><input type="checkbox" checked={value.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} />{c.id} · {c.title}</label>)}
        {shown.length === 0 && <span className="sub">No courses match.</span>}
      </div>
    </div>
  );
}

function MajorPanel({ db, initial, originalId, onClose, onSave }: { db: Db; initial: Major; originalId: string | null; onClose(): void; onSave(m: Major): { ok: true } | ({ ok: false } & MajorIssue) }) {
  const [draft, setDraft] = useState<Major>(initial);
  const [err, setErr] = useState<MajorIssue | null>(null);
  useEscapeToCancel(true, onClose);
  useWarnBeforeLeaving(JSON.stringify(draft) !== JSON.stringify(initial));
  const set = <K extends keyof Major>(k: K, v: Major[K]) => { setDraft({ ...draft, [k]: v }); if (err?.field === k) setErr(null); };
  const cls = (f: MajorField) => `input${err?.field === f ? ' error' : ''}`;
  const num = (k: 'unitsRequired' | 'majorUnits', label: string) => (
    <div className="field"><label className="label" htmlFor={`m-${k}`}>{label} <span className="req">*</span></label>
      <input id={`m-${k}`} type="number" min={0} className={cls(k)} value={Number.isNaN(draft[k]) ? '' : draft[k]} onChange={(e) => set(k, e.target.value === '' ? NaN : Number(e.target.value))} /></div>
  );
  function submit(e: FormEvent) { e.preventDefault(); const r = onSave(draft); if (!r.ok) setErr(r); }
  return (
    <aside className="panel" aria-label={originalId ? 'Edit major' : 'Add major'}>
      <div className="panel-head"><h2>{originalId ? `Edit ${originalId}` : 'Add major'}</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="majorform">
        <div className="field"><label className="label" htmlFor="m-id">Major ID <span className="req">*</span></label>
          <input id="m-id" className={cls('id')} value={draft.id} disabled={originalId !== null} placeholder="e.g. BIO-BS or HIST-MIN" onChange={(e) => set('id', e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="m-title">Title <span className="req">*</span></label>
          <input id="m-title" className={cls('title')} value={draft.title} placeholder="e.g. Biology, B.S." onChange={(e) => set('title', e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="m-dept">Department <span className="req">*</span></label>
          <select id="m-dept" className={cls('deptId')} value={draft.deptId} onChange={(e) => set('deptId', e.target.value)}>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{num('unitsRequired', 'Units required')}{num('majorUnits', 'Units in the major')}</div>
        <div className="field"><label className="label" htmlFor="m-req">Required courses ({draft.requiredCourses.length})</label>
          <CoursePicker db={db} id="m-req" value={draft.requiredCourses} exclude={draft.electives} onChange={(v) => set('requiredCourses', v)} invalid={err?.field === 'requiredCourses'} /></div>
        <div className="field"><label className="label" htmlFor="m-elec">Electives within the major ({draft.electives.length})</label>
          <CoursePicker db={db} id="m-elec" value={draft.electives} exclude={draft.requiredCourses} onChange={(v) => set('electives', v)} invalid={err?.field === 'electives'} /></div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Advisors ({draft.advisors.length})</legend>
          <div className="picker-list">{advisorCandidates(db).map((u) => <label key={u.id} className="check"><input type="checkbox" checked={draft.advisors.includes(u.id)} onChange={(e) => set('advisors', e.target.checked ? [...draft.advisors, u.id] : draft.advisors.filter((x) => x !== u.id))} />{u.name} · {u.jobTitle}</label>)}</div>
        </fieldset>
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="majorform">{originalId ? 'Save changes' : 'Add major'}</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
      </div>
    </aside>
  );
}
