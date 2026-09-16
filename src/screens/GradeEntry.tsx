import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../data/store';
import { Shell, PageHeader, Dot, useToast } from '../components/Shell';
import { Banner, Empty } from '../components/ui';
import { Clock, Note, Search } from '../components/icons';
import { courseOf, gradeStats, LETTER_GRADES, letterFor } from '../lib/rules';
import { formatDate, formatDateTime, formatTimeRange } from '../lib/format';
import { fillerName } from '../data/seed';
import { wildcardMatch } from '../lib/wildcard';

const COLS = '1.1fr 90px 90px 110px 1.7fr';

export default function GradeEntry() {
  const { db, user, setGrade, addGradeNote } = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const params = useParams();
  const privileged = user?.role === 'admin' || user?.role === 'registrar';
  const mine = db.offerings.filter((o) => o.term === db.term && (privileged || o.instructorId === user?.facultyId));
  const offering = db.offerings.find((o) => o.scheduleNo === params.scheduleNo) ?? mine[0];
  const [q, setQ] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [general, setGeneral] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const windowOpen = today >= db.gradeWindow.opens && today <= db.gradeWindow.closes;
  const canEnter = privileged || windowOpen;

  const regs = useMemo(() => offering ? db.registrations.filter((r) => r.scheduleNo === offering.scheduleNo) : [], [db.registrations, offering]);
  const rows = useMemo(() => regs.map((r) => {
    const s = db.students.find((x) => x.id === r.studentId);
    const name = s ? `${s.firstName} ${s.lastName}` : fillerName(r.studentId);
    return { r, name };
  }).filter((x) => wildcardMatch(q, x.name) || wildcardMatch(q, x.r.studentId)).sort((a, b) => a.name.localeCompare(b.name)), [regs, db.students, q]);

  if (!offering) return <Shell helpKey="grades" screen="GRADE · Grade sheet"><PageHeader title="Course grades" /><Empty>You are not the primary instructor of any course this term.</Empty></Shell>;

  const course = courseOf(db, offering.courseId)!;
  const instructor = db.faculty.find((f) => f.id === offering.instructorId);
  const isPrimary = user?.facultyId === offering.instructorId;
  const stats = gradeStats(regs);
  const notes = db.gradeNotes.filter((n) => n.scheduleNo === offering.scheduleNo);
  const lastGrade = [...db.transactions].reverse().find((t) => t.subsystem === 'GRADE');
  const pct = (n: number) => (stats.registered ? Math.round((n / stats.registered) * 100) : 0);

  function optionsFor(type: string) {
    if (type === 'audit') return ['AU'];
    if (type === 'crnc') return ['CR', 'NC', 'I'];
    return LETTER_GRADES;
  }

  return (
    <Shell helpKey="grades" screen="GRADE · Grade sheet">
      <PageHeader
        title={`${course.id} · ${course.title}`}
        meta={<><span>{db.departments.find((d) => d.id === course.deptId)?.name}</span><Dot /><span>Schedule {offering.scheduleNo}</span><Dot /><span>{offering.days} {formatTimeRange(offering.start, offering.end)} · {offering.location}</span><Dot /><span>Primary instructor {instructor?.name}</span><Dot /><span>{course.units} units</span><Dot /><span>{db.term}</span></>}
      >
        {mine.length > 1 && (
          <select className="input no-print" style={{ width: 220 }} value={offering.scheduleNo} onChange={(e) => nav(`/grades/${e.target.value}`)} aria-label="Course">
            {mine.map((o) => <option key={o.scheduleNo} value={o.scheduleNo}>{o.courseId} · {o.scheduleNo}</option>)}
          </select>
        )}
        <button className="btn" onClick={() => window.print()}>Grade sheet</button>
      </PageHeader>

      {canEnter
        ? <Banner kind="info"><strong>Grade entry is open {formatDate(db.gradeWindow.opens)} – {formatDate(db.gradeWindow.closes)}.</strong> {isPrimary ? 'You are the primary instructor.' : privileged ? 'You hold update privileges; changes you make are recorded under your name.' : ''} After the deadline only users with update privileges can change a grade, and the change is recorded under their name.</Banner>
        : <Banner kind="warn"><strong>Grade entry opens {formatDate(db.gradeWindow.opens)}.</strong> Grades may only be entered at the end of the semester unless you hold special update privileges. You can review the roster and add notes now.</Banner>}

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h2>{regs.length} students</h2><div className="input-wrap no-print" style={{ width: 220 }}><Search /><input className="input sm" placeholder="Find student" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          <div className="rows">
            <div className="row head" style={{ gridTemplateColumns: COLS }}><span>Student</span><span>ID</span><span>Type</span><span>Grade</span><span>Note</span></div>
            {rows.length === 0 && <Empty>No students match.</Empty>}
            {rows.map(({ r, name }) => (
              <div key={r.studentId}>
                <div className="row" style={{ gridTemplateColumns: COLS }}>
                  <span className="title">{name}</span>
                  <span className="sub">{r.studentId}</span>
                  <span className="sub">{r.type === 'letter' ? 'Letter' : r.type === 'crnc' ? 'CR / NC' : 'Audit'}</span>
                  <select className="input sm" style={{ width: 100 }} value={r.grade ?? ''} disabled={!canEnter} aria-label={`Grade for ${name}`} onChange={(e) => { setGrade(offering.scheduleNo, r.studentId, e.target.value); toast(`Grade ${e.target.value || 'cleared'} for ${name}`); }}>
                    <option value="">—</option>
                    {optionsFor(r.type).map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <span className="sub cluster" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {r.gradeNote && <><Note /><span>{r.gradeNote}</span></>}
                    {r.gradeUpdatedBy && <><Clock /><span>Updated by {r.gradeUpdatedBy} · {formatDateTime(r.gradeUpdatedAt!)}</span></>}
                    <button className="btn ghost sm no-print" style={{ height: 24 }} onClick={() => { setNoteFor(noteFor === r.studentId ? null : r.studentId); setNoteText(r.gradeNote ?? ''); }}>{r.gradeNote ? 'Edit note' : 'Add note'}</button>
                  </span>
                </div>
                {noteFor === r.studentId && (
                  <div className="expand no-print" style={{ gridTemplateColumns: '1fr auto', alignItems: 'end', paddingLeft: 20 }}>
                    <div className="field"><label className="label">Note attached to {name}'s grade</label><input className="input" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. Incomplete · extension approved to Jan 15" /></div>
                    <div className="cluster"><button className="btn" onClick={() => { setGrade(offering.scheduleNo, r.studentId, r.grade ?? '', noteText.trim()); setNoteFor(null); toast('Note saved'); }}>Save note</button><button className="btn ghost" onClick={() => setNoteFor(null)}>Cancel and restore</button></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {lastGrade && <div className="stamp"><Clock /><span>{lastGrade.text} by {lastGrade.by} · {formatDateTime(lastGrade.at)}</span></div>}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h2>Course statistics</h2><span className="sub">{stats.registered - regs.filter((r) => r.grade).length} ungraded</span></div>
            <div className="card-body" style={{ gap: 8 }}>
              <Stat l="Registered" v={String(stats.registered)} />
              <Stat l="Completing with a passing grade" v={`${stats.passing} · ${pct(stats.passing)}%`} />
              <Stat l="Average grade" v={stats.average === null ? '—' : `${stats.average.toFixed(2)} · ${letterFor(stats.average)}`} />
              <div className="divider" />
              {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => (
                <div key={g} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 40px', gap: 10, alignItems: 'center', fontSize: 13 }}><span className="strong">{g}</span><div className="bar"><span style={{ width: `${pct(stats.distribution[g])}%` }} /></div><span className="sub" style={{ textAlign: 'right' }}>{pct(stats.distribution[g])}%</span></div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2>General notes</h2><span className="sub">Not tied to a student</span></div>
            <div className="card-body" style={{ gap: 10 }}>
              {notes.length === 0 && <span className="sub">No general notes yet.</span>}
              {notes.map((n) => <div key={n.at} style={{ fontSize: 13, lineHeight: 1.5 }}>{n.text}<div className="sub" style={{ marginTop: 4 }}>{n.by} · {formatDateTime(n.at)}</div></div>)}
              <textarea className="input no-print" style={{ minHeight: 56 }} placeholder="Add a general note" value={general} onChange={(e) => setGeneral(e.target.value)} />
              <div className="no-print"><button className="btn secondary sm" disabled={!general.trim()} onClick={() => { addGradeNote(offering.scheduleNo, general.trim()); setGeneral(''); toast('General note appended'); }}>Append note</button></div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="sub" style={{ fontSize: 13 }}>{l}</span><span className="strong">{v}</span></div>;
}
