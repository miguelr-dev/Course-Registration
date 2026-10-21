/**
 * Entry and processing of names (GEN-13). Any name component (first, middle, last) may be
 * hyphenated, e.g. "Mary-Kate" or "Okafor-Reyes". Letters from any language, apostrophes
 * (O'Neil), periods (St. James) and single spaces between words are accepted as well.
 */
export interface NameIssue { reason: string; requirement: string; }

const ALLOWED = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;

/** Trims, collapses runs of spaces, and removes spaces around hyphens: "Okafor - Reyes" → "Okafor-Reyes". */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
}

/** Validates one name component after normalizing it; returns null when it is acceptable. */
export function nameIssue(raw: string, label: string, required: boolean): NameIssue | null {
  const v = normalizeName(raw);
  if (!v) return required ? { reason: `${label} is required.`, requirement: `Enter the ${label.toLowerCase()}; hyphenated names are accepted.` } : null;
  const rule = 'Use letters, with single hyphens, apostrophes, periods or spaces between them, e.g. Okafor-Reyes or O’Neil.';
  if (!ALLOWED.test(v)) return { reason: `${label} contains characters that are not allowed.`, requirement: rule };
  if (/--|-$|['’.]-|-['’.]/.test(v)) return { reason: `${label} has a misplaced hyphen.`, requirement: rule };
  if (v.length > 40) return { reason: `${label} is longer than 40 characters.`, requirement: 'Shorten it to 40 characters or fewer.' };
  return null;
}

/** "Maria", "Luz", "Okafor-Reyes" → "Maria Luz Okafor-Reyes" */
export function fullName(p: { firstName: string; middleName?: string; lastName: string }): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
}

/** Sorting key that keeps hyphenated surnames together: "Okafor-Reyes, Maria". */
export function sortName(p: { firstName: string; lastName: string }): string {
  return `${p.lastName}, ${p.firstName}`.toLocaleLowerCase();
}
