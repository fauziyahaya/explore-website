import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { hasDocumentScanner, pickFromLibrary, pickPdf, scanWithDocumentScanner, type Capture } from '../../services/scanner';
import { useApp } from '../../state/AppContext';
import { Banner, Card, Row, Divider, Screen, Text } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { radius, spacing, useTheme } from '../../ui/theme';

function openReview(c: Capture) {
  router.push({ pathname: '/receipt-review', params: { uri: c.uri, mimeType: c.mimeType, source: c.source } });
}

export default function Scan() {
  const t = useTheme();
  const { t: tr, role } = useApp();
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<Capture | null>) => {
    setError(null);
    try {
      const c = await fn();
      if (c) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        openReview(c);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const snap = () => (hasDocumentScanner() ? run(scanWithDocumentScanner) : router.push('/camera'));

  if (role === 'auditor') {
    return <Screen><Banner>Auditors have read-only access and cannot record transactions.</Banner></Screen>;
  }
  return (
    <Screen>
      <Text variant="largeTitle" accessibilityRole="header" style={{ marginBottom: spacing.lg }}>{tr('scan.title')}</Text>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      <Card onPress={snap} accessibilityLabel={tr('home.snap')} accessibilityHint="Opens the receipt scanner" style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md, backgroundColor: t.primary, borderColor: t.primary }}>
        <View style={{ width: 88, height: 88, borderRadius: radius.xl, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="scan" size={48} color={t.onPrimary} />
        </View>
        <Text variant="title" color={t.onPrimary}>{tr('home.snap')}</Text>
        <Text variant="callout" color={t.onPrimary} style={{ opacity: 0.85, textAlign: 'center' }}>{hasDocumentScanner() ? 'Edges are detected and cropped automatically.' : tr('scan.tip')}</Text>
      </Card>
      <Card style={{ marginTop: spacing.lg, paddingVertical: spacing.xs }}>
        <Row icon="photo" title={tr('scan.library')} subtitle="Screenshots, e-receipts and saved photos" onPress={() => run(pickFromLibrary)} />
        <Divider />
        <Row icon="pdf" title={tr('scan.pdf')} subtitle="Supplier invoices and e-invoices (PDF)" onPress={() => run(pickPdf)} />
        <Divider />
        <Row icon="pencil" title={tr('scan.manual')} subtitle="No receipt? Type the details" onPress={() => router.push({ pathname: '/receipt-review', params: { source: 'manual' } })} />
        <Divider />
        <Row icon="income" iconColor={t.positive} title={tr('income.title')} onPress={() => router.push('/income')} />
        <Divider />
        <Row icon="download" title="Import bank statement (CSV)" onPress={() => router.push('/import-csv')} />
      </Card>
      <Banner tone="info" icon="shield">Receipts are uploaded over an encrypted connection and stored privately. Offline? Capture anyway — it syncs when you reconnect.</Banner>
    </Screen>
  );
}
