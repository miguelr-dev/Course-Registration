import postgres from 'postgres';
import type { Db } from '../../src/data/types.js';
import { SCHEMA_SQL } from './schema.js';
import { docToTables, SELECTS, TABLES, tablesToDoc, type Row } from './mapping.js';

/**
 * Storage for the SignMeUp document on Supabase Postgres. The document is never stored as a
 * blob: every read assembles it from the relational tables and every write is diffed against
 * the current rows and applied as inserts, updates and deletes inside one transaction that
 * holds a lock on document_version (compare-and-set).
 */
export interface Stored { version: number; doc: Db; updatedAt: string; updatedBy: string | null; }

type Sql = ReturnType<typeof postgres>;
type Q = Sql | postgres.TransactionSql;

let sql: Sql | null = null;
let ready: Promise<void> | null = null;

export class StateError extends Error { constructor(message: string, public status = 500) { super(message); } }

function client(): Sql {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new StateError('Server is missing DATABASE_URL.', 503);
  sql = postgres(url, { ssl: 'require', max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  return sql;
}

/** First connection from this function instance: apply db/schema.sql (idempotent). */
async function ensureSchema() {
  ready ??= client().unsafe(SCHEMA_SQL).then(() => undefined);
  await ready;
}

async function loadTables(q: Q): Promise<Record<string, Row[]>> {
  const out: Record<string, Row[]> = {};
  for (const spec of TABLES) out[spec.table] = (await q.unsafe(SELECTS[spec.table])) as unknown as Row[];
  return out;
}

export async function readState(): Promise<Stored | null> {
  await ensureSchema();
  const s = client();
  const v = await s<{ version: number; updated_at: string; updated_by: string | null }[]>`
    select version, updated_at::text as updated_at, updated_by from document_version where id = 'main'`;
  if (!v[0]) return null;
  return { version: v[0].version, doc: tablesToDoc(await loadTables(s)), updatedAt: v[0].updated_at, updatedBy: v[0].updated_by };
}

const CHUNK = 200;

async function applyDocument(tx: postgres.TransactionSql, before: Db, after: Db) {
  const b = docToTables(before);
  const a = docToTables(after);
  const keyOf = (spec: (typeof TABLES)[number], row: Row) => JSON.stringify(spec.keys.map((k) => row[k]));
  const same = (spec: (typeof TABLES)[number], x: Row, y: Row) => spec.cols.every((c) => (x[c] ?? null) === (y[c] ?? null));

  // Inserts and updates, parents first.
  for (const spec of TABLES) {
    const prev = new Map(b[spec.table].map((r) => [keyOf(spec, r), r]));
    const changed = a[spec.table].filter((row) => {
      const p = prev.get(keyOf(spec, row));
      return !p || (!spec.appendOnly && !same(spec, p, row));
    });
    const nonKeys = spec.cols.filter((c) => !spec.keys.includes(c));
    const onConflict = spec.appendOnly || nonKeys.length === 0
      ? 'do nothing'
      : `do update set ${nonKeys.map((c) => `"${c}" = excluded."${c}"`).join(', ')}`;
    for (let i = 0; i < changed.length; i += CHUNK) {
      const rows = changed.slice(i, i + CHUNK) as Record<string, never>[];
      await tx`insert into ${tx(spec.table)} ${tx(rows, ...spec.cols)} on conflict (${tx(spec.keys)}) ${tx.unsafe(onConflict)}`;
    }
  }
  // Deletes, children first. Append-only tables are never deleted from directly; an
  // administrator's reset removes their parents and cascades (see reject_change in the schema).
  for (const spec of [...TABLES].reverse()) {
    if (spec.appendOnly) continue;
    const keep = new Set(a[spec.table].map((r) => keyOf(spec, r)));
    for (const row of b[spec.table]) {
      if (keep.has(keyOf(spec, row))) continue;
      const where = spec.keys.map((k, i) => `"${k}" = $${i + 1}`).join(' and ');
      await tx.unsafe(`delete from "${spec.table}" where ${where}`, spec.keys.map((k) => row[k] as never));
    }
  }
}

/**
 * Writes `doc` only if the stored version still equals `expected`. Returns the new version, or
 * null on conflict. `admin` allows deletes of append-only rows to cascade (sample-data reset).
 */
export async function writeState(expected: number, doc: Db, by: string, admin = false): Promise<number | null> {
  await ensureSchema();
  const result = await client().begin(async (tx) => {
    await tx`insert into document_version (id, version) values ('main', 0) on conflict (id) do nothing`;
    const [row] = await tx<{ version: number }[]>`select version from document_version where id = 'main' for update`;
    if (row.version !== expected) return null;
    if (admin) await tx`select set_config('signmeup.allow_delete', 'on', true)`;
    const before = expected === 0 ? tablesToDoc({}) : tablesToDoc(await loadTables(tx));
    await applyDocument(tx, before, doc);
    const next = expected + 1;
    await tx`update document_version set version = ${next}, updated_at = now(), updated_by = ${by} where id = 'main'`;
    return next;
  });
  return result as number | null;
}
