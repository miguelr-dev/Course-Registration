import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthError } from './_lib/auth.js';
import { ClerkError, setClerkPassword } from './_lib/clerk.js';
import { readState, StateError } from './_lib/state.js';
import { adminEmails } from '../src/lib/auth.js';
import { passwordIssue } from '../src/lib/passwords.js';
import { isAdminCaller } from '../src/lib/sync-rules.js';

/**
 * POST /api/password { userId, password } -> { created }   (administrators only)
 *
 * Sets the password of a SignMeUp user's sign-in account. The password is passed to Clerk and
 * never written to the SignMeUp database or logs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ reason: 'Method not allowed.' }); }
  try {
    const caller = await authenticate(req.headers.authorization);
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { userId?: unknown; password?: unknown };
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const state = await readState();
    if (!isAdminCaller(caller.email, state?.doc ?? null, adminEmails(process.env.VITE_ADMIN_EMAILS))) {
      return res.status(403).json({ reason: 'Only a system administrator can set passwords.' });
    }
    const target = state?.doc.users.find((u) => u.id === userId);
    if (!target) return res.status(404).json({ reason: `User ${userId} was not found.` });
    const issue = passwordIssue(password);
    if (issue) return res.status(400).json({ reason: `${issue.reason} ${issue.requirement}` });
    const r = await setClerkPassword({ email: target.email, name: target.name, password }, process.env.CLERK_SECRET_KEY);
    return res.status(200).json(r);
  } catch (err) {
    if (err instanceof AuthError || err instanceof StateError || err instanceof ClerkError) return res.status(err.status).json({ reason: err.message });
    console.error(err);
    return res.status(500).json({ reason: 'Unexpected server error.' });
  }
}
