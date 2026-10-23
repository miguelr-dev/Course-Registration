import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../data/store';
import type { CompletedCourse, Db, NoteCategory, Student, TransferCourse } from '../data/types';
import { Shell, PageHeader, Dot, useToast } from '../components/Shell';
import { Banner, Chip, Empty, Tile } from '../components/ui';
import { Search, X } from '../components/icons';
import { classLevel, graduateStatus } from '../lib/classLevel';
import { courseOf, currentRegistrations, gpa, offeringOf, unitsRegistered } from '../lib/rules';
import { formatDate, formatDateTime, formatTimeRange, shortName } from '../lib/format';
import { wildcardMatch } from '../lib/wildcard';
import { fullName } from '../lib/names';
import { isMinor, LABELS, missingKeyInfo, selfEditableFields, type StudentInfo } from '../lib/student';
import { COMPLETION_GRADES, historyKey, type HistoryField, type HistoryIssue, type HistoryKind } from '../lib/courseHistory';
import { useEscapeToCancel } from '../components/draft';

const CATEGORY: Record<NoteCategory, { label: string; kind: 'ok' | 'warn' | 'drop' | 'indigo' }> = {
  advising: { label: 'Advising', kind: 'indigo' }, commendation: { label: 'Commendation', kind: 'ok' }, issue: { label: 'Issue', kind: 'drop' }, 'special-need': { label: 'Special need', kind: 'warn' },
};

