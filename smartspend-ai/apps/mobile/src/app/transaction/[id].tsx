import { can, categoryLabel, formatMoney, lineItemQuantity, unitPricePerBase, verifyChain, type Transaction } from '@smartspend/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, View } from 'react-native';
import { shortDate } from '../../services/dates';
import { useApp } from '../../state/AppContext';
import { useCategoryMap, useDimensionNames } from '../../state/derived';
import { Banner, Button, Card, Divider, EmptyState, Field, MoneyField, Row, Screen, SectionHeader, Text } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { StatusPill } from '../../ui/TransactionRow';
import { radius, spacing, useTheme } from '../../ui/theme';

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6 }} accessible accessibilityLabel={`${k}: ${v ?? 'none'}`}>
      <Text variant="callout" color={t.textMuted}>{k}</Text>
      <Text variant="callout" style={{ flexShrink: 1, textAlign: 'right' }} selectable>{v || '—'}</Text>
    </View>
  );
}

export default function TransactionDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, backend, workspace, role, session, t: tr, locale } = useApp();
  const catMap = useCategoryMap();
  const dims = useDimensionNames();
  const tx = data?.transactions.find((x) => x.id === id);
  const [img, setImg] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [amending, setAmending] = useState(false);
  const [patch, setPatch] = useState<Partial<Transaction>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tx?.receipt) return;
    if (tx.receipt.localUri) setImg(tx.receipt.localUri);
    if (tx.receipt.storagePath) backend.receiptUrl(tx.receipt.storagePath).then((u) => u && setImg(u)).catch(() => undefined);
  }, [tx?.receipt, backend]);

  const events = useMemo(() => (data?.audit ?? []).filter((e) => e.entityId === id || (tx?.amendsTransactionId && e.entityId === tx.amendsTransactionId)), [data?.audit, id, tx?.amendsTransactionId]);
  const chain = useMemo(() => (data?.audit.length ? verifyChain(data.audit) : null), [data?.audit]);
  const names = Object.fromEntries((data?.members ?? []).map((m) => [m.uid, m.displayName]));

  if (!tx || !workspace) return <Screen edges={[]}><EmptyState icon="search" title="Transaction not found" message="It may have been removed or you may not have access." /></Screen>;
  const cat = catMap.get(tx.categoryId);
  const canAmend = tx.status === 'approved' && can(role, 'transaction.amend');
  const canReview = tx.status === 'submitted' && can(role, 'transaction.approve') && (tx.createdBy !== session?.uid || role === 'owner');
  const isMineDraft = ['draft', 'rejected'].includes(tx.status) && tx.createdBy === session?.uid;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      {tx.isSample ? <Banner tone="warning" icon="info">{tr('common.sample')} — not a real record.</Banner> : null}
      {tx.status === 'superseded' ? (
        <Banner tone="warning" icon="history">
          <Text variant="footnote">This version was amended and is kept for the audit trail.</Text>
          {tx.supersededBy ? <Pressable onPress={() => router.replace(`/transaction/${tx.supersededBy}`)}><Text variant="footnote" color={t.primary}>Open current version ›</Text></Pressable> : null}
        </Banner>
      ) : null}
      {tx.rejectedReason ? <Banner tone="danger" icon="x-circle">{`Rejected: ${tx.rejectedReason}`}</Banner> : null}

      <View style={{ alignItems: 'center', gap: 6, marginBottom: spacing.lg }}>
        <Text variant="callout" color={t.textMuted}>{tx.merchant ?? (tx.kind === 'income' ? 'Income' : 'Expense')}</Text>
        <Text variant="largeTitle" color={tx.kind === 'income' ? t.positive : t.text} style={{ fontVariant: ['tabular-nums'] }}>{tx.kind === 'income' ? '+' : '−'}{formatMoney(tx.total, tx.currency)}</Text>
        {tx.currency !== workspace.baseCurrency ? <Text variant="footnote" color={t.textMuted}>≈ {formatMoney(tx.baseTotal, workspace.baseCurrency)} @ {tx.fxRateToBase}</Text> : null}
        <StatusPill tx={tx} />
      </View>

      <Card>
        <KV k={tr('field.date')} v={shortDate(tx.date, locale)} />
        <KV k={tr('field.category')} v={categoryLabel(cat, locale)} />
        <KV k="Accounting treatment" v={cat ? cat.accountingClass.replace(/_/g, ' ') : null} />
        <KV k={tr('field.receiptNo')} v={tx.receiptNumber} />
        <KV k={tr('field.payment')} v={tx.paymentMethod.replace(/_/g, ' ')} />
        {tx.subtotal != null ? <KV k={tr('field.subtotal')} v={formatMoney(tx.subtotal, tx.currency)} /> : null}
        {tx.tax != null ? <KV k={tr('field.tax')} v={formatMoney(tx.tax, tx.currency)} /> : null}
        {workspace.type === 'business' ? (
          <>
            <KV k={tr('field.classification')} v={tr(`class.${tx.classification}`)} />
            <KV k={tr('field.department')} v={tx.departmentId ? dims[tx.departmentId] : null} />
            <KV k={tr('field.project')} v={tx.projectId ? dims[tx.projectId] : null} />
            <KV k={tr('field.purpose')} v={tx.businessPurpose} />
          </>
        ) : null}
        <KV k="Submitted by" v={names[tx.createdBy] ?? tx.createdBy} />
        {tx.approvedBy ? <KV k="Approved by" v={`${names[tx.approvedBy] ?? tx.approvedBy} · ${shortDate(tx.approvedAt ?? '', locale)}`} /> : null}
        <KV k="Google Sheets" v={tx.sync.sheets.replace('_', ' ')} />
        <KV k="Reference" v={tx.id} />
        {tx.ai ? <KV k="AI extraction" v={`${tx.ai.model} · ${Math.round(tx.ai.overallConfidence * 100)}%${tx.ai.correctedFields.length ? ` · corrected: ${tx.ai.correctedFields.join(', ')}` : ''}`} /> : null}
      </Card>

      {tx.lineItems.length ? (
        <>
          <SectionHeader title={`${tr('review.items')} (${tx.lineItems.length})`} />
          <Card style={{ paddingVertical: spacing.xs }}>
            {tx.lineItems.map((li, i) => {
              const q = lineItemQuantity({ description: li.description, packageSize: li.packageSize, quantity: li.quantity || 1, unit: li.unit });
              const ppu = unitPricePerBase(li.total, q);
              return (
                <View key={li.id}>
                  {i ? <Divider /> : null}
                  <Row title={li.description} subtitle={[li.brand, li.quantity > 1 ? `${li.quantity} ×` : null, li.packageSize, categoryLabel(catMap.get(li.categoryId ?? tx.categoryId), locale), ppu != null && q ? `${formatMoney(ppu)}/${q.baseUnit}` : null].filter(Boolean).join(' · ')} right={<Text variant="callout">{formatMoney(li.total, tx.currency)}</Text>} />
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeader title={tr('tx.receipt')} />
      {img ? (
        <Pressable onPress={() => setFull(true)} accessibilityRole="imagebutton" accessibilityLabel="Open receipt image">
          {tx.receipt?.contentType === 'application/pdf' ? <Card><Row icon="pdf" title="PDF invoice" subtitle="Tap to open" /></Card> : <Image source={{ uri: img }} style={{ height: 320, borderRadius: radius.lg, backgroundColor: t.input }} resizeMode="contain" />}
        </Pressable>
      ) : (
        <Card><Text color={t.textMuted}>{tx.receipt ? 'Receipt stored securely (loading…)' : tr('tx.noReceipt')}</Text></Card>
      )}
      {tx.receipt?.sha256 ? <Text variant="caption" color={t.textSubtle} style={{ marginTop: 4 }}>SHA-256 {tx.receipt.sha256.slice(0, 24)}…</Text> : null}

      {canReview ? (
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <Button title={tr('approvals.reject')} variant="secondary" style={{ flex: 1 }} onPress={() => Alert.prompt?.(tr('approvals.rejectReason'), undefined, (r) => r?.trim() && run(() => backend.reviewTransaction(workspace.id, tx.id, 'reject', r)))} />
          <Button title={tr('approvals.approve')} icon="check" style={{ flex: 1 }} loading={busy} onPress={() => run(() => backend.reviewTransaction(workspace.id, tx.id, 'approve'))} />
        </View>
      ) : null}
      {isMineDraft ? (
        <Button title={tr('common.delete')} variant="ghost" icon="trash" style={{ marginTop: spacing.lg }} onPress={() => Alert.alert('Delete draft?', 'Drafts can be deleted. Approved records are always retained.', [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('common.delete'), style: 'destructive', onPress: () => run(async () => { await backend.deleteDraft(workspace.id, tx.id); router.back(); }) }])} />
      ) : null}
      {canAmend && !amending ? <Button title={tr('tx.amend')} icon="pencil" variant="secondary" style={{ marginTop: spacing.xl }} onPress={() => setAmending(true)} /> : null}
      {amending ? (
        <Card style={{ marginTop: spacing.xl }}>
          <Text variant="headline" style={{ marginBottom: spacing.sm }}>{tr('tx.amend')}</Text>
          <Text variant="footnote" color={t.textMuted} style={{ marginBottom: spacing.md }}>Approved records are never overwritten. A new version is created and the original is kept, with both visible in the audit trail.</Text>
          <Field label={tr('field.merchant')} value={(patch.merchant ?? tx.merchant) ?? ''} onChangeText={(s) => setPatch({ ...patch, merchant: s })} />
          <Field label={tr('field.date')} value={patch.date ?? tx.date} onChangeText={(s) => setPatch({ ...patch, date: s })} />
          <MoneyField label={tr('field.total')} minor={patch.total ?? tx.total} onChange={(n) => setPatch({ ...patch, total: n ?? 0 })} currency={tx.currency} />
          <MoneyField label={tr('field.tax')} minor={patch.tax !== undefined ? patch.tax : tx.tax} onChange={(n) => setPatch({ ...patch, tax: n })} currency={tx.currency} />
          <Field label={tr('tx.amendReason')} value={reason} onChangeText={setReason} multiline placeholder="e.g. Total misread — receipt shows RM125.00" />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title={tr('common.cancel')} variant="ghost" style={{ flex: 1 }} onPress={() => { setAmending(false); setPatch({}); }} />
            <Button title={tr('common.save')} style={{ flex: 1 }} loading={busy} disabled={!reason.trim() || !Object.keys(patch).length} onPress={() => run(async () => {
              const amended = await backend.amendTransaction(workspace.id, tx.id, patch, reason);
              setAmending(false);
              router.replace(`/transaction/${amended.id}`);
            })} />
          </View>
        </Card>
      ) : null}

      {events.length ? (
        <>
          <SectionHeader title={tr('tx.auditTrail')} />
          {chain ? (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: spacing.sm }}>
              <Icon name={chain.valid ? 'shield' : 'alert'} size={16} color={chain.valid ? t.positive : t.danger} />
              <Text variant="footnote" color={chain.valid ? t.positive : t.danger}>{chain.valid ? 'Audit chain verified — no records altered' : `Audit chain broken at event ${chain.brokenAt! + 1}`}</Text>
            </View>
          ) : null}
          <Card style={{ gap: spacing.md }}>
            {events.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary, marginTop: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="callout" style={{ fontWeight: '600' }}>{e.action[0]!.toUpperCase() + e.action.slice(1)} · {names[e.actorUid] ?? e.actorUid}</Text>
                  <Text variant="footnote" color={t.textMuted}>{new Date(e.at).toLocaleString(locale === 'ms' ? 'ms-MY' : 'en-MY')}</Text>
                  {e.changes.filter((c) => !['lineItems', 'ai', 'receipt'].includes(c.field)).slice(0, 6).map((c) => (
                    <Text key={c.field} variant="caption" color={t.textMuted}>{`${c.field}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`}</Text>
                  ))}
                  {e.reason ? <Text variant="caption" color={t.textMuted}>Reason: {e.reason}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Modal visible={full} animationType="fade" onRequestClose={() => setFull(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000' }} onPress={() => setFull(false)} accessibilityLabel={tr('common.close')}>
          {img ? <Image source={{ uri: img }} style={{ flex: 1 }} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}
