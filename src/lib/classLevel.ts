import type { Student } from '../data/types';
import { isPassing } from './rules';

/**
 * ER-09: each student's class level and graduate-program acceptance status.
 * Class level is derived from units earned (passed courses here plus passed transfer courses),
 * never stored, so it can't drift from the record. Graduate acceptance is the stored
 * `graduate` flag that the registrar maintains (and that REG uses to limit graduate courses).
 */
export type ClassLevel = 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Graduate';

/** Lowest units earned for each undergraduate level. Team decision: change here if the class picks other cut-offs. */
export const LEVEL_THRESHOLDS: readonly [ClassLevel, number][] = [['Senior', 90], ['Junior', 60], ['Sophomore', 30], ['Freshman', 0]];

/** Units earned toward the degree: passed courses at this university plus passed transfer courses. */
export function unitsEarned(student: Pick<Student, 'completed' | 'transfer'>): number {
  const here = student.completed.filter((c) => isPassing(c.grade)).reduce((s, c) => s + c.units, 0);
  const transfer = student.transfer.filter((c) => isPassing(c.grade)).reduce((s, c) => s + c.units, 0);
  return here + transfer;
}

export function classLevel(student: Pick<Student, 'completed' | 'transfer' | 'graduate'>): ClassLevel {
  if (student.graduate) return 'Graduate';
  const units = unitsEarned(student);
  return LEVEL_THRESHOLDS.find(([, min]) => units >= min)![0];
}

export function graduateStatus(student: Pick<Student, 'graduate'>): string {
  return student.graduate ? 'Accepted into the graduate program' : 'Not in the graduate program';
}
