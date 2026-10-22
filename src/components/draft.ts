import { useEffect, useRef } from 'react';

/**
 * User cancellation and restoration (GEN-33, GEN-34). Screens hold the entries a user makes during
 * an action in local state and send them to the store only when the action is completed, so
 * cancelling simply discards them and everything is as it was before the action began.
 */

// Actions that can be cancelled, most recently started last; Escape cancels only the last one (e.g. Help before the panel under it).
const cancelStack: { current: () => void }[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !cancelStack.length) return;
    e.preventDefault();
    cancelStack[cancelStack.length - 1].current();
  });
}

/** Escape cancels the action in progress, the same as the Cancel and restore button. */
export function useEscapeToCancel(active: boolean, cancel: () => void) {
  const ref = useRef(cancel);
  ref.current = cancel;
  useEffect(() => {
    if (!active) return;
    const entry = ref;
    cancelStack.push(entry);
    return () => { const i = cancelStack.indexOf(entry); if (i >= 0) cancelStack.splice(i, 1); };
  }, [active]);
}

/** While entries are unsaved, warn before the page is closed or reloaded, which would discard them without a choice. */
export function useWarnBeforeLeaving(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
