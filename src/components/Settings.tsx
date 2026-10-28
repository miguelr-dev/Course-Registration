import { useState } from 'react';
import { useStore } from '../data/store';
import type { HelpTopic } from '../data/types';
import { listOf, PARAMETERS } from '../lib/parameters';
import { formatDateTime } from '../lib/format';
import { HELP } from './help';
import { MODULES } from '../modules';
import { Banner, Chip } from './ui';
import { Plus, X } from './icons';
import { useToast } from './Shell';

/**
 * Value lists and validation parameters (GEN-11, GEN-12), maintained by administrators. Each list
 * is edited as a draft; Save stores it and Cancel and restore discards the changes.
 */
export function ValueListsEditor() {
  const { db, saveValueList } = useStore();
  const toast = useToast();
  const [key, setKey] = useState(PARAMETERS[0].key);
  const def = PARAMETERS.find((p) => p.key === key)!;
  const stored = listOf(db, key);
  const [draft, setDraft] = useState<string[]>(stored);
  const [adding, setAdding] = useState('');
  const [err, setErr] = useState<{ reason: string; requirement: string } | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const choose = (k: string) => { setKey(k); setDraft(listOf(db, k)); setAdding(''); setErr(null); };
  const move = (i: number, d: number) => { const n = [...draft]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); setDraft(n); };
  function save() {
    const r = saveValueList(key, draft);
    if (!r.ok) return setErr(r);
    setErr(null);
    toast(`${def.label} saved`);
  }
  return (
    <div className="settings-grid">
      <nav className="card settings-list" aria-label="Value lists">
        {PARAMETERS.map((p) => (
          <button key={p.key} className={`settings-item${p.key === key ? ' active' : ''}`} onClick={() => choose(p.key)}>
            <span className="title">{p.label}</span>
            <span className="detail">{p.fixed ? 'Fixed' : p.kind === 'number' ? listOf(db, p.key)[0] : `${listOf(db, p.key).length} values`}</span>
          </button>
        ))}
      </nav>
      <div className="card">
        <div className="card-head"><div><h2>{def.label}</h2><div className="sub">{def.help}</div></div>{def.fixed && <Chip kind="neutral">Fixed</Chip>}</div>
        <div className="card-body">
          {def.kind === 'number' ? (
            <div className="field" style={{ maxWidth: 220 }}><label className="label" htmlFor="param-num">Value <span className="req">*</span></label>
              <input id="param-num" className="input" type="number" min={1} max={30} value={draft[0] ?? ''} onChange={(e) => { setDraft([e.target.value]); setErr(null); }} /></div>
          ) : (
            <>
              <ol className="value-list">
                {draft.map((v, i) => (
                  <li key={`${v}-${i}`}>
                    <span className="grow">{v}</span>
                    {!def.fixed && <>
                      <button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${v} up`}>↑</button>
                      <button className="btn ghost sm" disabled={i === draft.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${v} down`}>↓</button>
                      <button className="btn ghost sm icon" onClick={() => { setDraft(draft.filter((_, j) => j !== i)); setErr(null); }} aria-label={`Remove ${v}`}><X /></button>
                    </>}
                  </li>
                ))}
              </ol>
              {!def.fixed && (
                <form className="cluster" onSubmit={(e) => { e.preventDefault(); if (adding.trim()) { setDraft([...draft, adding.trim()]); setAdding(''); setErr(null); } }}>
                  <input className="input grow" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a value" aria-label="New value" />
                  <button className="btn secondary" type="submit" disabled={!adding.trim()}><Plus />Add</button>
                </form>
              )}
            </>
          )}
          {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
        </div>
        {!def.fixed && (
          <div className="card-foot">
            <div className="cluster">
              <button className="btn" disabled={!dirty} onClick={save}>Save list</button>
              <button className="btn ghost" disabled={!dirty} onClick={() => { setDraft(stored); setErr(null); }}>Cancel and restore</button>
              <span className="sub right">In any field that uses this list, press F4 or Alt+↓ to pick a value.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const HELP_KEYS = Object.keys(HELP);
const screenName = (key: string) => HELP[key]?.title ?? key;

/** On-line help maintenance under security control: administrators edit each screen's help, or restore the built-in text. */
export function HelpEditor({ initialKey }: { initialKey?: string | null }) {
  const { db, saveHelpTopic } = useStore();
  const toast = useToast();
  const [key, setKey] = useState(initialKey && HELP[initialKey] ? initialKey : HELP_KEYS[0]);
  const stored = db.helpTopics?.[key];
  const current: HelpTopic = stored?.editedAt ? stored : HELP[key];
  const [draft, setDraft] = useState<HelpTopic>(current);
  const [err, setErr] = useState<{ reason: string; requirement: string } | null>(null);
  const dirty = JSON.stringify([draft.title, draft.summary, draft.fields]) !== JSON.stringify([current.title, current.summary, current.fields]);
  const choose = (k: string) => { setKey(k); const s = db.helpTopics?.[k]; setDraft(s?.editedAt ? s : HELP[k]); setErr(null); };
  const setField = (i: number, j: 0 | 1, v: string) => setDraft({ ...draft, fields: draft.fields.map((f, n) => (n === i ? (j === 0 ? [v, f[1]] : [f[0], v]) : f)) });
  function save() {
    const r = saveHelpTopic(key, draft);
    if (!r.ok) return setErr(r);
    setErr(null);
    toast(`Help for ${screenName(key)} saved`);
  }
  function restore() {
    saveHelpTopic(key, null);
    setDraft(HELP[key]);
    setErr(null);
    toast(`Help for ${screenName(key)} restored to the built-in text`);
  }
  const usedBy = MODULES.filter((m) => m.home.replace('/', '') === key).map((m) => m.label);
  return (
    <div className="settings-grid">
      <nav className="card settings-list" aria-label="Help screens">
        {HELP_KEYS.map((k) => (
          <button key={k} className={`settings-item${k === key ? ' active' : ''}`} onClick={() => choose(k)}>
            <span className="title">{screenName(k)}</span>
            <span className="detail">{db.helpTopics?.[k]?.editedAt ? `Edited ${formatDateTime(db.helpTopics[k].editedAt!)}` : 'Built-in text'}</span>
          </button>
        ))}
      </nav>
      <div className="card">
        <div className="card-head"><div><h2>Help · {screenName(key)}</h2><div className="sub">{stored?.editedAt ? `Edited by ${stored.editedBy} · ${formatDateTime(stored.editedAt)}` : 'Built-in text'}{usedBy.length ? ` · ${usedBy.join(', ')}` : ''}</div></div></div>
        <div className="card-body">
          <div className="field"><label className="label" htmlFor="help-title">Title <span className="req">*</span></label><input id="help-title" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
          <div className="field"><label className="label" htmlFor="help-summary">What this screen is for <span className="req">*</span></label><textarea id="help-summary" className="input" rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></div>
          <span className="label">Field help</span>
          {draft.fields.map(([f, d], i) => (
            <div key={i} className="help-field-row">
              <input className="input" value={f} onChange={(e) => setField(i, 0, e.target.value)} aria-label={`Field ${i + 1} name`} placeholder="Field" />
              <textarea className="input" rows={2} value={d} onChange={(e) => setField(i, 1, e.target.value)} aria-label={`Field ${i + 1} description`} placeholder="Say whether it is mandatory and what it accepts" />
              <button className="btn ghost sm icon" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, n) => n !== i) })} aria-label={`Remove field ${f || i + 1}`}><X /></button>
            </div>
          ))}
          <div><button className="btn secondary sm" onClick={() => setDraft({ ...draft, fields: [...draft.fields, ['', '']] })}><Plus />Add field help</button></div>
          {err && <Banner kind="error"><strong>{err.reason}</strong> {err.requirement}</Banner>}
        </div>
        <div className="card-foot">
          <div className="cluster">
            <button className="btn" disabled={!dirty} onClick={save}>Save help</button>
            <button className="btn ghost" disabled={!dirty} onClick={() => { setDraft(current); setErr(null); }}>Cancel and restore</button>
            {stored?.editedAt && <button className="btn secondary right" onClick={restore}>Restore built-in text</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
