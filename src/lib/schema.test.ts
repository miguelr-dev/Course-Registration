import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMA_SQL } from '../../api/_lib/schema';

describe('api/_lib/schema.ts', () => {
  it('matches db/schema.sql (run `npm run schema` after editing the SQL)', () => {
    const sql = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');
    expect(SCHEMA_SQL).toBe(sql);
  });
  it('creates the document table the API relies on', () => {
    expect(SCHEMA_SQL).toMatch(/create table if not exists signmeup_state/);
  });
});
