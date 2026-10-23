import { Redirect, Tabs } from 'expo-router';
import { useApp } from '../../state/AppContext';
import { Icon, type IconName } from '../../ui/Icon';
import { useTheme } from '../../ui/theme';

export default function TabsLayout() {
  const t = useTheme();
  const { t: tr, session, workspace } = useApp();
  if (!session) return <Redirect href="/login" />;
  if (!workspace) return <Redirect href="/" />;
  const icon = (name: IconName) => ({ color, size }: { color: unknown; size: number }) => <Icon name={name} color={String(color)} size={size - 2} />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: t.primary, tabBarInactiveTintColor: t.textSubtle, tabBarStyle: { backgroundColor: t.card, borderTopColor: t.cardBorder }, tabBarLabelStyle: { fontSize: 11 } }}>
      <Tabs.Screen name="index" options={{ title: tr('tabs.home'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="scan" options={{ title: tr('tabs.scan'), tabBarIcon: icon('camera') }} />
      <Tabs.Screen name="transactions" options={{ title: tr('tabs.transactions'), tabBarIcon: icon('list') }} />
      <Tabs.Screen name="analytics" options={{ title: tr('tabs.analytics'), tabBarIcon: icon('chart') }} />
      <Tabs.Screen name="reports" options={{ title: tr('tabs.reports'), tabBarIcon: icon('report') }} />
      <Tabs.Screen name="settings" options={{ title: tr('tabs.settings'), tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
