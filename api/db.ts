import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthError } from './_lib/auth.js';
import { readState, StateError, writeState } from './_lib/state.js';
import { adminEmails } from '../src/lib/auth.js';
import { isAdminCaller, validateWrite } from '../src/lib/sync-rules.js';
import type { Db } from '../src/data/types.js';

/**
 * GET  /api/db            -> { version, db }            (db is null until the first write seeds it)
 * PUT  /api/db {version, db} -> { version }            on success
 *                            -> 409 { version, db }    when someone else wrote first: rebase and retry
 *                            -> 403 { reason }         when the write changes users/roles without admin rights
 *                            -> 400 { reason }         when the database rejects the rows (constraint violation)
 *
 * Storage is relational (db/schema.sql); see api/_lib/state.ts and mapping.ts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const caller = await authenticate(req.headers.authorization);
    if (req.method === 'GET') {
      const s = await readState();
      return res.status(200).json(s ? { version: s.version, db: s.doc, updatedAt: s.updatedAt, updatedBy: s.updatedBy } : { version: 0, db: null });
    }
    if (req.method === 'PUT') {
      const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { version?: unknown; db?: unknown };
      const version = Number(body?.version);
      const db = body?.db as Db | undefined;
      if (!Number.isInteger(version) || version < 0 || !db || typeof db !== 'object' || !Array.isArray(db.users)) {
        return res.status(400).json({ reason: 'Body must be { version: integer, db: document }.' });
      }
      const current = await readState();
      if ((current?.version ?? 0) !== version) {
        return res.status(409).json({ version: current?.version ?? 0, db: current?.doc ?? null });
      }
      const admins = adminEmails(process.env.VITE_ADMIN_EMAILS);
      const check = validateWrite(caller.email, current?.doc ?? null, db, admins);
      if (!check.ok) return res.status(403).json({ reason: check.reason });
      const next = await writeState(version, db, caller.email, isAdminCaller(caller.email, current?.doc ?? null, admins));
      if (next === null) {
        const latest = await readState();
        return res.status(409).json({ version: latest?.version ?? 0, db: latest?.doc ?? null });
      }
      return res.status(200).json({ version: next });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ reason: 'Method not allowed.' });
  } catch (err) {
    if (err instanceof AuthError || err instanceof StateError) return res.status(err.status).json({ reason: err.message });
    const code = (err as { code?: string })?.code ?? '';
    if (code.startsWith('23') || code === 'P0001') return res.status(400).json({ reason: `The database rejected the change: ${(err as Error).message}` });
    console.error(err);
    return res.status(500).json({ reason: 'Unexpected server error.' });
  }
}
