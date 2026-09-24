// Copies db/schema.sql into api/_lib/schema.ts so the serverless function can apply it
// without reading files at runtime. Run with `npm run schema` after editing db/schema.sql.
import { readFileSync, writeFileSync } from 'node:fs';

const sql = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const out = `// Generated from db/schema.sql by scripts/schema-to-ts.mjs. Do not edit by hand; run \`npm run schema\`.
export const SCHEMA_SQL = ${JSON.stringify(sql)};
`;
writeFileSync(new URL('../api/_lib/schema.ts', import.meta.url), out);
console.log('api/_lib/schema.ts updated');
