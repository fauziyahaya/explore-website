import { can, categoryLabel, formatMoney } from '@smartspend/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { shortDate } from '../services/dates';
import { useApp } from '../state/AppContext';
import { useCategoryMap } from '../state/derived';
import { Banner, Button, Card, EmptyState, Screen, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

/** Expense submission & approval queue (approvers, finance managers, owner). */
export default function Approvals() {
  const t = useTheme();
  const { data, workspace, role, backend, session, t: tr, locale } = useApp();
  const catMap = useCategoryMap();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!workspace || !data || !session) return null;
  const pending = data.transactions.filter((x) => x.status === 'submitted');
  const names = Object.fromEntries(data.members.map((m) => [m.uid, m.displayName]));
  if (!can(role, 'transaction.approve')) {
    const mine = data.transactions.filter((x) => x.createdBy === session.uid && x.status !== 'approved' && x.status !== 'superseded');
    return (
      <Screen edges={[]}>
        <Banner>Your claims and their status. An approver or finance manager reviews submitted claims.</Banner>
        {mine.length ? mine.map((x) => (
          <Card key={x.id} style={{ marginBottom: spacing.md }} onPress={() => router.push(`/transaction/${x.id}`)}>
            <Text variant="headline">{x.merchant ?? 'Expense'} · {formatMoney(x.baseTotal)}</Text>
            <Text variant="footnote" color={t.textMuted}>{x.status === 'submitted' ? 'Awaiting approval' : x.status === 'rejected' ? `Rejected: ${x.rejectedReason}` : 'Draft'}</Text>
          </Card>
        )) : <EmptyState icon="check-circle" title="No open claims" />}
      </Screen>
    );
  }
  const act = async (id: string, decision: 'approve' | 'reject', reason?: string) => {
    setBusy(id);
    setError(null);
    try {
      await backend.reviewTransaction(workspace.id, id, decision, reason);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Screen edges={[]}>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      {pending.length ? <Text variant="footnote" color={t.textMuted} style={{ marginBottom: spacing.md }}>{pending.length} claim(s) · {formatMoney(pending.reduce((s, x) => s + x.baseTotal, 0))}</Text> : null}
      {pending.length === 0 ? <EmptyState icon="check-circle" title={tr('approvals.empty')} /> : null}
      {pending.map((x) => {
        const self = x.createdBy === session.uid && role !== 'owner';
        return (
          <Card key={x.id} style={{ marginBottom: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessible>
              <View style={{ flex: 1 }}>
                <Text variant="headline">{x.merchant ?? 'Expense'}</Text>
                <Text variant="footnote" color={t.textMuted}>{names[x.createdBy] ?? x.createdBy} · {shortDate(x.date, locale)} · {categoryLabel(catMap.get(x.categoryId), locale)}</Text>
                {x.businessPurpose ? <Text variant="footnote">“{x.businessPurpose}”</Text> : null}
                <Text variant="caption" color={x.receipt ? t.positive : t.warning}>{x.receipt ? 'Receipt attached' : 'No receipt attached'}</Text>
              </View>
              <Text variant="headline">{formatMoney(x.baseTotal)}</Text>
            </View>
            {self ? <Text variant="caption" color={t.textSubtle}>You submitted this claim — another approver must review it (segregation of duties).</Text> : (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Button small title="Details" variant="ghost" style={{ flex: 1 }} onPress={() => router.push(`/transaction/${x.id}`)} />
                <Button small title={tr('approvals.reject')} variant="secondary" style={{ flex: 1 }} onPress={() => Alert.prompt?.(tr('approvals.rejectReason'), undefined, (r) => r?.trim() && act(x.id, 'reject', r))} />
                <Button small title={tr('approvals.approve')} style={{ flex: 1 }} loading={busy === x.id} onPress={() => act(x.id, 'approve')} />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
