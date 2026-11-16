import { useState } from 'react';
import { useStore } from '../data/store';
import type { Student } from '../data/types';
import { useToast } from './Shell';
import { Banner, FieldError } from './ui';
import { X } from './icons';
import { useEscapeToCancel } from './draft';
import { courseOf, currentRegistrations, offeringOf } from '../lib/rules';
import { formatDate } from '../lib/format';
import { MESSAGE_MAX, REQUEST_KINDS, requestRecipients, type RequestField, type RequestKind, type StudentRequest } from '../lib/requests';

/**
 * Side panel where a student sends a request to their major advisor, an instructor or the registrar.
 * `dropAfterDeadline` opens it in place of dropping once the add/drop deadline has passed, so the
 * student talks to someone before losing a course they cannot add back.
 */
export function RequestPanel({ student, initial, dropAfterDeadline = false, onClose }: { student: Student; initial?: Partial<StudentRequest>; dropAfterDeadline?: boolean; onClose: () => void }) {
  const { db, sendRequest } = useStore();
  const toast = useToast();
  const recipients = requestRecipients(db, student);
  const courses = currentRegistrations(db, student.id).map((r) => offeringOf(db, r.scheduleNo)?.courseId).filter((c): c is string => !!c);
  const [req, setReq] = useState<StudentRequest>({ to: recipients[0]?.id ?? '', kind: 'meeting', courseId: '', message: '', ...initial });
  const [err, setErr] = useState<{ field: RequestField; reason: string; requirement: string } | null>(null);
  useEscapeToCancel(true, onClose);

  const set = (change: Partial<StudentRequest>) => { setReq((r) => ({ ...r, ...change })); setErr(null); };
  const error = (f: RequestField) => (err?.field === f ? <FieldError reason={err.reason} requirement={err.requirement} /> : null);

  function send() {
    const r = sendRequest(student.id, req);
    if (!r.ok) return setErr(r);
    toast(`Request sent to ${recipients.find((x) => x.id === req.to)?.name ?? 'staff'} · added to your student record`);
    onClose();
  }

  return (
    <aside className="panel" aria-label={dropAfterDeadline ? 'Drop request' : 'Send a request'}>
      <div className="panel-head"><h2>{dropAfterDeadline ? 'Talk to your advisor before dropping' : 'Send a request'}</h2><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <div className="panel-body">
        {dropAfterDeadline && (
          <Banner kind="warn"><strong>The add/drop deadline for {db.term} passed on {formatDate(db.registrationCloses)}.</strong> A course dropped now cannot be added back. Send a drop request or ask for a meeting with your major advisor or instructor; the registrar drops the course once it is approved.</Banner>
        )}
        <div className="field">
          <label className="label" htmlFor="rq-to">To <span className="req">*</span></label>
          <select id="rq-to" className={`input${err?.field === 'to' ? ' error' : ''}`} value={req.to} onChange={(e) => set({ to: e.target.value })}>
            {recipients.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.label}</option>)}
          </select>
          {error('to')}
        </div>
        <div className="field">
          <label className="label" htmlFor="rq-kind">Request <span className="req">*</span></label>
          <select id="rq-kind" className="input" value={req.kind} onChange={(e) => set({ kind: e.target.value as RequestKind })}>
            {Object.entries(REQUEST_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {error('kind')}
        </div>
        <div className="field">
          <label className="label" htmlFor="rq-course">Course {req.kind === 'drop' && <span className="req">*</span>}</label>
          <select id="rq-course" className={`input${err?.field === 'courseId' ? ' error' : ''}`} value={req.courseId} onChange={(e) => set({ courseId: e.target.value })}>
            <option value="">{req.kind === 'drop' ? 'Choose a course' : 'None'}</option>
            {courses.map((c) => <option key={c} value={c}>{c} {courseOf(db, c)?.title}</option>)}
          </select>
          {error('courseId')}
        </div>
        <div className="field">
          <label className="label" htmlFor="rq-msg">Message <span className="req">*</span></label>
          <textarea id="rq-msg" className={`input${err?.field === 'message' ? ' error' : ''}`} maxLength={MESSAGE_MAX} value={req.message} onChange={(e) => set({ message: e.target.value })} placeholder={req.kind === 'drop' ? 'Why you want to drop the course' : 'What you need'} />
          {error('message')}
          <div className="sub">Saved to your student record, where your advisors and the registrar read it. It cannot be changed or deleted.</div>
        </div>
      </div>
      <div className="panel-foot">
        <button className="btn lg" onClick={send}>Send request</button>
        <button className="btn ghost" onClick={onClose}>Cancel and restore</button>
      </div>
    </aside>
  );
}
