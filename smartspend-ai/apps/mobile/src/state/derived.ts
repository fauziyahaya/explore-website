import { allAlerts, dashboardSummary, monthRange, type Transaction } from '@smartspend/core';
import { useMemo } from 'react';
import { todayLocal } from '../services/dates';
import { useApp } from './AppContext';

/** Current-month dashboard figures, budget statuses and alerts — all computed by @smartspend/core. */
export function useMonthOverview(month = todayLocal().slice(0, 7)) {
  const { workspace, data, categories } = useApp();
  return useMemo(() => {
    if (!workspace || !data) return null;
    const today = todayLocal();
    const { alerts, statuses } = allAlerts(workspace, data.transactions, categories, data.budgets, today, new Date().toISOString());
    const summary = dashboardSummary(workspace, data.transactions, categories, monthRange(month), statuses.filter((s) => s.budget.scope.type === 'overall' || statuses.length === 1));
    return { summary, alerts, statuses, range: monthRange(month) };
  }, [workspace, data, categories, month]);
}

export function useTransactionMap(): Map<string, Transaction> {
  const { data } = useApp();
  return useMemo(() => new Map((data?.transactions ?? []).map((t) => [t.id, t])), [data?.transactions]);
}

export function useCategoryMap() {
  const { categories } = useApp();
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

export function useDimensionNames() {
  const { data } = useApp();
  return useMemo(() => Object.fromEntries((data?.dimensions ?? []).map((d) => [d.id, d.name])), [data?.dimensions]);
}
