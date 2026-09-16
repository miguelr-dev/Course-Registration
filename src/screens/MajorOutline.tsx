import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../data/store';
import type { OutlineStatus } from '../data/types';
import { Shell, PageHeader, Dot, useToast } from '../components/Shell';
import { Empty, Progress, StatusChip } from '../components/ui';
import { Plus } from '../components/icons';
import { completedCourseIds, courseOf, currentRegistrations, offeringOf } from '../lib/rules';
import { formatDate, formatDateTime, shortName } from '../lib/format';

const COLS_EDIT = '84px 1fr 100px 100px 140px 120px';
const COLS_VIEW = '84px 1fr 100px 100px 140px';

export default function MajorOutline() {
  const { db, user, setOutlineStatus, addOutlineCourse } = useStore();
  const toast = useToast();
  const params = useParams();
  const isStudent = user?.role === 'student';
  const canEdit = user?.role === 'advisor' || user?.role === 'admin' || user?.role === 'registrar';
  const [pickedId, setPickedId] = useState<string>(params.studentId ?? '');
  const studentId = isStudent ? user!.studentId! : pickedId || db.students[0]?.id;
  const student = db.students.find((s) => s.id === studentId);
  const outline = db.outlines.find((o) => o.studentId === studentId);
  const [tab, setTab] = useState<'outline' | 'history'>('outline');
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState<{ courseId: string; status: OutlineStatus; note: string } | null>(null);

  if (!student || !outline) return <Shell helpKey="outline" screen="MAJOR · Approved major outline"><PageHeader title="Approved major outline" /><Empty>No approved outline on file for this student.</Empty></Shell>;

  const major = db.majors.find((m) => m.id === outline.majorId)!;
  const done = completedCourseIds(student);
  const inProgress = new Set(currentRegistrations(db, student.id).map((r) => offeringOf(db, r.scheduleNo)?.courseId));
  const requiredDone = major.requiredCourses.filter((c) => done.has(c)).length;
  const majorUnits = major.requiredCourses.concat(major.electives).filter((c) => done.has(c)).reduce((s, c) => s + (courseOf(db, c)?.units ?? 0), 0);
  const majorInProgress = outline.entries.filter((e) => e.status === 'approved' && inProgress.has(e.courseId));
  const inProgUnits = majorInProgress.reduce((s, e) => s + (courseOf(db, e.courseId)?.units ?? 0), 0);
  const candidates = major.requiredCourses.concat(major.electives).filter((c) => !outline.entries.some((e) => e.courseId === c));
  const history = [...outline.history].sort((a, b) => b.at.localeCompare(a.at));
  const COLS = canEdit ? COLS_EDIT : COLS_VIEW;

  function completion(courseId: string) {
    const c = student!.completed.find((x) => x.courseId === courseId);
    if (c) return `${c.term} · ${c.grade}`;
    const t = student!.transfer.find((x) => x.equivalentCourseId === courseId);
    if (t) return 'Transfer credit';
    if (inProgress.has(courseId)) return 'In progress';
    return '—';
  }

  function saveStatus() {
    if (!editing) return;
    setOutlineStatus(student!.id, editing.courseId, editing.status, editing.note.trim() || undefined);
    toast(`${editing.courseId} set to ${editing.status} · recorded under ${user!.name}`);
    setEditing(null);
  }

  return (
    <Shell helpKey="outline" screen="MAJOR · Approved major outline">
      <PageHeader
        title={`Approved outline · ${student.firstName} ${student.lastName}`}
        meta={<><span>ID {student.id}</span><Dot /><span>Major {major.id} · {major.title} · {db.departments.find((d) => d.id === major.deptId)?.name} Department</span><Dot /><span>Last approved {formatDate(outline.approvedAt)} by {outline.approvedBy}</span></>}
      >
        {!isStudent && (
          <select className="input no-print" style={{ width: 220 }} value={student.id} onChange={(e) => setPickedId(e.target.value)} aria-label="Student">
            {db.students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} · {s.id}</option>)}
          </select>
        )}
        {canEdit && (
          <div className="cluster no-print">
            <select className="input" style={{ width: 220 }} value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Course to add">
              <option value="">Add course from major…</option>
              {candidates.map((c) => <option key={c} value={c}>{c} {courseOf(db, c)?.title}</option>)}
            </select>
            <button className="btn" disabled={!adding} onClick={() => { addOutlineCourse(student.id, adding); toast(`Added ${adding} as Approved`); setAdding(''); }}><Plus />Add</button>
          </div>
        )}
      </PageHeader>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '4fr 8fr', gap: 24, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h2>Major requirements</h2><span className="sub">{major.id}</span></div>
            <div className="kv" style={{ padding: '16px 20px' }}>
              <span className="k">Units required</span><span>{major.unitsRequired} · {major.majorUnits} in major</span>
              <span className="k">Required courses</span><span>{major.requiredCourses.length}</span>
              <span className="k">Major electives</span><span>{major.electives.length} offered</span>
              <span className="k">Advisors</span><span>{major.advisors.map((id) => db.users.find((u) => u.id === id)?.name ?? id).join(', ')}</span>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2>Progress against outline</h2><span className="sub">Advisor and student only</span></div>
            <div className="card-body" style={{ gap: 14 }}>
              <Progress label="Required courses completed" value={requiredDone} max={major.requiredCourses.length} />
              <Progress label="Major units" value={majorUnits} max={major.majorUnits} />
              <Progress label="In progress this term" value={inProgUnits} max={major.majorUnits} warn text={`${majorInProgress.length} major ${majorInProgress.length === 1 ? 'course' : 'courses'} · ${inProgUnits} units`} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="tabs no-print">
            <button className={`tab${tab === 'outline' ? ' active' : ''}`} onClick={() => setTab('outline')}>Outline ({outline.entries.length})</button>
            <button className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>Change history ({outline.history.length})</button>
          </div>
          {tab === 'outline' && (
            <div className="rows">
              <div className="row head" style={{ gridTemplateColumns: COLS }}><span>Course</span><span>Title</span><span>Status</span><span>Status date</span><span>Completion</span>{canEdit && <span></span>}</div>
              {outline.entries.map((e) => (
                <div key={e.courseId}>
                  <div className="row tight" style={{ gridTemplateColumns: COLS }}>
                    <span className="cid">{e.courseId}</span>
                    <div><div className="title">{courseOf(db, e.courseId)?.title}</div>{e.note && <div className="detail">{e.note}</div>}</div>
                    <span><StatusChip status={e.status} /></span>
                    <span className="sub">{formatDate(e.statusDate)}</span>
                    <span>{completion(e.courseId)}</span>
                    {canEdit && <span style={{ textAlign: 'right' }}><button className="btn secondary sm no-print" onClick={() => setEditing({ courseId: e.courseId, status: e.status, note: '' })}>Change status</button></span>}
                  </div>
                  {editing?.courseId === e.courseId && (
                    <div className="expand no-print" style={{ gridTemplateColumns: '200px 1fr auto', alignItems: 'end', paddingLeft: 20 }}>
                      <div className="field"><label className="label">New status <span className="req">*</span></label>
                        <select className="input" value={editing.status} onChange={(ev) => setEditing({ ...editing, status: ev.target.value as OutlineStatus })}><option value="approved">Approved</option><option value="waived">Waived</option><option value="dropped">Dropped</option></select></div>
                      <div className="field"><label className="label">Reason (kept in history)</label><input className="input" value={editing.note} onChange={(ev) => setEditing({ ...editing, note: ev.target.value })} placeholder="e.g. Transfer credit · SMC MATH 21" /></div>
                      <div className="cluster"><button className="btn" onClick={saveStatus} disabled={editing.status === e.status && !editing.note}>Save</button><button className="btn ghost" onClick={() => setEditing(null)}>Cancel and restore</button></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {tab === 'history' && (
            <div className="rows">
              <div style={{ padding: '12px 20px 6px' }}><h3>Entries are never deleted · every change is kept</h3></div>
              {history.map((h) => <div key={h.at + h.action} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--row-border)', fontSize: 13 }}><span className="sub">{formatDateTime(h.at)}</span><span>{h.action} <span className="sub">· {shortName(h.by)}</span></span></div>)}
            </div>
          )}
          {tab === 'outline' && (
            <div className="card-foot">
              <h3>Recent changes · entries are never deleted</h3>
              {history.slice(0, 3).map((h) => <div key={h.at + h.action} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, fontSize: 13 }}><span className="sub">{formatDateTime(h.at)}</span><span>{h.action} <span className="sub">· {shortName(h.by)}</span></span></div>)}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
