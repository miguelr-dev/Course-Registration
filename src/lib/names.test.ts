import { describe, expect, it } from 'vitest';
import { fullName, nameIssue, normalizeName, sortName } from './names';

describe('names', () => {
  it('accepts hyphens in any component', () => {
    expect(nameIssue('Mary-Kate', 'First name', true)).toBeNull();
    expect(nameIssue('Luz-Elena', 'Middle name', false)).toBeNull();
    expect(nameIssue('Okafor-Reyes', 'Last name', true)).toBeNull();
    expect(nameIssue('Hwang-Baptiste-Lund', 'Last name', true)).toBeNull();
  });
  it('accepts accents, apostrophes, periods and spaces', () => {
    for (const n of ['Tomás', 'O’Neil', "D'Angelo", 'St. James', 'de la Cruz', 'Nguyễn']) expect(nameIssue(n, 'Last name', true)).toBeNull();
  });
  it('closes up spaces around hyphens and collapses whitespace', () => {
    expect(normalizeName('  Okafor - Reyes ')).toBe('Okafor-Reyes');
    expect(normalizeName('de   la Cruz')).toBe('de la Cruz');
    expect(nameIssue('Okafor - Reyes', 'Last name', true)).toBeNull();
  });
  it('rejects misplaced hyphens and other characters with the reason and the requirement', () => {
    for (const n of ['-Reyes', 'Okafor--Reyes', 'Okafor-', 'R2-D2', 'Smith!']) {
      const issue = nameIssue(n, 'Last name', true);
      expect(issue).not.toBeNull();
      expect(issue!.requirement).toMatch(/hyphen/);
    }
  });
  it('requires first and last names but not the middle name', () => {
    expect(nameIssue('  ', 'Last name', true)?.reason).toBe('Last name is required.');
    expect(nameIssue('', 'Middle name', false)).toBeNull();
  });
  it('builds full names and sort keys with hyphenated parts intact', () => {
    expect(fullName({ firstName: 'Maria', middleName: 'Luz', lastName: 'Okafor-Reyes' })).toBe('Maria Luz Okafor-Reyes');
    expect(fullName({ firstName: 'Tomás', lastName: 'Bravo' })).toBe('Tomás Bravo');
    expect(sortName({ firstName: 'Maria', lastName: 'Okafor-Reyes' })).toBe('okafor-reyes, maria');
  });
});
