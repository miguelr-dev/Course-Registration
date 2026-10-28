import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../data/store';
import type { Report } from '../lib/reports';
import { formatDateTime, nowIso } from '../lib/format';
import { useEscapeToCancel } from './draft';
import { Print, X } from './icons';

/** One choice on a report, e.g. department or major. The first option is the default. */
export interface ReportParam { key: string; label: string; options: [string, string][]; }
export interface ReportDef { id: string; label: string; params?: ReportParam[]; build(values: Record<string, string>): Report; }

/**
 * Report viewer (GEN-18, Reporting Requirements): every report is shown on the workstation before
 * printing, with its header information, and can be printed as a whole or in parts by keeping only
 * some sections. Printing while the viewer is open prints the report alone.
 */
export function ReportsButton({ reports, label = 'Reports', className = 'btn secondary', initial }: { reports: ReportDef[]; label?: string; className?: string; initial?: string }) {
  const [open, setOpen] = useState(false);
  if (!reports.length) return null;
  return (
    <>
      <button className={`${className} no-print`} onClick={() => setOpen(true)}>{label}</button>
      {open && createPortal(<ReportViewer reports={reports} initial={initial} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ReportViewer({ reports, initial, onClose }: { reports: ReportDef[]; initial?: string; onClose(): void }) {
  const { user, realUser } = useStore();
  const [reportId, setReportId] = useState(initial && reports.some((r) => r.id === initial) ? initial : reports[0].id);
  const def = reports.find((r) => r.id === reportId)!;
  const [values, setValues] = useState<Record<string, string>>({});
  const params = def.params ?? [];
  const resolved = Object.fromEntries(params.map((p) => [p.key, values[p.key] ?? p.options[0]?.[0] ?? '']));
  const report = useMemo(() => def.build(resolved), [def, JSON.stringify(resolved)]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [printedAt] = useState(nowIso);
  useEffect(() => { setHidden(new Set()); }, [reportId, JSON.stringify(resolved)]);
  useEscapeToCancel(true, onClose);
  useEffect(() => {
    document.body.classList.add('report-open');
    return () => document.body.classList.remove('report-open');
  }, []);
  const shown = report.sections.filter((s) => !hidden.has(s.id));
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="report-overlay" role="dialog" aria-label="Report preview">
      <div className="report-toolbar">
        <div className="report-controls">
          {reports.length > 1 && (
            <label className="field"><span className="label">Report</span>
              <select className="input" value={reportId} onChange={(e) => { setReportId(e.target.value); setValues({}); }}>{reports.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
          )}
          {params.map((p) => (
            <label key={p.key} className="field"><span className="label">{p.label}</span>
              <select className="input" value={resolved[p.key]} onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}>{p.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          ))}
        </div>
        {report.sections.length > 1 && (
          <div className="report-parts">
            <span className="label">Print sections</span>
            <div className="cluster" style={{ gap: 6 }}>
              {report.sections.map((s) => <label key={s.id} className="check"><input type="checkbox" checked={!hidden.has(s.id)} onChange={() => toggle(s.id)} />{s.title}</label>)}
            </div>
          </div>
        )}
        <div className="report-actions">
          <button className="btn" onClick={() => window.print()} disabled={!shown.length}><Print />Print</button>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close report"><X /></button>
        </div>
      </div>

      <article className="report-doc">
        <header className="report-head">
          <div className="report-brand">SignMeUp · Course registration</div>
          <h1>{report.title}</h1>
          {report.subtitle && <p className="sub">{report.subtitle}</p>}
          <dl className="report-meta">
            {report.meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            <div><dt>Printed by</dt><dd>{realUser?.name ?? user?.name ?? '—'}</dd></div>
            <div><dt>Date</dt><dd>{formatDateTime(printedAt)}</dd></div>
          </dl>
        </header>
        {!report.sections.length && <p className="sub">Nothing to report.</p>}
        {report.sections.length > 0 && !shown.length && <p className="sub no-print">Every section is unticked. Tick at least one section to print.</p>}
        {shown.map((s) => (
          <section key={s.id} className="report-section">
            <h2>{s.title}</h2>
            {s.note && <p className="sub">{s.note}</p>}
            {s.rows.length === 0
              ? <p className="sub">{s.empty ?? 'No entries.'}</p>
              : (
                <div className="report-table-wrap">
                  <table className="report-table">
                    <thead><tr>{s.columns.map((c, i) => <th key={c} className={s.numeric?.includes(i) ? 'num' : undefined}>{c}</th>)}</tr></thead>
                    <tbody>{s.rows.map((r, ri) => <tr key={ri}>{r.map((cell, ci) => <td key={ci} className={s.numeric?.includes(ci) ? 'num' : undefined}>{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            {s.summary && <dl className="report-summary">{s.summary.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
          </section>
        ))}
        <footer className="report-foot">SignMeUp · {report.title} · printed {formatDateTime(printedAt)}</footer>
      </article>
    </div>
  );
}
