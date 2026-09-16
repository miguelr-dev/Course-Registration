/**
 * Name and ID searches support standard wildcards: `*` matches any run of
 * characters and `?` matches exactly one. Matching is case-insensitive and,
 * when the pattern has no wildcard, a substring match.
 */
export function wildcardToRegExp(pattern: string): RegExp {
  const trimmed = pattern.trim();
  const hasWildcard = /[*?]/.test(trimmed);
  const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return hasWildcard ? new RegExp(`^${escaped}$`, 'i') : new RegExp(escaped, 'i');
}

export function wildcardMatch(pattern: string, value: string): boolean {
  if (!pattern.trim()) return true;
  return wildcardToRegExp(pattern).test(value);
}
