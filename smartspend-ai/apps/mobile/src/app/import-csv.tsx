import { findDuplicates, formatMoney, importBankCsv, newId, suggestCategory, transactionFingerprint, type ImportResult, type Transaction } from '@smartspend/core';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Banner, Button, Card, Divider, EmptyState, Screen, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

/** CSV bank statement import: preview, auto-categorise, skip duplicates, then save. */
export default function ImportCsv() {
  const t = useTheme();
  const { workspace, session, categories, data, backend } = useApp();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [drafts, setDrafts] = useState<Array<{ tx: Transaction; duplicate: boolean }>>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ saved: number; skipped: number; failed: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!workspace || !session) return null;

  const pick = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    try {
      const text = await new File(res.assets[0].uri).text();
      const r = importBankCsv(text, undefined, workspace.baseCurrency);
      setResult(r);
      const now = new Date().toISOString();
      setDrafts(r.rows.map((row) => {
        const s = suggestCategory({ merchant: row.description, description: row.description, kind: row.kind }, categories, workspace.type, data?.memory ?? undefined);
        const tx: Transaction = {
          id: newId('tx'), workspaceId: workspace.id, kind: row.kind, date: row.date, merchant: row.description.slice(0, 120), receiptNumber: row.reference, currency: workspace.baseCurrency,
          total: row.amount, subtotal: null, tax: null, discount: null, rounding: null, baseTotal: row.amount, paymentMethod: 'bank_transfer', classification: workspace.type === 'business' ? 'business' : 'personal',
          categoryId: s.categoryId, lineItems: [], status: 'draft', source: 'csv_import', fingerprint: '', createdBy: session.uid, createdAt: now, updatedAt: now, version: 1, sync: { sheets: 'not_connected' }, isSample: workspace.isSample,
          ai: { extractionId: '', suggestedCategoryId: s.categoryId, overallConfidence: s.confidence, model: `rules:${s.source}`, correctedFields: [] },
        };
        tx.fingerprint = transactionFingerprint(tx);
        return { tx, duplicate: findDuplicates(tx, data?.transactions ?? []).length > 0 };
      }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const save = async () => {
    setBusy(true);
    let saved = 0, skipped = 0;
    const failed: string[] = [];
    for (const d of drafts) {
      if (d.duplicate) { skipped++; continue; }
      try {
        await backend.saveTransaction(workspace.id, d.tx, { intent: 'save' });
        saved++;
      } catch (e) {
        if ((e as { code?: string }).code === 'already-exists') skipped++;
        else failed.push(`${d.tx.date} ${d.tx.merchant}: ${(e as Error).message}`);
      }
    }
    setDone({ saved, skipped, failed });
    setBusy(false);
  };

  if (done) {
    return (
      <Screen edges={[]}>
        <Banner tone="success" icon="check-circle">{`Imported ${done.saved} transaction(s). Skipped ${done.skipped} duplicate(s).`}</Banner>
        {done.failed.map((f) => <Text key={f} variant="footnote" color={t.danger}>{f}</Text>)}
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen edges={[]}>
      <Text variant="callout" color={t.textMuted} style={{ marginBottom: spacing.md }}>Export a CSV statement from your bank (Maybank2u, CIMB Clicks, Public Bank, RHB…). We recognise Date, Description and Debit/Credit or Amount columns.</Text>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      <Button title="Choose CSV file" icon="download" onPress={pick} variant={result ? 'secondary' : 'primary'} />
      {result ? (
        <>
          {result.errors.length ? <Banner tone="warning" icon="alert">{`${result.errors.length} row(s) could not be read: ${result.errors.slice(0, 3).map((e) => `line ${e.line} ${e.message}`).join('; ')}`}</Banner> : null}
          <Text variant="headline" style={{ marginTop: spacing.lg }}>{drafts.length} transactions found</Text>
          <Text variant="footnote" color={t.textMuted}>{drafts.filter((d) => d.duplicate).length} already recorded will be skipped. Review categories afterwards in Transactions.</Text>
          <Card style={{ marginTop: spacing.md, paddingVertical: spacing.xs }}>
            {drafts.slice(0, 50).map((d, i) => (
              <View key={d.tx.id}>
                {i ? <Divider /> : null}
                <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, gap: spacing.sm, opacity: d.duplicate ? 0.5 : 1 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="callout" numberOfLines={1}>{d.tx.merchant}</Text>
                    <Text variant="caption" color={t.textMuted}>{d.tx.date} · {categories.find((c) => c.id === d.tx.categoryId)?.name.en}{d.duplicate ? ' · duplicate' : ''}</Text>
                  </View>
                  <Text variant="callout" color={d.tx.kind === 'income' ? t.positive : t.text}>{d.tx.kind === 'income' ? '+' : '−'}{formatMoney(d.tx.total)}</Text>
                </View>
              </View>
            ))}
          </Card>
          <Button title={`Import ${drafts.filter((d) => !d.duplicate).length} transactions`} style={{ marginTop: spacing.lg }} loading={busy} disabled={!drafts.some((d) => !d.duplicate)} onPress={save} />
        </>
      ) : <EmptyState icon="download" title="No file selected" />}
    </Screen>
  );
}
