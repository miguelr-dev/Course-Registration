import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isAllowedEmail } from '../../src/lib/auth';

export interface Caller { sub: string; email: string; }

/** Clerk's Frontend API host is encoded in the publishable key, so the JWKS URL needs no secret. */
function frontendApiHost(publishableKey: string): string {
  const b64 = publishableKey.replace(/^pk_(test|live)_/, '');
  return Buffer.from(b64, 'base64').toString('utf8').replace(/\$$/, '');
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export class AuthError extends Error { constructor(message: string, public status = 401) { super(message); } }

export async function authenticate(authorization: string | undefined): Promise<Caller> {
  const pk = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!pk) throw new AuthError('Server is missing VITE_CLERK_PUBLISHABLE_KEY.', 500);
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) throw new AuthError('Sign in to use the shared database.');
  jwks ??= createRemoteJWKSet(new URL(`https://${frontendApiHost(pk)}/.well-known/jwks.json`));
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, jwks));
  } catch {
    throw new AuthError('Session token is invalid or expired.');
  }
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email) throw new AuthError('Session token has no email claim. Configure the Clerk session claims (see README).', 500);
  if (!isAllowedEmail(email)) throw new AuthError('This address is not an SDSU address.', 403);
  return { sub: String(payload.sub ?? ''), email };
}
