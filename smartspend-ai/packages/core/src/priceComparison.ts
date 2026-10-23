import { normaliseName } from './text';
import { lineItemQuantity, unitPricePerBase, type BaseUnit } from './units';
import type { ISODate, Transaction } from './types';

/**
 * All prices in this module are OBSERVED HISTORICAL purchase prices taken from
 * the user's own approved receipts — never current market prices.
 */
export const PRICE_DISCLAIMER =
  'Prices shown are historical prices observed on your own recorded receipts, not current market prices.';
export const INSUFFICIENT_DATA = 'Insufficient comparison data';

export interface PriceObservation {
  transactionId: string;
  lineItemId: string;
  date: ISODate;
  merchant: string;
  productType: string; // comparable group, e.g. "rice"
  productName: string;
  brand: string | null;
  baseUnit: BaseUnit | null;
  baseQuantity: number | null;
  total: number; // minor units
  pricePerBase: number | null; // minor units per base unit
}

export function productTypeKey(item: { productCategory?: string | null; description: string; brand?: string | null }): string {
  if (item.productCategory) return normaliseName(item.productCategory);
  let d = normaliseName(item.description).replace(/\b\d+(\.\d+)?\s*(kg|g|gm|l|ltr|ml|pcs|s|x)\b/g, ' ');
  if (item.brand) d = d.replace(normaliseName(item.brand), ' ');
  return d.replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractObservations(transactions: Transaction[]): PriceObservation[] {
  const out: PriceObservation[] = [];
  for (const tx of transactions) {
    if (tx.kind !== 'expense' || tx.status !== 'approved') continue;
    for (const li of tx.lineItems) {
      if (!li.description || li.total <= 0) continue;
      const qty = lineItemQuantity({ description: li.description, packageSize: li.packageSize, quantity: li.quantity || 1, unit: li.unit });
      out.push({
        transactionId: tx.id,
        lineItemId: li.id,
        date: tx.date,
        merchant: tx.merchant ?? 'Unknown merchant',
        productType: productTypeKey(li),
        productName: li.description,
        brand: li.brand ? li.brand.trim() : null,
        baseUnit: qty?.baseUnit ?? null,
        baseQuantity: qty?.amount ?? null,
        total: li.total,
        pricePerBase: unitPricePerBase(li.total, qty),
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface GroupStat {
  key: string; // brand or merchant
  observations: number;
  avgPricePerBase: number;
  minPricePerBase: number;
  maxPricePerBase: number;
  lastPricePerBase: number;
  lastDate: ISODate;
}

export type ComparisonResult =
  | { status: 'ok'; productType: string; baseUnit: BaseUnit; groups: GroupStat[]; cheapest: GroupStat; disclaimer: string }
  | { status: 'insufficient'; productType: string; message: string };

function comparable(obs: PriceObservation[], productType: string): { unit: BaseUnit; rows: PriceObservation[] } | null {
  const rows = obs.filter((o) => o.productType === productType && o.pricePerBase != null && o.baseUnit);
  if (!rows.length) return null;
  // Use the dominant base unit; never compare kg against litres.
  const counts = new Map<BaseUnit, number>();
  rows.forEach((r) => counts.set(r.baseUnit!, (counts.get(r.baseUnit!) ?? 0) + 1));
  const unit = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  return { unit, rows: rows.filter((r) => r.baseUnit === unit) };
}

function groupBy(rows: PriceObservation[], keyFn: (o: PriceObservation) => string): GroupStat[] {
  const map = new Map<string, PriceObservation[]>();
  rows.forEach((r) => {
    const k = keyFn(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  });
  return [...map.entries()]
    .map(([key, list]) => {
      const prices = list.map((l) => l.pricePerBase!);
      const last = list[list.length - 1]!;
      return {
        key,
        observations: list.length,
        avgPricePerBase: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        minPricePerBase: Math.min(...prices),
        maxPricePerBase: Math.max(...prices),
        lastPricePerBase: last.pricePerBase!,
        lastDate: last.date,
      };
    })
    .sort((a, b) => a.avgPricePerBase - b.avgPricePerBase);
}

function compare(obs: PriceObservation[], productType: string, by: 'brand' | 'merchant'): ComparisonResult {
  const c = comparable(obs, productType);
  const label = by === 'brand' ? 'brands' : 'merchants';
  if (!c) return { status: 'insufficient', productType, message: `${INSUFFICIENT_DATA}: no measurable package sizes recorded for “${productType}”.` };
  const groups = groupBy(c.rows, (o) => (by === 'brand' ? o.brand ?? 'Unbranded' : o.merchant));
  if (groups.length < 2) {
    return { status: 'insufficient', productType, message: `${INSUFFICIENT_DATA}: at least two ${label} are needed for “${productType}”.` };
  }
  return { status: 'ok', productType, baseUnit: c.unit, groups, cheapest: groups[0]!, disclaimer: PRICE_DISCLAIMER };
}

export const compareBrands = (obs: PriceObservation[], productType: string) => compare(obs, productType, 'brand');
export const compareMerchants = (obs: PriceObservation[], productType: string) => compare(obs, productType, 'merchant');

export function priceHistory(obs: PriceObservation[], productType: string, brand?: string | null) {
  const c = comparable(obs, productType);
  if (!c) return [];
  return c.rows
    .filter((r) => brand === undefined || r.brand === brand)
    .map((r) => ({ date: r.date, pricePerBase: r.pricePerBase!, merchant: r.merchant, brand: r.brand, transactionId: r.transactionId }));
}

export function frequentProducts(obs: PriceObservation[], limit = 10) {
  const map = new Map<string, { productType: string; count: number; spend: number; lastDate: string }>();
  for (const o of obs) {
    if (!o.productType) continue;
    const e = map.get(o.productType) ?? { productType: o.productType, count: 0, spend: 0, lastDate: o.date };
    e.count++;
    e.spend += o.total;
    if (o.date > e.lastDate) e.lastDate = o.date;
    map.set(o.productType, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.spend - a.spend).slice(0, limit);
}

export function lowestObserved(obs: PriceObservation[], productType: string): PriceObservation | null {
  const c = comparable(obs, productType);
  if (!c) return null;
  return c.rows.reduce<PriceObservation | null>((min, r) => (!min || r.pricePerBase! < min.pricePerBase! ? r : min), null);
}

/** Month-over-month price change of a product's average price per unit. */
export function priceChange(obs: PriceObservation[], productType: string): { from: number; to: number; changePct: number } | null {
  const hist = priceHistory(obs, productType);
  if (hist.length < 2) return null;
  const first = hist[0]!.pricePerBase;
  const last = hist[hist.length - 1]!.pricePerBase;
  return { from: first, to: last, changePct: Math.round(((last - first) / first) * 10000) / 100 };
}

export interface SavingOpportunity {
  productType: string;
  baseUnit: BaseUnit;
  usualChoice: string;
  usualAvgPricePerBase: number;
  cheaperChoice: string;
  cheaperAvgPricePerBase: number;
  quantityBought: number;
  potentialSaving: number; // minor units, over the observed purchases
  calculation: string;
}

/**
 * Recommend cheaper comparable options using ONLY recorded purchases.
 * potentialSaving = (usual avg − cheaper avg) × quantity bought of the usual choice.
 */
export function savingOpportunities(obs: PriceObservation[], minSaving = 100): SavingOpportunity[] {
  const types = [...new Set(obs.map((o) => o.productType).filter(Boolean))];
  const out: SavingOpportunity[] = [];
  for (const t of types) {
    const c = comparable(obs, t);
    if (!c) continue;
    for (const by of ['brand', 'merchant'] as const) {
      const groups = groupBy(c.rows, (o) => (by === 'brand' ? o.brand ?? 'Unbranded' : o.merchant));
      if (groups.length < 2) continue;
      const usual = [...groups].sort((a, b) => b.observations - a.observations)[0]!;
      const cheapest = groups[0]!;
      if (usual.key === cheapest.key) continue;
      const qty = c.rows
        .filter((r) => (by === 'brand' ? r.brand ?? 'Unbranded' : r.merchant) === usual.key)
        .reduce((a, r) => a + r.baseQuantity!, 0);
      const saving = Math.round((usual.avgPricePerBase - cheapest.avgPricePerBase) * qty);
      if (saving < minSaving) continue;
      out.push({
        productType: t,
        baseUnit: c.unit,
        usualChoice: usual.key,
        usualAvgPricePerBase: usual.avgPricePerBase,
        cheaperChoice: cheapest.key,
        cheaperAvgPricePerBase: cheapest.avgPricePerBase,
        quantityBought: Math.round(qty * 1000) / 1000,
        potentialSaving: saving,
        calculation: `(${(usual.avgPricePerBase / 100).toFixed(2)} − ${(cheapest.avgPricePerBase / 100).toFixed(2)}) RM/${c.unit} × ${Math.round(qty * 1000) / 1000} ${c.unit} = RM${(saving / 100).toFixed(2)}`,
      });
    }
  }
  return out.sort((a, b) => b.potentialSaving - a.potentialSaving);
}
