import { router } from 'expo-router';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Banner, Card, Screen, Text } from '../ui/components';
import { Icon } from '../ui/Icon';
import { spacing, useTheme } from '../ui/theme';

export default function AccountType() {
  const t = useTheme();
  const { t: tr, backend } = useApp();
  const pick = (type: 'personal' | 'business') => router.push({ pathname: '/profile-setup', params: { type } });
  return (
    <Screen edges={[]}>
      <Text variant="largeTitle" accessibilityRole="header" style={{ marginBottom: spacing.xl }}>{tr('accountType.title')}</Text>
      {backend.mode === 'demo' ? <Banner>The demo already includes a sample personal and business workspace.</Banner> : null}
      {(['personal', 'business'] as const).map((type) => (
        <Card key={type} onPress={() => pick(type)} style={{ marginBottom: spacing.lg }} accessibilityLabel={tr(type === 'personal' ? 'accountType.personal' : 'accountType.business')}>
          <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: t.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={type === 'personal' ? 'user' : 'building'} size={28} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{tr(type === 'personal' ? 'accountType.personal' : 'accountType.business')}</Text>
              <Text variant="callout" color={t.textMuted}>{tr(type === 'personal' ? 'accountType.personalBody' : 'accountType.businessBody')}</Text>
            </View>
            <Icon name="chevron-right" color={t.textSubtle} />
          </View>
        </Card>
      ))}
      <Text variant="footnote" color={t.textSubtle}>You can add more personal or business profiles later in Settings → Switch workspace.</Text>
    </Screen>
  );
}
