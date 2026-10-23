/**
 * Package-size parsing and unit normalisation so that equivalent quantities
 * can be compared (RM per kg, per litre, per piece) instead of comparing
 * unequal package sizes.
 */

export type BaseUnit = 'kg' | 'L' | 'pc';

export interface NormalisedQuantity {
  baseUnit: BaseUnit;
  /** Quantity in base units for ONE package (e.g. 5kg bag -> 5, 12x330ml -> 3.96). */
  amount: number;
}

const UNIT_TABLE: Record<string, [BaseUnit, number]> = {
  kg: ['kg', 1], kgs: ['kg', 1], kilo: ['kg', 1], kilogram: ['kg', 1],
  g: ['kg', 0.001], gm: ['kg', 0.001], gms: ['kg', 0.001], gr: ['kg', 0.001], gram: ['kg', 0.001], grams: ['kg', 0.001],
  mg: ['kg', 0.000001],
  l: ['L', 1], lt: ['L', 1], ltr: ['L', 1], litre: ['L', 1], liter: ['L', 1], liters: ['L', 1], litres: ['L', 1],
  ml: ['L', 0.001], cl: ['L', 0.01],
  pc: ['pc', 1], pcs: ['pc', 1], piece: ['pc', 1], pieces: ['pc', 1], s: ['pc', 1], biji: ['pc', 1], unit: ['pc', 1], units: ['pc', 1], ea: ['pc', 1],
  pack: ['pc', 1], pkt: ['pc', 1], btl: ['pc', 1], can: ['pc', 1], tin: ['pc', 1], roll: ['pc', 1], rolls: ['pc', 1],
};

export function parsePackageSize(text: string | null | undefined): NormalisedQuantity | null {
  if (!text) return null;
  const s = text.toLowerCase().replace(/,/g, '.').replace(/×/g, 'x');
  // Multi-pack: "12 x 330ml", "6x1.5l", "2 x 500 g"
  const multi = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*([a-z]+)\b/.exec(s);
  if (multi) {
    const u = UNIT_TABLE[multi[3]!];
    if (u) return { baseUnit: u[0], amount: round(Number(multi[1]) * Number(multi[2]) * u[1]) };
  }
  const single = /(\d+(?:\.\d+)?)\s*([a-z]+)\b/.exec(s);
  if (single) {
    const u = UNIT_TABLE[single[2]!];
    if (u) return { baseUnit: u[0], amount: round(Number(single[1]) * u[1]) };
  }
  return null;
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Resolve the comparable quantity of a line item. Uses packageSize first,
 * then the description, then a weight/volume unit on the quantity itself
 * (e.g. loose vegetables sold "0.85 kg"). Returns null when unknown.
 */
export function lineItemQuantity(item: {
  description: string;
  packageSize?: string | null;
  quantity: number;
  unit?: string | null;
}): NormalisedQuantity | null {
  const pkg = parsePackageSize(item.packageSize) ?? parsePackageSize(item.description);
  if (pkg) return { baseUnit: pkg.baseUnit, amount: round(pkg.amount * item.quantity) };
  const unit = item.unit?.toLowerCase().trim();
  if (unit && UNIT_TABLE[unit]) {
    const [base, factor] = UNIT_TABLE[unit];
    return { baseUnit: base, amount: round(item.quantity * factor) };
  }
  return null;
}

/** Price per base unit in minor units (e.g. sen per kg). */
export function unitPricePerBase(totalMinor: number, qty: NormalisedQuantity | null): number | null {
  if (!qty || qty.amount <= 0) return null;
  return Math.round(totalMinor / qty.amount);
}

export function baseUnitLabel(u: BaseUnit, locale: 'en' | 'ms' = 'en'): string {
  if (u === 'pc') return locale === 'ms' ? 'unit' : 'piece';
  return u;
}
