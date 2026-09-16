import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { Shell, PageHeader, useToast } from '../components/Shell';
import { Empty } from '../components/ui';
import { Print, Search } from '../components/icons';
import { wildcardMatch } from '../lib/wildcard';

type Mode = 'facultyName' | 'facultyId' | 'courseId' | 'courseTitle';

export default function FacultyCourses() {
  const { db } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('facultyName');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [sel, setSel] = useState<string | null>('F-10422');

  const facultyMode = mode === 'facultyName' || mode === 'facultyId';
  const facultyMatches = useMemo(() => db.faculty.filter((f) => (!dept || f.deptId === dept || f.teachesIn.includes(dept)) && wildcardMatch(q, mode === 'facultyId' ? f.id : f.name)), [db.faculty, q, dept, mode]);
  const courseMatches = useMemo(() => db.courses.filter((c) => (!dept || c.deptId === dept) && wildcardMatch(q, mode === 'courseId' ? c.id : c.title)), [db.courses, q, dept, mode]);

  const faculty = facultyMode ? db.faculty.find((f) => f.id === sel) ?? facultyMatches[0] : undefined;
  const course = !facultyMode ? db.courses.find((c) => c.id === sel) ?? courseMatches[0] : undefined;
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? id;

  return (
    <Shell helpKey="fci" screen="FCI · Faculty & course information">
      <PageHeader title="Faculty and courses" meta={<span>Query by faculty ID, faculty name, course ID or course title · use * as a wildcard</span>}>
        <button className="btn secondary" onClick={() => toast('Department report: preview opens in the print dialog')}>Department report</button>
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
            {facultyMode && facultyMatches.map((f) => (
              <div key={f.id} className={`row clickable${faculty?.id === f.id ? ' selected' : ''}`} style={{ gridTemplateColumns: '1fr', gap: 2 }} onClick={() => setSel(f.id)}><span className="title">{f.name}</span><span className="detail">{f.id} · {deptName(f.deptId)}</span></div>
            ))}
            {!facultyMode && courseMatches.length === 0 && <Empty>No courses match.</Empty>}
            {!facultyMode && courseMatches.map((c) => (
              <div key={c.id} className={`row clickable${course?.id === c.id ? ' selected' : ''}`} style={{ gridTemplateColumns: '1fr', gap: 2 }} onClick={() => setSel(c.id)}><span className="title">{c.id} · {c.title}</span><span className="detail">{c.units} units · {deptName(c.deptId)}</span></div>
            ))}
          </div>
        </div>

        {faculty && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="card">
              <div className="card-head"><div><h2>{faculty.name}</h2><div className="sub">{faculty.positionTitle} · Faculty ID {faculty.id}</div></div><div className="actions"><button className="btn secondary sm" onClick={() => window.print()}><Print />Print</button></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 32px', padding: '16px 20px' }}>
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
                    {list.map((c) => <div key={c.id} className="row" style={{ gridTemplateColumns: '84px 1fr 48px 200px' }}><span className="cid">{c.id}</span><span className="title">{c.title}</span><span className="num">{c.units}</span><span className="sub">{c.prereqs.join(', ') || 'None'}</span></div>)}
                  </div>
                </>
              ); })()}
            </div>
          </div>
        )}

        {course && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="card">
              <div className="card-head"><div><h2>{course.id} · {course.title}</h2><div className="sub">{course.units} units · {deptName(course.deptId)} · {course.level === 'upper' ? 'Upper division' : course.level === 'graduate' ? 'Graduate' : 'Lower division'}</div></div><div className="actions"><button className="btn secondary sm" onClick={() => window.print()}><Print />Print</button></div></div>
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
