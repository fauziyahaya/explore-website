import { isProfitAndLoss } from './categories';
import { pct, sum } from './money';
import type { AccountingClass, Category, ISODate, Transaction, Workspace } from './types';

/**
 * Financial calculation engine. Operates on base-currency minor units.
 *
 * Only APPROVED, non-superseded transactions are counted. Receipts whose line
 * items carry different categories are allocated per line, with header-level
 * tax / discount / rounding distributed proportionally (largest-remainder) so
 * allocations always sum exactly to the receipt total.
 */

export type AllocationClass = AccountingClass | 'personal_excluded';

export interface Allocation {
  transactionId: string;
  lineItemId: string | null;
  date: ISODate;
  kind: 'expense' | 'income';
  categoryId: string;
  accountingClass: AllocationClass;
  amount: number;
  merchant: string | null;
  brand: string | null;
  departmentId: string | null;
  costCentreId: string | null;
  projectId: string | null;
  paymentMethod: Transaction['paymentMethod'];
}

export interface DateRange {
  from: ISODate; // inclusive
  to: ISODate; // inclusive
}

export function inRange(date: ISODate, range?: DateRange): boolean {
  return !range || (date >= range.from && date <= range.to);
}

export function countable(tx: Transaction): boolean {
  return tx.status === 'approved' && !tx.supersededBy;
}

/** Split `total` across `weights` proportionally so that the parts sum to `total` exactly. */
export function distribute(total: number, weights: number[]): number[] {
  const wSum = sum(weights);
  if (wSum === 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const raw = weights.map((w) => (total * w) / wSum);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = total - sum(floors);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) floors[order[k]![1]]! += 1;
  return floors;
}

export function allocate(tx: Transaction, categories: Map<string, Category>, workspace: Pick<Workspace, 'type'>): Allocation[] {
  const base = {
    transactionId: tx.id,
    date: tx.date,
    kind: tx.kind,
    merchant: tx.merchant,
    departmentId: tx.departmentId ?? null,
    costCentreId: tx.costCentreId ?? null,
    projectId: tx.projectId ?? null,
    paymentMethod: tx.paymentMethod,
  };
  const classOf = (categoryId: string): AllocationClass => {
    if (tx.classification === 'owner_drawing') return 'owner_drawing';
    if (workspace.type === 'business' && tx.classification === 'personal') return 'personal_excluded';
    const c = categories.get(categoryId);
    if (!c) return tx.kind === 'income' ? (workspace.type === 'business' ? 'other_operating_income' : 'personal_income') : workspace.type === 'business' ? 'operating_expense' : 'personal_expense';
    return c.accountingClass;
  };

  const items = tx.lineItems.filter((li) => li.total > 0);
  const splittable = items.length > 0 && items.some((li) => li.categoryId && li.categoryId !== tx.categoryId);
  if (!splittable) {
    return [{ ...base, lineItemId: null, categoryId: tx.categoryId, accountingClass: classOf(tx.categoryId), amount: tx.baseTotal, brand: null }];
  }
  const parts = distribute(tx.baseTotal, items.map((li) => li.total));
  return items.map((li, i) => {
    const cat = li.categoryId ?? tx.categoryId;
    return { ...base, lineItemId: li.id, categoryId: cat, accountingClass: classOf(cat), amount: parts[i]!, brand: li.brand ?? null };
  });
}

export function allocateAll(
  txs: Transaction[],
  categories: Category[],
  workspace: Pick<Workspace, 'type'>,
  range?: DateRange,
): Allocation[] {
  const map = new Map(categories.map((c) => [c.id, c]));
  return txs.filter((t) => countable(t) && inRange(t.date, range)).flatMap((t) => allocate(t, map, workspace));
}

const total = (allocs: Allocation[], pred: (a: Allocation) => boolean) => sum(allocs.filter(pred).map((a) => a.amount));

export interface PersonalSummary {
  basis: 'cash';
  income: number;
  expenses: number;
  /** Net Cash Surplus = Recorded Cash Income − Recorded Cash Expenses */
  netCashSurplus: number;
  savingsRatePct: number | null;
  expenseToIncomePct: number | null;
  excludedTransfers: number;
  transactionCount: number;
}

export function personalSummary(allocs: Allocation[]): PersonalSummary {
  const plAllocs = allocs.filter((a) => a.accountingClass !== 'personal_excluded' && isProfitAndLoss(a.accountingClass as AccountingClass));
  const income = total(plAllocs, (a) => a.kind === 'income');
  const expenses = total(plAllocs, (a) => a.kind === 'expense');
  return {
    basis: 'cash',
    income,
    expenses,
    netCashSurplus: income - expenses,
    savingsRatePct: pct(income - expenses, income),
    expenseToIncomePct: pct(expenses, income),
    excludedTransfers: total(allocs, (a) => a.accountingClass === 'transfer'),
    transactionCount: new Set(allocs.map((a) => a.transactionId)).size,
  };
}

export interface ProfitAndLoss {
  basis: 'cash';
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  otherOperatingIncome: number;
  operatingExpenses: number;
  operatingProfit: number;
  nonOperatingIncome: number;
  otherExpenses: number;
  netProfit: number;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  expenseToIncomePct: number | null;
  /** Cash movements deliberately excluded from profit. */
  excluded: {
    capitalExpenditure: number;
    ownerDrawings: number;
    ownerContributions: number;
    loanPrincipal: number;
    transfers: number;
    personalExpenses: number;
  };
  /** Net cash movement (all inflows − all outflows): NOT the same as profit. */
  netCashFlow: number;
  byCategory: Array<{ categoryId: string; accountingClass: AllocationClass; amount: number }>;
}