export default function StudentRecord() {
  const { db, user, appendNote, updateStudent, saveCourseHistory } = useStore();
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
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<{ kind: HistoryKind; entry: CompletedCourse | TransferCourse; originalKey: string | null } | null>(null);

  const matches = useMemo(() => db.students.filter((s) => wildcardMatch(query, fullName(s)) || wildcardMatch(query, `${s.firstName} ${s.lastName}`) || wildcardMatch(query, s.lastName) || wildcardMatch(query, s.id)), [db.students, query]);

  if (!student) return <Shell helpKey="record" screen="ER · Electronic student record"><PageHeader title="Student record" /><Empty>No student selected.</Empty></Shell>;

  const major = db.majors.find((m) => m.id === student.majorId);
  const minor = db.majors.find((m) => m.id === student.minorId);
  const regs = currentRegistrations(db, student.id);
  const unitsHere = student.completed.reduce((s, c) => s + c.units, 0);
  const unitsTransfer = student.transfer.reduce((s, c) => s + c.units, 0);
  const g = gpa(student);
  const missing = missingKeyInfo(student);
  const editable: (keyof StudentInfo)[] | null = isStudent ? selfEditableFields(student) : null; // null: every field
  const panel = editing
    ? <EditPanel key={student.id} db={db} student={student} only={editable} onClose={() => setEditing(false)} onSave={(info) => {
        const r = updateStudent(student.id, info);
        if (r.ok) { setEditing(false); toast(`Student information saved · recorded under ${user!.name}`); }
        return r;
      }} />
    : history
      ? <HistoryPanel key={`${student.id}-${history.kind}-${history.originalKey ?? 'new'}`} db={db} kind={history.kind} initial={history.entry} isNew={history.originalKey === null} onClose={() => setHistory(null)} onSave={(entry) => {
          const r = saveCourseHistory(student.id, history.kind, entry, history.originalKey);
          if (r.ok) { setTab(history.kind); toast(`${history.originalKey ? 'Course corrected' : 'Course added'} · recorded under ${user!.name}`); setHistory(null); }
          return r;
        }} />
      : undefined;
  const blankHere: CompletedCourse = { courseId: '', title: '', term: '', units: 0, grade: '' };
  const blankTransfer: TransferCourse = { ...blankHere, university: '', location: '', equivalentCourseId: '' };
  const openHistory = (kind: HistoryKind, entry: CompletedCourse | TransferCourse, originalKey: string | null) => { setEditing(false); setHistory({ kind, entry, originalKey }); };

  function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setNoteErr('Note text is required. Enter at least one sentence describing the issue, commendation or need.');
    appendNote(student!.id, cat, text.trim());
    setText(''); setNoteErr(null);
    toast(`Note appended under employee ${user!.id}`);
  }

  return (
    <Shell helpKey="record" screen="ER · Electronic student record" panel={panel}>
      <PageHeader
        title={fullName(student)}
        meta={<><span>ID {student.id}</span><Dot /><span title={graduateStatus(student)}>{classLevel(student)}</span><Dot /><span>{major?.title}{minor ? ` · Minor: ${minor.title.replace(' minor', '')}` : ''}</span><Dot /><span>Born {formatDate(student.dateOfBirth)}</span><Dot /><span>{student.phone}</span><Dot /><span>{student.address}</span></>}
      >
        {!isStudent && (
          <div className="input-wrap no-print" style={{ width: 240 }}><Search /><input className="input" placeholder="Find student (Okafor-*)" value={query} onChange={(e) => setQuery(e.target.value)} list="students" onBlur={() => { const m = db.students.find((s) => s.id === query.trim() || `${s.firstName} ${s.lastName}` === query.trim()); if (m) setPickedId(m.id); }} />
            <datalist id="students">{matches.map((s) => <option key={s.id} value={`${s.firstName} ${s.lastName}`}>{s.id}</option>)}</datalist>
          </div>
        )}
        <button className="btn secondary no-print" onClick={() => { setHistory(null); setEditing(true); }}>{isStudent ? 'Update contact info' : 'Edit student information'}</button>
        <button className="btn" onClick={() => window.print()}>Print record</button>
      </PageHeader>

      {missing.length > 0 && (
        <Banner kind="warn"><strong>Key student information is incomplete: {missing.map((f) => LABELS[f].toLowerCase()).join(', ')}.</strong> Registration, major outline changes and course history entry are blocked until it is complete. Choose {isStudent ? 'Update contact info' : 'Edit student information'} to complete it.</Banner>
      )}

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
            {!isStudent && tab !== 'current' && (
              <div className="cluster no-print" style={{ padding: '10px 20px', borderBottom: '1px solid var(--row-border)' }}>
                <span className="sub grow">{tab === 'here' ? 'Courses completed at this university' : 'Courses completed at another accredited university'}</span>
                <button className="btn secondary sm" onClick={() => openHistory(tab, tab === 'here' ? blankHere : blankTransfer, null)}>{tab === 'here' ? 'Add completed course' : 'Add transfer course'}</button>
              </div>
            )}
            {tab === 'here' && <>
              <div className="row head" style={{ gridTemplateColumns: `84px 1fr 100px 48px 56px${isStudent ? '' : ' 72px'}` }}><span>Course</span><span>Title</span><span>Semester</span><span style={{ textAlign: 'right' }}>Units</span><span style={{ textAlign: 'right' }}>Grade</span>{!isStudent && <span />}</div>
              {student.completed.length === 0 && <Empty>No completed courses on file.</Empty>}
              {student.completed.map((c) => <div key={c.courseId + c.term} className="row" style={{ gridTemplateColumns: `84px 1fr 100px 48px 56px${isStudent ? '' : ' 72px'}` }}><span className="cid">{c.courseId}</span><span className="title">{c.title}</span><span className="sub">{c.term}</span><span className="num">{c.units}</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{c.grade}</span>{!isStudent && <span style={{ textAlign: 'right' }}><button className="btn ghost sm no-print" onClick={() => openHistory('here', c, historyKey('here', c))}>Correct</button></span>}</div>)}
            </>}
            {tab === 'transfer' && <>
              <div className="row head" style={{ gridTemplateColumns: `84px 1fr 1fr 100px 48px 56px${isStudent ? '' : ' 72px'}` }}><span>Course</span><span>Title · equivalent here</span><span>University</span><span>Semester</span><span style={{ textAlign: 'right' }}>Units</span><span style={{ textAlign: 'right' }}>Grade</span>{!isStudent && <span />}</div>
              {student.transfer.length === 0 && <Empty>No transfer courses on file.</Empty>}
              {student.transfer.map((c) => <div key={historyKey('transfer', c)} className="row" style={{ gridTemplateColumns: `84px 1fr 1fr 100px 48px 56px${isStudent ? '' : ' 72px'}` }}><span className="cid">{c.courseId}</span><div><div className="title">{c.title}</div><div className="detail">{c.equivalentCourseId ? `Equivalent to ${c.equivalentCourseId}` : 'No equivalent course'}</div></div><div><div>{c.university}</div><div className="detail">{c.location}</div></div><span className="sub">{c.term}</span><span className="num">{c.units}</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{c.grade}</span>{!isStudent && <span style={{ textAlign: 'right' }}><button className="btn ghost sm no-print" onClick={() => openHistory('transfer', c, historyKey('transfer', c))}>Correct</button></span>}</div>)}
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
          <div className="card-head"><h2>Notes</h2><span className="sub">Append-only · oldest first · cannot be deleted</span></div>
          <div className="rows">
            {student.notes.length === 0 && <Empty>No notes on file.</Empty>}
            {[...student.notes].sort((a, b) => a.at.localeCompare(b.at)).map((n, i) => (
              <div key={`${n.at}-${n.byEmployeeId}-${i}`} className="stack" style={{ gap: 6, padding: '14px 20px', borderBottom: '1px solid var(--row-border)' }}>
                <div className="cluster" style={{ gap: 10 }}><Chip kind={CATEGORY[n.category].kind}>{CATEGORY[n.category].label}</Chip><span className="sub right">{formatDateTime(n.at)} · Emp {n.byEmployeeId}{authorName(db, n.byEmployeeId) ? ` · ${authorName(db, n.byEmployeeId)}` : ''}</span></div>
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

function authorName(db: Db, employeeId: string): string | undefined {
  return db.users.find((u) => u.id === employeeId)?.name;
}

/** Return to the student information screen to add optional details or change earlier entries (GEN-32). Cancel discards the draft. */
function EditPanel({ db, student, only, onClose, onSave }: {
  db: Db; student: Student; only: (keyof StudentInfo)[] | null; onClose(): void;
  onSave(info: StudentInfo): { ok: true } | { ok: false; field: keyof StudentInfo; reason: string; requirement: string };
}) {
  const [draft, setDraft] = useState<StudentInfo>({
    firstName: student.firstName, middleName: student.middleName ?? '', lastName: student.lastName, phone: student.phone, address: student.address,
    dateOfBirth: student.dateOfBirth, majorId: student.majorId, minorId: student.minorId ?? '', graduate: student.graduate,
  });
  const [err, setErr] = useState<{ field: keyof StudentInfo; reason: string; requirement: string } | null>(null);
  const can = (f: keyof StudentInfo) => !only || only.includes(f);
  const set = <K extends keyof StudentInfo>(k: K, v: StudentInfo[K]) => { setDraft({ ...draft, [k]: v }); if (err?.field === k) setErr(null); };
  const cls = (f: keyof StudentInfo) => `input${err?.field === f ? ' error' : ''}`;
  const text = (f: 'firstName' | 'middleName' | 'lastName' | 'phone' | 'address', required: boolean, placeholder?: string) => (
    <div className="field"><label className="label" htmlFor={`st-${f}`}>{LABELS[f]} {required && <span className="req">*</span>}</label>
      <input id={`st-${f}`} className={cls(f)} value={draft[f] ?? ''} disabled={!can(f)} placeholder={placeholder} onChange={(e) => set(f, e.target.value)} /></div>
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = onSave(draft);
    if (!r.ok) setErr(r);
  }
  return (
    <aside className="panel" aria-label="Edit student information">
      <div className="panel-head"><h2>{only ? 'Update contact info' : 'Student information'}</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="editstudent">
        <div className="kv"><span className="k">Student ID</span><span>{student.id}</span></div>
        {text('firstName', true, 'Hyphenated names are accepted')}
        {text('middleName', false, 'Optional')}
        {text('lastName', true, 'e.g. Okafor-Reyes')}
        {text('phone', true, '(310) 555-0142')}
        {text('address', true, 'Street, city, state ZIP')}
        <div className="field"><label className="label" htmlFor="st-dob">{LABELS.dateOfBirth} <span className="req">*</span></label>
          <input id="st-dob" type="date" className={cls('dateOfBirth')} value={draft.dateOfBirth} disabled={!can('dateOfBirth')} onChange={(e) => set('dateOfBirth', e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="st-major">{LABELS.majorId} <span className="req">*</span></label>
          <select id="st-major" className={cls('majorId')} value={draft.majorId} disabled={!can('majorId')} onChange={(e) => set('majorId', e.target.value)}>
            {db.majors.filter((m) => !isMinor(m.id)).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select></div>
        <div className="field"><label className="label" htmlFor="st-minor">{LABELS.minorId}</label>
          <select id="st-minor" className={cls('minorId')} value={draft.minorId ?? ''} disabled={!can('minorId')} onChange={(e) => set('minorId', e.target.value)}>
            <option value="">None</option>
            {db.majors.filter((m) => isMinor(m.id)).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select></div>
        <label className="check"><input type="checkbox" checked={draft.graduate} disabled={!can('graduate')} onChange={(e) => set('graduate', e.target.checked)} />Accepted into the graduate program</label>
        {only && <span className="help">You can update your telephone and address, and fill in key information that is still missing. The registrar changes the rest of the record.</span>}
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="editstudent">Save changes</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
      </div>
    </aside>
  );
}

/** Add or correct a course completed here or at another university (ER-01, ER-04). Cancel and restore or Esc discards the draft (GEN-33, GEN-34). */
function HistoryPanel({ db, kind, initial, isNew, onClose, onSave }: {
  db: Db; kind: HistoryKind; initial: CompletedCourse | TransferCourse; isNew: boolean; onClose(): void;
  onSave(entry: CompletedCourse | TransferCourse): { ok: true } | ({ ok: false } & HistoryIssue);
}) {
  const [draft, setDraft] = useState<TransferCourse>({ university: '', location: '', equivalentCourseId: '', ...initial } as TransferCourse);
  const [err, setErr] = useState<HistoryIssue | null>(null);
  useEscapeToCancel(true, onClose);
  const set = <K extends keyof TransferCourse>(k: K, v: TransferCourse[K]) => { setDraft({ ...draft, [k]: v }); if (err?.field === k) setErr(null); };
  const cls = (f: HistoryField) => `input${err?.field === f ? ' error' : ''}`;
  const transfer = kind === 'transfer';
  function pickCatalog(id: string) {
    const c = db.courses.find((x) => x.id === id.trim().toUpperCase());
    setDraft({ ...draft, courseId: id, ...(c && !transfer ? { title: c.title, units: c.units } : {}) });
    if (err?.field === 'courseId') setErr(null);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const here: CompletedCourse = { courseId: draft.courseId, title: draft.title, term: draft.term, units: draft.units, grade: draft.grade };
    const r = onSave(transfer ? draft : here);
    if (!r.ok) setErr(r);
  }
  return (
    <aside className="panel" aria-label={transfer ? 'Transfer course' : 'Completed course'}>
      <div className="panel-head"><h2>{isNew ? (transfer ? 'Add transfer course' : 'Add completed course') : `Correct ${initial.courseId}`}</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="historyform">
        {transfer && <>
          <div className="field"><label className="label" htmlFor="h-uni">University <span className="req">*</span></label><input id="h-uni" className={cls('university')} value={draft.university} placeholder="e.g. Santa Monica College" onChange={(e) => set('university', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="h-loc">Location <span className="req">*</span></label><input id="h-loc" className={cls('location')} value={draft.location} placeholder="e.g. Santa Monica, CA" onChange={(e) => set('location', e.target.value)} /></div>
        </>}
        <div className="field"><label className="label" htmlFor="h-id">{transfer ? 'Course ID at that university' : 'Course ID'} <span className="req">*</span></label>
          <input id="h-id" className={cls('courseId')} value={draft.courseId} list={transfer ? undefined : 'history-catalog'} placeholder={transfer ? 'e.g. MATH 21' : 'e.g. CS 101'} onChange={(e) => pickCatalog(e.target.value)} />
          {!transfer && <datalist id="history-catalog">{db.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</datalist>}</div>
        <div className="field"><label className="label" htmlFor="h-title">Course title <span className="req">*</span></label><input id="h-title" className={cls('title')} value={draft.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12 }}>
          <div className="field"><label className="label" htmlFor="h-term">Semester <span className="req">*</span></label><input id="h-term" className={cls('term')} value={draft.term} placeholder="Fall 2025" onChange={(e) => set('term', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="h-units">Units <span className="req">*</span></label><input id="h-units" type="number" min={0} max={12} step={1} className={cls('units')} value={Number.isNaN(draft.units) ? '' : draft.units} onChange={(e) => set('units', e.target.value === '' ? NaN : Number(e.target.value))} /></div>
          <div className="field"><label className="label" htmlFor="h-grade">Grade <span className="req">*</span></label>
            <select id="h-grade" className={cls('grade')} value={draft.grade} onChange={(e) => set('grade', e.target.value)}><option value="">—</option>{COMPLETION_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
        </div>
        {transfer && <div className="field"><label className="label" htmlFor="h-eq">Equivalent course here</label>
          <select id="h-eq" className={cls('equivalentCourseId')} value={draft.equivalentCourseId} onChange={(e) => set('equivalentCourseId', e.target.value)}><option value="">None</option>{db.courses.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}</select></div>}
        {!isNew && <span className="help">Corrections replace the entry and are recorded in the transaction log under your name.</span>}
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="historyform">{isNew ? 'Add course' : 'Save correction'}</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
      </div>
    </aside>
  );
}
