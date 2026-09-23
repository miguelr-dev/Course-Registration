import { readFileSync } from 'node:fs';
import { createSeed } from '../src/data/seed';
import { loadState, saveSnapshot } from '../server/persist';

const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split('\n')
  .find((entry) => entry.startsWith('DATABASE_URL='));
if (!line) throw new Error('DATABASE_URL is missing from .env');
process.env.DATABASE_URL = line.slice('DATABASE_URL='.length).trim();

await saveSnapshot(createSeed());
const db = await loadState();
console.log(`Seeded ${db.term}: ${db.students.length} students, ${db.courses.length} courses, ${db.offerings.length} offerings, ${db.registrations.length} registrations`);
process.exit(0);
