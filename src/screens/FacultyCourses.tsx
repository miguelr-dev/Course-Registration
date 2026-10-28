import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { Shell, PageHeader, useToast } from '../components/Shell';
import { Banner, Empty } from '../components/ui';
import { Print, Search, X } from '../components/icons';
import { useEscapeToCancel, useWarnBeforeLeaving } from '../components/draft';
import { useProgressive } from '../components/progressive';
import { ReportsButton } from '../components/Reports';
import { courseListReport, departmentChoices, facultyListReport, majorChoices, majorRequirementsReport } from '../lib/reports';
import type { Course, Db, Faculty } from '../data/types';
import { canMaintainCatalog, type CourseField, type CourseIssue } from '../lib/catalog';
import type { FacultyEntry, FacultyField, FacultyIssue } from '../lib/faculty';
import { wildcardMatch } from '../lib/wildcard';

type Mode = 'facultyName' | 'facultyId' | 'courseId' | 'courseTitle';

export default function FacultyCourses() {
  const { db, user, saveCourse, saveFaculty } = useStore();
  const canMaintain = canMaintainCatalog(user); // FCI-01, FCI-02, FCI-03
  const [editing, setEditing] = useState<{ course: Course; originalId: string | null } | null>(null);
  const [editingFaculty, setEditingFaculty] = useState<{ entry: FacultyEntry; originalId: string | null } | null>(null);
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('facultyName');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [sel, setSel] = useState<string | null>('F-10422');

  const facultyMode = mode === 'facultyName' || mode === 'facultyId';
  const facultyMatches = useMemo(() => db.faculty.filter((f) => (!dept || f.deptId === dept || f.teachesIn.includes(dept)) && wildcardMatch(q, mode === 'facultyId' ? f.id : f.name)), [db.faculty, q, dept, mode]);
  const courseMatches = useMemo(() => db.courses.filter((c) => (!dept || c.deptId === dept) && wildcardMatch(q, mode === 'courseId' ? c.id : c.title)), [db.courses, q, dept, mode]);
  const facultyPage = useProgressive(facultyMatches, `${mode}|${q}|${dept}`);
  const coursePage = useProgressive(courseMatches, `${mode}|${q}|${dept}`);

  const faculty = facultyMode ? db.faculty.find((f) => f.id === sel) ?? facultyMatches[0] : undefined;
  const course = !facultyMode ? db.courses.find((c) => c.id === sel) ?? courseMatches[0] : undefined;
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? id;

  return (
    <Shell helpKey="fci" screen="FCI · Faculty & course information" panel={editingFaculty ? (
      <FacultyPanel key={editingFaculty.originalId ?? 'new-faculty'} db={db} initial={editingFaculty.entry} originalId={editingFaculty.originalId} onClose={() => setEditingFaculty(null)} onSave={(entry) => {
        const r = saveFaculty(entry, editingFaculty.originalId);
        if (r.ok) { const id = entry.faculty.id.trim().toUpperCase().replace(/^F-?(\d)/, 'F-$1'); setEditingFaculty(null); setMode('facultyId'); setQ(''); setSel(id); toast(`${editingFaculty.originalId ? 'Faculty updated' : 'Faculty added'} · recorded under ${user!.name}`); }
        return r;
      }} />
    ) : editing ? (
      <CoursePanel key={editing.originalId ?? 'new'} db={db} initial={editing.course} originalId={editing.originalId} onClose={() => setEditing(null)} onSave={(c) => {
        const r = saveCourse(c, editing.originalId);
        if (r.ok) { setEditing(null); setMode('courseId'); setQ(''); setSel(c.id.trim().toUpperCase().replace(/\s+/g, ' ')); toast(`${editing.originalId ? 'Course updated' : 'Course added'} · recorded under ${user!.name}`); }
        return r;
      }} />
    ) : undefined}>
      <PageHeader title="Faculty and courses" meta={<span>Query by faculty ID, faculty name, course ID or course title · use * as a wildcard</span>}>
        {canMaintain && <button className="btn secondary no-print" onClick={() => { setEditing(null); setEditingFaculty({ entry: { faculty: { id: '', name: '', positionTitle: '', officePhone: '', office: '', officeHours: '', deptId: dept || db.departments[0]?.id || '', teachesIn: [], email: '' }, courses: [] }, originalId: null }); }}>Add faculty</button>}
        {canMaintain && <button className="btn no-print" onClick={() => { setEditingFaculty(null); setEditing({ course: { id: '', title: '', description: '', units: 3, prereqs: [], deptId: dept || db.departments[0]?.id || '', level: 'lower', qualifiedFaculty: [] }, originalId: null }); }}>Add course</button>}
        <ReportsButton reports={[
          { id: 'faculty', label: 'Faculty list', params: [{ key: 'dept', label: 'Department', options: departmentChoices(db, 'University, by department') }], build: (v) => facultyListReport(db, v.dept || null) },
          { id: 'courses', label: 'Course list', params: [{ key: 'dept', label: 'Department', options: departmentChoices(db, 'University, by department') }], build: (v) => courseListReport(db, v.dept || null) },
          { id: 'major', label: 'Required courses for a major', params: [{ key: 'major', label: 'Major', options: majorChoices(db) }], build: (v) => majorRequirementsReport(db, v.major) },
        ]} />
      </PageHeader>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ width: 200 }}>
          <label className="label" htmlFor="mode">Search by <span className="req">*</span></label>
          <select id="mode" className="input" value={mode} onChange={(e) => { setMode(e.target.value as Mode); setSel(null); }}>
            <option value="facultyName">Faculty name</option><option value="facultyId">Faculty ID</option><option value="courseId">Course ID</option><option value="courseTitle">Course title</option>
          </select>
        </div>
        <div className="field grow" style={{ minWidth: 200 }}>
          <label className="label" htmlFor="q">Query</label>
          <div className="input-wrap"><Search /><input id="q" className="input" placeholder={facultyMode ? 'e.g. Hwang-*' : 'e.g. CS 3?0'} value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} /></div>
        </div>
        <div className="field" style={{ width: 220 }}>
          <label className="label" htmlFor="dept">Department</label>
          <select id="dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </div>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '3fr 9fr', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h2>{(facultyMode ? facultyMatches : courseMatches).length} {(facultyMode ? facultyMatches : courseMatches).length === 1 ? 'match' : 'matches'}</h2><span className="sub">{q || 'all'}</span></div>
          <div className="rows">
            {facultyMode && facultyMatches.length === 0 && <Empty>No faculty match.</Empty>}
            {facultyMode && facultyPage.visible.map((f) => (
              <div key={f.id} className={`row clickable${faculty?.id === f.id ? ' selected' : ''}`} style={{ gridTemplateColumns: '1fr', gap: 2 }} onClick={() => setSel(f.id)}><span className="title">{f.name}</span><span className="detail">{f.id} · {deptName(f.deptId)}</span></div>
            ))}
            {!facultyMode && courseMatches.length === 0 && <Empty>No courses match.</Empty>}
            {!facultyMode && coursePage.visible.map((c) => (
              <div key={c.id} className={`row clickable${course?.id === c.id ? ' selected' : ''}`} style={{ gridTemplateColumns: '1fr', gap: 2 }} onClick={() => setSel(c.id)}><span className="title">{c.id} · {c.title}</span><span className="detail">{c.units} units · {deptName(c.deptId)}</span></div>
            ))}
            {facultyMode ? facultyPage.more : coursePage.more}
          </div>
        </div>

        {faculty && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="card">
              <div className="card-head"><div><h2>{faculty.name}</h2><div className="sub">{faculty.positionTitle} · Faculty ID {faculty.id}</div></div><div className="actions">{canMaintain && <button className="btn secondary sm no-print" onClick={() => { setEditing(null); setEditingFaculty({ entry: { faculty, courses: db.courses.filter((c) => c.qualifiedFaculty.includes(faculty.id)).map((c) => c.id) }, originalId: faculty.id }); }}>Edit faculty</button>}<button className="btn secondary sm" onClick={() => window.print()}><Print />Print</button></div></div>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 32px', padding: '16px 20px' }}>
                <div className="kv"><span className="k">Department</span><span>{deptName(faculty.deptId)}</span><span className="k">Teaches in</span><span>{faculty.teachesIn.map(deptName).join(', ')}</span><span className="k">Office</span><span>{faculty.office}</span></div>
                <div className="kv"><span className="k">Office phone</span><span>{faculty.officePhone}</span><span className="k">Office hours</span><span>{faculty.officeHours}</span><span className="k">Email</span><span>{faculty.email}</span></div>
              </div>
            </div>
            <div className="card">
              {(() => { const list = db.courses.filter((c) => c.qualifiedFaculty.includes(faculty.id)); const offered = list.filter((c) => db.offerings.some((o) => o.courseId === c.id && o.instructorId === faculty.id && o.term === db.term)).length; return (
                <>
                  <div className="card-head"><h2>Authorized to teach</h2><span className="sub">{list.length} courses · {offered} offered {db.term}</span></div>
                  <div className="rows">
                    <div className="row head" style={{ gridTemplateColumns: '84px 1fr 48px 200px' }}><span>Course</span><span>Title</span><span style={{ textAlign: 'right' }}>Units</span><span>Prerequisites</span></div>
                    {list.map((c) => <div key={c.id} className="row" style={{ gridTemplateColumns: '84px 1fr 48px 200px' }}><span className="cid">{c.id}</span><span className="title">{c.title}</span><span className="num">{c.units}<span className="show-small"> units</span></span><span className="sub"><span className="show-small">Prerequisites: </span>{c.prereqs.join(', ') || 'None'}</span></div>)}
                  </div>
                </>
              ); })()}
            </div>
          </div>
        )}

        {course && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="card">
              <div className="card-head"><div><h2>{course.id} · {course.title}</h2><div className="sub">{course.units} units · {deptName(course.deptId)} · {course.level === 'upper' ? 'Upper division' : course.level === 'graduate' ? 'Graduate' : 'Lower division'}</div></div><div className="actions">{canMaintain && <button className="btn secondary sm no-print" onClick={() => { setEditingFaculty(null); setEditing({ course, originalId: course.id }); }}>Edit course</button>}<button className="btn secondary sm" onClick={() => window.print()}><Print />Print</button></div></div>
              <div className="card-body">
                <p style={{ fontSize: 13, lineHeight: 1.55 }}>{course.description}</p>
                <div className="kv"><span className="k">Prerequisites</span><span>{course.prereqs.join(', ') || 'None'}</span></div>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h2>Authorized to teach this course</h2><span className="sub">{course.qualifiedFaculty.length} faculty</span></div>
              <div className="rows">
                {course.qualifiedFaculty.length === 0 && <Empty>No faculty currently authorized.</Empty>}
                {course.qualifiedFaculty.map((id) => db.faculty.find((f) => f.id === id)).filter(Boolean).map((f) => <div key={f!.id} className="row" style={{ gridTemplateColumns: '1fr 160px 200px' }}><div><div className="title">{f!.name}</div><div className="detail">{f!.positionTitle} · {f!.id}</div></div><span className="sub">{deptName(f!.deptId)}</span><span className="sub">{f!.office} · {f!.officePhone}</span></div>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

const LEVELS: [Course['level'], string][] = [['lower', 'Lower division'], ['upper', 'Upper division'], ['graduate', 'Graduate']];

/** Add or edit a catalog course (FCI-03). Entries stay in this panel until saved; Cancel and restore or Esc discards them (GEN-33, GEN-34). */
function CoursePanel({ db, initial, originalId, onClose, onSave }: {
  db: Db; initial: Course; originalId: string | null; onClose(): void; onSave(c: Course): { ok: true } | ({ ok: false } & CourseIssue);
}) {
  const [draft, setDraft] = useState<Course>(initial);
  const [prereqText, setPrereqText] = useState(initial.prereqs.join(', '));
  const [err, setErr] = useState<CourseIssue | null>(null);
  const dirty = JSON.stringify({ ...draft, prereqs: prereqText }) !== JSON.stringify({ ...initial, prereqs: initial.prereqs.join(', ') });
  useEscapeToCancel(true, onClose);
  useWarnBeforeLeaving(dirty);
  const set = <K extends keyof Course>(k: K, v: Course[K]) => { setDraft({ ...draft, [k]: v }); if (err?.field === k) setErr(null); };
  const cls = (f: CourseField) => `input${err?.field === f ? ' error' : ''}`;
  const toggleFaculty = (id: string) => set('qualifiedFaculty', draft.qualifiedFaculty.includes(id) ? draft.qualifiedFaculty.filter((x) => x !== id) : [...draft.qualifiedFaculty, id]);
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = onSave({ ...draft, prereqs: prereqText.split(',') });
    if (!r.ok) setErr(r);
  }
  return (
    <aside className="panel" aria-label={originalId ? 'Edit course' : 'Add course'}>
      <div className="panel-head"><h2>{originalId ? `Edit ${originalId}` : 'Add course'}</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="editcourse">
        <div className="field"><label className="label" htmlFor="c-id">Course ID <span className="req">*</span></label>
          <input id="c-id" className={cls('id')} value={draft.id} disabled={originalId !== null} placeholder="e.g. CS 310" onChange={(e) => set('id', e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="c-title">Title <span className="req">*</span></label>
          <input id="c-title" className={cls('title')} value={draft.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="c-desc">Description <span className="req">*</span></label>
          <textarea id="c-desc" className={cls('description')} rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label className="label" htmlFor="c-units">Units <span className="req">*</span></label>
            <input id="c-units" type="number" min={0} max={12} step={1} className={cls('units')} value={Number.isNaN(draft.units) ? '' : draft.units} onChange={(e) => set('units', e.target.value === '' ? NaN : Number(e.target.value))} /></div>
          <div className="field"><label className="label" htmlFor="c-level">Level <span className="req">*</span></label>
            <select id="c-level" className={cls('level')} value={draft.level} onChange={(e) => set('level', e.target.value as Course['level'])}>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        <div className="field"><label className="label" htmlFor="c-dept">Department <span className="req">*</span></label>
          <select id="c-dept" className={cls('deptId')} value={draft.deptId} onChange={(e) => set('deptId', e.target.value)}>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="field"><label className="label" htmlFor="c-pre">Prerequisites</label>
          <input id="c-pre" className={cls('prereqs')} value={prereqText} placeholder="Course IDs separated by commas, e.g. CS 201, CS 250" list="catalog-ids" onChange={(e) => { setPrereqText(e.target.value); if (err?.field === 'prereqs') setErr(null); }} />
          <datalist id="catalog-ids">{db.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</datalist></div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Faculty qualified to teach</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {db.faculty.map((f) => <label key={f.id} className="check"><input type="checkbox" checked={draft.qualifiedFaculty.includes(f.id)} onChange={() => toggleFaculty(f.id)} />{f.name} · {f.id}</label>)}
          </div>
        </fieldset>
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="editcourse">{originalId ? 'Save changes' : 'Add course'}</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
      </div>
    </aside>
  );
}

/** Value lists offered in faculty fields (GEN-12): suggestions while typing, the full list on F4 or Alt+↓. */
const LISTS: Partial<Record<string, string>> = { positionTitle: 'positionTitles', office: 'locations' };
const valueList = (key?: string) => (key ? { list: `vl-${key}`, 'data-list': key, title: 'Press F4 or Alt+↓ for the list of values' } : {});

/** Add or edit a faculty member and the courses they are qualified to teach (FCI-01, FCI-02). Cancel and restore or Esc discards the draft (GEN-33, GEN-34). */
function FacultyPanel({ db, initial, originalId, onClose, onSave }: {
  db: Db; initial: FacultyEntry; originalId: string | null; onClose(): void; onSave(e: FacultyEntry): { ok: true } | ({ ok: false } & FacultyIssue);
}) {
  const [draft, setDraft] = useState<Faculty>(initial.faculty);
  const [courses, setCourses] = useState<string[]>(initial.courses);
  const [courseFilter, setCourseFilter] = useState('');
  const [err, setErr] = useState<FacultyIssue | null>(null);
  const dirty = JSON.stringify({ draft, courses }) !== JSON.stringify({ draft: initial.faculty, courses: initial.courses });
  useEscapeToCancel(true, onClose);
  useWarnBeforeLeaving(dirty);
  const set = <K extends keyof Faculty>(k: K, v: Faculty[K]) => { setDraft({ ...draft, [k]: v }); if (err?.field === k) setErr(null); };
  const cls = (f: FacultyField) => `input${err?.field === f ? ' error' : ''}`;
  const text = (k: 'id' | 'name' | 'positionTitle' | 'officePhone' | 'office' | 'officeHours' | 'email', label: string, required: boolean, placeholder: string, disabled = false) => (
    <div className="field"><label className="label" htmlFor={`f-${k}`}>{label} {required && <span className="req">*</span>}</label>
      <input id={`f-${k}`} className={cls(k)} value={draft[k]} disabled={disabled} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} {...valueList(LISTS[k])} /></div>
  );
  const teaching = new Set(originalId ? db.offerings.filter((o) => o.instructorId === originalId && o.term === db.term).map((o) => o.courseId) : []);
  const shown = db.courses.filter((c) => courses.includes(c.id) || wildcardMatch(courseFilter, c.id) || wildcardMatch(courseFilter, c.title));
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = onSave({ faculty: draft, courses });
    if (!r.ok) setErr(r);
  }
  return (
    <aside className="panel" aria-label={originalId ? 'Edit faculty' : 'Add faculty'}>
      <div className="panel-head"><h2>{originalId ? `Edit ${initial.faculty.name}` : 'Add faculty'}</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <form className="panel-body" onSubmit={submit} noValidate id="editfaculty">
        {text('id', 'Faculty ID', true, 'e.g. F-10231', originalId !== null)}
        {text('name', 'Full name', true, 'Hyphenated names are accepted')}
        {text('positionTitle', 'Position title', true, 'e.g. Associate Professor')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {text('officePhone', 'Office phone', true, '(310) 555-0171')}
          {text('office', 'Office number', true, 'e.g. Boelter 4531')}
        </div>
        {text('officeHours', 'Office hours', true, 'e.g. Mon 2:00–4:00 PM')}
        {text('email', 'Email', false, 'Optional')}
        <div className="field"><label className="label" htmlFor="f-dept">Assigned department <span className="req">*</span></label>
          <select id="f-dept" className={cls('deptId')} value={draft.deptId} onChange={(e) => set('deptId', e.target.value)}>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Departments taught in</legend>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {db.departments.map((d) => <label key={d.id} className="check"><input type="checkbox" checked={d.id === draft.deptId || draft.teachesIn.includes(d.id)} disabled={d.id === draft.deptId} onChange={(e) => set('teachesIn', e.target.checked ? [...draft.teachesIn, d.id] : draft.teachesIn.filter((x) => x !== d.id))} />{d.id}</label>)}
          </div>
          <span className="help">The assigned department is always included.</span>
        </fieldset>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Courses qualified to teach ({courses.length})</legend>
          <input className={`${cls('courses')} sm`} placeholder="Filter, e.g. CS 3*" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filter courses" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginTop: 6 }}>
            {shown.map((c) => <label key={c.id} className="check"><input type="checkbox" checked={courses.includes(c.id)} disabled={teaching.has(c.id) && courses.includes(c.id)} onChange={(e) => { setCourses(e.target.checked ? [...courses, c.id] : courses.filter((x) => x !== c.id)); if (err?.field === 'courses') setErr(null); }} />{c.id} · {c.title}{teaching.has(c.id) ? ` · teaching ${db.term}` : ''}</label>)}
          </div>
        </fieldset>
        {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
      </form>
      <div className="panel-foot">
        <button className="btn lg" type="submit" form="editfaculty">{originalId ? 'Save changes' : 'Add faculty'}</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
      </div>
    </aside>
  );
}
