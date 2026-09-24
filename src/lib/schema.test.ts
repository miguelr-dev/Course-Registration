import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMA_SQL } from '../../api/_lib/schema';

describe('api/_lib/schema.ts', () => {
  it('matches db/schema.sql (run `npm run schema` after editing the SQL)', () => {
    const sql = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');
    expect(SCHEMA_SQL).toBe(sql);
  });
  it('creates the version row the API locks on and the append-only guard', () => {
    expect(SCHEMA_SQL).toMatch(/create table if not exists document_version/);
    expect(SCHEMA_SQL).toMatch(/signmeup\.allow_delete/);
  });
});
