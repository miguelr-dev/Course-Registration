import { describe, expect, it } from 'vitest';
import { wildcardMatch } from './wildcard';

describe('wildcardMatch', () => {
  it('matches a trailing star against a hyphenated name', () => {
    expect(wildcardMatch('Hwang-*', 'Hwang-Baptiste')).toBe(true);
    expect(wildcardMatch('Hwang-*', 'Hwang')).toBe(false);
  });
  it('is case-insensitive and substring when no wildcard is present', () => {
    expect(wildcardMatch('okafor', 'Maria Okafor-Reyes')).toBe(true);
  });
  it('treats ? as a single character', () => {
    expect(wildcardMatch('CS 3?0', 'CS 310')).toBe(true);
    expect(wildcardMatch('CS 3?0', 'CS 3100')).toBe(false);
  });
  it('escapes regex metacharacters', () => {
    expect(wildcardMatch('(310)', '(310) 555-0142')).toBe(true);
  });
  it('matches everything for a blank pattern', () => {
    expect(wildcardMatch('   ', 'anything')).toBe(true);
  });
});
