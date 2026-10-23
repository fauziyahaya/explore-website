import { can, ROLE_LABELS } from '@smartspend/core';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Alert, View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { Banner, Card, Divider, Row, Screen, SectionHeader, Segmented, SwitchRow, Text } from '../../ui/components';
import { spacing, useTheme } from '../../ui/theme';

export default function Settings() {
  const t = useTheme();
  const app = useApp();
  const { t: tr, workspace, role, session, profile, locale, appearance, backend, demo } = app;
  if (!workspace || !session) return null;
  const business = workspace.type === 'business';

  const deleteAccount = () =>
    Alert.alert(tr('settings.delete'), tr('settings.deleteConfirm'), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('settings.delete'), style: 'destructive', onPress: async () => {
        try {
          await backend.deleteAccount();
          router.replace('/login');
        } catch (e) {
          Alert.alert(tr('common.error'), (e as Error).message);
        }
      } },
    ]);

  return (
    <Screen>
      <Text variant="largeTitle" accessibilityRole="header">{tr('settings.title')}</Text>
      {backend.mode === 'demo' ? <Banner tone="warning" icon="sparkles">You are exploring sample data. Nothing here is a real record, and nothing is sent to a server.</Banner> : null}

      <Card style={{ paddingVertical: spacing.xs }}>
        <Row icon="user" title={profile?.displayName ?? session.displayName} subtitle={`${session.email ?? ''}${session.provider !== 'demo' ? ` · ${session.provider}` : ''}`} />
        <Divider />
        <Row icon={business ? 'building' : 'user'} title={workspace.name} subtitle={`${ROLE_LABELS[role!][locale]} · ${tr('settings.switch')}`} onPress={() => router.push('/workspaces')} />
      </Card>

      <SectionHeader title={tr('settings.workspace')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        {can(role, 'workspace.manage') ? <><Row icon="building" title={business ? tr('profile.companyTitle') : tr('profile.title')} subtitle="Name, registration, retention, report header" onPress={() => router.push('/company-profile')} /><Divider /></> : null}
        <Row icon="tag" title={tr('categories.title')} subtitle="Categories, departments, projects, cost centres" onPress={() => router.push('/categories')} />
        <Divider />
        <Row icon="budget" title={tr('budgets.title')} onPress={() => router.push('/budgets')} />
        {business ? <><Divider /><Row icon="users" title={tr('team.title')} subtitle="Roles & permissions" onPress={() => router.push('/team')} /></> : null}
        {business && can(role, 'transaction.approve') ? <><Divider /><Row icon="clock" title={tr('approvals.title')} onPress={() => router.push('/approvals')} /></> : null}
        <Divider />
        <Row icon="sheet" title={tr('sheets.title')} subtitle={workspace.googleSheets ? `Linked · last sync ${workspace.googleSheets.lastSyncAt?.slice(0, 16).replace('T', ' ') ?? '—'}` : 'Not connected'} onPress={() => router.push('/google-sheets')} />
        <Divider />
        <Row icon="download" title="Import bank statement (CSV)" onPress={() => router.push('/import-csv')} />
      </Card>

      <SectionHeader title={tr('settings.language')} />
      <Segmented options={[{ value: 'en', label: 'English' }, { value: 'ms', label: 'Bahasa Malaysia' }]} value={locale} onChange={app.setLocale} />
      <SectionHeader title={tr('settings.appearance')} />
      <Segmented options={[{ value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} value={appearance} onChange={app.setAppearance} />

      <SectionHeader title="Security" />
      <Card style={{ paddingVertical: spacing.xs }}>
        <SwitchRow icon="faceid" title={tr('settings.faceId')} subtitle="Ask for Face ID when opening the app" value={!!profile?.biometricLock} onValueChange={async (on) => {
          const ok = await app.setBiometricLock(on);
          if (!ok && on) Alert.alert('Face ID unavailable', 'Set up Face ID or a passcode in iOS Settings first.');
        }} />
        <Divider />
        <Row icon="shield" title={tr('settings.privacy')} subtitle="Consents, data export, retention" onPress={() => router.push('/security')} />
        <Divider />
        <Row icon="download" title={tr('settings.export')} onPress={async () => {
          try {
            const url = await backend.exportMyData();
            if (!url) return;
            if (url.startsWith('file:')) await Sharing.shareAsync(url);
            else await WebBrowser.openBrowserAsync(url);
          } catch (e) {
            Alert.alert(tr('common.error'), (e as Error).message);
          }
        }} />
      </Card>

      {backend.mode === 'demo' ? (
        <>
          <SectionHeader title="Demo" />
          <Card style={{ paddingVertical: spacing.xs }}>
            <Row icon="history" title="Reset sample data" onPress={() => Alert.alert('Reset sample data?', undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: 'Reset', onPress: () => demo.resetDemo() }])} />
          </Card>
        </>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Card style={{ paddingVertical: spacing.xs }}>
          <Row icon="logout" title={tr('settings.signOut')} onPress={async () => { await app.signOut(); router.replace('/login'); }} />
          <Divider />
          <Row icon="trash" iconColor={t.danger} destructive title={tr('settings.delete')} onPress={deleteAccount} />
        </Card>
      </View>
      <Text variant="caption" color={t.textSubtle} style={{ textAlign: 'center', marginTop: spacing.lg }}>SmartSpend AI 1.0 · {backend.mode === 'demo' ? 'Demo mode' : 'Connected'}</Text>
    </Screen>
  );
}
