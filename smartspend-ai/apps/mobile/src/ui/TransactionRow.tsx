import { categoryLabel, formatMoney, type Category, type Transaction } from '@smartspend/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { shortDate } from '../services/dates';
import { useApp } from '../state/AppContext';
import { Text } from './components';
import { Icon } from './Icon';
import { radius, spacing, useTheme } from './theme';

export function StatusPill({ tx }: { tx: Transaction }) {
  const t = useTheme();
  const map: Record<Transaction['status'], [string, string, string]> = {
    draft: ['Draft', t.textMuted, t.input],
    submitted: ['Awaiting approval', t.warning, t.warningSoft],
    approved: ['Approved', t.positive, t.positiveSoft],
    rejected: ['Rejected', t.danger, t.negativeSoft],
    superseded: ['Amended', t.textMuted, t.input],
  };
  const [label, fg, bg] = map[tx.status];
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: bg, alignSelf: 'flex-start' }}>
      <Text variant="caption" color={fg}>{label}</Text>
    </View>
  );
}

export function TransactionRow({ tx, category }: { tx: Transaction; category?: Category }) {
  const t = useTheme();
  const { locale } = useApp();
  const income = tx.kind === 'income';
  const label = tx.merchant ?? (income ? 'Income' : 'Expense');
  const pendingSync = tx.sync.sheets === 'pending' && tx.sync.error;
  return (
    <Pressable
      onPress={() => router.push(`/transaction/${tx.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${income ? 'income' : 'expense'} ${formatMoney(tx.baseTotal)}, ${shortDate(tx.date, locale)}, ${categoryLabel(category, locale)}, ${tx.status}`}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm }, pressed && { opacity: 0.6 }]}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (category?.color ?? t.primary) + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={income ? 'income' : tx.receipt ? 'doc' : 'expense'} size={20} color={category?.color ?? t.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>{label}</Text>
        <Text variant="footnote" color={t.textMuted} numberOfLines={1}>
          {shortDate(tx.date, locale)} · {categoryLabel(category, locale)}
          {tx.lineItems.length > 1 ? ` · ${tx.lineItems.length} items` : ''}
        </Text>
        {tx.status !== 'approved' || pendingSync ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {tx.status !== 'approved' ? <StatusPill tx={tx} /> : null}
            {pendingSync ? <Text variant="caption" color={t.warning}>⏳ {tx.sync.error}</Text> : null}
          </View>
        ) : null}
      </View>
      <Text variant="headline" color={income ? t.positive : t.text} style={{ fontVariant: ['tabular-nums'], textDecorationLine: tx.status === 'superseded' ? 'line-through' : 'none' }}>
        {income ? '+' : '−'}{formatMoney(tx.baseTotal)}
      </Text>
    </Pressable>
  );
}
