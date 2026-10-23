/**
 * Money is stored as integer minor units (sen for MYR) to avoid floating-point
 * drift in financial totals. All engine calculations operate on minor units.
 */

export type CurrencyCode = string; // ISO 4217, e.g. "MYR", "USD", "SGD"

export const DEFAULT_CURRENCY: CurrencyCode = 'MYR';

/** Currencies with a non-2 minor-unit exponent. Everything else uses 2. */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  IDR: 2,
  VND: 0,
  BHD: 3,
  KWD: 3,
};

export function minorUnitExponent(currency: CurrencyCode): number {
  return MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2;
}

/** Convert a decimal major-unit amount (e.g. 12.35) to integer minor units (1235). */
export function toMinor(major: number, currency: CurrencyCode = DEFAULT_CURRENCY): number {
  if (!Number.isFinite(major)) throw new Error(`Invalid amount: ${major}`);
  const factor = 10 ** minorUnitExponent(currency);
  // Round half away from zero, guarding against binary representation (1.005 -> 1.01).
  const scaled = Math.abs(major) * factor;
  const rounded = Math.round(scaled + Number.EPSILON * scaled);
  return Math.sign(major) * rounded || 0;
}

export function toMajor(minor: number, currency: CurrencyCode = DEFAULT_CURRENCY): number {
  return minor / 10 ** minorUnitExponent(currency);
}

/** Parse a user / OCR supplied amount string like "RM1,234.50", "1.234,50", "(12.00)". */
export function parseAmount(input: string): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^(RM|MYR|USD|SGD|\$|S\$|US\$)\s*/i, '').replace(/\s*(RM|MYR)$/i, '');
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/\s/g, '');
  // European style "1.234,50"
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

export function formatMoney(
  minor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  opts: { showSign?: boolean; compact?: boolean } = {},
): string {
  const exp = minorUnitExponent(currency);
  const major = toMajor(Math.abs(minor), currency);
  const symbol = currency === 'MYR' ? 'RM' : `${currency} `;
  let body: string;
  if (opts.compact && major >= 1000) {
    const units: Array<[number, string]> = [
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'k'],
    ];
    const [div, suffix] = units.find(([d]) => major >= d)!;
    body = `${(major / div).toFixed(1).replace(/\.0$/, '')}${suffix}`;
  } else {
    body = major.toLocaleString('en-MY', { minimumFractionDigits: exp, maximumFractionDigits: exp });
  }
  const sign = minor < 0 ? '-' : opts.showSign && minor > 0 ? '+' : '';
  return `${sign}${symbol}${body}`;
}

/** Sum integer amounts exactly. */
export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Convert an amount between currencies using an explicit rate table
 * (rates expressed as "1 unit of currency = X MYR"). Never guesses a rate.
 */
export function convertMinor(
  minor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  ratesToBase: Record<CurrencyCode, number>,
  base: CurrencyCode = DEFAULT_CURRENCY,
): number {
  if (from === to) return minor;
  const rateFrom = from === base ? 1 : ratesToBase[from];
  const rateTo = to === base ? 1 : ratesToBase[to];
  if (!rateFrom || !rateTo) throw new Error(`Missing exchange rate for ${from}->${to}`);
  const majorBase = toMajor(minor, from) * rateFrom;
  return toMinor(majorBase / rateTo, to);
}

/** Percentage helper returning null when the denominator is zero (never invent a ratio). */
export function pct(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}
