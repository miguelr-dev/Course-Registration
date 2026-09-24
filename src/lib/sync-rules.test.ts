import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { provisionUser } from './auth';
import { validateWrite } from './sync-rules';

const me = 'someone@sdsu.edu';

describe('validateWrite', () => {
  it('lets a student create only their own student record on first sign-in', () => {
    const before = createSeed();
    const after = provisionUser(before, { email: me, name: 'Some One', clerkUserId: 'u1', admin: false }).db;
    expect(validateWrite(me, before, after, [])).toEqual({ ok: true });
  });
  it('refuses a self-created account that is not a plain student', () => {
    const before = createSeed();
    const after = provisionUser(before, { email: me, name: 'Some One', clerkUserId: 'u1', admin: true }).db;
    expect(validateWrite(me, before, after, []).ok).toBe(false);
  });
  it('allows a listed admin address to bootstrap itself as admin', () => {
    const before = createSeed();
    const after = provisionUser(before, { email: me, name: 'Some One', clerkUserId: 'u1', admin: true }).db;
    expect(validateWrite(me, before, after, [me])).toEqual({ ok: true });
  });
  it('refuses a non-admin who changes another user or their own role', () => {
    const before = provisionUser(createSeed(), { email: me, name: 'Some One', clerkUserId: 'u1', admin: false }).db;
    const promoted = { ...before, users: before.users.map((u) => (u.email === me ? { ...u, role: 'admin' as const } : u)) };
    expect(validateWrite(me, before, promoted, []).ok).toBe(false);
    const removed = { ...before, users: before.users.filter((u) => u.id !== '10093') };
    expect(validateWrite(me, before, removed, []).ok).toBe(false);
    const added = { ...before, users: [...before.users, { id: '99999', name: 'X', email: 'x@sdsu.edu', jobTitle: 'Y', role: 'faculty' as const, access: ['GRADE' as const] }] };
    expect(validateWrite(me, before, added, []).ok).toBe(false);
  });
  it('allows sign-in stamps and non-user data changes for anyone', () => {
    const before = provisionUser(createSeed(), { email: me, name: 'Some One', clerkUserId: 'u1', admin: false }).db;
    const after = { ...before, users: before.users.map((u) => (u.email === me ? { ...u, lastSignIn: '2026-09-24T09:00:00', clerkUserId: 'u1' } : u)), transactions: [...before.transactions, { at: 'now', by: 'Some One', subsystem: 'REG' as const, text: 'Registered' }] };
    expect(validateWrite(me, before, after, [])).toEqual({ ok: true });
  });
  it('lets an existing admin do anything', () => {
    const before = createSeed();
    const admin = { ...before, users: [...before.users, { id: '77777', name: 'Admin', email: 'admin@sdsu.edu', jobTitle: 'Admin', role: 'admin' as const, access: ['USERS' as const] }] };
    const after = { ...admin, users: admin.users.filter((u) => u.id !== '10093') };
    expect(validateWrite('admin@sdsu.edu', admin, after, [])).toEqual({ ok: true });
  });
});
