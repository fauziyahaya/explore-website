import {
  allocateAll,
  applyFilter,
  budgetStatus,
  dimensionBreakdown,
  formatMoney,
  generateAnalytics,
  lastNMonthsRange,
  monthRange,
  profitAndLoss,
  yearRange,
  type AnalyticsBundle,
  type Granularity,
} from '@smartspend/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart, DonutChart, LineChart, RankBars } from '../../charts/Charts';
import { monthLabel, todayLocal } from '../../services/dates';
import { useApp } from '../../state/AppContext';
import { useDimensionNames } from '../../state/derived';
import { Button, Card, Chip, ChipRow, Divider, EmptyState, PickerSheet, ProgressBar, Screen, SectionHeader, Segmented, Text } from '../../ui/components';
import { spacing, useTheme } from '../../ui/theme';

type Period = 'this_month' | 'last_3' | 'last_6' | 'this_year' | 'last_year';

function periodRange(p: Period) {
  const today = todayLocal();
  const y = Number(today.slice(0, 4));
  switch (p) {
    case 'this_month': return monthRange(today.slice(0, 7));
    case 'last_3': return lastNMonthsRange(today, 3);
    case 'last_6': return lastNMonthsRange(today, 6);
    case 'this_year': return yearRange(y);
    case 'last_year': return yearRange(y - 1);
  }
}

function drill(ids: string[], title: string) {
  router.push({ pathname: '/drilldown', params: { ids: ids.join(','), title } });
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 120 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="caption" color={t.textMuted}>{label}</Text>
      <Text variant="headline" color={tone === 'pos' ? t.positive : tone === 'neg' ? t.negative : t.text}>{value}</Text>
    </View>
  );
}

