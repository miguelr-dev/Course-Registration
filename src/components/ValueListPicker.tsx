import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { listOf, PARAMETERS } from '../lib/parameters';

/**
 * The list of possible values for an entry field, by key sequence (GEN-12). A field opts in with
 * `data-list="<value list key>"` and `list="vl-<key>"`: typing suggests matching values, and F4 or
 * Alt+↓ opens the full list, filtered by what is typed. Picking a value fills the field.
 */
export function ValueListPicker() {
  const { db } = useStore();
  const [open, setOpen] = useState<{ input: HTMLInputElement; key: string; active: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (!(el instanceof HTMLInputElement) || !el.dataset.list) return;
      if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) { e.preventDefault(); setOpen({ input: el, key: el.dataset.list, active: 0 }); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const lists = PARAMETERS.filter((p) => p.kind === 'list' && !p.fixed);
  const datalists = lists.map((p) => <datalist key={p.key} id={`vl-${p.key}`}>{listOf(db, p.key).map((v) => <option key={v} value={v} />)}</datalist>);
  if (!open) return <>{datalists}</>;

  const typed = open.input.value.trim().toLowerCase();
  const all = listOf(db, open.key);
  const values = typed ? [...all.filter((v) => v.toLowerCase().includes(typed)), ...all.filter((v) => !v.toLowerCase().includes(typed))] : all;
  const rect = open.input.getBoundingClientRect();
  const label = PARAMETERS.find((p) => p.key === open.key)?.label ?? open.key;
  const close = () => { const i = open.input; setOpen(null); i.focus(); };
  const pick = (v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(open.input, v); // fill a React-controlled input the same way typing does
    open.input.dispatchEvent(new Event('input', { bubbles: true }));
    close();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen({ ...open, active: Math.min(values.length - 1, open.active + 1) }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen({ ...open, active: Math.max(0, open.active - 1) }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (values[open.active]) pick(values[open.active]); }
  };
  return (
    <>
      {datalists}
      <div className="vl-scrim" onMouseDown={close} />
      <div className="vl-menu" role="listbox" aria-label={label} tabIndex={-1} ref={(n) => n?.focus()} onKeyDown={onKeyDown}
        style={{ left: Math.min(rect.left, window.innerWidth - 280), top: rect.bottom + 4 > window.innerHeight - 240 ? Math.max(8, rect.top - 244) : rect.bottom + 4, width: Math.max(220, Math.min(rect.width, 320)) }}>
        <div className="vl-head">{label} · ↑↓ Enter to pick, Esc to close</div>
        {values.map((v, i) => <div key={v} role="option" aria-selected={i === open.active} className={`vl-option${i === open.active ? ' active' : ''}`} onMouseDown={(e) => { e.preventDefault(); pick(v); }}>{v}</div>)}
      </div>
    </>
  );
}
