import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { completionGrades, letterGrades, listOf, maxUnits, normalizeList, valueListIssue } from './parameters';
import { registrationIssues } from './rules';
import { historyIssue } from './courseHistory';

const db = createSeed();
const maria = db.students.find((s) => s.id === '20231847')!;

describe('user-maintained parameters (GEN-11) and value lists (GEN-12)', () => {
  it('falls back to defaults until a list is maintained', () => {
    expect(maxUnits({ valueLists: {} })).toBe(18);
    expect(listOf({ valueLists: {} }, 'universities').length).toBeGreaterThan(0);
    expect(listOf({ valueLists: { universities: ['Somewhere'] } }, 'universities')).toEqual(['Somewhere']);
  });

  it('registration enforces the maintained unit limit', () => {
    const open = db.offerings.find((o) => registrationIssues(db, maria, o).length === 0)!;
    const tight = { ...db, valueLists: { ...db.valueLists, maxUnits: ['4'] } };
    expect(registrationIssues(tight, maria, open).map((i) => i.code)).toContain('units');
    expect(registrationIssues(tight, maria, open).find((i) => i.code === 'units')!.requirement).toContain('4 units');
  });

  it('grade entry and course history use the maintained grade list', () => {
    const noPlus = { ...db, valueLists: { ...db.valueLists, grades: ['A', 'B', 'C', 'D', 'F', 'I', 'CR', 'NC', 'AU'] } };
    expect(letterGrades(noPlus)).toEqual(['A', 'B', 'C', 'D', 'F', 'I']);
    expect(completionGrades(noPlus)).toEqual(['A', 'B', 'C', 'D', 'F', 'CR', 'NC']);
    const entry = { courseId: 'CS 101', title: 'Programming I', term: 'Winter 2023', units: 4, grade: 'A-' };
    expect(historyIssue(db, maria, 'here', entry, null)).toBeNull();
    expect(historyIssue(noPlus, maria, 'here', entry, null)?.field).toBe('grade');
  });

  it('validates edits with the reason and what is needed', () => {
    expect(valueListIssue('maxUnits', ['20'])).toBeNull();
    expect(valueListIssue('maxUnits', ['0'])?.requirement).toMatch(/1 to 30/);
    expect(valueListIssue('universities', [])?.reason).toMatch(/cannot be empty/);
    expect(valueListIssue('universities', ['UCLA', 'ucla'])?.reason).toMatch(/duplicate/);
    expect(valueListIssue('grades', ['A', 'F', 'Z'])?.reason).toMatch(/not a standard grade/);
    expect(valueListIssue('grades', ['B', 'C'])?.reason).toMatch(/A grade and F/);
    expect(valueListIssue('noteCategories', ['x'])?.reason).toMatch(/fixed/);
  });

  it('normalizes values before saving', () => {
    expect(normalizeList('grades', [' a- ', 'f', ''])).toEqual(['A-', 'F']);
    expect(normalizeList('locations', ['  Boelter   2444 '])).toEqual(['Boelter 2444']);
  });
});
