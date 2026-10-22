import { describe, expect, it } from 'vitest';
import { VALUE_LISTS } from './data/seed';
import { HOME_PATH, MODULES } from './modules';

describe('module registry', () => {
  it('has exactly one module per access area', () => {
    expect(MODULES.map((m) => m.code).sort()).toEqual([...VALUE_LISTS.subsystems].sort());
  });
  it('gives every route path to only one module', () => {
    const paths = MODULES.flatMap((m) => m.routes.map((r) => r.path));
    expect(new Set(paths).size).toBe(paths.length);
  });
  it('opens each module at one of its own routes', () => {
    for (const m of MODULES) {
      expect(m.routes.map((r) => r.path)).toContain(m.home);
      expect(HOME_PATH[m.code]).toBe(m.home);
    }
  });
  it('loads every screen as a separate module', async () => {
    for (const r of MODULES.flatMap((m) => m.routes)) expect(typeof r.load).toBe('function');
  });
});