export default function Analytics() {
  const t = useTheme();
  const { t: tr, workspace, data, categories, locale } = useApp();
  const dimNames = useDimensionNames();
  const [period, setPeriod] = useState<Period>('last_6');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [bundle, setBundle] = useState<AnalyticsBundle | null>(null);
  const [catPicker, setCatPicker] = useState(false);
  const [merchantPicker, setMerchantPicker] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const range = periodRange(period);

  const generate = () => {
    if (!workspace || !data) return;
    setBundle(generateAnalytics(workspace, data.transactions, categories, { range, categoryIds, merchants: merchant ? [merchant] : undefined }, granularity, locale));
  };

  const extras = useMemo(() => {
    if (!bundle || !workspace || !data) return null;
    const allocs = applyFilter(allocateAll(data.transactions, categories, workspace), { range: bundle.range, categoryIds, merchants: merchant ? [merchant] : undefined });
    const pl = profitAndLoss(allocs);
    const months = bundle.incomeVsExpenses.map((p) => p.key);
    const budgets = data.budgets.map((b) => {
      const s = budgetStatus({ ...b, periodKey: b.period === 'monthly' ? months[months.length - 1]! : bundle.range.to.slice(0, 4) }, data.transactions, categories, workspace, todayLocal());
      return s;
    });
    return { pl, budgets, depts: dimensionBreakdown(allocs, 'departmentId', dimNames), projects: dimensionBreakdown(allocs, 'projectId', dimNames) };
  }, [bundle, workspace, data, categories, categoryIds, merchant, dimNames]);

  if (!workspace) return null;
  const business = workspace.type === 'business';
  const merchants = [...new Set((data?.transactions ?? []).filter((x) => x.kind === 'expense' && x.merchant).map((x) => x.merchant!))].sort();
  const fmtKey = (k: string) => monthLabel(k, locale);

  return (
    <Screen>
      <Text variant="largeTitle" accessibilityRole="header">{tr('tabs.analytics')}</Text>
      <Text variant="footnote" color={t.textMuted} style={{ marginBottom: spacing.md }}>{tr('analytics.period')}: {range.from} → {range.to}</Text>

      {/* Filters: one row above the charts */}
      <ChipRow>
        {(['this_month', 'last_3', 'last_6', 'this_year', 'last_year'] as Period[]).map((p) => (
          <Chip key={p} label={{ this_month: 'This month', last_3: '3 months', last_6: '6 months', this_year: 'This year', last_year: 'Last year' }[p]} selected={period === p} onPress={() => setPeriod(p)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip icon="filter" label={categoryIds.length ? `${categoryIds.length} categories` : 'All categories'} selected={categoryIds.length > 0} onPress={() => setCatPicker(true)} />
        <Chip icon="building" label={merchant ?? 'All merchants'} selected={!!merchant} onPress={() => setMerchantPicker(true)} />
        {categoryIds.length || merchant ? <Chip icon="x" label="Clear" onPress={() => { setCategoryIds([]); setMerchant(null); }} /> : null}
      </ChipRow>
      <View style={{ marginVertical: spacing.md }}>
        <Segmented options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }]} value={granularity} onChange={(g) => setGranularity(g as Granularity)} />
      </View>
      <Button title={tr('analytics.generate')} icon="chart" onPress={generate} disabled={!data} />

      {!bundle ? (
        <EmptyState icon="chart" title={tr('analytics.generate')} message="Choose a period and filters, then generate interactive charts from your recorded transactions." />
      ) : bundle.totals.expenses === 0 && bundle.totals.income === 0 ? (
        <EmptyState icon="inbox" title={tr('analytics.empty')} />
      ) : (
        <>
          <Text variant="caption" color={t.textSubtle} style={{ marginTop: spacing.md }}>{tr('analytics.tapHint')} Cash basis · approved records only.</Text>
          <Card style={{ marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <Stat label={tr('home.income')} value={formatMoney(bundle.totals.income)} tone="pos" />
            <Stat label={tr('home.expenses')} value={formatMoney(bundle.totals.expenses)} />
            <Stat label={business ? 'Net profit (cash)' : tr('home.netPersonal')} value={formatMoney(bundle.totals.net, 'MYR', { showSign: true })} tone={bundle.totals.net >= 0 ? 'pos' : 'neg'} />
            <Stat label="Expense-to-income" value={bundle.totals.expenseToIncomePct == null ? '—' : `${bundle.totals.expenseToIncomePct}%`} />
            <Stat label="Month-on-month" value={bundle.monthOnMonthPct == null ? '—' : `${bundle.monthOnMonthPct > 0 ? '+' : ''}${bundle.monthOnMonthPct}%`} tone={bundle.monthOnMonthPct != null && bundle.monthOnMonthPct > 0 ? 'neg' : 'pos'} />
          </Card>

          <SectionHeader title={tr('analytics.trend')} action={{ label: asTable ? 'Charts' : 'Table', onPress: () => setAsTable(!asTable) }} />
          <Card>
            {asTable ? (
              bundle.expenseTrend.map((p) => (
                <View key={p.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text variant="footnote">{fmtKey(p.key)}</Text>
                  <Text variant="footnote">{formatMoney(p.amount)} {p.changePct != null ? `(${p.changePct > 0 ? '+' : ''}${p.changePct}%)` : ''}</Text>
                </View>
              ))
            ) : granularity === 'day' || bundle.expenseTrend.length > 14 ? (
              <LineChart labels={bundle.expenseTrend.map((p) => p.key)} series={[{ key: 'exp', label: tr('home.expenses'), values: bundle.expenseTrend.map((p) => p.amount) }]} formatLabel={fmtKey} onSelect={(i) => drill(bundle.expenseTrend[i]!.transactionIds, `${tr('home.expenses')} · ${fmtKey(bundle.expenseTrend[i]!.key)}`)} />
            ) : (
              <BarChart labels={bundle.expenseTrend.map((p) => p.key)} series={[{ key: 'exp', label: tr('home.expenses'), values: bundle.expenseTrend.map((p) => p.amount), color: t.chart[0] }]} formatLabel={fmtKey} onSelect={(i) => drill(bundle.expenseTrend[i]!.transactionIds, `${tr('home.expenses')} · ${fmtKey(bundle.expenseTrend[i]!.key)}`)} />
            )}
          </Card>

          <SectionHeader title={tr('analytics.ive')} />
          <Card>
            <BarChart labels={bundle.incomeVsExpenses.map((p) => p.key)} formatLabel={fmtKey} series={[
              { key: 'inc', label: tr('home.income'), values: bundle.incomeVsExpenses.map((p) => p.income) },
              { key: 'exp', label: tr('home.expenses'), values: bundle.incomeVsExpenses.map((p) => p.expenses) },
            ]} />
            <Divider />
            {bundle.incomeVsExpenses.map((p) => (
              <View key={p.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text variant="footnote" color={t.textMuted}>{fmtKey(p.key)}</Text>
                <Text variant="footnote" color={p.net >= 0 ? t.positive : t.negative}>{formatMoney(p.net, 'MYR', { showSign: true })}{p.marginPct != null ? ` · ${p.marginPct}%` : ''}</Text>
              </View>
            ))}
          </Card>

          <SectionHeader title={tr('analytics.categories')} />
          <Card>
            {bundle.categories.length ? (
              <>
                <DonutChart slices={bundle.categories.map((c) => ({ key: c.key, label: c.label, value: c.amount }))} onSelect={(k) => { const c = bundle.categories.find((x) => x.key === k)!; drill(c.transactionIds, c.label); }} centerLabel={tr('home.expenses')} />
                <Divider />
                <Text variant="footnote" color={t.textMuted} style={{ marginVertical: spacing.sm }}>Highest expense categories</Text>
                <RankBars rows={bundle.categories.map((c) => ({ key: c.key, label: c.label, value: c.amount, sub: `${c.sharePct}% · ${c.transactionIds.length} transactions` }))} max={5} onSelect={(k) => { const c = bundle.categories.find((x) => x.key === k)!; drill(c.transactionIds, c.label); }} />
              </>
            ) : <Text color={t.textMuted}>{tr('analytics.empty')}</Text>}
          </Card>

          {business && extras && (extras.depts.length > 1 || extras.projects.length > 1) ? (
            <>
              <SectionHeader title="By department & project" />
              <Card style={{ gap: spacing.lg }}>
                <RankBars rows={extras.depts.map((d) => ({ key: d.key, label: d.label, value: d.amount, sub: `${d.sharePct}%` }))} onSelect={(k) => drill(extras.depts.find((d) => d.key === k)!.transactionIds, k)} />
                {extras.projects.length > 1 ? <><Divider /><RankBars rows={extras.projects.map((d) => ({ key: d.key, label: d.label, value: d.amount, sub: `${d.sharePct}%` }))} onSelect={(k) => drill(extras.projects.find((d) => d.key === k)!.transactionIds, k)} /></> : null}
              </Card>
            </>
          ) : null}

          {extras?.budgets.length ? (
            <>
              <SectionHeader title={tr('analytics.budget')} action={{ label: tr('budgets.title'), onPress: () => router.push('/budgets') }} />
              <Card style={{ gap: spacing.md }}>
                {extras.budgets.map((s) => (
                  <View key={s.budget.id} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="callout">{s.budget.name} <Text variant="caption" color={t.textSubtle}>{s.periodLabel}</Text></Text>
                      <Text variant="callout" color={s.exceeded ? t.danger : t.text}>{s.utilisedPct}%</Text>
                    </View>
                    <ProgressBar pct={s.utilisedPct} label={`${s.budget.name} ${s.utilisedPct}% used`} />
                    <Text variant="caption" color={t.textMuted}>{formatMoney(s.spent)} of {formatMoney(s.budget.amount)} · variance {formatMoney(s.remaining, 'MYR', { showSign: true })}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title={tr('analytics.performance')} action={business ? { label: tr('pnl.title'), onPress: () => router.push('/pnl') } : undefined} />
          <Card style={{ gap: spacing.md }}>
            {business && extras ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                <Stat label="Revenue" value={formatMoney(extras.pl.revenue)} />
                <Stat label="Gross margin" value={extras.pl.grossMarginPct == null ? '—' : `${extras.pl.grossMarginPct}%`} />
                <Stat label="Net margin" value={extras.pl.netMarginPct == null ? '—' : `${extras.pl.netMarginPct}%`} tone={(extras.pl.netMarginPct ?? 0) >= 0 ? 'pos' : 'neg'} />
              </View>
            ) : null}
            <LineChart labels={bundle.incomeVsExpenses.map((p) => p.key)} formatLabel={fmtKey} series={[
              { key: 'inc', label: business ? 'Revenue & income' : tr('home.income'), values: bundle.incomeVsExpenses.map((p) => p.income) },
              { key: 'exp', label: tr('home.expenses'), values: bundle.incomeVsExpenses.map((p) => p.expenses) },
            ]} />
            <Divider />
            <Text variant="callout">{tr('analytics.recurring')}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Stat label="Recurring" value={formatMoney(bundle.recurring.recurring)} />
              <Stat label="One-time" value={formatMoney(bundle.recurring.oneTime)} />
            </View>
            {bundle.recurring.recurringMerchants.length ? <Text variant="caption" color={t.textMuted}>Recurring: {bundle.recurring.recurringMerchants.join(', ')}</Text> : null}
          </Card>

          <SectionHeader title={tr('analytics.merchants')} action={{ label: tr('products.title'), onPress: () => router.push('/products') }} />
          <Card><RankBars rows={bundle.merchants.map((m) => ({ key: m.key, label: m.label, value: m.amount, sub: `${m.transactionIds.length} visits` }))} onSelect={(k) => { const m = bundle.merchants.find((x) => x.key === k)!; drill(m.transactionIds, m.label); }} /></Card>
          {bundle.brands.length ? (
            <>
              <SectionHeader title={tr('analytics.brands')} />
              <Card><RankBars rows={bundle.brands.map((m) => ({ key: m.key, label: m.label, value: m.amount }))} onSelect={(k) => { const m = bundle.brands.find((x) => x.key === k)!; drill(m.transactionIds, m.label); }} /></Card>
            </>
          ) : null}
        </>
      )}

      <PickerSheet visible={catPicker} title="Filter by category" options={categories.filter((c) => c.kind !== 'income').map((c) => ({ value: c.id, label: `${categoryIds.includes(c.id) ? '✓ ' : ''}${c.name[locale]}`, color: c.color }))} onSelect={(id) => setCategoryIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} onClose={() => setCatPicker(false)} />
      <PickerSheet visible={merchantPicker} title="Filter by merchant" options={[{ value: '__all', label: 'All merchants' }, ...merchants.map((m) => ({ value: m, label: m }))]} value={merchant ?? '__all'} onSelect={(m) => setMerchant(m === '__all' ? null : m)} onClose={() => setMerchantPicker(false)} />
    </Screen>
  );
}
