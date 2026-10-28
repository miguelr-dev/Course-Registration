import { Link, Navigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { Shell, PageHeader, Dot, useToast } from '../components/Shell';
import { Banner, Chip, Empty, PrereqChip, SeatsChip, Stamp, StatusChip } from '../components/ui';
import { keyInfoBlock } from '../lib/student';
import { fullName } from '../lib/names';
import { maxUnits } from '../lib/parameters';
import { registrationClosed } from '../lib/schedule';
import { ReportsButton } from '../components/Reports';
import { studentScheduleReport } from '../lib/reports';
import { X } from '../components/icons';
import { courseOf, currentRegistrations, eligibleMajorOfferings, offeringOf, seatsOpen, unitsRegistered } from '../lib/rules';
import { formatDate, formatTimeRange, shortName } from '../lib/format';

export default function Dashboard() {
  const { db, user, register, drop } = useStore();
  const toast = useToast();
  const student = user?.role === 'student' ? db.students.find((s) => s.id === user.studentId) : undefined; // staff accounts may also own a student record; it applies only when acting as a student
  if (!user) return null;
  if (!student) return <Navigate to="/search" replace />;

  const major = db.majors.find((m) => m.id === student.majorId);
  const regs = currentRegistrations(db, student.id);
  const units = unitsRegistered(db, student.id);
  const eligible = eligibleMajorOfferings(db, student);
  const block = keyInfoBlock(student); // GEN-31: registration waits for a complete record
  const closed = registrationClosed(db) && user.role === 'student';
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
        title={`Welcome back, ${fullName(student)}`}
        meta={<><span>ID {student.id}</span><Dot /><span>{major?.title}</span><Dot /><span>{db.term}</span></>}
      >
        <ReportsButton label="Print schedule" reports={[{ id: 'schedule', label: 'My schedule', build: () => studentScheduleReport(db, student.id) }]} />
        <Link to="/search" className="btn">Search courses</Link>
      </PageHeader>

      {closed && !block && <Banner kind="info"><strong>Registration for {db.term} closed on {formatDate(db.registrationCloses)}.</strong> You can still drop courses. To add one, ask the registrar.</Banner>}
      {block && <Banner kind="warn"><strong>{block.reason}</strong> {block.requirement} Registration is blocked until then. <Link to="/record">Open your student record</Link></Banner>}

      {(block || !outline || regs.length === 0) && <GettingStarted steps={[
        { done: !block, title: 'Complete your student record', detail: block ? 'Telephone, address and date of birth are needed before anything else can be attached to your record.' : 'Name, contact details and date of birth are on file.', to: '/record', action: block ? 'Complete record' : 'View record' },
        { done: !!outline, title: 'Get your major outline approved', detail: outline ? `Approved by ${outline.approvedBy}.` : 'Your major advisor enters and approves the courses you will take for your major. Until then, major courses are not recommended here.', to: '/outline', action: 'View outline' },
        { done: regs.length > 0, title: `Register for ${db.term}`, detail: regs.length ? `${regs.length} ${regs.length === 1 ? 'course' : 'courses'}, ${units} units.` : closed ? `Registration closed on ${formatDate(db.registrationCloses)}; ask the registrar.` : `Open until ${formatDate(db.registrationCloses)}. Search courses or register below.`, to: '/search', action: 'Search courses' },
      ]} />}

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '4fr 8fr', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h2>My schedule</h2><span className="sub">{regs.length} {regs.length === 1 ? 'course' : 'courses'} · {units} of {maxUnits(db)} units</span></div>
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
            {eligible.length === 0 && !outline && <Empty>No approved outline yet. Once your advisor approves your major outline, the courses you can take next appear here. Meanwhile you can <Link to="/search">search all courses</Link>.</Empty>}
            {eligible.length === 0 && outline && <Empty>Nothing to add right now. Every approved course is either completed, in progress, or waiting on a prerequisite.</Empty>}
            {eligible.map((o) => {
              const c = courseOf(db, o.courseId)!;
              const inst = db.faculty.find((f) => f.id === o.instructorId);
              return (
                <div key={o.scheduleNo} className="row" style={{ gridTemplateColumns: '84px 1fr 104px 112px 84px' }}>
                  <div><div className="cid">{c.id}</div><div className="detail">{o.scheduleNo}</div></div>
                  <div><div className="title">{c.title}</div><div className="detail">{o.days} {formatTimeRange(o.start, o.end)} · {o.location} · {inst ? shortName(inst.name) : '—'} · {c.units} units</div></div>
                  <PrereqChip met />
                  <SeatsChip open={seatsOpen(db, o)} />
                  <button className="btn sm no-print" style={{ height: 32 }} disabled={closed} title={closed ? 'Registration is closed' : undefined} onClick={() => onRegister(o.scheduleNo, c.id)}>Register</button>
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

/**
 * The normal order of entry (GEN-28): record, then outline, then registration. Each step links to its
 * screen, so a student can still go to any screen out of sequence (GEN-29).
 */
function GettingStarted({ steps }: { steps: { done: boolean; title: string; detail: string; to: string; action: string }[] }) {
  const next = steps.findIndex((s) => !s.done);
  return (
    <div className="card">
      <div className="card-head"><h2>Getting started</h2><span className="sub">{steps.filter((s) => s.done).length} of {steps.length} done</span></div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.title} className={`step${s.done ? ' done' : ''}${i === next ? ' current' : ''}`}>
            <span className="step-mark" aria-hidden>{s.done ? '✓' : i + 1}</span>
            <div className="grow"><div className="title">{s.title}</div><div className="detail">{s.detail}</div></div>
            <Link to={s.to} className={`btn sm ${i === next ? '' : 'secondary'}`}>{s.action}</Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
