import { describe, expect, it } from 'vitest';
import { ClerkError, setClerkPassword } from './clerk';

type Call = { url: string; method: string; body: unknown; auth: string | null };

function fakeFetch(responses: { status: number; json: unknown }[]) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init.headers).get('Authorization') });
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const who = { email: 'pat@sdsu.edu', name: 'Pat Okafor-Reyes', password: 'Aztec-Gold-2026' };

describe('setClerkPassword', () => {
  it('resets the password of an existing account and signs it out everywhere', async () => {
    const { f, calls } = fakeFetch([{ status: 200, json: [{ id: 'user_1' }] }, { status: 200, json: { id: 'user_1' } }]);
    expect(await setClerkPassword(who, 'sk_test_x', f)).toEqual({ created: false });
    expect(calls[0].url).toBe('https://api.clerk.com/v1/users?email_address=pat%40sdsu.edu&limit=1');
    expect(calls[0].auth).toBe('Bearer sk_test_x');
    expect(calls[1]).toMatchObject({ url: 'https://api.clerk.com/v1/users/user_1', method: 'PATCH', body: { password: who.password, sign_out_of_all_sessions: true } });
  });
  it('creates the sign-in account with the password when none exists (initialize)', async () => {
    const { f, calls } = fakeFetch([{ status: 200, json: [] }, { status: 200, json: { id: 'user_2' } }]);
    expect(await setClerkPassword(who, 'sk_test_x', f)).toEqual({ created: true });
    expect(calls[1]).toMatchObject({ method: 'POST', body: { email_address: ['pat@sdsu.edu'], password: who.password, first_name: 'Pat', last_name: 'Okafor-Reyes' } });
  });
  it("passes Clerk's reason through when it rejects the password", async () => {
    const { f } = fakeFetch([{ status: 200, json: [{ id: 'user_1' }] }, { status: 422, json: { errors: [{ message: 'bad', long_message: 'Password has been found in an online data breach.' }] } }]);
    await expect(setClerkPassword(who, 'sk_test_x', f)).rejects.toMatchObject({ status: 400, message: 'Password has been found in an online data breach.' });
  });
  it('refuses without a secret key', async () => {
    await expect(setClerkPassword(who, undefined)).rejects.toBeInstanceOf(ClerkError);
  });
});
