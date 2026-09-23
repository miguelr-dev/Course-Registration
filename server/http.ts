import type { IncomingMessage, ServerResponse } from 'node:http';
import { withoutPasswords } from '../src/data/relational';
import type { Db } from '../src/data/types';
import { authenticate, databaseUrl, loadState, saveSnapshot } from './persist';

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function readRaw(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const withBody = req as IncomingMessage & { body?: unknown };
  if (withBody.body && typeof withBody.body === 'object') return withBody.body;
  if (typeof withBody.body === 'string') return withBody.body ? JSON.parse(withBody.body) as unknown : null;
  const raw = await readRaw(req);
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

function isDb(value: unknown): value is Db {
  if (!value || typeof value !== 'object') return false;
  const db = value as Partial<Db>;
  return typeof db.term === 'string'
    && !!db.gradeWindow && typeof db.gradeWindow === 'object'
    && Array.isArray(db.users)
    && Array.isArray(db.departments)
    && Array.isArray(db.courses)
    && Array.isArray(db.offerings)
    && Array.isArray(db.registrations)
    && Array.isArray(db.students)
    && Array.isArray(db.faculty)
    && Array.isArray(db.majors)
    && Array.isArray(db.outlines)
    && Array.isArray(db.gradeNotes)
    && Array.isArray(db.transactions);
}

export async function handleApi(pathname: string, method: string, body: unknown): Promise<{ status: number; body: unknown }> {
  if (!databaseUrl()) {
    return { status: 503, body: { error: 'DATABASE_URL or POSTGRES_URL is not set. Add the connection string from your Postgres project.' } };
  }
  if (pathname === '/api/auth' && method === 'POST') {
    const creds = (body ?? {}) as { id?: unknown; password?: unknown; at?: unknown };
    const result = await authenticate(String(creds.id ?? ''), String(creds.password ?? ''), String(creds.at ?? ''));
    return { status: result.ok ? 200 : 401, body: result };
  }
  if (pathname === '/api/db' && method === 'GET') {
    return { status: 200, body: withoutPasswords(await loadState()) };
  }
  if (pathname === '/api/db' && method === 'PUT') {
    if (!isDb(body)) return { status: 400, body: { error: 'Expected a SignMeUp database snapshot.' } };
    await saveSnapshot(body);
    return { status: 200, body: { ok: true } };
  }
  return { status: 405, body: { error: 'Method not allowed.' } };
}
