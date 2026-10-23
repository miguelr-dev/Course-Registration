import { describe, expect, it } from 'vitest';
import { createSeed } from '../../src/data/seed';
import type { Db, Faculty } from '../../src/data/types';
import { applyFacultySave } from '../../src/lib/faculty';
import { checkObjectPermissions } from './permissions';
import { docToTables, tablesToDoc } from './mapping';

/** FCI-01, FCI-02 end to end: what the faculty editor saves must pass the server's object-based security and survive storage. */
const db = createSeed();
const email = (id: string) => db.users.find((u) => u.id === id)!.email;
const nameOf = (id: string) => db.users.find((u) => u.id === id)!.name;
const ADMIN = '10093';
const PRIYA = '41208'; // registrar
const ROSA = '30117'; // advisor
const MARIA = '20231847'; // student
const NAKAMURA = '28804'; // faculty
const newcomer: Faculty = { id: 'F-12345', name: 'Ana Ruiz-Soto', positionTitle: 'Lecturer', officePhone: '(310) 555-0199', office: 'Boelter 2100', officeHours: 'Wed 1:00–2:00 PM', deptId: 'CS', teachesIn: ['CS', 'MATH'], email: 'aruiz@sdsu.edu' };
const saved = (userId: string): Db => {
  const r = applyFacultySave(db, { role: 'admin', access: ['FCI'] }, { faculty: newcomer, courses: ['CS 101', 'CS 201'] }, null); // the server decides who may send it
  if (!r.ok || !r.log) throw new Error('fixture faculty should be valid');
  return { ...r.db, transactions: [...r.db.transactions, { at: '2026-10-23T10:00:00', by: nameOf(userId), subsystem: 'FCI', text: r.log }] };
};

describe('FCI-01/02 faculty changes against the server', () => {
  it('accepts a new faculty member from the registrar and from an administrator', () => {
    expect(checkObjectPermissions(email(PRIYA), db, saved(PRIYA), [])).toEqual({ ok: true });
    expect(checkObjectPermissions(email(ADMIN), db, saved(ADMIN), [])).toEqual({ ok: true });
  });
  it('refuses the same change from an advisor, a faculty member or a student', () => {
    for (const id of [ROSA, NAKAMURA, MARIA]) expect(checkObjectPermissions(email(id), db, saved(id), []).ok).toBe(false);
  });
  it('stores the faculty record, departments and qualified courses and reads them back unchanged', () => {
    const back = tablesToDoc(docToTables(saved(PRIYA)));
    const f = back.faculty.find((x) => x.id === newcomer.id)!;
    expect({ ...f, teachesIn: [...f.teachesIn].sort() }).toEqual(newcomer);
    expect(back.courses.filter((c) => c.qualifiedFaculty.includes(newcomer.id)).map((c) => c.id).sort()).toEqual(['CS 101', 'CS 201']);
  });
});
