/**
 * Initialize or reset a user's password through Clerk's Backend API (FW-05, FW-07). SignMeUp never
 * stores passwords: the new one goes straight to Clerk, which hashes it. When the address has no
 * Clerk account yet, one is created with that password, which is how an administrator initializes
 * a password for someone who has never signed in.
 */
const API = 'https://api.clerk.com/v1';

export class ClerkError extends Error { constructor(message: string, public status = 502) { super(message); } }

type Fetch = typeof fetch;

async function call<T>(f: Fetch, secretKey: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await f(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => null)) as { errors?: { message?: string; long_message?: string }[] } | null;
  if (!res.ok) {
    const e = data?.errors?.[0];
    // 422 is Clerk rejecting the password itself (too short, found in a breach list): show its message to the admin.
    throw new ClerkError(e?.long_message ?? e?.message ?? `Clerk returned ${res.status}.`, res.status === 422 ? 400 : 502);
  }
  return data as T;
}

export async function setClerkPassword(
  { email, name, password }: { email: string; name: string; password: string },
  secretKey: string | undefined,
  f: Fetch = fetch,
): Promise<{ created: boolean }> {
  if (!secretKey) throw new ClerkError('Server is missing CLERK_SECRET_KEY, so passwords cannot be set from SignMeUp.', 503);
  const found = await call<{ id: string }[]>(f, secretKey, `/users?email_address=${encodeURIComponent(email)}&limit=1`);
  if (found.length) {
    await call(f, secretKey, `/users/${found[0].id}`, { method: 'PATCH', body: { password, sign_out_of_all_sessions: true } });
    return { created: false };
  }
  const [first, ...rest] = name.trim().split(/\s+/);
  await call(f, secretKey, '/users', { method: 'POST', body: { email_address: [email], password, first_name: first || undefined, last_name: rest.join(' ') || undefined } });
  return { created: true };
}
