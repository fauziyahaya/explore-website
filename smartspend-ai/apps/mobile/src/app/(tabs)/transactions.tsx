import { categoryLabel, formatMoney, normaliseName, type Transaction } from '@smartspend/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../state/AppContext';
import { useCategoryMap } from '../../state/derived';
import { Chip, ChipRow, Divider, EmptyState, ErrorState, Loading, Text } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { TransactionRow } from '../../ui/TransactionRow';
import { font, radius, spacing, useTheme } from '../../ui/theme';

type Filter = 'all' | 'expense' | 'income' | 'pending';

export default function Transactions() {
  const t = useTheme();
  const params = useLocalSearchParams<{ filter?: Filter }>();
  const { t: tr, data, dataError, locale } = useApp();
  const catMap = useCategoryMap();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>(params.filter ?? 'all');
  const [showAmended, setShowAmended] = useState(false);
  useEffect(() => {
    if (params.filter) setFilter(params.filter);
  }, [params.filter]);

  const list = useMemo(() => {
    const needle = normaliseName(q);
    const amount = Number(q.replace(/[^0-9.]/g, ''));
    return (data?.transactions ?? []).filter((x: Transaction) => {
      if (!showAmended && x.status === 'superseded') return false;
      if (filter === 'expense' && x.kind !== 'expense') return false;
      if (filter === 'income' && x.kind !== 'income') return false;
      if (filter === 'pending' && !['draft', 'submitted', 'rejected'].includes(x.status)) return false;
      if (!needle) return true;
      if (amount && Math.abs(x.baseTotal / 100 - amount) < 0.005) return true;
      const hay = normaliseName([x.merchant, x.receiptNumber, x.description, x.businessPurpose, categoryLabel(catMap.get(x.categoryId), locale), ...x.lineItems.flatMap((l) => [l.description, l.brand])].filter(Boolean).join(' '));
      return hay.includes(needle);
    });
  }, [data?.transactions, q, filter, showAmended, catMap, locale]);

  const total = list.filter((x) => x.status === 'approved').reduce((s, x) => s + (x.kind === 'income' ? x.baseTotal : -x.baseTotal), 0);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bgAlt }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md }}>
        <Text variant="largeTitle" accessibilityRole="header">{tr('tabs.transactions')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: t.input, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 44 }}>
          <Icon name="search" size={18} color={t.textSubtle} />
          <TextInput value={q} onChangeText={setQ} placeholder={tr('tx.search')} placeholderTextColor={t.textSubtle} style={[font.body, { flex: 1, color: t.text }]} accessibilityLabel={tr('tx.search')} clearButtonMode="while-editing" returnKeyType="search" />
        </View>
        <ChipRow>
          {(['all', 'expense', 'income', 'pending'] as Filter[]).map((f) => (
            <Chip key={f} label={tr(f === 'all' ? 'tx.filterAll' : f === 'expense' ? 'tx.filterExpense' : f === 'income' ? 'tx.filterIncome' : 'tx.filterPending')} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
          <Chip label="Show amended" icon="history" selected={showAmended} onPress={() => setShowAmended(!showAmended)} />
        </ChipRow>
        {list.length ? <Text variant="footnote" color={t.textMuted}>{list.length} records · net approved {formatMoney(total, 'MYR', { showSign: true })}</Text> : null}
      </View>
      {dataError ? <View style={{ padding: spacing.lg }}><ErrorState message={dataError} /></View> : null}
      {!data ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => <TransactionRow tx={item} category={catMap.get(item.categoryId)} />}
          initialNumToRender={20}
          ListEmptyComponent={<EmptyState icon={q ? 'search' : 'scan'} title={q ? 'No matches' : tr('tx.empty')} action={q ? undefined : { label: tr('home.snap'), onPress: () => router.push('/(tabs)/scan') }} />}
        />
      )}
    </SafeAreaView>
  );
}
