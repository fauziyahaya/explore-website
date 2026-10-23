import { allocateAll, categoryLabel, formatMoney, monthRange, profitAndLoss, reconcile, shiftMonth, yearRange, type Allocation } from '@smartspend/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { todayLocal } from '../services/dates';
import { useApp } from '../state/AppContext';
import { useCategoryMap } from '../state/derived';
import { Banner, Card, Chip, ChipRow, Divider, Screen, SectionHeader, Text } from '../ui/components';
import { Icon } from '../ui/Icon';
import { spacing, useTheme } from '../ui/theme';

export default function ProfitAndLoss() {
  const t = useTheme();
  const { workspace, data, categories, t: tr, locale } = useApp();
  const catMap = useCategoryMap();
  const today = todayLocal();
  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'ytd' | 'last_year'>('this_month');
  const range = period === 'this_month' ? monthRange(today.slice(0, 7)) : period === 'last_month' ? monthRange(shiftMonth(today.slice(0, 7), -1)) : period === 'ytd' ? { from: `${today.slice(0, 4)}-01-01`, to: today } : yearRange(Number(today.slice(0, 4)) - 1);
  const { allocs, pl, rec } = useMemo(() => {
    const a = workspace && data ? allocateAll(data.transactions, categories, workspace, range) : [];
    return { allocs: a, pl: profitAndLoss(a), rec: reconcile(data?.transactions ?? [], a, range) };
  }, [workspace, data, categories, range.from, range.to]);
  if (!workspace) return null;

  const ids = (pred: (a: Allocation) => boolean) => [...new Set(allocs.filter(pred).map((a) => a.transactionId))];
  const Line = ({ label, value, cls, strong, help, indent }: { label: string; value: number; cls?: string[]; strong?: boolean; help?: string; indent?: boolean }) => (
    <Pressable disabled={!cls} onPress={() => cls && router.push({ pathname: '/drilldown', params: { ids: ids((a) => cls.includes(a.accountingClass)).join(','), title: label } })} accessibilityRole={cls ? 'button' : 'text'} accessibilityLabel={`${label}: ${formatMoney(value)}`}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingLeft: indent ? spacing.md : 0, gap: 6 }}>
      <Text variant={strong ? 'headline' : 'callout'} style={{ flex: 1 }} color={strong ? t.text : t.textMuted}>{label}</Text>
      {help ? <Pressable onPress={() => Alert.alert(label, help)} hitSlop={8} accessibilityLabel={`What is ${label}?`}><Icon name="info" size={14} color={t.textSubtle} /></Pressable> : null}
      <Text variant={strong ? 'headline' : 'callout'} color={strong ? (value >= 0 ? t.positive : t.negative) : t.text} style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(value)}</Text>
      {cls ? <Icon name="chevron-right" size={14} color={t.textSubtle} /> : null}
    </Pressable>
  );

  return (
    <Screen edges={[]}>
      <ChipRow>
        {(['this_month', 'last_month', 'ytd', 'last_year'] as const).map((p) => <Chip key={p} label={{ this_month: 'This month', last_month: 'Last month', ytd: 'Year to date', last_year: 'Last year' }[p]} selected={period === p} onPress={() => setPeriod(p)} />)}
      </ChipRow>
      <Text variant="footnote" color={t.textMuted} style={{ marginVertical: spacing.sm }}>{range.from} → {range.to} · Cash basis · approved records</Text>
      <Card>
        <Line label="Revenue" value={pl.revenue} cls={['revenue']} />
        <Line label="Cost of goods sold" value={-pl.costOfGoodsSold} cls={['cogs']} indent />
        <Divider />
        <Line label="Gross profit" value={pl.grossProfit} strong help={tr('help.grossProfit')} />
        <Line label="Other operating income" value={pl.otherOperatingIncome} cls={['other_operating_income']} indent />
        <Line label="Operating expenses" value={-pl.operatingExpenses} cls={['operating_expense']} indent />
        <Divider />
        <Line label="Operating profit" value={pl.operatingProfit} strong help={tr('help.operatingProfit')} />
        <Line label="Non-operating income" value={pl.nonOperatingIncome} cls={['non_operating_income']} indent />
        <Line label="Other expenses (financing)" value={-pl.otherExpenses} cls={['other_expense']} indent />
        <Divider />
        <Line label="Net profit / (loss)" value={pl.netProfit} strong help={tr('help.netProfit')} />
      </Card>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        {[['Gross margin', pl.grossMarginPct], ['Operating margin', pl.operatingMarginPct], ['Net margin', pl.netMarginPct]].map(([l, v]) => (
          <Card key={l as string} style={{ flex: 1, padding: spacing.md }}><Text variant="caption" color={t.textMuted}>{l}</Text><Text variant="headline">{v == null ? '—' : `${v}%`}</Text></Card>
        ))}
      </View>

      <SectionHeader title="Operating expenses by category" />
      <Card style={{ paddingVertical: spacing.xs }}>
        {pl.byCategory.filter((c) => c.accountingClass === 'operating_expense').map((c, i) => (
          <View key={c.categoryId}>{i ? <Divider /> : null}
            <Pressable onPress={() => router.push({ pathname: '/drilldown', params: { ids: ids((a) => a.categoryId === c.categoryId).join(','), title: categoryLabel(catMap.get(c.categoryId), locale) } })} style={{ flexDirection: 'row', minHeight: 44, alignItems: 'center' }} accessibilityRole="button">
              <Text variant="callout" style={{ flex: 1 }}>{categoryLabel(catMap.get(c.categoryId), locale)}</Text>
              <Text variant="callout">{formatMoney(c.amount)}</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <SectionHeader title="Not included in profit" />
      <Card>
        <Line label="Capital expenditure (assets)" value={pl.excluded.capitalExpenditure} cls={['capital_expenditure']} />
        <Line label="Owner drawings" value={pl.excluded.ownerDrawings} cls={['owner_drawing']} />
        <Line label="Owner capital contributions" value={pl.excluded.ownerContributions} cls={['owner_contribution']} />
        <Line label="Loan principal repayments" value={pl.excluded.loanPrincipal} cls={['financing']} />
        <Line label="Personal expenses paid by business" value={pl.excluded.personalExpenses} cls={['personal_excluded']} />
        <Divider />
        <Line label="Net cash flow" value={pl.netCashFlow} strong help="All money in minus all money out. This is NOT profit: it includes asset purchases, drawings and loan repayments." />
      </Card>
      <Banner tone={rec.ok ? 'success' : 'danger'} icon={rec.ok ? 'shield' : 'alert'}>{rec.ok ? `Reconciled: every approved transaction in this period (${formatMoney(rec.transactionTotal, 'MYR', { showSign: true })} net) is accounted for in profit or the excluded items.` : `Reconciliation difference of ${formatMoney(rec.difference)} — please review.`}</Banner>
      <Text variant="caption" color={t.textSubtle}>{tr('reports.disclaimerShort')} Accrual accounting will be available in a later version.</Text>
    </Screen>
  );
}
