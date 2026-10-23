import { describe, expect, it } from 'vitest';
import { meetsResponseTarget, RESPONSE_TARGET_MS, saveTimeLabel } from './performance';

describe('GEN-02 5-second response target', () => {
  it('is 5 seconds', () => {
    expect(RESPONSE_TARGET_MS).toBe(5000);
  });
  it('passes saves up to and including 5 seconds', () => {
    expect(meetsResponseTarget(412)).toBe(true);
    expect(meetsResponseTarget(5000)).toBe(true);
    expect(meetsResponseTarget(5001)).toBe(false);
  });
  it('labels the last save and flags one over the target', () => {
    expect(saveTimeLabel(null)).toBe('');
    expect(saveTimeLabel(412)).toBe('last save 412 ms');
    expect(saveTimeLabel(6200)).toBe('last save 6.2 s · over the 5 s target');
  });
});
