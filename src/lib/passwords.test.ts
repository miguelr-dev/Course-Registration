import { describe, expect, it } from 'vitest';
import { passwordIssue, temporaryPassword } from './passwords';

describe('passwords', () => {
  it('requires 10+ characters with letters and digits and no spaces', () => {
    expect(passwordIssue('')?.reason).toBe('Password is required.');
    expect(passwordIssue('abc12345')?.reason).toBe('Password is too short.');
    expect(passwordIssue('abcdefghijk')?.reason).toMatch(/letters and digits/);
    expect(passwordIssue('abcde 12345')?.reason).toMatch(/spaces/);
    expect(passwordIssue('Aztec-Gold-2026')).toBeNull();
  });
  it('generates temporary passwords that pass the rules', () => {
    for (let i = 0; i < 50; i++) expect(passwordIssue(temporaryPassword())).toBeNull();
    expect(temporaryPassword(() => 0)).toBe('aaaa-aaaa-aa22');
  });
});
