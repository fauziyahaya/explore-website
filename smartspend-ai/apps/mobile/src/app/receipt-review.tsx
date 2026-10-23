import {
  categoryLabel,
  draftFromExtraction,
  fieldsNeedingReview,
  findDuplicates,
  finaliseDraft,
  formatMoney,
  newId,
  validateForSave,
  type ExtractedReceipt,
  type LineItem,
  type PaymentMethod,
  type ReceiptAttachment,
  type Transaction,
  type TransactionSource,
} from '@smartspend/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, View } from 'react-native';
import { BackendError } from '../services/backend';
import { todayLocal } from '../services/dates';
import { emptyExtraction } from '../services/emptyExtraction';
import { useApp } from '../state/AppContext';
import { useCategoryMap } from '../state/derived';
import { Banner, Button, Card, ConfidenceBadge, Divider, Field, Loading, MoneyField, PickerSheet, Screen, SectionHeader, SelectField, Text } from '../ui/components';
import { Icon } from '../ui/Icon';
import { radius, spacing, useTheme } from '../ui/theme';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash', debit_card: 'Debit card', credit_card: 'Credit card', ewallet: 'E-wallet (TNG, GrabPay, Boost…)', bank_transfer: 'Bank transfer / FPX', duitnow: 'DuitNow QR', cheque: 'Cheque', other: 'Other', unknown: 'Not shown',
};

type Picker = { kind: 'category' | 'payment' | 'classification' | 'department' | 'project' | 'costCentre'; itemIndex?: number } | null;

