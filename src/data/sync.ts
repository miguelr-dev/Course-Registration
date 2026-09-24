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
      return { kind: 'unavailable', reason: String(json?.reason ?? `Shared database returned ${status}.`) };
    } catch (e) {
      return { kind: 'unavailable', reason: e instanceof Error ? e.message : 'Network error.' };
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
