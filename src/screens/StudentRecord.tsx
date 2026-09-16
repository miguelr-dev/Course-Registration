import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../data/store';
import type { NoteCategory } from '../data/types';
import { Shell, PageHeader, Dot, useToast } from '../components/Shell';
import { Chip, Empty, Tile } from '../components/ui';
import { Search } from '../components/icons';
import { courseOf, currentRegistrations, gpa, offeringOf, unitsRegistered } from '../lib/rules';
import { formatDate, formatDateTime, formatTimeRange, shortName } from '../lib/format';
import { wildcardMatch } from '../lib/wildcard';

const CATEGORY: Record<NoteCategory, { label: string; kind: 'ok' | 'warn' | 'drop' | 'indigo' }> = {
  advising: { label: 'Advising', kind: 'indigo' }, commendation: { label: 'Commendation', kind: 'ok' }, issue: { label: 'Issue', kind: 'drop' }, 'special-need': { label: 'Special need', kind: 'warn' },
};

export default function StudentRecord() {
  const { db, user, appendNote } = useStore();
  const toast = useToast();
  const params = useParams();
  const isStudent = user?.role === 'student';
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(params.studentId ?? null);
  const studentId = isStudent ? user!.studentId! : pickedId ?? db.students[0]?.id;
  const student = db.students.find((s) => s.id === studentId);
  const [tab, setTab] = useState<'here' | 'transfer' | 'current'>('here');
  const [detail, setDetail] = useState(true);
  const [scope, setScope] = useState<'here' | 'all'>('all');
  const [cat, setCat] = useState<NoteCategory>('advising');
  const [text, setText] = useState('');
  const [noteErr, setNoteErr] = useState<string | null>(null);

  const matches = useMemo(() => db.students.filter((s) => wildcardMatch(query, `${s.firstName} ${s.lastName}`) || wildcardMatch(query, s.lastName) || wildcardMatch(query, s.id)), [db.students, query]);

  if (!student) return <Shell helpKey="record" screen="ER · Electronic student record"><PageHeader title="Student record" /><Empty>No student selected.</Empty></Shell>;

  const major = db.majors.find((m) => m.id === student.majorId);
  const minor = db.majors.find((m) => m.id === student.minorId);
  const regs = currentRegistrations(db, student.id);
  const unitsHere = student.completed.reduce((s, c) => s + c.units, 0);
  const unitsTransfer = student.transfer.reduce((s, c) => s + c.units, 0);
  const g = gpa(student);

  function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setNoteErr('Note text is required. Enter at least one sentence describing the issue, commendation or need.');
    appendNote(student!.id, cat, text.trim());
    setText(''); setNoteErr(null);
    toast(`Note appended under employee ${user!.id}`);
  }

  return (
    <Shell helpKey="record" screen="ER · Electronic student record">
      <PageHeader
        title={`${student.firstName}${student.middleName ? ` ${student.middleName}` : ''} ${student.lastName}`}
        meta={<><span>ID {student.id}</span><Dot /><span>{major?.title}{minor ? ` · Minor: ${minor.title.replace(' minor', '')}` : ''}</span><Dot /><span>Born {formatDate(student.dateOfBirth)}</span><Dot /><span>{student.phone}</span><Dot /><span>{student.address}</span></>}
      >
        {!isStudent && (
          <div className="input-wrap no-print" style={{ width: 240 }}><Search /><input className="input" placeholder="Find student (Okafor-*)" value={query} onChange={(e) => setQuery(e.target.value)} list="students" onBlur={() => { const m = db.students.find((s) => s.id === query.trim() || `${s.firstName} ${s.lastName}` === query.trim()); if (m) setPickedId(m.id); }} />
            <datalist id="students">{matches.map((s) => <option key={s.id} value={`${s.firstName} ${s.lastName}`}>{s.id}</option>)}</datalist>
          </div>
        )}
        <button className="btn" onClick={() => window.print()}>Print record</button>
      </PageHeader>

      <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <Tile big={g === null ? '—' : g.toFixed(2)} label="Overall GPA · this university" />
        <Tile big={unitsHere + unitsTransfer} label={`Units completed · ${unitsHere} here, ${unitsTransfer} transfer`} />
        <Tile big={unitsRegistered(db, student.id)} label={`Units in progress · ${db.term}`} />
        <Tile big={student.standing.split(' · ')[0]} label={student.standing.split(' · ')[1] ?? ' '} />
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <div className="tabs no-print">
            <button className={`tab${tab === 'here' ? ' active' : ''}`} onClick={() => setTab('here')}>Completed here ({student.completed.length})</button>
            <button className={`tab${tab === 'transfer' ? ' active' : ''}`} onClick={() => setTab('transfer')}>Transfer ({student.transfer.length})</button>
            <button className={`tab${tab === 'current' ? ' active' : ''}`} onClick={() => setTab('current')}>Current ({regs.length})</button>
          </div>
          <div className="rows">
            {tab === 'here' && <>
              <div className="row head" style={{ gridTemplateColumns: '84px 1fr 100px 48px 56px' }}><span>Course</span><span>Title</span><span>Semester</span><span style={{ textAlign: 'right' }}>Units</span><span style={{ textAlign: 'right' }}>Grade</span></div>
              {student.completed.map((c) => <div key={c.courseId + c.term} className="row" style={{ gridTemplateColumns: '84px 1fr 100px 48px 56px' }}><span className="cid">{c.courseId}</span><span className="title">{c.title}</span><span className="sub">{c.term}</span><span className="num">{c.units}</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{c.grade}</span></div>)}
            </>}
            {tab === 'transfer' && <>
              <div className="row head" style={{ gridTemplateColumns: '84px 1fr 1fr 100px 48px 56px' }}><span>Course</span><span>Title · equivalent here</span><span>University</span><span>Semester</span><span style={{ textAlign: 'right' }}>Units</span><span style={{ textAlign: 'right' }}>Grade</span></div>
              {student.transfer.length === 0 && <Empty>No transfer courses on file.</Empty>}
              {student.transfer.map((c) => <div key={c.courseId} className="row" style={{ gridTemplateColumns: '84px 1fr 1fr 100px 48px 56px' }}><span className="cid">{c.courseId}</span><div><div className="title">{c.title}</div><div className="detail">Equivalent to {c.equivalentCourseId}</div></div><div><div>{c.university}</div><div className="detail">{c.location}</div></div><span className="sub">{c.term}</span><span className="num">{c.units}</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{c.grade}</span></div>)}
            </>}
            {tab === 'current' && <>
              <div className="row head" style={{ gridTemplateColumns: '84px 1fr 150px 48px' }}><span>Course</span><span>Title · instructor</span><span>Days / time</span><span style={{ textAlign: 'right' }}>Units</span></div>
              {regs.length === 0 && <Empty>Not registered this term.</Empty>}
              {regs.map((r) => { const o = offeringOf(db, r.scheduleNo)!; const c = courseOf(db, o.courseId)!; const f = db.faculty.find((x) => x.id === o.instructorId); return <div key={r.scheduleNo} className="row" style={{ gridTemplateColumns: '84px 1fr 150px 48px' }}><span className="cid">{c.id}</span><div><div className="title">{c.title}</div><div className="detail">{f ? shortName(f.name) : '—'} · {r.type === 'letter' ? 'Letter grade' : r.type === 'crnc' ? 'CR / NC' : 'Audit'}</div></div><span className="sub">{o.days} {formatTimeRange(o.start, o.end)}</span><span className="num">{c.units}</span></div>; })}
            </>}
          </div>
          <div className="stamp no-print" style={{ gap: 10 }}>
            <span>Print options:</span>
            <label className="check"><input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} />Include course detail</label>
            <label className="check"><input type="radio" name="scope" checked={scope === 'here'} onChange={() => setScope('here')} />This university only</label>
            <label className="check"><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />All courses</label>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Notes</h2><span className="sub">Append-only · chronological · cannot be deleted</span></div>
          <div className="rows">
            {student.notes.length === 0 && <Empty>No notes on file.</Empty>}
            {[...student.notes].sort((a, b) => b.at.localeCompare(a.at)).map((n) => (
              <div key={n.at + n.byEmployeeId} className="stack" style={{ gap: 6, padding: '14px 20px', borderBottom: '1px solid var(--row-border)' }}>
                <div className="cluster" style={{ gap: 10 }}><Chip kind={CATEGORY[n.category].kind}>{CATEGORY[n.category].label}</Chip><span className="sub right">{formatDateTime(n.at)} · Emp {n.byEmployeeId}</span></div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{n.text}</div>
              </div>
            ))}
          </div>
          {!isStudent && (
            <form className="card-foot no-print" style={{ background: 'var(--surface)' }} onSubmit={submitNote}>
              <div className="field">
                <label className="label" htmlFor="note">Add note <span className="req">*</span></label>
                <textarea id="note" className={`input${noteErr ? ' error' : ''}`} style={{ minHeight: 56 }} placeholder="It will be stamped with your employee ID and the current date and time." value={text} onChange={(e) => { setText(e.target.value); setNoteErr(null); }} />
                {noteErr && <div className="err">{noteErr}</div>}
              </div>
              <div className="cluster">
                <select className="input" style={{ width: 180 }} value={cat} onChange={(e) => setCat(e.target.value as NoteCategory)} aria-label="Category">
                  {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button className="btn" type="submit">Append note</button>
                <button className="btn ghost" type="button" onClick={() => { setText(''); setNoteErr(null); }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Shell>
  );
}