export function profitAndLoss(allocs: Allocation[]): ProfitAndLoss {
  const cls = (c: AllocationClass) => total(allocs, (a) => a.accountingClass === c);
  const revenue = cls('revenue');
  const cogs = cls('cogs');
  const grossProfit = revenue - cogs;
  const otherOperatingIncome = cls('other_operating_income');
  const opex = cls('operating_expense');
  const operatingProfit = grossProfit + otherOperatingIncome - opex;
  const nonOperatingIncome = cls('non_operating_income');
  const otherExpenses = cls('other_expense');
  const netProfit = operatingProfit + nonOperatingIncome - otherExpenses;
  const inflow = total(allocs, (a) => a.kind === 'income');
  const outflow = total(allocs, (a) => a.kind === 'expense');
  const totalIncome = revenue + otherOperatingIncome + nonOperatingIncome;

  const byCat = new Map<string, { categoryId: string; accountingClass: AllocationClass; amount: number }>();
  for (const a of allocs) {
    const e = byCat.get(a.categoryId) ?? { categoryId: a.categoryId, accountingClass: a.accountingClass, amount: 0 };
    e.amount += a.amount;
    byCat.set(a.categoryId, e);
  }

  return {
    basis: 'cash',
    revenue,
    costOfGoodsSold: cogs,
    grossProfit,
    otherOperatingIncome,
    operatingExpenses: opex,
    operatingProfit,
    nonOperatingIncome,
    otherExpenses,
    netProfit,
    grossMarginPct: pct(grossProfit, revenue),
    operatingMarginPct: pct(operatingProfit, revenue),
    netMarginPct: pct(netProfit, revenue),
    expenseToIncomePct: pct(cogs + opex + otherExpenses, totalIncome),
    excluded: {
      capitalExpenditure: cls('capital_expenditure'),
      ownerDrawings: cls('owner_drawing'),
      ownerContributions: cls('owner_contribution'),
      loanPrincipal: cls('financing'),
      transfers: cls('transfer'),
      personalExpenses: cls('personal_excluded'),
    },
    netCashFlow: inflow - outflow,
    byCategory: [...byCat.values()].sort((a, b) => b.amount - a.amount),
  };
}

export interface Reconciliation {
  ok: boolean;
  transactionTotal: number;
  allocationTotal: number;
  plTotal: number;
  excludedTotal: number;
  difference: number;
}

/**
 * Proves that every countable transaction is fully accounted for: the sum of
 * allocations equals the sum of transaction totals, and P&L + excluded
 * movements together equal all inflows and outflows.
 */
export function reconcile(txs: Transaction[], allocs: Allocation[], range?: DateRange): Reconciliation {
  const counted = txs.filter((t) => countable(t) && inRange(t.date, range));
  const signed = (kind: string, amount: number) => (kind === 'income' ? amount : -amount);
  const transactionTotal = sum(counted.map((t) => signed(t.kind, t.baseTotal)));
  const allocationTotal = sum(allocs.map((a) => signed(a.kind, a.amount)));
  const isPl = (a: Allocation) => a.accountingClass !== 'personal_excluded' && isProfitAndLoss(a.accountingClass as AccountingClass);
  const plTotal = sum(allocs.filter(isPl).map((a) => signed(a.kind, a.amount)));
  const excludedTotal = sum(allocs.filter((a) => !isPl(a)).map((a) => signed(a.kind, a.amount)));
  const difference = transactionTotal - (plTotal + excludedTotal);
  return { ok: difference === 0 && transactionTotal === allocationTotal, transactionTotal, allocationTotal, plTotal, excludedTotal, difference };
}

/** Dashboard summary cards. */
export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  netLabel: 'Net Cash Surplus' | 'Net Profit / Loss';
  remainingBudget: number | null;
  overspentBudgets: number;
  awaitingApproval: number;
  awaitingApprovalAmount: number;
}

export function dashboardSummary(
  workspace: Pick<Workspace, 'type'>,
  txs: Transaction[],
  categories: Category[],
  range: DateRange,
  budgetStatus: Array<{ remaining: number; exceeded: boolean }>,
): DashboardSummary {
  const allocs = allocateAll(txs, categories, workspace, range);
  const pending = txs.filter((t) => t.status === 'submitted' && inRange(t.date, range));
  let income: number, expenses: number, net: number;
  if (workspace.type === 'personal') {
    const p = personalSummary(allocs);
    [income, expenses, net] = [p.income, p.expenses, p.netCashSurplus];
  } else {
    const p = profitAndLoss(allocs);
    income = p.revenue + p.otherOperatingIncome + p.nonOperatingIncome;
    expenses = p.costOfGoodsSold + p.operatingExpenses + p.otherExpenses;
    net = p.netProfit;
  }
  return {
    totalIncome: income,
    totalExpenses: expenses,
    net,
    netLabel: workspace.type === 'personal' ? 'Net Cash Surplus' : 'Net Profit / Loss',
    remainingBudget: budgetStatus.length ? sum(budgetStatus.map((b) => b.remaining)) : null,
    overspentBudgets: budgetStatus.filter((b) => b.exceeded).length,
    awaitingApproval: pending.length,
    awaitingApprovalAmount: sum(pending.map((t) => t.baseTotal)),
  };
}
