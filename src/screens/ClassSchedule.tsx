import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import type { Db, Offering } from '../data/types';
import { Shell, PageHeader, Dot, useToast } from '../components/Shell';
import { Banner, Empty, SeatsChip } from '../components/ui';
import { Plus, X } from '../components/icons';
import { useEscapeToCancel, useWarnBeforeLeaving } from '../components/draft';
import { useProgressive } from '../components/progressive';
import { canMaintainCatalog } from '../lib/catalog';
import { courseOf, seatsOpen } from '../lib/rules';
import { enrolled, localToday, registrationClosed, type OfferingField, type TermDates, type TermField } from '../lib/schedule';
import { formatDate, formatTimeRange } from '../lib/format';

const COLS = '96px 1fr 150px 130px 90px 96px';
type Fail<F extends string> = { field: F; reason: string; requirement: string };

/** The schedule of classes for the current term, maintained by department, and the term calendar (REG-01, REG-02, REG-03, REG-13). */
export default function ClassSchedule() {
  const { db, user, saveOffering, removeOffering, saveTerm } = useStore();
  const toast = useToast();
  const canEdit = canMaintainCatalog(user);
  const [dept, setDept] = useState('');
  const [editing, setEditing] = useState<{ offering: Offering; originalNo: string | null } | null>(null);
  const sections = useMemo(() => db.offerings.filter((o) => o.term === db.term && (!dept || courseOf(db, o.courseId)?.deptId === dept)).sort((a, b) => a.courseId.localeCompare(b.courseId) || a.scheduleNo.localeCompare(b.scheduleNo)), [db, dept]);
  const page = useProgressive(sections, dept);
  const nextNo = String(Math.max(10000, ...db.offerings.map((o) => Number(o.scheduleNo) || 0)) + 1);
  const blank: Offering = { scheduleNo: nextNo, courseId: '', term: db.term, days: 'MWF', start: '09:00', end: '09:50', location: '', instructorId: '', capacity: 40 };

  const panel = editing ? (
    <SectionPanel key={editing.originalNo ?? 'new'} db={db} initial={editing.offering} originalNo={editing.originalNo} onClose={() => setEditing(null)}
      onSave={(o) => { const r = saveOffering(o, editing.originalNo); if (r.ok) { toast(`${editing.originalNo ? 'Section updated' : 'Section added'} · recorded under ${user!.name}`); setEditing(null); } return r; }}
      onRemove={editing.originalNo ? () => { const r = removeOffering(editing.originalNo!); if (r.ok) { toast(`Section ${editing.originalNo} cancelled`); setEditing(null); } return r; } : undefined} />
  ) : undefined;

  return (
    <Shell helpKey="schedule" screen="REG · Class schedule" panel={panel}>
      <PageHeader title="Class schedule" meta={<><span>{db.term}</span><Dot /><span>{sections.length} sections{dept ? ` in ${db.departments.find((d) => d.id === dept)?.name}` : ''}</span></>}>
        <Link to="/search" className="btn secondary no-print">Search courses</Link>
        {canEdit && <button className="btn no-print" onClick={() => setEditing({ offering: { ...blank, courseId: '' }, originalNo: null })}><Plus />Add section</button>}
      </PageHeader>

      <TermCard db={db} canEdit={canEdit} onSave={(t) => { const r = saveTerm(t); if (r.ok) toast(`Term calendar saved · recorded under ${user!.name}`); return r; }} />

      <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ width: 260 }}><label className="label" htmlFor="sched-dept">Department</label>
          <select id="sched-dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      </div>

      <div className="card">
        <div className="rows">
          <div className="row head" style={{ gridTemplateColumns: COLS }}><span>Course · sched #</span><span>Title · instructor</span><span>Days / time</span><span>Location</span><span>Seats</span><span></span></div>
          {sections.length === 0 && <Empty>No sections scheduled{dept ? ' in this department' : ''} for {db.term}.</Empty>}
          {page.visible.map((o) => {
            const c = courseOf(db, o.courseId);
            return (
              <div key={o.scheduleNo} className="row" style={{ gridTemplateColumns: COLS }}>
                <div><div className="cid">{o.courseId}</div><div className="detail">{o.scheduleNo}</div></div>
                <div><div className="title">{c?.title ?? '—'}</div><div className="detail">{db.faculty.find((f) => f.id === o.instructorId)?.name ?? '—'} · {c?.units ?? '—'} units</div></div>
                <span>{o.days} {formatTimeRange(o.start, o.end)}</span>
                <span className="sub">{o.location}</span>
                <SeatsChip open={seatsOpen(db, o)} capacity={o.capacity} />
                {canEdit ? <span style={{ textAlign: 'right' }}><button className="btn secondary sm no-print" onClick={() => setEditing({ offering: o, originalNo: o.scheduleNo })}>Edit</button></span> : <span />}
              </div>
            );
          })}
          {page.more}
        </div>
      </div>
    </Shell>
  );
}

