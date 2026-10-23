import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEGAL } from '../../services/config';
import { useApp } from '../../state/AppContext';
import { Banner, Button, Field, Text } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { spacing, useTheme } from '../../ui/theme';

export default function Register() {
  const t = useTheme();
  const { backend, t: tr, saveProfile } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weak = password.length > 0 && (password.length < 8 || !/\d/.test(password) || !/[A-Za-z]/.test(password));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await backend.register(name, email, password);
      const at = new Date().toISOString();
      await saveProfile({ displayName: name, email, consents: (['privacy_policy', 'terms', 'ai_processing'] as const).map((purpose) => ({ purpose, version: LEGAL.policyVersion, grantedAt: at })) });
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Icon name="chevron-left" color={t.primary} />
        </Pressable>
        <Text variant="largeTitle" accessibilityRole="header" style={{ marginBottom: spacing.xl }}>{tr('auth.register')}</Text>
        {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
        <Field label={tr('auth.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
        <Field label={tr('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label={tr('auth.password')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password"
          error={weak ? 'Use at least 8 characters with letters and numbers.' : null} help="At least 8 characters, with letters and numbers." />
        <Pressable onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginVertical: spacing.md }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: t.primary, backgroundColor: consent ? t.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {consent ? <Icon name="check" size={16} color={t.onPrimary} /> : null}
          </View>
          <Text variant="footnote" style={{ flex: 1 }}>{tr('auth.consent')}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xl }}>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacyPolicyUrl)} accessibilityRole="link"><Text variant="footnote" color={t.primary}>Privacy Policy</Text></Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(LEGAL.termsUrl)} accessibilityRole="link"><Text variant="footnote" color={t.primary}>Terms of Use</Text></Pressable>
        </View>
        <Button title={tr('auth.register')} loading={busy} disabled={!name || !email || !password || weak || !consent} onPress={submit} />
        <Pressable onPress={() => router.replace('/login')} style={{ marginTop: spacing.lg, alignItems: 'center', minHeight: 44, justifyContent: 'center' }} accessibilityRole="link">
          <Text variant="callout" color={t.primary}>{tr('auth.haveAccount')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
