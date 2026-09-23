import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi, readJson, sendJson } from './http';

interface MiddlewareStack {
  use(fn: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void): void;
}

/** Serves /api/db and /api/auth during `npm run dev`. Vercel serves the same handlers from api/. */
export function attachDbApi(middlewares: MiddlewareStack) {
  middlewares.use(async (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/api/db' && path !== '/api/auth') {
      next();
      return;
    }
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? null : await readJson(req);
      const result = await handleApi(path, req.method ?? 'GET', body);
      sendJson(res, result.status, result.body);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : 'Database error' });
    }
  });
}
