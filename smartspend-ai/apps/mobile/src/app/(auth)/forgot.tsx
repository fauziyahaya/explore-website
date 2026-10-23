import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../state/AppContext';
import { Banner, Button, Field, Text } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { spacing, useTheme } from '../../ui/theme';

export default function Forgot() {
  const t = useTheme();
  const { backend, t: tr } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: spacing.xl }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={{ marginBottom: spacing.lg }}>
        <Icon name="chevron-left" color={t.primary} />
      </Pressable>
      <Text variant="largeTitle" accessibilityRole="header" style={{ marginBottom: spacing.xl }}>{tr('auth.forgot')}</Text>
      {sent ? <Banner tone="success" icon="check-circle">{tr('auth.resetSent')}</Banner> : null}
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      <Field label={tr('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <View style={{ gap: spacing.md }}>
        <Button title={tr('auth.reset')} loading={busy} disabled={!email} onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await backend.resetPassword(email);
            setSent(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }} />
        <Button title={tr('auth.signIn')} variant="ghost" onPress={() => router.replace('/login')} />
      </View>
    </SafeAreaView>
  );
}