/** Registration deadline and grade-entry window for the current term. */
function TermCard({ db, canEdit, onSave }: { db: Db; canEdit: boolean; onSave(t: TermDates): { ok: true } | ({ ok: false } & Fail<string>) }) {
  const stored: TermDates = { registrationCloses: db.registrationCloses, opens: db.gradeWindow.opens, closes: db.gradeWindow.closes };
  const [draft, setDraft] = useState<TermDates>(stored);
  const [err, setErr] = useState<Fail<string> | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const closed = registrationClosed(db);
  const set = (k: TermField, v: string) => { setDraft({ ...draft, [k === 'opens' || k === 'closes' ? k : 'registrationCloses']: v }); if (err?.field === k) setErr(null); };
  const input = (k: TermField, label: string, value: string) => (
    <div className="field"><label className="label" htmlFor={`term-${k}`}>{label}</label>
      <input id={`term-${k}`} type="date" className={`input${err?.field === k ? ' error' : ''}`} value={value} disabled={!canEdit} onChange={(e) => set(k, e.target.value)} /></div>
  );
  return (
    <div className="card">
      <div className="card-head"><div><h2>Term calendar · {db.term}</h2><div className="sub">Registration is {closed ? `closed since ${formatDate(db.registrationCloses)}` : `open until ${formatDate(db.registrationCloses)}`} for students · grade entry {formatDate(db.gradeWindow.opens)} – {formatDate(db.gradeWindow.closes)}</div></div></div>
      <div className="card-body">
        <div className="grid-3">
          {input('registrationCloses', 'Registration closes', draft.registrationCloses)}
          {input('opens', 'Grade entry opens', draft.opens)}
          {input('closes', 'Grade entry closes', draft.closes)}
        </div>
        {closed && <span className="help">After the deadline students can no longer register; the registrar and administrators still can. Today is {formatDate(localToday())}.</span>}
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </div>
      {canEdit && (
        <div className="card-foot"><div className="cluster">
          <button className="btn" disabled={!dirty} onClick={() => { const r = onSave(draft); if (!r.ok) setErr(r); else setErr(null); }}>Save dates</button>
          <button className="btn ghost" disabled={!dirty} onClick={() => { setDraft(stored); setErr(null); }}>Cancel and restore</button>
        </div></div>
      )}
    </div>
  );
}

const DAY_CHOICES = ['MWF', 'MW', 'TTh', 'M', 'T', 'W', 'Th', 'F', 'MTWThF'];

