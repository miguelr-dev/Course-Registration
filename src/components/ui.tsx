import type { ReactNode } from 'react';
import { Check, Clock, ErrorIcon, Info, Warn, X } from './icons';
import { formatDateTime } from '../lib/format';
import type { OutlineStatus } from '../data/types';

export function Chip({ kind, children }: { kind: 'ok' | 'warn' | 'drop' | 'neutral' | 'indigo'; children: ReactNode }) {
  return <span className={`chip ${kind}`}>{children}</span>;
}

export function StatusChip({ status }: { status: OutlineStatus }) {
  if (status === 'approved') return <Chip kind="ok"><Check />Approved</Chip>;
  if (status === 'waived') return <Chip kind="warn"><Warn />Waived</Chip>;
  return <Chip kind="drop"><X />Dropped</Chip>;
}

export function PrereqChip({ met, short = false }: { met: boolean; short?: boolean }) {
  return met
    ? <Chip kind="ok"><Check />{short ? 'Met' : 'Prereq met'}</Chip>
    : <Chip kind="drop"><X />{short ? 'Not met' : 'Prereq not met'}</Chip>;
}

export function SeatsChip({ open, capacity }: { open: number; capacity?: number }) {
  if (open === 0) return <Chip kind="drop"><X />Full</Chip>;
  if (open <= 3) return <Chip kind="warn"><Warn />{open} {open === 1 ? 'seat' : 'seats'} left</Chip>;
  return <Chip kind="neutral">{capacity ? `${open} of ${capacity}` : `${open} seats`}</Chip>;
}

export function Banner({ kind, children }: { kind: 'error' | 'info' | 'warn' | 'success'; children: ReactNode }) {
  const Icon = kind === 'error' ? ErrorIcon : kind === 'warn' ? Warn : kind === 'success' ? Check : Info;
  return <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : 'status'}><Icon size={16} /><div>{children}</div></div>;
}

export function FieldError({ reason, requirement }: { reason: string; requirement: string }) {
  return <div className="err" role="alert"><ErrorIcon size={14} /><span>{reason} {requirement}</span></div>;
}

export function Stamp({ by, at, action, bare = false }: { by: string; at: string; action?: string; bare?: boolean }) {
  return (
    <div className={`stamp${bare ? ' bare' : ''}`}>
      <Clock />
      <span>{action ? `${action} by ${by}` : by} · {formatDateTime(at)}</span>
    </div>
  );
}

export function Tile({ big, label }: { big: ReactNode; label: string }) {
  return <div className="tile"><span className="big">{big}</span><span className="lbl">{label}</span></div>;
}

export function Progress({ label, value, max, warn = false, text }: { label: string; value: number; max: number; warn?: boolean; text?: string }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{label}</span><span className="strong">{text ?? `${value} of ${max}`}</span></div>
      <div className="bar"><span className={warn ? 'warn' : ''} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
