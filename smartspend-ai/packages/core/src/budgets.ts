import { allocateAll, type Allocation } from './finance';
import { analyseSpike } from './insights';
import { monthRange, yearRange } from './analytics';
import { formatMoney, pct, sum } from './money';
import { normaliseName } from './text';
import type { Alert, Budget, Category, ISODate, Transaction, Workspace } from './types';
import { isProfitAndLoss } from './categories';
import { findDuplicates } from './duplicates';

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  utilisedPct: number;
  exceeded: boolean;
  /** Highest threshold crossed (e.g. 80 or 100), or null. */
  thresholdCrossed: number | null;
  transactionIds: string[];
  periodLabel: string;
}

function budgetRange(b: Budget, today: ISODate) {
  if (b.period === 'monthly') return monthRange(b.periodKey === '*' ? today.slice(0, 7) : b.periodKey);
  return yearRange(b.periodKey === '*' ? today.slice(0, 4) : b.periodKey);
}

function matchesScope(a: Allocation, b: Budget): boolean {
  const s = b.scope;
  switch (s.type) {
    case 'overall':
      return true;
    case 'category':
      return a.categoryId === s.categoryId;
    case 'department':
    case 'business_unit':
      return a.departmentId === s.dimensionId;
    case 'project':
      return a.projectId === s.dimensionId;
    case 'merchant':
      return normaliseName(a.merchant) === normaliseName(s.merchant);
  }
}

export function budgetStatus(
  budget: Budget,
  txs: Transaction[],
  categories: Category[],
  workspace: Pick<Workspace, 'type'>,
  today: ISODate,
): BudgetStatus {
  const range = budgetRange(budget, today);
  const allocs = allocateAll(txs, categories, workspace, range).filter(
    (a) => a.kind === 'expense' && a.accountingClass !== 'personal_excluded' && isProfitAndLoss(a.accountingClass as never) && matchesScope(a, budget),
  );
  const spent = sum(allocs.map((a) => a.amount));
  const utilisedPct = pct(spent, budget.amount) ?? 0;
  const crossed = [...budget.alertThresholds].sort((a, b) => b - a).find((t) => utilisedPct >= t) ?? null;
  return {
    budget,
    spent,
    remaining: budget.amount - spent,
    utilisedPct,
    exceeded: spent > budget.amount,
    thresholdCrossed: crossed,
    transactionIds: [...new Set(allocs.map((a) => a.transactionId))],
    periodLabel: budget.period === 'monthly' ? range.from.slice(0, 7) : range.from.slice(0, 4),
  };
}

export function budgetAlerts(statuses: BudgetStatus[], nowIso: string): Alert[] {
  const alerts: Alert[] = [];
  for (const s of statuses) {
    if (s.thresholdCrossed == null) continue;
    const exceeded = s.exceeded;
    alerts.push({
      id: `budget_${s.budget.id}_${s.periodLabel}_${exceeded ? 'over' : s.thresholdCrossed}`,
      type: exceeded ? 'budget_exceeded' : 'budget_threshold',
      severity: exceeded ? 'critical' : 'warning',
      title: exceeded ? `${s.budget.name} budget exceeded` : `${s.budget.name} budget at ${Math.floor(s.utilisedPct)}%`,
      message: exceeded
        ? `You have spent ${formatMoney(s.spent)} against a budget of ${formatMoney(s.budget.amount)} (${formatMoney(-s.remaining)} over).`
        : `You have used ${s.utilisedPct}% of your ${formatMoney(s.budget.amount)} budget. ${formatMoney(s.remaining)} remains.`,
      calculation: `${formatMoney(s.spent)} ÷ ${formatMoney(s.budget.amount)} × 100 = ${s.utilisedPct}% (${s.transactionIds.length} transactions, ${s.periodLabel})`,
      transactionIds: s.transactionIds,
      budgetId: s.budget.id,
      createdAt: nowIso,
    });
  }
  return alerts;
}

/**
 * Unusual single transaction: more than mean + 3σ of the same category's
 * previous approved expenses (needs ≥ 5 data points; otherwise no alert).
 */
export function unusualAmountAlerts(txs: Transaction[], recent: Transaction[], nowIso: string): Alert[] {
  const alerts: Alert[] = [];
  for (const tx of recent) {
    if (tx.kind !== 'expense') continue;
    const history = txs.filter((t) => t.id !== tx.id && t.status === 'approved' && t.kind === 'expense' && t.categoryId === tx.categoryId && t.date <= tx.date);
    if (history.length < 5) continue;
    const vals = history.map((t) => t.baseTotal);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    const limit = mean + 3 * sd;
    if (sd > 0 && tx.baseTotal > limit) {
      alerts.push({
        id: `unusual_${tx.id}`,
        type: 'unusual_amount',
        severity: 'warning',
        title: 'Unusual transaction amount',
        message: `${tx.merchant ?? 'This transaction'} on ${tx.date} (${formatMoney(tx.baseTotal)}) is much higher than your usual spending in this category.`,
        calculation: `mean ${formatMoney(Math.round(mean))} + 3 × σ ${formatMoney(Math.round(sd))} = ${formatMoney(Math.round(limit))} < ${formatMoney(tx.baseTotal)} (n=${vals.length})`,
        transactionIds: [tx.id],
        createdAt: nowIso,
      });
    }
  }
  return alerts;
}

export function duplicateAlerts(txs: Transaction[], recent: Transaction[], nowIso: string): Alert[] {
  const out: Alert[] = [];
  const seen = new Set<string>();
  for (const tx of recent) {
    const dups = findDuplicates(tx, txs);
    for (const d of dups) {
      const pair = [tx.id, d.transactionId].sort().join(':');
      if (seen.has(pair)) continue;
      seen.add(pair);
      out.push({
        id: `dup_${pair}`,
        type: 'duplicate_suspected',
        severity: d.score >= 0.95 ? 'critical' : 'warning',
        title: 'Possible duplicate purchase',
        message: `${tx.merchant ?? 'A transaction'} for ${formatMoney(tx.baseTotal)} on ${tx.date} looks like a duplicate.`,
        calculation: `Match score ${Math.round(d.score * 100)}%: ${d.reasons.join('; ')}`,
        transactionIds: [tx.id, d.transactionId],
        createdAt: nowIso,
      });
    }
  }
  return out;
}

export function allAlerts(
  workspace: Pick<Workspace, 'type'>,
  txs: Transaction[],
  categories: Category[],
  budgets: Budget[],
  today: ISODate,
  nowIso: string,
): { alerts: Alert[]; statuses: BudgetStatus[] } {
  const statuses = budgets.map((b) => budgetStatus(b, txs, categories, workspace, today));
  const monthStart = `${today.slice(0, 7)}-01`;
  const recent = txs.filter((t) => t.date >= monthStart && t.status !== 'superseded' && t.status !== 'rejected');
  const spike = analyseSpike(workspace, txs, categories, today);
  const alerts = [
    ...budgetAlerts(statuses, nowIso),
    ...duplicateAlerts(txs, recent, nowIso),
    ...unusualAmountAlerts(txs, recent.filter((t) => t.status === 'approved'), nowIso),
    ...spike.map((s) => ({
      id: `spike_${s.categoryId}_${today.slice(0, 7)}`,
      type: 'spending_spike' as const,
      severity: 'info' as const,
      title: s.title,
      message: s.message,
      calculation: s.calculation,
      transactionIds: s.transactionIds,
      createdAt: nowIso,
    })),
  ];
  return { alerts, statuses };
}