function SectionPanel({ db, initial, originalNo, onClose, onSave, onRemove }: {
  db: Db; initial: Offering; originalNo: string | null; onClose(): void;
  onSave(o: Offering): { ok: true } | ({ ok: false } & Fail<string>);
  onRemove?: () => { ok: true } | ({ ok: false } & Fail<string>);
}) {
  const [draft, setDraft] = useState<Offering>(initial);
  const [err, setErr] = useState<Fail<string> | null>(null);
  useEscapeToCancel(true, onClose);
  useWarnBeforeLeaving(JSON.stringify(draft) !== JSON.stringify(initial));
  const set = <K extends keyof Offering>(k: K, v: Offering[K]) => { setDraft({ ...draft, [k]: v }); if (err?.field === k) setErr(null); };
  const cls = (f: OfferingField) => `input${err?.field === f ? ' error' : ''}`;
  const course = courseOf(db, draft.courseId);
  const qualified = db.faculty.filter((f) => course?.qualifiedFaculty.includes(f.id));
  const taken = originalNo ? enrolled(db, originalNo) : 0;
  function submit(e: FormEvent) { e.preventDefault(); const r = onSave(draft); if (!r.ok) setErr(r); }
  return (
    <aside className="panel" aria-label={originalNo ? 'Edit section' : 'Add section'}>
      <div className="panel-head"><h2>{originalNo ? `Section ${originalNo}` : 'Add section'}</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="sectionform">
        <div className="field"><label className="label" htmlFor="s-no">Schedule number <span className="req">*</span></label>
          <input id="s-no" className={cls('scheduleNo')} value={draft.scheduleNo} disabled={originalNo !== null} inputMode="numeric" onChange={(e) => set('scheduleNo', e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="s-course">Course <span className="req">*</span></label>
          <select id="s-course" className={cls('courseId')} value={draft.courseId} disabled={originalNo !== null && taken > 0} onChange={(e) => setDraft({ ...draft, courseId: e.target.value, instructorId: '' })}>
            <option value="">Choose a course…</option>
            {db.departments.map((d) => { const cs = db.courses.filter((c) => c.deptId === d.id); return cs.length ? <optgroup key={d.id} label={d.name}>{cs.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}</optgroup> : null; })}
          </select>
          {course && <span className="help">{course.units} units · prerequisites: {course.prereqs.join(', ') || 'none'}</span>}</div>
        <div className="field"><label className="label" htmlFor="s-days">Days <span className="req">*</span></label>
          <input id="s-days" className={cls('days')} value={draft.days} list="day-choices" onChange={(e) => set('days', e.target.value)} placeholder="e.g. MWF or TTh" />
          <datalist id="day-choices">{DAY_CHOICES.map((d) => <option key={d} value={d} />)}</datalist></div>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label className="label" htmlFor="s-start">Starts <span className="req">*</span></label><input id="s-start" type="time" className={cls('start')} value={draft.start} onChange={(e) => set('start', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="s-end">Ends <span className="req">*</span></label><input id="s-end" type="time" className={cls('end')} value={draft.end} onChange={(e) => set('end', e.target.value)} /></div>
        </div>
        <div className="field"><label className="label" htmlFor="s-loc">Location <span className="req">*</span></label>
          <input id="s-loc" className={cls('location')} value={draft.location} list="vl-locations" data-list="locations" title="Press F4 or Alt+↓ for the list of values" placeholder="e.g. Boelter 3400" onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="s-inst">Instructor <span className="req">*</span></label>
          <select id="s-inst" className={cls('instructorId')} value={draft.instructorId} disabled={!course} onChange={(e) => set('instructorId', e.target.value)}>
            <option value="">{course ? 'Choose a qualified instructor…' : 'Choose the course first'}</option>
            {qualified.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.positionTitle}</option>)}
          </select></div>
        <div className="field"><label className="label" htmlFor="s-cap">Seats <span className="req">*</span></label>
          <input id="s-cap" type="number" min={1} max={500} className={cls('capacity')} value={Number.isNaN(draft.capacity) ? '' : draft.capacity} onChange={(e) => set('capacity', e.target.value === '' ? NaN : Number(e.target.value))} />
          {originalNo && <span className="help">{taken} registered · {Math.max(0, draft.capacity - taken) || 0} open after saving</span>}</div>
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="sectionform">{originalNo ? 'Save changes' : 'Add section'}</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
        {onRemove && <button className="btn secondary" disabled={taken > 0} title={taken ? 'Only a section with no registrations can be cancelled' : undefined} onClick={() => { if (confirm(`Cancel section ${originalNo}? It is removed from the schedule.`)) { const r = onRemove(); if (!r.ok) setErr(r); } }}>Cancel this section</button>}
      </div>
    </aside>
  );
}
