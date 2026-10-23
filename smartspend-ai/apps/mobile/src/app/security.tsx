import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import { LEGAL } from '../services/config';
import { useApp } from '../state/AppContext';
import { Card, Divider, Row, Screen, SectionHeader, SwitchRow, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

/** Privacy & consent management (PDPA 2010) and data-handling transparency. */
export default function Security() {
  const t = useTheme();
  const { profile, saveProfile, workspace } = useApp();
  const consents = profile?.consents ?? [];
  const has = (p: string) => consents.some((c) => c.purpose === p && !c.revokedAt);
  const toggle = (purpose: 'ai_processing' | 'analytics' | 'google_sheets_sync', on: boolean) => {
    const now = new Date().toISOString();
    const next = on
      ? [...consents.filter((c) => c.purpose !== purpose), { purpose, version: LEGAL.policyVersion, grantedAt: now }]
      : consents.map((c) => (c.purpose === purpose && !c.revokedAt ? { ...c, revokedAt: now } : c));
    saveProfile({ consents: next });
  };
  return (
    <Screen edges={[]}>
      <SectionHeader title="Consents" />
      <Card style={{ paddingVertical: spacing.xs }}>
        <SwitchRow title="AI receipt reading" subtitle="Receipt images are processed by Google AI to extract details. Turn off to enter details manually." value={has('ai_processing')} onValueChange={(v) => toggle('ai_processing', v)} />
        <Divider />
        <SwitchRow title="Google Sheets sync" subtitle="Copy approved records to a spreadsheet you own." value={has('google_sheets_sync')} onValueChange={(v) => toggle('google_sheets_sync', v)} />
        <Divider />
        <SwitchRow title="Anonymous usage analytics" subtitle="Helps improve the app. Never includes financial data." value={has('analytics')} onValueChange={(v) => toggle('analytics', v)} />
      </Card>
      <SectionHeader title="How your data is protected" />
      <Card style={{ gap: spacing.sm }}>
        {[
          'Encrypted in transit (TLS) and at rest on Google Cloud (asia-southeast1).',
          'Each personal or business workspace is isolated; only its members can read it.',
          'Financial records are written only by our server, which checks your role and records every change in a tamper-evident audit trail.',
          'API keys and Google tokens are kept on the server — never in the app.',
          `Records are retained for ${workspace?.retentionYears ?? 7} years for this workspace (Malaysian default: 7).`,
        ].map((s) => <View key={s} style={{ flexDirection: 'row', gap: 8 }}><Text color={t.primary}>•</Text><Text variant="footnote" style={{ flex: 1 }}>{s}</Text></View>)}
      </Card>
      <SectionHeader title="Documents" />
      <Card style={{ paddingVertical: spacing.xs }}>
        <Row icon="doc" title="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacyPolicyUrl)} />
        <Divider />
        <Row icon="doc" title="Terms of Use" onPress={() => WebBrowser.openBrowserAsync(LEGAL.termsUrl)} />
      </Card>
      <Text variant="caption" color={t.textSubtle} style={{ marginTop: spacing.lg }}>Consent history: {consents.map((c) => `${c.purpose} ${c.revokedAt ? 'revoked' : 'granted'} ${c.grantedAt.slice(0, 10)}`).join(' · ') || 'none recorded'}</Text>
    </Screen>
  );
}
