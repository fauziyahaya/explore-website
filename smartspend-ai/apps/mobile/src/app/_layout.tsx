import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../state/AppContext';
import { Button, Text } from '../ui/components';
import { Icon } from '../ui/Icon';
import { spacing, useIsDark, useTheme } from '../ui/theme';

function LockScreen() {
  const t = useTheme();
  const { unlock, t: tr, signOut } = useApp();
  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }} accessibilityViewIsModal>
      <Icon name="lock" size={48} color={t.primary} />
      <Text variant="title">{tr('appName')}</Text>
      <Text color={t.textMuted} style={{ textAlign: 'center' }}>Your financial data is locked.</Text>
      <Button title={tr('auth.unlock')} icon="faceid" onPress={unlock} style={{ alignSelf: 'stretch' }} />
      <Button title={tr('settings.signOut')} variant="ghost" onPress={signOut} />
    </View>
  );
}

function Shell() {
  const t = useTheme();
  const dark = useIsDark();
  const { locked, t: tr } = useApp();
  const modal = { presentation: 'modal' as const };
  return (
    <View style={{ flex: 1, backgroundColor: t.bgAlt }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerTintColor: t.primary, headerStyle: { backgroundColor: t.bgAlt }, headerTitleStyle: { color: t.text }, contentStyle: { backgroundColor: t.bgAlt }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="account-type" options={{ title: '' }} />
        <Stack.Screen name="profile-setup" options={{ title: tr('profile.title') }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="camera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="receipt-review" options={{ title: tr('review.title') }} />
        <Stack.Screen name="transaction/[id]" options={{ title: tr('tx.detail') }} />
        <Stack.Screen name="income" options={{ ...modal, title: tr('income.title') }} />
        <Stack.Screen name="categories" options={{ title: tr('categories.title') }} />
        <Stack.Screen name="budgets" options={{ title: tr('budgets.title') }} />
        <Stack.Screen name="products" options={{ title: tr('products.title') }} />
        <Stack.Screen name="pnl" options={{ title: tr('pnl.title') }} />
        <Stack.Screen name="approvals" options={{ title: tr('approvals.title') }} />
        <Stack.Screen name="google-sheets" options={{ title: tr('sheets.title') }} />
        <Stack.Screen name="team" options={{ title: tr('team.title') }} />
        <Stack.Screen name="security" options={{ title: tr('settings.privacy') }} />
        <Stack.Screen name="import-csv" options={{ ...modal, title: 'Import bank statement' }} />
        <Stack.Screen name="drilldown" options={{ title: 'Transactions' }} />
        <Stack.Screen name="workspaces" options={{ ...modal, title: tr('settings.switch') }} />
        <Stack.Screen name="company-profile" options={{ title: tr('profile.companyTitle') }} />
      </Stack>
      {locked ? <LockScreen /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
