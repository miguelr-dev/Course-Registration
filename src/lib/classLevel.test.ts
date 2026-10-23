import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import type { CompletedCourse, TransferCourse } from '../data/types';
import { classLevel, graduateStatus, unitsEarned } from './classLevel';

const course = (units: number, grade = 'A'): CompletedCourse => ({ courseId: 'X 100', title: 'X', term: 'Fall 2025', units, grade });
const transfer = (units: number, grade = 'B'): TransferCourse => ({ ...course(units, grade), university: 'Mesa College', location: 'San Diego, CA', equivalentCourseId: 'X 100' });
const student = (here: CompletedCourse[], tr: TransferCourse[] = [], graduate = false) => ({ completed: here, transfer: tr, graduate });

describe('ER-09 class level and graduate status', () => {
  it('starts every new student as a Freshman', () => {
    expect(classLevel(student([]))).toBe('Freshman');
    expect(classLevel(student([course(29)]))).toBe('Freshman');
  });
  it('moves up at 30, 60 and 90 units earned', () => {
    expect(classLevel(student([course(30)]))).toBe('Sophomore');
    expect(classLevel(student([course(59)]))).toBe('Sophomore');
    expect(classLevel(student([course(60)]))).toBe('Junior');
    expect(classLevel(student([course(90)]))).toBe('Senior');
  });
  it('counts passed transfer units and skips failed or incomplete courses', () => {
    expect(unitsEarned(student([course(20), course(4, 'F'), course(3, 'I')], [transfer(15), transfer(3, 'F')]))).toBe(35);
    expect(classLevel(student([course(20)], [transfer(15)]))).toBe('Sophomore');
    expect(unitsEarned(student([course(3, 'CR')]))).toBe(3);
  });
  it('shows Graduate for students accepted into the graduate program, whatever their units', () => {
    expect(classLevel(student([], [], true))).toBe('Graduate');
    expect(graduateStatus({ graduate: true })).toBe('Accepted into the graduate program');
    expect(graduateStatus({ graduate: false })).toBe('Not in the graduate program');
  });
  it('gives every seeded student a level', () => {
    for (const s of createSeed().students) expect(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']).toContain(classLevel(s));
  });
});
