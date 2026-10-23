/** Local calendar date (device time zone) as YYYY-MM-DD. */
export function todayLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_MS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

export function monthLabel(key: string, locale: 'en' | 'ms' = 'en'): string {
  const [y, m] = key.split('-');
  if (!m) return key;
  if (m.startsWith('W')) return `W${m.slice(1)}`;
  const names = locale === 'ms' ? MONTHS_MS : MONTHS_EN;
  return key.length === 7 ? `${names[Number(m) - 1]} ${y!.slice(2)}` : `${Number(key.slice(8))} ${names[Number(m) - 1]}`;
}

export function shortDate(iso: string, locale: 'en' | 'ms' = 'en'): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const names = locale === 'ms' ? MONTHS_MS : MONTHS_EN;
  return `${Number(iso.slice(8, 10))} ${names[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
