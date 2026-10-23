import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import type { Course } from '../data/types';
import { changedCourseFields, courseIssue, normalizeCourse } from './catalog';

const db = createSeed();
const cs310 = db.courses.find((c) => c.id === 'CS 310')!;
const fresh = (over: Partial<Course> = {}): Course => ({
  id: 'CS 399', title: 'Special Topics', description: 'Selected topics in computing.', units: 3, prereqs: ['CS 310'], deptId: 'CS', level: 'upper', qualifiedFaculty: [...cs310.qualifiedFaculty], ...over,
});

describe('FCI-03 course catalog maintenance', () => {
  it('accepts every seeded course unchanged', () => {
    for (const c of db.courses) expect(courseIssue(db, c, c.id)).toBeNull();
  });
  it('accepts a complete new course with ID, title, description, prerequisites, units and qualified faculty', () => {
    expect(courseIssue(db, fresh(), null)).toBeNull();
  });
  it('normalizes the course ID and lists before saving', () => {
    const n = normalizeCourse(fresh({ id: ' cs399 ', title: '  Special   Topics ', prereqs: ['cs 310', 'CS 310', ' '] }));
    expect(n.id).toBe('CS 399');
    expect(n.title).toBe('Special Topics');
    expect(n.prereqs).toEqual(['CS 310']);
  });
  it('rejects a duplicate or badly formatted ID, and renaming an existing course', () => {
    expect(courseIssue(db, fresh({ id: 'CS 310' }), null)?.field).toBe('id');
    expect(courseIssue(db, fresh({ id: 'Data Structures' }), null)?.field).toBe('id');
    expect(courseIssue(db, { ...cs310, id: 'CS 311' }, 'CS 310')?.reason).toMatch(/cannot be changed/);
  });
  it('requires a title and description and whole units from 0 to 12', () => {
    expect(courseIssue(db, fresh({ title: ' ' }), null)?.field).toBe('title');
    expect(courseIssue(db, fresh({ description: '' }), null)?.field).toBe('description');
    expect(courseIssue(db, fresh({ units: 13 }), null)?.field).toBe('units');
    expect(courseIssue(db, fresh({ units: 2.5 }), null)?.field).toBe('units');
  });
  it('rejects unknown, self-referencing and looping prerequisites', () => {
    expect(courseIssue(db, fresh({ prereqs: ['CS 999'] }), null)?.field).toBe('prereqs');
    expect(courseIssue(db, fresh({ prereqs: ['CS 399'] }), null)?.reason).toMatch(/own prerequisite/);
    const base = cs310.prereqs[0];
    if (base) expect(courseIssue(db, { ...db.courses.find((c) => c.id === base)!, prereqs: ['CS 310'] }, base)?.reason).toMatch(/loop/);
  });
  it('rejects qualified faculty that are not in the directory', () => {
    const issue = courseIssue(db, fresh({ qualifiedFaculty: ['F-00000'] }), null);
    expect(issue?.field).toBe('qualifiedFaculty');
    expect(issue?.requirement).toMatch(/Choose/);
  });
  it('lists only the fields that changed, ignoring list order', () => {
    expect(changedCourseFields(cs310, { ...cs310, prereqs: [...cs310.prereqs].reverse() })).toEqual([]);
    expect(changedCourseFields(cs310, { ...cs310, units: cs310.units + 1, title: 'New' })).toEqual(['title', 'units']);
  });
});
