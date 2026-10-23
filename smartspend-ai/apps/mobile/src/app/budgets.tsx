import { budgetStatus, can, categoryLabel, formatMoney, newId, type Budget } from '@smartspend/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { todayLocal } from '../services/dates';
import { useApp } from '../state/AppContext';
import { useCategoryMap, useDimensionNames } from '../state/derived';
import { Banner, Button, Card, Chip, ChipRow, EmptyState, Field, MoneyField, PickerSheet, ProgressBar, Screen, SectionHeader, Segmented, SelectField, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

export default function Budgets() {
  const t = useTheme();
  const { workspace, data, categories, role, backend, session, locale } = useApp();
  const catMap = useCategoryMap();
  const dims = useDimensionNames();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [scopeType, setScopeType] = useState<Budget['scope']['type']>('category');
  const [scopeValue, setScopeValue] = useState<string>('');
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!workspace || !data || !session) return null;
  const manage = can(role, 'budget.manage');
  const business = workspace.type === 'business';
  const today = todayLocal();
  const statuses = data.budgets.map((b) => budgetStatus(b, data.transactions, categories, workspace, today));

  const scopeLabel = (b: Budget) => {
    const s = b.scope;
    if (s.type === 'overall') return business ? 'Whole company' : 'All spending';
    if (s.type === 'category') return categoryLabel(catMap.get(s.categoryId), locale);
    if (s.type === 'merchant') return `Merchant: ${s.merchant}`;
    return `${s.type.replace('_', ' ')}: ${dims[s.dimensionId] ?? s.dimensionId}`;
  };
  const scopeOptions = scopeType === 'category'
    ? categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name[locale], color: c.color }))
    : scopeType === 'merchant'
      ? [...new Set(data.transactions.filter((x) => x.merchant).map((x) => x.merchant!))].map((m) => ({ value: m, label: m }))
      : data.dimensions.filter((d) => (scopeType === 'department' ? d.type === 'department' : scopeType === 'project' ? d.type === 'project' : d.type === 'business_unit')).map((d) => ({ value: d.id, label: d.name }));

  const save = async () => {
    setError(null);
    const scope: Budget['scope'] = scopeType === 'overall' ? { type: 'overall' } : scopeType === 'category' ? { type: 'category', categoryId: scopeValue } : scopeType === 'merchant' ? { type: 'merchant', merchant: scopeValue } : { type: scopeType, dimensionId: scopeValue };
    try {
      await backend.saveBudget(workspace.id, { id: newId('bud'), workspaceId: workspace.id, name: name.trim(), period, periodKey: '*', scope, amount: amount!, alertThresholds: [80, 100], createdBy: session.uid, createdAt: new Date().toISOString() });
      setAdding(false); setName(''); setAmount(null); setScopeValue('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Screen edges={[]}>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      <Text variant="footnote" color={t.textMuted}>Alerts are sent at 80% and when a budget is exceeded. Budgets repeat every {period === 'monthly' ? 'month' : 'year'}.</Text>
      {statuses.length === 0 && !adding ? <EmptyState icon="budget" title="No budgets yet" message="Set a monthly or annual limit for a category, department, project or merchant." action={manage ? { label: 'Add budget', onPress: () => setAdding(true) } : undefined} /> : null}
      {statuses.map((s) => (
        <Card key={s.budget.id} style={{ marginTop: spacing.md, gap: 8 }} onPress={() => router.push({ pathname: '/drilldown', params: { ids: s.transactionIds.join(','), title: s.budget.name } })} accessibilityLabel={`${s.budget.name}: ${s.utilisedPct} percent used`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{s.budget.name}</Text>
              <Text variant="footnote" color={t.textMuted}>{scopeLabel(s.budget)} · {s.budget.period} · {s.periodLabel}</Text>
            </View>
            <Text variant="headline" color={s.exceeded ? t.danger : s.utilisedPct >= 80 ? t.warning : t.positive}>{Math.round(s.utilisedPct)}%</Text>
          </View>
          <ProgressBar pct={s.utilisedPct} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="footnote" color={t.textMuted}>{formatMoney(s.spent)} of {formatMoney(s.budget.amount)}</Text>
            <Text variant="footnote" color={s.remaining < 0 ? t.danger : t.textMuted}>{s.remaining < 0 ? `${formatMoney(-s.remaining)} over` : `${formatMoney(s.remaining)} left`}</Text>
          </View>
          {s.exceeded ? <Text variant="caption" color={t.danger}>⚠︎ Over budget</Text> : s.thresholdCrossed ? <Text variant="caption" color={t.warning}>⚠︎ {s.thresholdCrossed}% threshold reached</Text> : null}
          {manage ? (
            <Pressable onPress={() => Alert.alert('Delete budget?', s.budget.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => backend.deleteBudget(workspace.id, s.budget.id) }])} accessibilityRole="button" style={{ alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' }}>
              <Text variant="footnote" color={t.danger}>Delete</Text>
            </Pressable>
          ) : null}
        </Card>
      ))}
      {manage && !adding && statuses.length ? <Button title="Add budget" icon="plus" variant="secondary" style={{ marginTop: spacing.lg }} onPress={() => setAdding(true)} /> : null}
      {adding ? (
        <>
          <SectionHeader title="New budget" />
          <Card>
            <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Groceries" />
            <MoneyField label="Amount" minor={amount} onChange={setAmount} />
            <Segmented options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} value={period} onChange={setPeriod} />
            <Text variant="footnote" color={t.textMuted} style={{ marginTop: spacing.md, marginBottom: 6 }}>Applies to</Text>
            <ChipRow>
              {(['category', 'overall', 'merchant', ...(business ? (['department', 'project', 'business_unit'] as const) : [])] as Array<Budget['scope']['type']>).map((s) => (
                <Chip key={s} label={s === 'overall' ? (business ? 'Whole company' : 'All spending') : s.replace('_', ' ')} selected={scopeType === s} onPress={() => { setScopeType(s); setScopeValue(''); }} />
              ))}
            </ChipRow>
            {scopeType !== 'overall' ? <View style={{ marginTop: spacing.md }}><SelectField label="Choose" valueLabel={scopeOptions.find((o) => o.value === scopeValue)?.label ?? 'Select…'} onPress={() => setPicker(true)} /></View> : null}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <Button title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setAdding(false)} />
              <Button title="Save" style={{ flex: 1 }} disabled={!name.trim() || !amount || (scopeType !== 'overall' && !scopeValue)} onPress={save} />
            </View>
          </Card>
        </>
      ) : null}
      <PickerSheet visible={picker} title="Applies to" options={scopeOptions} value={scopeValue} onSelect={setScopeValue} onClose={() => setPicker(false)} />
    </Screen>
  );
}
