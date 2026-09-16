import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import type { Offering, RegistrationType } from '../data/types';
import { Shell, PageHeader, Dot, useToast } from '../components/Shell';
import { Banner, Chip, Empty, PrereqChip, SeatsChip, Stamp } from '../components/ui';
import { Check, ChevronDown, ChevronUp, Search, X } from '../components/icons';
import { conflicts, courseOf, currentRegistrations, MAX_UNITS, prereqStatus, registrationIssues, seatsOpen, unitsRegistered } from '../lib/rules';
import { formatDate, formatTimeRange, shortName } from '../lib/format';
import { wildcardMatch } from '../lib/wildcard';

const COLS = '84px 1fr 44px 130px 64px 92px';

export default function CourseSearch() {
  const { db, user, register, requestWaiver } = useStore();
  const toast = useToast();
  const student = db.students.find((s) => s.id === user?.studentId);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [type, setType] = useState<RegistrationType>('letter');
  const [note, setNote] = useState('');

  const results = useMemo(() => db.offerings.filter((o) => {
    if (o.term !== db.term) return false;
    const c = courseOf(db, o.courseId);
    if (!c) return false;
    if (dept && c.deptId !== dept) return false;
    if (openOnly && seatsOpen(db, o) === 0) return false;
    if (q.trim() && !(wildcardMatch(q, c.id) || wildcardMatch(q, c.title) || wildcardMatch(q, o.scheduleNo))) return false;
    return true;
  }).sort((a, b) => a.courseId.localeCompare(b.courseId)), [db, q, dept, openOnly]);

  const sel = selected ? db.offerings.find((o) => o.scheduleNo === selected) : undefined;
  const selCourse = sel && courseOf(db, sel.courseId);
  const issues = sel && student ? registrationIssues(db, student, sel) : [];
  const lastReg = [...db.transactions].reverse().find((t) => t.subsystem === 'REG' && t.by === user?.name);

  function cancel() { setSelected(null); setType('letter'); setNote(''); }
  function confirm() {
    if (!sel || !student) return;
    const r = register(student.id, sel.scheduleNo, type);
    if (r.ok) { toast(`Registered ${sel.courseId} · recorded under ${user!.name}`); cancel(); }
  }
  function waiver() {
    if (!sel || !student) return;
    requestWaiver(student.id, sel.courseId, note);
    toast(`Waiver request for ${sel.courseId} sent to your advisor`);
    cancel();
  }

  const panel = sel && selCourse && student ? (
    <aside className="panel" aria-label="Confirm registration">
      <div className="panel-head"><h2>Confirm registration</h2><button className="btn ghost sm icon" onClick={cancel} aria-label="Close"><X /></button></div>
      <div className="panel-body">
        <div>
          <div className="cid" style={{ fontSize: 16 }}>{selCourse.id} · {selCourse.title}</div>
          <div className="detail" style={{ fontSize: 13, marginTop: 4 }}>Schedule {sel.scheduleNo} · {selCourse.units} units · {sel.days} {formatTimeRange(sel.start, sel.end)} · {sel.location} · {instructorName(db, sel)}</div>
        </div>
        {issues.map((i) => <Banner key={i.code + i.reason} kind="error"><strong>{i.reason}</strong> {i.requirement}</Banner>)}
        {issues.length === 0 && <Banner kind="success">All checks pass. Registering adds this course under your name with today's date and time.</Banner>}
        <div className="field">
          <label className="label" htmlFor="rtype">Registration type <span className="req">*</span></label>
          <select id="rtype" className="input" value={type} onChange={(e) => setType(e.target.value as RegistrationType)}>
            <option value="letter">Letter grade</option><option value="crnc">Credit / No credit</option><option value="audit">Audit</option>
          </select>
        </div>
        <div className="kv">
          <span className="k">Units after adding</span><span>{unitsRegistered(db, student.id) + selCourse.units} of {MAX_UNITS}</span>
          <span className="k">Schedule conflicts</span><span>{currentRegistrations(db, student.id).some((r) => { const o = db.offerings.find((x) => x.scheduleNo === r.scheduleNo); return o && conflicts(o, sel); }) ? <Chip kind="drop"><X />Conflict</Chip> : <Chip kind="ok"><Check />None</Chip>}</span>
          <span className="k">Seats</span><span>{seatsOpen(db, sel)} of {sel.capacity} open</span>
        </div>
        {issues.some((i) => i.code === 'prereq') && (
          <div className="field">
            <label className="label" htmlFor="wnote">Note to advisor (optional)</label>
            <textarea id="wnote" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why a waiver is appropriate" />
          </div>
        )}
      </div>
      <div className="panel-foot">
        <button className="btn lg" disabled={issues.length > 0} onClick={confirm}>Register</button>
        {issues.some((i) => i.code === 'prereq') && <button className="btn secondary lg" onClick={waiver}>Request advisor waiver</button>}
        <button className="btn ghost" onClick={cancel}>Cancel and restore</button>
        {lastReg && <Stamp bare action={`Last transaction: ${lastReg.text}`} by={lastReg.by} at={lastReg.at} />}
      </div>
    </aside>
  ) : undefined;

  return (
    <Shell helpKey="search" screen="REG · Course search & registration" panel={panel}>
      <PageHeader title="Search courses" meta={<><span>{db.term}</span><Dot /><span>Registration open until {formatDate(db.registrationCloses)}</span></>} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field grow" style={{ minWidth: 200 }}>
          <label className="label" htmlFor="q">Course ID or title</label>
          <div className="input-wrap"><Search /><input id="q" className="input" placeholder="e.g. CS 3* or Operating" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div className="field" style={{ width: 220 }}>
          <label className="label" htmlFor="dept">Department</label>
          <select id="dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ width: 140 }}>
          <label className="label" htmlFor="term">Term</label>
          <select id="term" className="input" value={db.term} disabled><option>{db.term}</option></select>
        </div>
        <label className="check" style={{ height: 36 }}><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />Seats available only</label>
      </div>

      <div className="card">
        <div className="card-head"><h2>{results.length} {results.length === 1 ? 'course matches' : 'courses match'}</h2><span className="sub">Use * as a wildcard · upper-division courses are limited to declared majors and minors · graduate courses to graduate students</span></div>
        <div className="rows">
          <div className="row head" style={{ gridTemplateColumns: COLS }}><span>Course · sched #</span><span>Title · instructor</span><span style={{ textAlign: 'right' }}>Units</span><span>Days / time · location</span><span>Seats</span><span>Prereqs</span></div>
          {results.length === 0 && <Empty>No offerings match. Clear a filter or widen the wildcard.</Empty>}
          {results.map((o) => {
            const c = courseOf(db, o.courseId)!;
            const pre = student ? prereqStatus(db, student, c) : { met: true, missing: [], inProgress: [] };
            const isOpen = expanded === o.scheduleNo;
            const isSel = selected === o.scheduleNo;
            return (
              <div key={o.scheduleNo}>
                <div className={`row clickable${isSel ? ' selected' : ''}`} style={{ gridTemplateColumns: COLS }} onClick={() => setSelected(o.scheduleNo)}>
                  <div><div className="cid">{c.id}</div><div className="detail">{o.scheduleNo}</div></div>
                  <div>
                    <div className="cluster">
                      <span className="title">{c.title}</span>
                      <button className="btn ghost sm icon" style={{ height: 22 }} aria-label={isOpen ? 'Collapse' : 'Expand'} onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : o.scheduleNo); }}>{isOpen ? <ChevronUp /> : <ChevronDown />}</button>
                    </div>
                    <div className="detail">{instructorName(db, o)}</div>
                  </div>
                  <span className="num">{c.units}</span>
                  <div><div>{o.days} {formatTimeRange(o.start, o.end)}</div><div className="detail">{o.location}</div></div>
                  <SeatsChip open={seatsOpen(db, o)} capacity={o.capacity} />
                  <PrereqChip met={pre.met} short />
                </div>
                {isOpen && (
                  <div className="expand">
                    <div className="stack" style={{ gap: 6 }}><h3>Description</h3><div style={{ fontSize: 13, lineHeight: 1.55 }}>{c.description}</div></div>
                    <div className="stack" style={{ gap: 8 }}>
                      <h3>Prerequisites</h3>
                      {c.prereqs.length === 0 && <span style={{ fontSize: 13 }}>None</span>}
                      {c.prereqs.map((p) => {
                        const done = student?.completed.find((x) => x.courseId === p) ?? student?.transfer.find((x) => x.equivalentCourseId === p);
                        const inProg = pre.inProgress.includes(p);
                        return (
                          <div key={p} className="cluster" style={{ fontSize: 13, gap: 10 }}>
                            {done ? <Chip kind="ok"><Check />Completed</Chip> : inProg ? <Chip kind="warn">In progress</Chip> : <Chip kind="drop"><X />Missing</Chip>}
                            <span>{p} {courseOf(db, p)?.title}{done ? ` · ${done.term} · ${done.grade}` : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

function instructorName(db: ReturnType<typeof useStore>['db'], o: Offering): string {
  const f = db.faculty.find((x) => x.id === o.instructorId);
  return f ? shortName(f.name) : '—';
}
