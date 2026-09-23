import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi, readJson, sendJson } from '../server/http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = req.method === 'POST' ? await readJson(req) : null;
    const result = await handleApi('/api/auth', req.method ?? 'GET', body);
    sendJson(res, result.status, result.body);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Database error' });
  }
}
