import postgres from 'postgres';
import type { Db } from '../../src/data/types.js';

/** One row holds the whole SignMeUp document; `version` makes writes compare-and-set. */
export interface Stored { version: number; doc: Db; updatedAt: string; updatedBy: string | null; }

let sql: ReturnType<typeof postgres> | null = null;
let ready: Promise<void> | null = null;

export class StateError extends Error { constructor(message: string, public status = 500) { super(message); } }

function client() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new StateError('Server is missing DATABASE_URL.', 503);
  sql = postgres(url, { ssl: 'require', max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  return sql;
}

async function ensureTable() {
  ready ??= client()`
    create table if not exists signmeup_state (
      id text primary key,
      version integer not null default 0,
      doc jsonb not null,
      updated_at timestamptz not null default now(),
      updated_by text
    )`.then(() => undefined);
  await ready;
}

export async function readState(): Promise<Stored | null> {
  await ensureTable();
  const rows = await client()<{ version: number; doc: Db; updated_at: Date; updated_by: string | null }[]>`
    select version, doc, updated_at, updated_by from signmeup_state where id = 'main'`;
  const r = rows[0];
  return r ? { version: r.version, doc: r.doc, updatedAt: r.updated_at.toISOString(), updatedBy: r.updated_by } : null;
}

/** Writes `doc` only if the stored version still equals `expected`. Returns the new version, or null on conflict. */
export async function writeState(expected: number, doc: Db, by: string): Promise<number | null> {
  await ensureTable();
  const s = client();
  const json = JSON.stringify(doc);
  if (expected === 0) {
    const rows = await s<{ version: number }[]>`
      insert into signmeup_state (id, version, doc, updated_by) values ('main', 1, ${json}::jsonb, ${by})
      on conflict (id) do nothing returning version`;
    return rows[0]?.version ?? null;
  }
  const rows = await s<{ version: number }[]>`
    update signmeup_state set doc = ${json}::jsonb, version = version + 1, updated_at = now(), updated_by = ${by}
    where id = 'main' and version = ${expected} returning version`;
  return rows[0]?.version ?? null;
}
