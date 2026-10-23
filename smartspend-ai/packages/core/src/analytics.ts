import { isProfitAndLoss } from './categories';
import { allocateAll, distribute, inRange, type Allocation, type DateRange } from './finance';
import { pct, sum } from './money';
import { normaliseName } from './text';
import type { AccountingClass, Category, ISODate, Transaction, Workspace } from './types';

export type Granularity = 'day' | 'week' | 'month' | 'year';

export interface AnalyticsFilter {
  range: DateRange;
  categoryIds?: string[];
  merchants?: string[];
  departmentIds?: string[];
  projectIds?: string[];
  costCentreIds?: string[];
}

function isoWeek(date: ISODate): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday=0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function bucketKey(date: ISODate, g: Granularity): string {
  switch (g) {
    case 'day':
      return date;
    case 'week':
      return isoWeek(date);
    case 'month':
      return date.slice(0, 7);
    case 'year':
      return date.slice(0, 4);
  }
}

/** Every bucket key between range.from and range.to so charts show gaps as zero. */
export function bucketsInRange(range: DateRange, g: Granularity): string[] {
  const keys: string[] = [];
  const d = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  while (d <= end) {
    const k = bucketKey(d.toISOString().slice(0, 10), g);
    if (keys[keys.length - 1] !== k) keys.push(k);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return keys;
}

export function applyFilter(allocs: Allocation[], f: AnalyticsFilter): Allocation[] {
  const merchants = f.merchants?.map(normaliseName);
  return allocs.filter(
    (a) =>
      a.date >= f.range.from &&
      a.date <= f.range.to &&
      (!f.categoryIds?.length || f.categoryIds.includes(a.categoryId)) &&
      (!merchants?.length || merchants.includes(normaliseName(a.merchant))) &&
      (!f.departmentIds?.length || (a.departmentId && f.departmentIds.includes(a.departmentId))) &&
      (!f.projectIds?.length || (a.projectId && f.projectIds.includes(a.projectId))) &&
      (!f.costCentreIds?.length || (a.costCentreId && f.costCentreIds.includes(a.costCentreId))),
  );
}

const isPlExpense = (a: Allocation) =>
  a.kind === 'expense' && a.accountingClass !== 'personal_excluded' && isProfitAndLoss(a.accountingClass as AccountingClass);
const isPlIncome = (a: Allocation) =>
  a.kind === 'income' && a.accountingClass !== 'personal_excluded' && isProfitAndLoss(a.accountingClass as AccountingClass);

export interface TrendPoint {
  key: string;
  amount: number;
  /** Change vs previous bucket (%), null when previous is zero. */
  changePct: number | null;
  transactionIds: string[];
}

export function expenseTrend(allocs: Allocation[], range: DateRange, g: Granularity): TrendPoint[] {
  const keys = bucketsInRange(range, g);
  const map = new Map(keys.map((k) => [k, { amount: 0, ids: new Set<string>() }]));
  for (const a of allocs) {
    if (!isPlExpense(a) || !inRange(a.date, range)) continue;
    const b = map.get(bucketKey(a.date, g));
    if (!b) continue;
    b.amount += a.amount;
    b.ids.add(a.transactionId);
  }
  let prev: number | null = null;
  return keys.map((k) => {
    const b = map.get(k)!;
    const point = { key: k, amount: b.amount, changePct: prev == null ? null : pct(b.amount - prev, prev), transactionIds: [...b.ids] };
    prev = b.amount;
    return point;
  });
}

export interface IncomeExpensePoint {
  key: string;
  income: number;
  expenses: number;
  net: number;
  marginPct: number | null;
  expenseToIncomePct: number | null;
}

export function incomeVsExpenses(allocs: Allocation[], range: DateRange, g: Granularity = 'month'): IncomeExpensePoint[] {
  const keys = bucketsInRange(range, g);
  const map = new Map(keys.map((k) => [k, { income: 0, expenses: 0 }]));
  for (const a of allocs) {
    if (!inRange(a.date, range)) continue;
    const b = map.get(bucketKey(a.date, g));
    if (!b) continue;
    if (isPlIncome(a)) b.income += a.amount;
    else if (isPlExpense(a)) b.expenses += a.amount;
  }
  return keys.map((k) => {
    const { income, expenses } = map.get(k)!;
    return { key: k, income, expenses, net: income - expenses, marginPct: pct(income - expenses, income), expenseToIncomePct: pct(expenses, income) };
  });
}

export interface BreakdownRow {
  key: string;
  label: string;
  amount: number;
  sharePct: number;
  transactionIds: string[];
  color?: string;
}

function breakdown(allocs: Allocation[], keyFn: (a: Allocation) => string | null, labelFn: (k: string) => string, colorFn?: (k: string) => string | undefined): BreakdownRow[] {
  const rows = new Map<string, { amount: number; ids: Set<string> }>();
  for (const a of allocs) {
    const k = keyFn(a);
    if (k == null) continue;
    const r = rows.get(k) ?? { amount: 0, ids: new Set<string>() };
    r.amount += a.amount;
    r.ids.add(a.transactionId);
    rows.set(k, r);
  }
  const totalAmt = sum([...rows.values()].map((r) => r.amount));
  return [...rows.entries()]
    .map(([key, r]) => ({ key, label: labelFn(key), amount: r.amount, sharePct: pct(r.amount, totalAmt) ?? 0, transactionIds: [...r.ids], color: colorFn?.(key) }))
    .sort((a, b) => b.amount - a.amount);
}

export function categoryBreakdown(allocs: Allocation[], categories: Category[], locale: 'en' | 'ms' = 'en'): BreakdownRow[] {
  const map = new Map(categories.map((c) => [c.id, c]));
  return breakdown(
    allocs.filter(isPlExpense),
    (a) => a.categoryId,
    (k) => map.get(k)?.name[locale] ?? k,
    (k) => map.get(k)?.color,
  );
}

export function dimensionBreakdown(allocs: Allocation[], dim: 'departmentId' | 'projectId' | 'costCentreId', names: Record<string, string>): BreakdownRow[] {
  return breakdown(allocs.filter(isPlExpense), (a) => a[dim] ?? 'unassigned', (k) => (k === 'unassigned' ? 'Unassigned' : names[k] ?? k));
}

export function merchantBreakdown(allocs: Allocation[]): BreakdownRow[] {
  return breakdown(allocs.filter(isPlExpense), (a) => (a.merchant ? normaliseName(a.merchant) : 'unknown'), (k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));
}

export function brandBreakdown(txs: Transaction[], range: DateRange): BreakdownRow[] {
  const rows = new Map<string, { amount: number; ids: Set<string>; label: string }>();
  for (const tx of txs) {
    if (tx.status !== 'approved' || tx.kind !== 'expense' || tx.date < range.from || tx.date > range.to) continue;
    for (const li of tx.lineItems) {
      if (!li.brand) continue;
      const k = normaliseName(li.brand);
      const r = rows.get(k) ?? { amount: 0, ids: new Set<string>(), label: li.brand };
      r.amount += li.total;
      r.ids.add(tx.id);
      rows.set(k, r);
    }
  }
  const t = sum([...rows.values()].map((r) => r.amount));
  return [...rows.entries()]
    .map(([key, r]) => ({ key, label: r.label, amount: r.amount, sharePct: pct(r.amount, t) ?? 0, transactionIds: [...r.ids] }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Recurring detection: same merchant & similar amount (±10%) seen in at least
 * 3 distinct months, or flagged recurring by the user.
 */
export function recurringSplit(txs: Transaction[], range: DateRange): { recurring: number; oneTime: number; recurringMerchants: string[] } {
  const expenses = txs.filter((t) => t.status === 'approved' && t.kind === 'expense');
  const byMerchant = new Map<string, Transaction[]>();
  expenses.forEach((t) => {
    const k = normaliseName(t.merchant);
    if (k) byMerchant.set(k, [...(byMerchant.get(k) ?? []), t]);
  });
  const recurringIds = new Set<string>(expenses.filter((t) => t.isRecurring).map((t) => t.id));
  const recurringMerchants: string[] = [];
  for (const [m, list] of byMerchant) {
    const months = new Set(list.map((t) => t.date.slice(0, 7)));
    if (months.size < 3) continue;
    const amounts = list.map((t) => t.baseTotal).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)]!;
    const similar = list.filter((t) => Math.abs(t.baseTotal - median) <= median * 0.1);
    if (new Set(similar.map((t) => t.date.slice(0, 7))).size >= 3) {
      similar.forEach((t) => recurringIds.add(t.id));
      recurringMerchants.push(m);
    }
  }
  const inR = expenses.filter((t) => t.date >= range.from && t.date <= range.to);
  const recurring = sum(inR.filter((t) => recurringIds.has(t.id)).map((t) => t.baseTotal));
  return { recurring, oneTime: sum(inR.map((t) => t.baseTotal)) - recurring, recurringMerchants };
}

export interface AnalyticsBundle {
  range: DateRange;
  granularity: Granularity;
  expenseTrend: TrendPoint[];
  incomeVsExpenses: IncomeExpensePoint[];
  categories: BreakdownRow[];
  merchants: BreakdownRow[];
  brands: BreakdownRow[];
  recurring: ReturnType<typeof recurringSplit>;
  totals: { income: number; expenses: number; net: number; marginPct: number | null; expenseToIncomePct: number | null };
  monthOnMonthPct: number | null;
}

/** "Generate Analytics" — compute every chart dataset for a period in one pass. */
export function generateAnalytics(
  workspace: Pick<Workspace, 'type'>,
  txs: Transaction[],
  categories: Category[],
  filter: AnalyticsFilter,
  granularity: Granularity,
  locale: 'en' | 'ms' = 'en',
): AnalyticsBundle {
  const allocs = applyFilter(allocateAll(txs, categories, workspace), filter);
  const ive = incomeVsExpenses(allocs, filter.range, 'month');
  const income = sum(ive.map((p) => p.income));
  const expenses = sum(ive.map((p) => p.expenses));
  const last = ive[ive.length - 1];
  const prev = ive[ive.length - 2];
  return {
    range: filter.range,
    granularity,
    expenseTrend: expenseTrend(allocs, filter.range, granularity),
    incomeVsExpenses: ive,
    categories: categoryBreakdown(allocs, categories, locale),
    merchants: merchantBreakdown(allocs),
    brands: brandBreakdown(txs, filter.range),
    recurring: recurringSplit(txs, filter.range),
    totals: { income, expenses, net: income - expenses, marginPct: pct(income - expenses, income), expenseToIncomePct: pct(expenses, income) },
    monthOnMonthPct: last && prev ? pct(last.expenses - prev.expenses, prev.expenses) : null,
  };
}

/** Helpers for period pickers. */
export function monthRange(yyyyMm: string): DateRange {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${yyyyMm}-01`, to: `${yyyyMm}-${String(last).padStart(2, '0')}` };
}
export function yearRange(yyyy: string | number): DateRange {
  return { from: `${yyyy}-01-01`, to: `${yyyy}-12-31` };
}
export function lastNMonthsRange(today: ISODate, n: number): DateRange {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - n, 1));
  return { from: start.toISOString().slice(0, 10), to: monthRange(today.slice(0, 7)).to };
}
export function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
