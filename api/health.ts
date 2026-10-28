import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ping, StateError } from './_lib/state.js';

/**
 * GET /api/health -> { ok, databaseMs }
 *
 * Runs a trivial query against the shared database. Vercel Cron calls it daily (vercel.json) so the
 * free Supabase project never sits idle long enough to be paused. It returns no data.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    return res.status(200).json({ ok: true, databaseMs: await ping() });
  } catch (err) {
    const status = err instanceof StateError ? err.status : 503;
    return res.status(status).json({ ok: false, reason: err instanceof StateError ? err.message : 'Database unreachable.' });
  }
}
