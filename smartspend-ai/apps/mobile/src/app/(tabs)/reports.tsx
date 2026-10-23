import { can, monthRange, REPORT_TYPES, shiftMonth, yearRange, type ReportType } from '@smartspend/core';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import type { ReportFormat } from '../../services/backend';
import { todayLocal } from '../../services/dates';
import { useApp } from '../../state/AppContext';
import { Banner, Button, Card, Chip, ChipRow, Divider, Field, PickerSheet, Row, Screen, SectionHeader, SelectField, Text } from '../../ui/components';
import { spacing, useTheme } from '../../ui/theme';

type Period = 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom';

export default function Reports() {
  const t = useTheme();
  const { t: tr, workspace, role, backend, locale, data } = useApp();
  const [type, setType] = useState<ReportType>('monthly_expense_statement');
  const [period, setPeriod] = useState<Period>('last_month');
  const [from, setFrom] = useState(monthRange(todayLocal().slice(0, 7)).from);
  const [to, setTo] = useState(todayLocal());
  const [reviewer, setReviewer] = useState<string | null>(null);
  const [picker, setPicker] = useState<'type' | 'reviewer' | null>(null);
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  if (!workspace) return null;
  const business = workspace.type === 'business';
  const allowed = can(role, 'report.generate');
  const types = REPORT_TYPES.filter((r) => business || !r.businessOnly);
  const today = todayLocal();
  const range = period === 'this_month' ? monthRange(today.slice(0, 7)) : period === 'last_month' ? monthRange(shiftMonth(today.slice(0, 7), -1)) : period === 'this_year' ? yearRange(today.slice(0, 4)) : period === 'last_year' ? yearRange(Number(today.slice(0, 4)) - 1) : { from, to };

  const generate = async (format: ReportFormat) => {
    setBusy(format);
    setError(null);
    try {
      const res = await backend.generateReport(workspace.id, type, range, format, reviewer);
      if (!res) return;
      setLast(res.reference);
      if (res.url.startsWith('file:')) {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(res.url, { dialogTitle: res.reference, mimeType: format === 'csv' ? 'text/csv' : 'application/pdf', UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'com.adobe.pdf' });
      } else {
        await WebBrowser.openBrowserAsync(res.url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!allowed) {
    return <Screen><Text variant="largeTitle">{tr('reports.title')}</Text><Banner>Your role cannot generate company reports. Ask a finance manager or the business owner.</Banner></Screen>;
  }
  const meta = REPORT_TYPES.find((r) => r.type === type)!;
  const reviewers = (data?.members ?? []).filter((m) => m.active && ['owner', 'finance_manager', 'approver', 'auditor'].includes(m.role));

  return (
    <Screen>
      <Text variant="largeTitle" accessibilityRole="header">{tr('reports.title')}</Text>
      <Banner tone="warning" icon="info">{tr('reports.disclaimerShort')}</Banner>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      {last ? <Banner tone="success" icon="check-circle">{`Generated ${last}`}</Banner> : null}

      <Card>
        <SelectField label="Report" valueLabel={meta.title[locale]} onPress={() => setPicker('type')} />
        <Text variant="footnote" color={t.textMuted} style={{ marginBottom: 6 }}>Reporting period</Text>
        <ChipRow>
          {(['this_month', 'last_month', 'this_year', 'last_year', 'custom'] as Period[]).map((p) => (
            <Chip key={p} label={{ this_month: 'This month', last_month: 'Last month', this_year: 'This year', last_year: 'Last year', custom: 'Custom' }[p]} selected={period === p} onPress={() => setPeriod(p)} />
          ))}
        </ChipRow>
        {period === 'custom' ? (
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}><Field label="From" value={from} onChangeText={setFrom} /></View>
            <View style={{ flex: 1 }}><Field label="To" value={to} onChangeText={setTo} /></View>
          </View>
        ) : <Text variant="footnote" color={t.textSubtle} style={{ marginTop: spacing.sm }}>{range.from} → {range.to}</Text>}
        {business ? <View style={{ marginTop: spacing.md }}><SelectField label="Reviewed / approved by" valueLabel={reviewers.find((r) => r.uid === reviewer)?.displayName ?? 'Not yet reviewed'} onPress={() => setPicker('reviewer')} /></View> : null}
      </Card>

      <SectionHeader title={tr('reports.export')} />
      <View style={{ gap: spacing.md }}>
        <Button title="PDF report" icon="pdf" loading={busy === 'pdf'} onPress={() => generate('pdf')} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Excel" icon="sheet" variant="secondary" style={{ flex: 1 }} loading={busy === 'xlsx'} onPress={() => generate('xlsx')} />
          <Button title="CSV" icon="doc" variant="secondary" style={{ flex: 1 }} loading={busy === 'csv'} onPress={() => generate('csv')} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Google Sheets" icon="link" variant="secondary" style={{ flex: 1 }} loading={busy === 'gsheet'} onPress={() => generate('gsheet')} />
          <Button title="Evidence ZIP" icon="folder" variant="secondary" style={{ flex: 1 }} loading={busy === 'zip'} onPress={() => generate('zip')} />
        </View>
        <Text variant="caption" color={t.textSubtle}>Every report lists company details, period, transaction references, vendors, items, categories, taxes, payment methods, departments, business purpose, approval status and supporting documents. The ZIP package adds the receipt files and a SHA-256 manifest.</Text>
      </View>

      <SectionHeader title="More" />
      <Card style={{ paddingVertical: spacing.xs }}>
        {business ? <><Row icon="wallet" title={tr('pnl.title')} subtitle="Revenue, gross, operating and net profit" onPress={() => router.push('/pnl')} /><Divider /></> : null}
        {business && can(role, 'transaction.approve') ? <><Row icon="clock" title={tr('approvals.title')} onPress={() => router.push('/approvals')} /><Divider /></> : null}
        <Row icon="scale" title={tr('products.title')} subtitle="Brand and merchant unit prices" onPress={() => router.push('/products')} />
        <Divider />
        <Row icon="sheet" title={tr('sheets.title')} subtitle={workspace.googleSheets ? 'Connected' : 'Not connected'} onPress={() => router.push('/google-sheets')} />
      </Card>

      <PickerSheet visible={picker === 'type'} title="Report" options={types.map((r) => ({ value: r.type, label: r.title[locale] }))} value={type} onSelect={setType} onClose={() => setPicker(null)} />
      <PickerSheet visible={picker === 'reviewer'} title="Reviewed / approved by" options={[{ value: '', label: 'Not yet reviewed' }, ...reviewers.map((m) => ({ value: m.uid, label: m.displayName, subtitle: m.role }))]} value={reviewer ?? ''} onSelect={(v) => setReviewer(v || null)} onClose={() => setPicker(null)} />
    </Screen>
  );
}
