import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { docToTables, SELECTS, TABLES, tablesToDoc } from '../../api/_lib/mapping';

describe('relational mapping', () => {
  it('round-trips the sample university through the tables without loss', () => {
    const seed = createSeed();
    const back = tablesToDoc(docToTables(seed));
    expect(back).toEqual(seed);
  });
  it('keeps administrator help edits with their stamp, and reads older unstamped rows as plain topics', () => {
    const seed = createSeed();
    const edited = { title: 'Grades', summary: 'Edited summary.', fields: [['Grade', 'Pick one.']] as [string, string][], editedBy: 'Kenji Ibarra-Novak', editedAt: '2026-10-27T10:00:00' };
    expect(tablesToDoc(docToTables({ ...seed, helpTopics: { grades: edited } })).helpTopics.grades).toEqual(edited);
    const legacy = { ...docToTables(seed), help_topics: [{ key: 'search', title: 'Old', summary: 'Old summary.', fields: '[["Q","Old note."]]' }] };
    expect(tablesToDoc(legacy).helpTopics.search).toEqual({ title: 'Old', summary: 'Old summary.', fields: [['Q', 'Old note.']] });
  });
  it('covers every table in dependency order with a SELECT', () => {
    for (const spec of TABLES) {
      expect(SELECTS[spec.table]).toMatch(new RegExp(`from "${spec.table}"`));
      for (const k of spec.keys) expect(spec.cols).toContain(k);
    }
    const order = TABLES.map((t) => t.table);
    expect(order.indexOf('students')).toBeLessThan(order.indexOf('student_notes'));
    expect(order.indexOf('courses')).toBeLessThan(order.indexOf('offerings'));
    expect(order.indexOf('offerings')).toBeLessThan(order.indexOf('registrations'));
  });
  it('formats dates, times and timestamps as the document strings', () => {
    expect(SELECTS.offerings).toContain(`to_char("start_time", 'HH24:MI') as "start_time"`);
    expect(SELECTS.transactions).toContain(`to_char("at", 'YYYY-MM-DD"T"HH24:MI:SS') as "at"`);
    expect(SELECTS.students).toContain(`to_char("date_of_birth", 'YYYY-MM-DD') as "date_of_birth"`);
  });
  it('produces an empty document from empty tables', () => {
    const d = tablesToDoc({});
    expect(d.users).toEqual([]);
    expect(d.term).toBe('');
  });
});
