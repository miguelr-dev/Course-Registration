/**
 * GEN-02: when a user commits a completed transaction to the database, SignMeUp shall respond
 * within 5 seconds. The store times every accepted write (lastSaveMs) and the footer reports it,
 * flagging any save that misses the target so it can be seen and investigated.
 */
export const RESPONSE_TARGET_MS = 5000;

export function meetsResponseTarget(ms: number): boolean {
  return ms <= RESPONSE_TARGET_MS;
}

/** Footer text for the last save: "last save 412 ms", or a flag when it took longer than 5 seconds. */
export function saveTimeLabel(ms: number | null): string {
  if (ms === null) return '';
  return meetsResponseTarget(ms) ? `last save ${ms} ms` : `last save ${(ms / 1000).toFixed(1)} s · over the 5 s target`;
}
