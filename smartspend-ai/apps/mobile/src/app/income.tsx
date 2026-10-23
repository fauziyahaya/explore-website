import { categoryLabel, finaliseDraft, newId, suggestCategory, transactionFingerprint, validateForSave, type PaymentMethod, type Transaction } from '@smartspend/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { todayLocal } from '../services/dates';
import { useApp } from '../state/AppContext';
import { useCategoryMap } from '../state/derived';
import { Banner, Button, Chip, ChipRow, Field, MoneyField, PickerSheet, Screen, SelectField, SwitchRow, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

const METHODS: PaymentMethod[] = ['bank_transfer', 'duitnow', 'cash', 'ewallet', 'cheque', 'other'];

export default function IncomeEntry() {
  const t = useTheme();
  const { backend, workspace, categories, session, t: tr, locale, data } = useApp();
  const catMap = useCategoryMap();
  const incomeCats = categories.filter((c) => c.kind === 'income');
  const [payer, setPayer] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [ref, setRef] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [categoryId, setCategoryId] = useState(incomeCats[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!workspace || !session) return null;

  const onPayer = (s: string) => {
    setPayer(s);
    const sug = suggestCategory({ merchant: s, description: notes, kind: 'income' }, categories, workspace.type, data?.memory ?? undefined);
    if (sug.source !== 'fallback') setCategoryId(sug.categoryId);
  };

  const build = (): Transaction => {
    const now = new Date().toISOString();
    const tx: Transaction = {
      id: newId('tx'), workspaceId: workspace.id, kind: 'income', date, merchant: payer || null, receiptNumber: ref || null, currency: workspace.baseCurrency,
      total: amount ?? 0, subtotal: null, tax: null, discount: null, rounding: null, baseTotal: amount ?? 0, paymentMethod: method,
      classification: workspace.type === 'business' ? 'business' : 'personal', categoryId, lineItems: [], description: notes || null, incomeSource: payer || null,
      status: 'draft', source: 'manual', fingerprint: '', createdBy: session.uid, createdAt: now, updatedAt: now, version: 1, isRecurring: recurring,
      sync: { sheets: 'not_connected' }, isSample: workspace.isSample,
    };
    tx.fingerprint = transactionFingerprint(tx);
    return finaliseDraft(tx, workspace.baseCurrency);
  };
  const v = validateForSave(build(), todayLocal());

  return (
    <Screen edges={[]}>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      <MoneyField label="Amount received" minor={amount} onChange={setAmount} currency={workspace.baseCurrency} />
      <Field label={tr('field.source')} value={payer} onChangeText={onPayer} placeholder={workspace.type === 'business' ? 'Customer name' : 'e.g. Employer, client, tenant'} autoCapitalize="words" />
      <SelectField label={tr('field.category')} valueLabel={categoryLabel(catMap.get(categoryId), locale)} onPress={() => setPicker(true)} />
      {catMap.get(categoryId)?.help ? <Text variant="footnote" color={t.textSubtle} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>{catMap.get(categoryId)!.help![locale]}</Text> : null}
      <Field label={`${tr('field.date')} (YYYY-MM-DD)`} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <Text variant="footnote" color={t.textMuted} style={{ marginBottom: 6 }}>{tr('field.payment')}</Text>
      <ChipRow>{METHODS.map((m) => <Chip key={m} label={m.replace('_', ' ')} selected={method === m} onPress={() => setMethod(m)} />)}</ChipRow>
      <Field label="Reference / invoice no." value={ref} onChangeText={setRef} autoCapitalize="characters" />
      <Field label={tr('field.notes')} value={notes} onChangeText={setNotes} multiline />
      <SwitchRow title="Recurring income" subtitle="e.g. monthly salary or rent" value={recurring} onValueChange={setRecurring} />
      {workspace.type === 'business' ? <Banner>Owner capital you put into the business is not revenue — choose “Owner Capital Contribution” for that.</Banner> : null}
      {!v.ok && amount ? <Text variant="footnote" color={t.danger}>{v.errors.join(' ')}</Text> : null}
      <Button title={tr('income.save')} style={{ marginTop: spacing.lg }} loading={busy} disabled={!v.ok} onPress={async () => {
        setBusy(true);
        setError(null);
        try {
          await backend.saveTransaction(workspace.id, build(), { intent: 'save' });
          router.back();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }} />
      <PickerSheet visible={picker} title={tr('field.category')} options={[...incomeCats, ...categories.filter((c) => c.accountingClass === 'owner_contribution' || (c.kind === 'non_pl' && c.accountingClass === 'transfer'))].map((c) => ({ value: c.id, label: c.name[locale], subtitle: c.help?.[locale], color: c.color }))} value={categoryId} onSelect={setCategoryId} onClose={() => setPicker(false)} />
    </Screen>
  );
}
