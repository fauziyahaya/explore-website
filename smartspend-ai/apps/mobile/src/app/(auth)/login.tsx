import * as AppleAuthentication from 'expo-apple-authentication';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isBackendConfigured } from '../../services/config';
import { useApp } from '../../state/AppContext';
import { Banner, Button, Divider, Field, Text } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { spacing, useIsDark, useTheme } from '../../ui/theme';

export default function Login() {
  const t = useTheme();
  const dark = useIsDark();
  const { backend, t: tr, startDemo, session, useRealAccount } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const configured = isBackendConfigured();

  useEffect(() => {
    if (configured) useRealAccount();
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (session) router.replace('/');
  }, [session]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error).message;
      if (!/cancel/i.test(msg) && (e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') setError(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginVertical: spacing.xl, gap: spacing.sm }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="scan" size={38} color={t.onPrimary} />
            </View>
            <Text variant="largeTitle" accessibilityRole="header">{tr('appName')}</Text>
            <Text color={t.textMuted} style={{ textAlign: 'center' }}>{tr('tagline')}</Text>
          </View>

          {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}

          {configured ? (
            <>
              {Platform.OS === 'ios' && appleAvailable ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={{ height: 52 }}
                  onPress={() => run('apple', () => backend.signInWithApple())}
                />
              ) : null}
              <Button title={tr('auth.google')} icon="globe" variant="secondary" loading={busy === 'google'} onPress={() => run('google', () => backend.signInWithGoogle())} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.md }}>
                <View style={{ flex: 1 }}><Divider /></View>
                <Text variant="footnote" color={t.textSubtle}>{tr('auth.or')}</Text>
                <View style={{ flex: 1 }}><Divider /></View>
              </View>
              <Field label={tr('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
              <Field label={tr('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" />
              <Button title={tr('auth.signIn')} loading={busy === 'email'} disabled={!email || !password} onPress={() => run('email', () => backend.signInWithEmail(email, password))} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
                <Link href="/forgot" accessibilityRole="link"><Text variant="callout" color={t.primary}>{tr('auth.forgot')}</Text></Link>
                <Link href="/register" accessibilityRole="link"><Text variant="callout" color={t.primary}>{tr('auth.register')}</Text></Link>
              </View>
            </>
          ) : (
            <Banner tone="info" icon="info">This build is not connected to a SmartSpend backend yet, so sign-in is unavailable. You can explore every feature with sample data.</Banner>
          )}

          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <Button title={tr('auth.demo')} icon="sparkles" variant={configured ? 'ghost' : 'primary'} loading={busy === 'demo'} onPress={() => run('demo', startDemo)} />
            <Text variant="footnote" color={t.textSubtle} style={{ textAlign: 'center' }}>{tr('auth.demoNote')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
