import { formatMoney } from '@smartspend/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../state/AppContext';
import { useCategoryMap, useMonthOverview } from '../../state/derived';
import { Banner, Card, Divider, EmptyState, ErrorState, Loading, SectionHeader, Text } from '../../ui/components';
import { Icon, type IconName } from '../../ui/Icon';
import { TransactionRow } from '../../ui/TransactionRow';
import { radius, spacing, useTheme } from '../../ui/theme';

function SummaryCard({ title, value, icon, tone, help, onPress, sub }: { title: string; value: string; icon: IconName; tone?: 'positive' | 'negative' | 'warning'; help?: string; onPress?: () => void; sub?: string }) {
  const t = useTheme();
  const color = tone === 'positive' ? t.positive : tone === 'negative' ? t.negative : tone === 'warning' ? t.warning : t.text;
  return (
    <Card onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1, padding: spacing.md, gap: 6 }} accessibilityLabel={`${title}: ${value}${sub ? `, ${sub}` : ''}`} accessibilityHint={help}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={16} color={t.textMuted} />
        <Text variant="footnote" color={t.textMuted} style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
        {help ? (
          <Pressable onPress={() => Alert.alert(title, help)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`What is ${title}?`}>
            <Icon name="info" size={16} color={t.textSubtle} />
          </Pressable>
        ) : null}
      </View>
      <Text variant="title" color={color} style={{ fontVariant: ['tabular-nums'] }} fit>{value}</Text>
      {sub ? <Text variant="caption" color={t.textSubtle} numberOfLines={1}>{sub}</Text> : null}
    </Card>
  );
}

