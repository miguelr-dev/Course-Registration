import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { X } from './icons';

interface Box { x: number; y: number; w: number; h: number; }

const KEY = (id: string) => `signmeup.window.${id}`;
const MIN_W = 300;
const MIN_H = 200;

function load(id: string, fallback: Box): Box {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<Box>) };
  } catch { /* storage unavailable: use the default placement */ }
  return fallback;
}

function clamp(b: Box): Box {
  const w = Math.max(MIN_W, Math.min(b.w, window.innerWidth - 16));
  const h = Math.max(MIN_H, Math.min(b.h, window.innerHeight - 16));
  return { w, h, x: Math.max(8, Math.min(b.x, window.innerWidth - w - 8)), y: Math.max(8, Math.min(b.y, window.innerHeight - h - 8)) };
}

/**
 * A moveable, sizeable window inside SignMeUp (GEN-01). Drag it by its title bar, resize it from
 * the lower-right corner; the position and size are remembered per window in this browser. It is
 * not modal, so the screen underneath stays usable while it is open.
 */
export function FloatingWindow({ id, title, onClose, children, initial }: { id: string; title: ReactNode; onClose(): void; children: ReactNode; initial?: Partial<Box> }) {
  const [box, setBox] = useState<Box>(() => clamp(load(id, { x: window.innerWidth - 460, y: 72, w: 420, h: Math.min(560, window.innerHeight - 96), ...initial })));
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY(id), JSON.stringify(box)); } catch { /* not remembered */ }
  }, [id, box]);

  // CSS `resize: both` does the resizing; mirror the new size into state so it is remembered.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      setBox((b) => (b.w === w && b.h === h ? b : { ...b, w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setBox((b) => clamp(b));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - box.x, dy: e.clientY - box.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const { dx, dy } = drag.current;
    setBox((b) => clamp({ ...b, x: e.clientX - dx, y: e.clientY - dy }));
  }
  function up() { drag.current = null; }

  return (
    <div ref={ref} className="window no-print" role="dialog" aria-label={typeof title === 'string' ? title : undefined} style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
      <div className="window-bar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} title="Drag to move · drag the lower-right corner to resize">
        <h2>{title}</h2>
        <button className="btn ghost sm icon" onClick={onClose} aria-label="Close window"><X /></button>
      </div>
      <div className="window-body">{children}</div>
    </div>
  );
}

/** Opens the current screen in a separate browser window, which the user can move and size like any other (GEN-01). */
export function openInNewWindow(path = window.location.pathname + window.location.search) {
  const w = Math.min(1280, window.screen.availWidth - 80);
  const h = Math.min(860, window.screen.availHeight - 80);
  window.open(path, '_blank', `popup=yes,width=${w},height=${h},left=${window.screenX + 40},top=${window.screenY + 40}`);
}
