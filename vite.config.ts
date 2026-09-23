import { loadEnv, type PreviewServer, type ViteDevServer } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { attachDbApi } from './server/attach';

function dbApi() {
  const attach = (server: ViteDevServer | PreviewServer) => {
    attachDbApi(server.middlewares);
  };
  return {
    name: 'signmeup-db',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.DATABASE_URL) process.env.DATABASE_URL ??= env.DATABASE_URL;
  if (env.POSTGRES_URL) process.env.POSTGRES_URL ??= env.POSTGRES_URL;
  return {
    plugins: [react(), dbApi()],
    server: { port: 5173 },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