export default function Dashboard() {
  const t = useTheme();
  const { t: tr, workspace, data, dataError, role } = useApp();
  const overview = useMonthOverview();
  const catMap = useCategoryMap();
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  if (!workspace) return null;
  const business = workspace.type === 'business';
  const s = overview?.summary;
  const recent = (data?.transactions ?? []).filter((x) => x.status !== 'superseded').slice(0, 5);
  const alerts = overview?.alerts ?? [];
  const canApprove = role && ['owner', 'finance_manager', 'approver'].includes(role);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bgAlt }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <Pressable onPress={() => router.push('/workspaces')} accessibilityRole="button" accessibilityHint="Switch workspace" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="footnote" color={t.textMuted}>{tr('home.thisMonth')} · {business ? tr('accountType.business') : tr('accountType.personal')}</Text>
          {workspace.isSample ? <View style={{ backgroundColor: t.warningSoft, borderRadius: radius.pill, paddingHorizontal: 8 }}><Text variant="caption" color={t.warning}>{tr('common.sample')}</Text></View> : null}
        </Pressable>
        <Pressable onPress={() => router.push('/workspaces')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg }}>
          <Text variant="largeTitle" numberOfLines={1} style={{ flexShrink: 1 }} accessibilityRole="header">{workspace.name}</Text>
          <Icon name="chevron-down" size={18} color={t.textMuted} />
        </Pressable>

        {dataError ? <ErrorState message={dataError} /> : null}
        {(data?.pendingUploads ?? 0) > 0 ? <Banner tone="warning" icon="offline">{`${data!.pendingUploads} item(s) waiting to upload. They will sync automatically when you are online.`}</Banner> : null}

        {!s ? (
          <Loading label={tr('common.loading')} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              <SummaryCard title={tr('home.income')} value={formatMoney(s.totalIncome)} icon="income" tone="positive" onPress={() => router.push({ pathname: '/(tabs)/transactions', params: { filter: 'income' } })} />
              <SummaryCard title={tr('home.expenses')} value={formatMoney(s.totalExpenses)} icon="expense" onPress={() => router.push({ pathname: '/(tabs)/transactions', params: { filter: 'expense' } })} />
              <SummaryCard
                title={business ? tr('home.netBusiness') : tr('home.netPersonal')}
                value={formatMoney(s.net, 'MYR', { showSign: true })}
                icon="wallet"
                tone={s.net >= 0 ? 'positive' : 'negative'}
                help={business ? tr('help.netProfit') : tr('help.netCashSurplus')}
                sub="Cash basis"
                onPress={business ? () => router.push('/pnl') : undefined}
              />
              <SummaryCard title={tr('home.remainingBudget')} value={s.remainingBudget == null ? tr('home.noBudget') : formatMoney(s.remainingBudget)} icon="budget" tone={s.remainingBudget != null && s.remainingBudget < 0 ? 'negative' : undefined} onPress={() => router.push('/budgets')} />
              <SummaryCard title={tr('home.overspending')} value={String(alerts.filter((a) => a.severity !== 'info').length)} icon="alert" tone={alerts.some((a) => a.severity === 'critical') ? 'negative' : alerts.length ? 'warning' : undefined} sub={overview!.statuses.filter((x) => x.exceeded).length ? `${overview!.statuses.filter((x) => x.exceeded).length} budget(s) exceeded` : undefined} />
              <SummaryCard title={tr('home.awaiting')} value={String(s.awaitingApproval)} icon="clock" tone={s.awaitingApproval ? 'warning' : undefined} sub={s.awaitingApproval ? formatMoney(s.awaitingApprovalAmount) : undefined} onPress={canApprove ? () => router.push('/approvals') : () => router.push({ pathname: '/(tabs)/transactions', params: { filter: 'pending' } })} />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              {[
                { icon: 'income' as const, label: tr('home.addIncome'), go: () => router.push('/income') },
                { icon: 'pencil' as const, label: tr('home.addExpense'), go: () => router.push({ pathname: '/receipt-review', params: { source: 'manual' } }) },
                { icon: 'chart' as const, label: tr('analytics.generate'), go: () => router.push('/(tabs)/analytics') },
                { icon: 'scale' as const, label: business ? tr('pnl.title') : tr('products.title'), go: () => router.push(business ? '/pnl' : '/products') },
              ].map((a) => (
                <Pressable key={a.label} onPress={a.go} accessibilityRole="button" accessibilityLabel={a.label} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6, minHeight: 72 }, pressed && { opacity: 0.6 }]}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, alignItems: 'center', justifyContent: 'center' }}><Icon name={a.icon} color={t.primary} /></View>
                  <Text variant="caption" color={t.textMuted} style={{ textAlign: 'center' }} numberOfLines={2}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            {alerts.length ? (
              <>
                <SectionHeader title={tr('home.insights')} action={alerts.length > 3 ? { label: showAllAlerts ? 'Less' : `All ${alerts.length}`, onPress: () => setShowAllAlerts(!showAllAlerts) } : undefined} />
                <Card style={{ gap: spacing.md }}>
                  {(showAllAlerts ? alerts : alerts.slice(0, 3)).map((a, i) => (
                    <View key={a.id}>
                      {i > 0 ? <Divider /> : null}
                      <Pressable onPress={() => router.push({ pathname: '/drilldown', params: { ids: a.transactionIds.join(','), title: a.title, calc: a.calculation } })} accessibilityRole="button" accessibilityHint="Shows the transactions behind this insight" style={{ flexDirection: 'row', gap: spacing.md, paddingTop: i ? spacing.md : 0 }}>
                        <Icon name={a.type === 'spending_spike' ? 'trending' : a.type === 'duplicate_suspected' ? 'doc' : 'alert'} size={20} color={a.severity === 'critical' ? t.danger : a.severity === 'warning' ? t.warning : t.info} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text variant="callout" style={{ fontWeight: '600' }}>{a.title}</Text>
                          <Text variant="footnote" color={t.textMuted}>{a.message}</Text>
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            <SectionHeader title={tr('home.recent')} action={recent.length ? { label: 'See all', onPress: () => router.push('/(tabs)/transactions') } : undefined} />
            <Card style={{ paddingVertical: spacing.xs }}>
              {recent.length ? recent.map((x, i) => (
                <View key={x.id}>{i > 0 ? <Divider /> : null}<TransactionRow tx={x} category={catMap.get(x.categoryId)} /></View>
              )) : <EmptyState icon="scan" title={tr('tx.empty')} action={{ label: tr('home.snap'), onPress: () => router.push('/(tabs)/scan') }} />}
            </Card>
            <Text variant="caption" color={t.textSubtle} style={{ marginTop: spacing.md, textAlign: 'center' }}>Figures are on a cash basis and include approved records only.</Text>
          </>
        )}
      </ScrollView>

      {role !== 'auditor' ? (
        <Pressable
          onPress={() => router.push('/(tabs)/scan')}
          accessibilityRole="button"
          accessibilityLabel={tr('home.snap')}
          accessibilityHint="Opens the camera to photograph a receipt"
          style={({ pressed }) => ({ position: 'absolute', right: spacing.lg, bottom: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: t.primary, paddingHorizontal: spacing.xl, minHeight: 60, borderRadius: radius.pill, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6, opacity: pressed ? 0.85 : 1 })}
        >
          <Icon name="camera" size={24} color={t.onPrimary} />
          <Text variant="headline" color={t.onPrimary}>{tr('home.snap')}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
