import { formatMoney } from '@smartspend/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { useCategoryMap, useTransactionMap } from '../state/derived';
import { Banner, Card, Divider, EmptyState, Screen, Text } from '../ui/components';
import { TransactionRow } from '../ui/TransactionRow';
import { spacing, useTheme } from '../ui/theme';

/** Drill-down from any chart element, summary figure, budget or insight to its underlying transactions. */
export default function DrillDown() {
  const t = useTheme();
  const { ids, title, calc } = useLocalSearchParams<{ ids?: string; title?: string; calc?: string }>();
  useApp();
  const txMap = useTransactionMap();
  const catMap = useCategoryMap();
  const list = (ids ?? '').split(',').filter(Boolean).map((id) => txMap.get(id)).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, x) => s + (x.kind === 'income' ? x.baseTotal : -x.baseTotal), 0);
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: title ?? 'Transactions' }} />
      {calc ? <Banner icon="info"><Text variant="footnote">How this was calculated: {calc}</Text></Banner> : null}
      <Text variant="footnote" color={t.textMuted} style={{ marginBottom: spacing.sm }}>{list.length} transaction(s) · net {formatMoney(total, 'MYR', { showSign: true })}</Text>
      <Card style={{ paddingVertical: spacing.xs }}>
        {list.length ? list.map((x, i) => <View key={x.id}>{i ? <Divider /> : null}<TransactionRow tx={x} category={catMap.get(x.categoryId)} /></View>) : <EmptyState title="No transactions" />}
      </Card>
    </Screen>
  );
}
