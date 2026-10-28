import { useEffect, useRef, useState } from 'react';

/**
 * Long lists render in pages so a screen is never one endless scroll: the first `pageSize` rows
 * show at once and the next page loads as the end of the list scrolls into view. A Show more
 * button does the same for keyboard and screen-reader users. Printing always includes every row,
 * because any display must print in full (Display Printing).
 */
export function useProgressive<T>(items: T[], resetKey: unknown, pageSize = 20) {
  const [count, setCount] = useState(pageSize);
  const [printing, setPrinting] = useState(false);
  useEffect(() => { setCount(pageSize); }, [resetKey, pageSize]);
  useEffect(() => {
    const before = () => setPrinting(true);
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  const shown = printing ? items.length : Math.min(count, items.length);
  return {
    visible: items.slice(0, shown),
    more: <LoadMore remaining={items.length - shown} total={items.length} onMore={() => setCount((c) => c + pageSize)} />,
  };
}

function LoadMore({ remaining, total, onMore }: { remaining: number; total: number; onMore(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const more = useRef(onMore);
  more.current = onMore;
  useEffect(() => {
    const el = ref.current;
    if (!el || remaining <= 0 || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) more.current(); }, { rootMargin: '240px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [remaining]);
  if (remaining <= 0) return null;
  return (
    <div ref={ref} className="load-more no-print">
      <span className="sub">Showing {total - remaining} of {total}</span>
      <button className="btn secondary sm" onClick={onMore}>Show more ({remaining} left)</button>
    </div>
  );
}