export default function ReceiptReview() {
  const t = useTheme();
  const params = useLocalSearchParams<{ uri?: string; mimeType?: string; source?: TransactionSource }>();
  const { backend, workspace, categories, data, session, t: tr, role, locale } = useApp();
  const catMap = useCategoryMap();
  const [phase, setPhase] = useState<'extracting' | 'review' | 'saving' | 'saved' | 'error'>(params.uri ? 'extracting' : 'review');
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractedReceipt | null>(params.uri ? null : emptyExtraction());
  const [note, setNote] = useState<string | null>(null);
  const [dupImage, setDupImage] = useState<string | null>(null);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<Picker>(null);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState<{ tx: Transaction; queued?: boolean } | null>(null);
  const source: TransactionSource = (params.source as TransactionSource) ?? 'manual';

  const build = (x: ExtractedReceipt, extractionId: string, receipt: ReceiptAttachment | null) => {
    if (!workspace || !session) return;
    setTx(draftFromExtraction({ id: newId('tx'), extraction: x, extractionId, workspace, categories, memory: data?.memory ?? undefined, uid: session.uid, now: new Date().toISOString(), source, receipt }));
  };

  const extract = async () => {
    if (!workspace || !params.uri) return;
    setPhase('extracting');
    setError(null);
    try {
      const res = await backend.extractReceipt(workspace.id, { uri: params.uri, mimeType: params.mimeType ?? 'image/jpeg' }, source);
      setExtraction(res.extraction);
      setNote(res.note ?? null);
      setDupImage(res.duplicateImageOf);
      build(res.extraction, res.extractionId, res.receipt);
      setPhase('review');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  };

  // Start once the workspace and session are available (they load asynchronously on a cold start).
  const started = useRef(false);
  useEffect(() => {
    if (!workspace || !session || started.current) return;
    started.current = true;
    if (params.uri) extract();
    else build(emptyExtraction(), '', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, session?.uid]);

  const review = useMemo(() => new Set(extraction && extraction.model !== 'manual' ? fieldsNeedingReview(extraction) : []), [extraction]);
  const flag = (key: string) => review.has(key) && !touched.has(key);
  const conf = (key: keyof ExtractedReceipt) => (extraction && extraction.model !== 'manual' && (extraction[key] as { value: unknown })?.value != null ? (extraction[key] as { confidence: number }).confidence : null);
  const set = <K extends keyof Transaction>(key: K, value: Transaction[K], touchKey: string = key as string) => {
    setTx((cur) => (cur ? { ...cur, [key]: value } : cur));
    setTouched((s) => new Set(s).add(touchKey));
  };
  const setItem = (i: number, patch: Partial<LineItem>, touchKey?: string) => {
    setTx((cur) => (cur ? { ...cur, lineItems: cur.lineItems.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : cur));
    if (touchKey) setTouched((s) => new Set(s).add(`lineItems.${i}.${touchKey}`));
  };

  const duplicates = useMemo(() => {
    if (!tx || !workspace || !tx.date || !tx.total) return [];
    const f = finaliseDraft(tx, workspace.baseCurrency);
    return findDuplicates(f, data?.transactions ?? []);
  }, [tx, workspace, data?.transactions]);

  if (!workspace) return null;
  const business = workspace.type === 'business';

  if (phase === 'extracting') {
    return (
      <Screen edges={[]}>
        {params.uri ? <Image source={{ uri: params.uri }} style={{ height: 260, borderRadius: radius.lg, opacity: 0.6 }} resizeMode="cover" accessibilityLabel="Receipt photo" /> : null}
        <Loading label={tr('scan.processing')} />
        <Text variant="footnote" color={t.textSubtle} style={{ textAlign: 'center' }}>Reading merchant, items, tax and total. Values that can’t be read will be left blank — never guessed.</Text>
      </Screen>
    );
  }
  if (phase === 'error') {
    return (
      <Screen edges={[]}>
        <Banner tone="danger" icon="alert">{error ?? tr('common.error')}</Banner>
        <Button title={tr('common.retry')} onPress={extract} />
        <Button title={tr('scan.manual')} variant="ghost" style={{ marginTop: spacing.md }} onPress={() => { setExtraction(emptyExtraction()); build(emptyExtraction(), '', null); setPhase('review'); }} />
      </Screen>
    );
  }
  if (phase === 'saved' && saved) {
    const s = saved.tx;
    const syncLabel = saved.queued ? 'Saved on this device — will upload and sync when online' : s.sync.sheets === 'synced' ? tr('saved.sheetsSynced') : s.sync.sheets === 'pending' ? tr('saved.sheetsPending') : tr('saved.sheetsOff');
    return (
      <Screen edges={[]}>
        <View style={{ alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl }} accessibilityLiveRegion="polite">
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: t.positiveSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="check-circle" size={52} color={t.positive} /></View>
          <Text variant="title">{tr('saved.title')}</Text>
          <Text variant="money">{formatMoney(s.baseTotal)}</Text>
          <Text color={t.textMuted}>{s.merchant ?? ''} · {categoryLabel(catMap.get(s.categoryId), locale)}</Text>
        </View>
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Icon name="shield" color={t.positive} />
            <Text style={{ flex: 1 }}>{s.status === 'approved' ? 'Recorded and approved' : s.status === 'submitted' ? 'Submitted for approval' : 'Saved as draft'}</Text>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Icon name={saved.queued ? 'offline' : 'sheet'} color={s.sync.sheets === 'not_connected' && !saved.queued ? t.textSubtle : t.primary} />
            <Text style={{ flex: 1 }}>{syncLabel}</Text>
          </View>
        </Card>
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <Button title={tr('home.snap')} icon="camera" onPress={() => router.replace('/(tabs)/scan')} />
          <Button title="View transaction" variant="secondary" onPress={() => router.replace(`/transaction/${s.id}`)} />
          <Button title={tr('common.done')} variant="ghost" onPress={() => router.dismissTo('/(tabs)')} />
        </View>
      </Screen>
    );
  }
  if (!tx) return <Screen><Loading /></Screen>;

  const v = validateForSave(finaliseDraft(tx, workspace.baseCurrency), todayLocal());
  const needsApproval = business && workspace.approvalRequired && role !== 'owner';
  const corrected = () => {
    if (!extraction || extraction.model === 'manual') return [];
    const out: string[] = [];
    const cmp: Array<[keyof ExtractedReceipt, unknown]> = [['merchant', tx.merchant], ['date', tx.date], ['receiptNumber', tx.receiptNumber], ['total', tx.total], ['tax', tx.tax], ['subtotal', tx.subtotal], ['paymentMethod', tx.paymentMethod]];
    for (const [k, val] of cmp) if (((extraction[k] as { value: unknown }).value ?? null) !== (val || null)) out.push(k);
    if (tx.ai?.suggestedCategoryId && tx.ai.suggestedCategoryId !== tx.categoryId) out.push('category');
    return out;
  };

  const save = async (allowDuplicate = false, duplicateReason?: string) => {
    setPhase('saving');
    setError(null);
    try {
      const final = finaliseDraft({ ...tx, ai: tx.ai ? { ...tx.ai, correctedFields: corrected() } : null }, workspace.baseCurrency);
      const res = await backend.saveTransaction(workspace.id, final, { intent: 'save', allowDuplicate, duplicateReason });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setSaved({ tx: res.transaction, queued: res.queuedOffline });
      setPhase('saved');
    } catch (e) {
      setPhase('review');
      if (e instanceof BackendError && e.code === 'already-exists') {
        Alert.prompt?.(tr('review.duplicate'), 'If this really is a separate purchase, briefly say why (kept in the audit trail).', [
          { text: tr('common.cancel'), style: 'cancel' },
          { text: tr('review.saveAnyway'), onPress: (reason?: string) => reason?.trim() && save(true, reason) },
        ], 'plain-text') ?? Alert.alert(tr('review.duplicate'));
      } else setError((e as Error).message);
    }
  };

  const categoryOptions = categories.filter((c) => c.kind !== 'income').map((c) => ({ value: c.id, label: c.name[locale], subtitle: c.help?.[locale], color: c.color }));
  const dims = (type: 'department' | 'project' | 'cost_centre') => [{ value: '', label: tr('common.none') }, ...(data?.dimensions ?? []).filter((d) => d.type === type && !d.archived).map((d) => ({ value: d.id, label: d.name }))];
  const dimName = (id?: string | null) => (id ? data?.dimensions.find((d) => d.id === id)?.name ?? id : tr('common.none'));

  return (
    <Screen edges={[]}>
      {note ? <Banner tone="info" icon="info">{note}</Banner> : null}
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}

      {params.uri ? (
        <Pressable onPress={() => setPreview(true)} accessibilityRole="imagebutton" accessibilityLabel="View receipt image" style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.md }}>
          {params.mimeType === 'application/pdf' ? (
            <View style={{ width: 64, height: 84, borderRadius: radius.sm, backgroundColor: t.input, alignItems: 'center', justifyContent: 'center' }}><Icon name="pdf" color={t.primary} /></View>
          ) : (
            <Image source={{ uri: params.uri }} style={{ width: 64, height: 84, borderRadius: radius.sm }} />
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Text variant="headline">{tr('review.confidence')}</Text>
              {extraction ? <ConfidenceBadge value={extraction.overallConfidence} /> : null}
            </View>
            <Text variant="footnote" color={t.textMuted}>{review.size ? `${tr('review.verify')} (${review.size})` : 'All key fields read clearly. Please give it a quick check.'}</Text>
          </View>
        </Pressable>
      ) : null}

      {dupImage || duplicates.length ? (
        <Banner tone="warning" icon="alert">
          <Text variant="footnote">{tr('review.duplicate')} {dupImage ? '(identical image)' : duplicates[0]?.reasons[0]}</Text>
          <Pressable onPress={() => router.push(`/transaction/${dupImage ?? duplicates[0]!.transactionId}`)} accessibilityRole="link"><Text variant="footnote" color={t.primary}>View the existing record ›</Text></Pressable>
        </Banner>
      ) : null}

      <Card>
        <Field label={tr('field.merchant')} value={tx.merchant ?? ''} onChangeText={(s) => set('merchant', s || null)} highlight={flag('merchant')} confidence={conf('merchant')} autoCapitalize="words" placeholder={tr('review.notFound')} />
        <Field label={`${tr('field.date')} (YYYY-MM-DD)`} value={tx.date} onChangeText={(s) => set('date', s)} highlight={flag('date')} confidence={conf('date')} placeholder={todayLocal()} keyboardType="numbers-and-punctuation"
          error={tx.date && !/^\d{4}-\d{2}-\d{2}$/.test(tx.date) ? 'Use the format YYYY-MM-DD' : null} />
        <Field label={tr('field.receiptNo')} value={tx.receiptNumber ?? ''} onChangeText={(s) => set('receiptNumber', s || null)} highlight={flag('receiptNumber')} confidence={conf('receiptNumber')} autoCapitalize="characters" placeholder={tr('review.notFound')} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}><MoneyField label={tr('field.subtotal')} minor={tx.subtotal} onChange={(n) => set('subtotal', n)} highlight={flag('subtotal')} confidence={conf('subtotal')} currency={tx.currency} placeholder="—" /></View>
          <View style={{ flex: 1 }}><MoneyField label={tr('field.tax')} minor={tx.tax} onChange={(n) => set('tax', n)} highlight={flag('tax')} confidence={conf('tax')} currency={tx.currency} placeholder="—" /></View>
        </View>
        <MoneyField label={tr('field.total')} minor={tx.total || null} onChange={(n) => set('total', n ?? 0)} highlight={flag('total')} confidence={conf('total')} currency={tx.currency}
          error={!(tx.total > 0) && touched.has('total') ? 'Total is required' : null} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ width: 96 }}><Field label={tr('field.currency')} value={tx.currency} onChangeText={(s) => set('currency', s.toUpperCase().slice(0, 3))} autoCapitalize="characters" highlight={flag('currency')} /></View>
          <View style={{ flex: 1 }}><SelectField label={tr('field.payment')} valueLabel={PAYMENT_LABELS[tx.paymentMethod]} onPress={() => setPicker({ kind: 'payment' })} highlight={flag('paymentMethod')} confidence={conf('paymentMethod')} /></View>
        </View>
        {tx.currency !== workspace.baseCurrency ? (
          <Field label={`Exchange rate: 1 ${tx.currency} = ? ${workspace.baseCurrency}`} value={tx.fxRateToBase ? String(tx.fxRateToBase) : ''} keyboardType="decimal-pad" onChangeText={(s) => set('fxRateToBase', Number(s) || null)}
            help={tx.fxRateToBase ? `≈ ${formatMoney(Math.round(tx.total * tx.fxRateToBase), workspace.baseCurrency)}` : 'Enter the rate on your card statement. We never assume a rate.'} />
        ) : null}
        <SelectField label={tr('field.category')} valueLabel={categoryLabel(catMap.get(tx.categoryId), locale)} onPress={() => setPicker({ kind: 'category' })} confidence={tx.ai?.suggestedCategoryId === tx.categoryId && extraction?.model !== 'manual' ? tx.ai?.overallConfidence ?? null : null} />
        {catMap.get(tx.categoryId)?.help ? <Text variant="footnote" color={t.textSubtle} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>{catMap.get(tx.categoryId)!.help![locale]}</Text> : null}
        {business ? (
          <>
            <SelectField label={tr('field.classification')} valueLabel={tr(`class.${tx.classification}`)} onPress={() => setPicker({ kind: 'classification' })} />
            <SelectField label={tr('field.department')} valueLabel={dimName(tx.departmentId)} onPress={() => setPicker({ kind: 'department' })} />
            <SelectField label={tr('field.project')} valueLabel={dimName(tx.projectId)} onPress={() => setPicker({ kind: 'project' })} />
            <Field label={tr('field.purpose')} value={tx.businessPurpose ?? ''} onChangeText={(s) => set('businessPurpose', s || null)} placeholder="e.g. Client meeting with ABC Sdn Bhd" multiline />
          </>
        ) : null}
      </Card>

      <SectionHeader title={`${tr('review.items')} (${tx.lineItems.length})`} action={{ label: tr('review.addItem'), onPress: () => setTx({ ...tx, lineItems: [...tx.lineItems, { id: `${tx.id}_li${tx.lineItems.length + 1}_${Date.now() % 1000}`, description: '', quantity: 1, unitPrice: null, discount: 0, tax: 0, total: 0, categoryId: tx.categoryId }] }) }} />
      {tx.lineItems.length === 0 ? <Text variant="footnote" color={t.textMuted}>No individual items. Add items to split a receipt across categories or to track product prices.</Text> : null}
      {tx.lineItems.map((li, i) => (
        <Card key={li.id} style={{ marginBottom: spacing.md, gap: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text variant="footnote" color={t.textMuted}>Item {i + 1}</Text>
            <Pressable onPress={() => setTx({ ...tx, lineItems: tx.lineItems.filter((_, j) => j !== i) })} accessibilityRole="button" accessibilityLabel={`Remove item ${i + 1}`} hitSlop={10}><Icon name="trash" size={18} color={t.danger} /></Pressable>
          </View>
          <Field label={tr('field.description')} value={li.description} onChangeText={(s) => setItem(i, { description: s }, 'description')} highlight={flag(`lineItems.${i}.description`)} />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}><Field label={tr('field.brand')} value={li.brand ?? ''} onChangeText={(s) => setItem(i, { brand: s || null })} /></View>
            <View style={{ flex: 1 }}><Field label={tr('field.packageSize')} value={li.packageSize ?? ''} onChangeText={(s) => setItem(i, { packageSize: s || null })} placeholder="5kg, 1L…" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ width: 80 }}><Field label={tr('field.qty')} value={String(li.quantity)} keyboardType="decimal-pad" onChangeText={(s) => setItem(i, { quantity: Number(s) || 1 }, 'quantity')} highlight={flag(`lineItems.${i}.quantity`)} /></View>
            <View style={{ flex: 1 }}><MoneyField label={tr('field.unitPrice')} minor={li.unitPrice} onChange={(n) => setItem(i, { unitPrice: n }, 'unitPrice')} highlight={flag(`lineItems.${i}.unitPrice`)} currency={tx.currency} /></View>
            <View style={{ flex: 1 }}><MoneyField label={tr('field.total')} minor={li.total || null} onChange={(n) => setItem(i, { total: n ?? 0 }, 'total')} highlight={flag(`lineItems.${i}.total`)} currency={tx.currency} /></View>
          </View>
          <SelectField label={tr('field.category')} valueLabel={categoryLabel(catMap.get(li.categoryId ?? tx.categoryId), locale)} onPress={() => setPicker({ kind: 'category', itemIndex: i })} />
        </Card>
      ))}

      {extraction?.checks.length ? (
        <>
          <SectionHeader title={tr('review.checks')} />
          <Card style={{ gap: spacing.sm }}>
            {extraction.checks.map((c, i) => (
              <View key={`${c.code}${i}`} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Icon name={c.passed ? 'check-circle' : 'alert'} size={18} color={c.passed ? t.positive : t.warning} />
                <Text variant="footnote" style={{ flex: 1 }}>{c.message}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        {v.warnings.map((w) => <Banner key={w} tone="warning" icon="alert">{w}</Banner>)}
        {!v.ok ? <Text variant="footnote" color={t.danger}>{v.errors.join(' ')}</Text> : null}
        <Button title={needsApproval ? tr('review.submit') : tr('review.save')} icon="check" loading={phase === 'saving'} disabled={!v.ok} onPress={() => save()} />
        <Text variant="caption" color={t.textSubtle} style={{ textAlign: 'center' }}>Nothing is saved until you confirm. You can correct any value above.</Text>
      </View>

      <PickerSheet
        visible={picker?.kind === 'category'}
        title={tr('field.category')}
        options={categoryOptions}
        value={picker?.itemIndex != null ? tx.lineItems[picker.itemIndex]?.categoryId ?? tx.categoryId : tx.categoryId}
        onSelect={(id) => (picker?.itemIndex != null ? setItem(picker.itemIndex, { categoryId: id }) : set('categoryId', id, 'category'))}
        onClose={() => setPicker(null)}
      />
      <PickerSheet visible={picker?.kind === 'payment'} title={tr('field.payment')} options={(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((p) => ({ value: p, label: PAYMENT_LABELS[p] }))} value={tx.paymentMethod} onSelect={(p) => set('paymentMethod', p)} onClose={() => setPicker(null)} />
      <PickerSheet visible={picker?.kind === 'classification'} title={tr('field.classification')}
        options={[
          { value: 'business', label: tr('class.business'), subtitle: 'Counts as a business expense' },
          { value: 'personal', label: tr('class.personal'), subtitle: 'Paid by the business for personal use — excluded from profit' },
          { value: 'owner_drawing', label: tr('class.owner_drawing'), subtitle: 'Money taken out by the owner — not an expense' },
        ]}
        value={tx.classification} onSelect={(c) => set('classification', c as Transaction['classification'])} onClose={() => setPicker(null)} />
      <PickerSheet visible={picker?.kind === 'department'} title={tr('field.department')} options={dims('department')} value={tx.departmentId ?? ''} onSelect={(d) => set('departmentId', d || null)} onClose={() => setPicker(null)} />
      <PickerSheet visible={picker?.kind === 'project'} title={tr('field.project')} options={dims('project')} value={tx.projectId ?? ''} onSelect={(d) => set('projectId', d || null)} onClose={() => setPicker(null)} />

      <Modal visible={preview} animationType="fade" onRequestClose={() => setPreview(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000' }} onPress={() => setPreview(false)} accessibilityRole="button" accessibilityLabel={tr('common.close')}>
          {params.uri ? <Image source={{ uri: params.uri }} style={{ flex: 1 }} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}
