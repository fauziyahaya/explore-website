import { can, spreadsheetTitle, TABS } from '@smartspend/core';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Banner, Button, Card, Divider, Row, Screen, SectionHeader, Text } from '../ui/components';
import { Icon } from '../ui/Icon';
import { spacing, useTheme } from '../ui/theme';

/** Google account connection for Sheets/Drive — independent from app login. */
export default function GoogleSheets() {
  const t = useTheme();
  const { workspace, backend, profile, role, data, t: tr, refreshWorkspaces } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  if (!workspace) return null;
  const connection = (profile as unknown as { googleConnection?: { email: string | null } | null })?.googleConnection;
  const link = workspace.googleSheets;
  const manage = can(role, 'sheets.manage');
  const pending = (data?.transactions ?? []).filter((x) => x.sync.sheets === 'pending').length;
  const failed = (data?.transactions ?? []).filter((x) => x.sync.sheets === 'failed');

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={[]}>
      <Banner icon="shield">{tr('sheets.explain')}</Banner>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      {info ? <Banner tone="success" icon="check-circle">{info}</Banner> : null}
      {workspace.isSample ? <Banner tone="warning">Sample workspaces never sync to Google, so demo data can’t mix with your real records.</Banner> : null}

      <SectionHeader title="1. Google account" />
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Icon name="globe" color={connection ? t.positive : t.textSubtle} />
          <Text style={{ flex: 1 }}>{connection ? `Connected${connection.email ? ` as ${connection.email}` : ''}` : 'Not connected'}</Text>
        </View>
        <Text variant="footnote" color={t.textMuted}>SmartSpend asks only for Google Sheets and access to files it creates in your Drive. Tokens are stored encrypted on our server — never on this phone.</Text>
        {connection ? (
          <Button title={tr('sheets.disconnect')} variant="ghost" loading={busy === 'disc'} onPress={() => run('disc', async () => { await backend.disconnectGoogle(); await refreshWorkspaces(); setInfo('Google account disconnected. Your spreadsheet stays in your Drive.'); })} />
        ) : (
          <Button title={tr('sheets.connect')} icon="link" loading={busy === 'conn'} disabled={workspace.isSample} onPress={() => run('conn', async () => { const r = await backend.connectGoogle(); setInfo(`Connected ${r.email ?? ''}`); })} />
        )}
      </Card>

      <SectionHeader title="2. Spreadsheet for this workspace" />
      <Card style={{ gap: spacing.md }}>
        <Text variant="callout" style={{ fontWeight: '600' }}>{spreadsheetTitle(workspace)}</Text>
        {link ? (
          <>
            <Text variant="footnote" color={t.textMuted}>Last sync: {link.lastSyncAt?.replace('T', ' ').slice(0, 16) ?? '—'}{link.lastSyncError ? ` · Error: ${link.lastSyncError}` : ''}</Text>
            <Text variant="footnote" color={pending ? t.warning : t.positive}>{pending ? `${pending} change(s) waiting to sync` : 'All approved records are synced'}</Text>
            {failed.length ? <Text variant="footnote" color={t.danger}>{failed.length} failed: {failed[0]!.sync.error}</Text> : null}
            <Button title={tr('sheets.open')} icon="sheet" onPress={() => WebBrowser.openBrowserAsync(link.spreadsheetUrl)} />
            <Button title={tr('sheets.syncNow')} icon="sync" variant="secondary" loading={busy === 'sync'} onPress={() => run('sync', async () => { await backend.syncSheetsNow(workspace.id); await refreshWorkspaces(); setInfo('Sync complete. Re-syncing never creates duplicate rows.'); })} />
            {manage ? <Button title="Stop syncing this workspace" variant="ghost" onPress={() => run('unlink', async () => { await backend.unlinkSpreadsheet(workspace.id); await refreshWorkspaces(); })} /> : null}
          </>
        ) : manage ? (
          <Button title="Create & link spreadsheet" icon="plus" disabled={!connection || workspace.isSample} loading={busy === 'link'} onPress={() => run('link', async () => { const r = await backend.linkSpreadsheet(workspace.id); await refreshWorkspaces(); setInfo('Spreadsheet created and synced.'); await WebBrowser.openBrowserAsync(r.spreadsheetUrl); })} />
        ) : <Text color={t.textMuted}>Ask the owner or finance manager to link a spreadsheet.</Text>}
      </Card>

      <SectionHeader title="Tabs created" />
      <Card style={{ paddingVertical: spacing.xs }}>
        {TABS.map((tab, i) => (
          <View key={tab.name}>{i ? <Divider /> : null}<Row title={`${i + 1}. ${tab.name}`} subtitle={tab.mode === 'upsert' ? 'Updated row-by-row using unique IDs' : 'Rebuilt from your records each sync'} /></View>
        ))}
      </Card>
    </Screen>
  );
}
