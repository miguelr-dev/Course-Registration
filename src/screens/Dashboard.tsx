import { Link, Navigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { Shell, PageHeader, Dot, useToast } from '../components/Shell';
import { Chip, Empty, PrereqChip, SeatsChip, Stamp, StatusChip } from '../components/ui';
import { X } from '../components/icons';
import { courseOf, currentRegistrations, eligibleMajorOfferings, MAX_UNITS, offeringOf, seatsOpen, unitsRegistered } from '../lib/rules';
import { formatDate, formatTimeRange, shortName } from '../lib/format';

export default function Dashboard() {
  const { db, user, register, drop } = useStore();
  const toast = useToast();
  const student = db.students.find((s) => s.id === user?.studentId);
  if (!user) return null;
  if (!student) return <Navigate to="/search" replace />;

  const major = db.majors.find((m) => m.id === student.majorId);
  const regs = currentRegistrations(db, student.id);
  const units = unitsRegistered(db, student.id);
  const eligible = eligibleMajorOfferings(db, student);
  const outline = db.outlines.find((o) => o.studentId === student.id);
  const last = [...db.transactions].reverse().find((t) => t.subsystem === 'REG' && t.by === user.name);
  const recentChanges = outline ? [...outline.entries].filter((e) => e.statusDate >= '2026-08-01').sort((a, b) => b.statusDate.localeCompare(a.statusDate)).slice(0, 4) : [];

  function onRegister(scheduleNo: string, courseId: string) {
    const r = register(student!.id, scheduleNo, 'letter');
    if (r.ok) toast(`Registered ${courseId} · recorded under ${user!.name}`);
    else toast(`${r.issues[0].reason} ${r.issues[0].requirement}`);
  }

  return (
    <Shell helpKey="dashboard" screen="REG · Student dashboard">
      <PageHeader
        title={`Welcome back, ${student.firstName} ${student.lastName}`}
        meta={<><span>ID {student.id}</span><Dot /><span>{major?.title}</span><Dot /><span>{db.term}</span></>}
      >
        <Link to="/search" className="btn">Search courses</Link>
      </PageHeader>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '4fr 8fr', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h2>My schedule</h2><span className="sub">{regs.length} {regs.length === 1 ? 'course' : 'courses'} · {units} of {MAX_UNITS} units</span></div>
          <div className="rows">
            {regs.length === 0 && <Empty>No courses yet. Search courses to register.</Empty>}
            {regs.map((r) => {
              const o = offeringOf(db, r.scheduleNo)!;
              const c = courseOf(db, o.courseId)!;
              const inst = db.faculty.find((f) => f.id === o.instructorId);
              return (
                <div key={r.scheduleNo} className="row" style={{ gridTemplateColumns: '76px 1fr 52px 32px' }}>
                  <span className="cid">{c.id}</span>
                  <div>
                    <div className="title">{c.title}</div>
                    <div className="detail">{o.days} {formatTimeRange(o.start, o.end)} · {o.location}</div>
                    <div className="detail">{inst ? shortName(inst.name) : '—'}</div>
                  </div>
                  <span className="num">{c.units} units</span>
                  <button className="btn ghost sm icon no-print" title={`Drop ${c.id}`} aria-label={`Drop ${c.id}`} onClick={() => { if (confirm(`Drop ${c.id}? This is recorded under your name.`)) { drop(student.id, r.scheduleNo); toast(`Dropped ${c.id}`); } }}><X /></button>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', fontWeight: 600 }}><span>Total</span><span>{units} units</span></div>
          {last && <Stamp action="Last registered" by={last.by} at={last.at} />}
        </div>

        <div className="card">
          <div className="card-head"><h2>Eligible major courses</h2><span className="sub">On your approved outline · prerequisites met · seats open</span></div>
          <div className="rows">
            {eligible.length === 0 && <Empty>Nothing to add right now. Every approved course is either completed, in progress, or waiting on a prerequisite.</Empty>}
            {eligible.map((o) => {
              const c = courseOf(db, o.courseId)!;
              const inst = db.faculty.find((f) => f.id === o.instructorId);
              return (
                <div key={o.scheduleNo} className="row" style={{ gridTemplateColumns: '84px 1fr 104px 100px 84px' }}>
                  <div><div className="cid">{c.id}</div><div className="detail">{o.scheduleNo}</div></div>
                  <div><div className="title">{c.title}</div><div className="detail">{o.days} {formatTimeRange(o.start, o.end)} · {o.location} · {inst ? shortName(inst.name) : '—'} · {c.units} units</div></div>
                  <PrereqChip met />
                  <SeatsChip open={seatsOpen(db, o)} />
                  <button className="btn sm no-print" style={{ height: 32 }} onClick={() => onRegister(o.scheduleNo, c.id)}>Register</button>
                </div>
              );
            })}
          </div>
          {recentChanges.length > 0 && (
            <div className="card-foot">
              <h3>Outline changes this term</h3>
              {recentChanges.map((e) => (
                <div key={e.courseId} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                  <StatusChip status={e.status} />
                  <span>{e.courseId} {courseOf(db, e.courseId)?.title}{e.note ? ` (${e.note})` : ''}</span>
                  <span className="sub right">{shortName(e.by)} · {formatDate(e.statusDate)}</span>
                </div>
              ))}
              <div className="sub"><Chip kind="neutral">{outline?.entries.length ?? 0} on outline</Chip> <Link to="/outline">View full outline</Link></div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
