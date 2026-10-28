import type { Db } from './types';

export type LoadResult =
  | { kind: 'ok'; version: number; db: Db | null }
  | { kind: 'denied'; reason: string }
  | { kind: 'unavailable'; reason: string };

export type SaveResult =
  | { kind: 'ok'; version: number }
  | { kind: 'conflict'; version: number; db: Db | null }
  | { kind: 'refused'; reason: string }
  | { kind: 'unavailable'; reason: string };

/** Plain `npm run dev` serves the app but not the /api functions, so /api/db answers with the app's HTML page. */
const NO_API = 'the database API is not running here. Plain npm run dev serves only the app; run vercel dev to use the shared database';

/** Talks to /api/db: one shared document with compare-and-set versions. */
export class SyncClient {
  constructor(private readonly getToken: () => Promise<string | null>) {}

  private async request(method: 'GET' | 'PUT', body?: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
    const token = await this.getToken();
    const res = await fetch('/api/db', {
      method,
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    const json = isJson ? ((await res.json()) as Record<string, unknown>) : null;
    return { status: res.status, json };
  }

  async load(): Promise<LoadResult> {
    try {
      const { status, json } = await this.request('GET');
      if (status === 200 && json) return { kind: 'ok', version: Number(json.version ?? 0), db: (json.db as Db | null) ?? null };
      if (status === 401 || status === 403) return { kind: 'denied', reason: String(json?.reason ?? 'Not allowed.') };
      if (!json && status === 200) return { kind: 'unavailable', reason: NO_API };
      return { kind: 'unavailable', reason: String(json?.reason ?? `Shared database returned ${status}.`) };
    } catch (e) {
      return { kind: 'unavailable', reason: e instanceof Error ? e.message : 'Network error.' };
    }
  }

  /** Administrator only: initialize or reset a user's sign-in password. The password goes to the sign-in service, never into the document. */
  async setPassword(userId: string, password: string): Promise<{ ok: true; created: boolean } | { ok: false; reason: string }> {
    try {
      const token = await this.getToken();
      const res = await fetch('/api/password', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId, password }),
      });
      const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
      const json = isJson ? ((await res.json()) as Record<string, unknown>) : null;
      if (res.status === 200 && json) return { ok: true, created: Boolean(json.created) };
      return { ok: false, reason: String(json?.reason ?? `Password service returned ${res.status}.`) };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'Network error.' };
    }
  }

  async save(version: number, db: Db): Promise<SaveResult> {
    try {
      const { status, json } = await this.request('PUT', { version, db });
      if (status === 200 && json) return { kind: 'ok', version: Number(json.version) };
      if (status === 409 && json) return { kind: 'conflict', version: Number(json.version ?? 0), db: (json.db as Db | null) ?? null };
      if (status === 403 || status === 401 || status === 400) return { kind: 'refused', reason: String(json?.reason ?? 'Change refused.') };
      return { kind: 'unavailable', reason: String(json?.reason ?? `Shared database returned ${status}.`) };
    } catch (e) {
      return { kind: 'unavailable', reason: e instanceof Error ? e.message : 'Network error.' };
    }
  }
}
