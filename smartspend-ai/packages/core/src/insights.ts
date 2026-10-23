import { allocateAll, distribute } from './finance';
import { monthRange, shiftMonth } from './analytics';
import { isProfitAndLoss } from './categories';
import { formatMoney, pct, sum } from './money';
import { tokens } from './text';
import type { Category, ISODate, Transaction, Workspace } from './types';

/**
 * Explainable spending insights. Every insight is derived from recorded
 * transactions with a reproducible calculation string — no generated numbers.
 */
export interface Insight {
  categoryId: string;
  title: string;
  message: string;
  calculation: string;
  changePct: number;
  transactionIds: string[];
}

/**
 * Compare this month-to-date vs the same days of last month per category and
 * explain the largest driver (top line-item keyword) of each increase.
 * Triggers when change ≥ minPct and absolute change ≥ minAmount.
 */
export function analyseSpike(
  workspace: Pick<Workspace, 'type'>,
  txs: Transaction[],
  categories: Category[],
  today: ISODate,
  opts: { minPct?: number; minAmount?: number; locale?: 'en' | 'ms'; compareFullMonths?: boolean } = {},
): Insight[] {
  const minPct = opts.minPct ?? 20;
  const minAmount = opts.minAmount ?? 5000; // RM50
  const locale = opts.locale ?? 'en';
  const thisMonth = today.slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);
  const day = today.slice(8, 10);
  const cur = opts.compareFullMonths ? monthRange(thisMonth) : { from: `${thisMonth}-01`, to: today };
  const prevFull = monthRange(lastMonth);
  const prev = opts.compareFullMonths ? prevFull : { from: prevFull.from, to: `${lastMonth}-${day}` > prevFull.to ? prevFull.to : `${lastMonth}-${day}` };

  const plExp = (a: { kind: string; accountingClass: string }) =>
    a.kind === 'expense' && a.accountingClass !== 'personal_excluded' && isProfitAndLoss(a.accountingClass as never);
  const curA = allocateAll(txs, categories, workspace, cur).filter(plExp);
  const prevA = allocateAll(txs, categories, workspace, prev).filter(plExp);
  const cats = new Map(categories.map((c) => [c.id, c]));
  const txMap = new Map(txs.map((t) => [t.id, t]));

  const out: Insight[] = [];
  for (const catId of new Set(curA.map((a) => a.categoryId))) {
    const nowAmt = sum(curA.filter((a) => a.categoryId === catId).map((a) => a.amount));
    const prevAmt = sum(prevA.filter((a) => a.categoryId === catId).map((a) => a.amount));
    if (prevAmt === 0) continue;
    const change = pct(nowAmt - prevAmt, prevAmt)!;
    if (change < minPct || nowAmt - prevAmt < minAmount) continue;

    // Driver: which item keyword grew the most.
    const keywordTotals = (allocs: typeof curA) => {
      const m = new Map<string, number>();
      for (const a of allocs.filter((x) => x.categoryId === catId)) {
        const tx = txMap.get(a.transactionId);
        // Break unsplit receipts down by their line items so the driver is the product, not the receipt.
        const items = a.lineItemId ? tx?.lineItems.filter((l) => l.id === a.lineItemId) ?? [] : tx?.lineItems.filter((l) => l.total > 0) ?? [];
        const parts = items.length ? distribute(a.amount, items.map((l) => l.total)) : [a.amount];
        (items.length ? items : [null]).forEach((li, i) => {
          const label = (li?.productCategory ?? li?.description ?? tx?.merchant ?? '').trim();
          const key = tokens(label).slice(0, 2).join(' ') || 'other';
          m.set(key, (m.get(key) ?? 0) + parts[i]!);
        });
      }
      return m;
    };
    const nowK = keywordTotals(curA);
    const prevK = keywordTotals(prevA);
    let driver: [string, number] | null = null;
    for (const [k, v] of nowK) {
      const delta = v - (prevK.get(k) ?? 0);
      if (!driver || delta > driver[1]) driver = [k, delta];
    }
    const name = cats.get(catId)?.name[locale] ?? catId;
    const share = driver ? pct(driver[1], nowAmt - prevAmt) : null;
    out.push({
      categoryId: catId,
      title: `${name} up ${Math.round(change)}%`,
      message:
        `${name} expenses increased by ${Math.round(change)}% compared with last month.` +
        (driver && share != null && share >= 40 ? ` Most of the increase came from ${driver[0]}.` : ''),
      calculation:
        `(${formatMoney(nowAmt)} − ${formatMoney(prevAmt)}) ÷ ${formatMoney(prevAmt)} = ${change}% [${cur.from}..${cur.to} vs ${prev.from}..${prev.to}]` +
        (driver ? `; driver “${driver[0]}” +${formatMoney(driver[1])} (${share}% of increase)` : ''),
      changePct: change,
      transactionIds: [...new Set(curA.filter((a) => a.categoryId === catId).map((a) => a.transactionId))],
    });
  }
  return out.sort((a, b) => b.changePct - a.changePct);
}
