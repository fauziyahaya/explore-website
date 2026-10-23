/** Normalise merchant / product text for matching: lowercase, strip legal suffixes & punctuation. */
export function normaliseName(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(sdn\.?\s*bhd\.?|bhd\.?|berhad|enterprise|ent\.?|plt|trading|\(m\)|malaysia|store|outlet|branch|cawangan)\b/g, ' ')
    .replace(/\(\s*\d{6,}[-\s]?[a-z]?\s*\)/g, ' ') // SSM numbers like (123456-A)
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(input: string | null | undefined): string[] {
  return normaliseName(input).split(' ').filter((t) => t.length > 1);
}

/** Dice coefficient on character bigrams (0..1) for fuzzy name similarity. */
export function similarity(a: string, b: string): number {
  const x = normaliseName(a).replace(/\s/g, '');
  const y = normaliseName(b).replace(/\s/g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const grams = new Map<string, number>();
  for (let i = 0; i < x.length - 1; i++) {
    const g = x.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < y.length - 1; i++) {
    const g = y.slice(i, i + 2);
    const n = grams.get(g) ?? 0;
    if (n > 0) {
      overlap++;
      grams.set(g, n - 1);
    }
  }
  return (2 * overlap) / (x.length - 1 + (y.length - 1));
}

let counter = 0;
/** Sortable unique id (time-prefixed). Server uses its own ids; this is for offline drafts. */
export function newId(prefix = 'id'): string {
  counter = (counter + 1) % 1679616;
  const time = Date.now().toString(36).padStart(9, '0');
  const rand = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `${prefix}_${time}${counter.toString(36).padStart(4, '0')}${rand}`;
}
