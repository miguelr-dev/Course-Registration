const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-12T14:41:00" → "Sep 12, 2026, 2:41 PM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hh}:${mm} ${ampm}`;
}

/** "2026-09-12" → "Sep 12, 2026" */
export function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "13:00" → "1:00" ; pair → "1:00–1:50" */
export function formatTimeRange(start: string, end: string): string {
  const f = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')}`;
  };
  return `${f(start)}–${f(end)}`;
}

export function nowIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** "Rosa Delgado-Munoz" → "R. Delgado-Munoz" */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
