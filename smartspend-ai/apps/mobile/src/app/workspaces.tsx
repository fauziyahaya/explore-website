import { ROLE_LABELS } from '@smartspend/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Button, Card, Divider, Row, Screen, Text } from '../ui/components';
import { Icon } from '../ui/Icon';
import { spacing, useTheme } from '../ui/theme';

/** Switch between personal and business profiles (multiple businesses per user). */
export default function Workspaces() {
  const t = useTheme();
  const { workspaces, workspace, selectWorkspace, locale, backend, t: tr } = useApp();
  return (
    <Screen edges={[]}>
      <Card style={{ paddingVertical: spacing.xs }}>
        {workspaces.map((w, i) => (
          <View key={w.workspace.id}>
            {i ? <Divider /> : null}
            <Row icon={w.workspace.type === 'business' ? 'building' : 'user'} title={w.workspace.name} subtitle={`${w.workspace.type === 'business' ? tr('accountType.business') : tr('accountType.personal')} · ${ROLE_LABELS[w.role][locale]}${w.workspace.isSample ? ` · ${tr('common.sample')}` : ''}`}
              right={w.workspace.id === workspace?.id ? <Icon name="check" color={t.primary} /> : <View />}
              onPress={() => { selectWorkspace(w.workspace.id); router.back(); }} />
          </View>
        ))}
      </Card>
      {backend.mode === 'firebase' ? <Button title="Add personal or business profile" icon="plus" variant="secondary" style={{ marginTop: spacing.lg }} onPress={() => router.push('/account-type')} /> : null}
      <Text variant="footnote" color={t.textSubtle} style={{ marginTop: spacing.md }}>Each profile’s records are kept completely separate.</Text>
    </Screen>
  );
}
