import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { Button, Segmented, Text } from '../ui/components';
import { Icon, type IconName } from '../ui/Icon';
import { radius, spacing, useTheme } from '../ui/theme';

const STEPS: Array<{ icon: IconName; title: 'onboarding.1.title' | 'onboarding.2.title' | 'onboarding.3.title'; body: 'onboarding.1.body' | 'onboarding.2.body' | 'onboarding.3.body' }> = [
  { icon: 'scan', title: 'onboarding.1.title', body: 'onboarding.1.body' },
  { icon: 'check-circle', title: 'onboarding.2.title', body: 'onboarding.2.body' },
  { icon: 'chart', title: 'onboarding.3.title', body: 'onboarding.3.body' },
];

export default function Onboarding() {
  const t = useTheme();
  const { t: tr, completeOnboarding, locale, setLocale } = useApp();
  const [step, setStep] = useState(0);
  const s = STEPS[step]!;
  const finish = () => {
    completeOnboarding();
    router.replace('/login');
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ width: 140 }}>
          <Segmented options={[{ value: 'en', label: 'English' }, { value: 'ms', label: 'BM' }]} value={locale} onChange={setLocale} />
        </View>
        <Pressable onPress={finish} accessibilityRole="button" hitSlop={12}><Text color={t.textMuted}>{tr('onboarding.skip')}</Text></Pressable>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl }}>
        <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: t.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={s.icon} size={64} color={t.primary} />
        </View>
        <Text variant="largeTitle" accessibilityRole="header" style={{ textAlign: 'center' }}>{tr(s.title)}</Text>
        <Text variant="body" color={t.textMuted} style={{ textAlign: 'center', lineHeight: 24 }}>{tr(s.body)}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.xl }} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((_, i) => (
          <View key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: radius.pill, backgroundColor: i === step ? t.primary : t.cardBorder }} />
        ))}
      </View>
      <Button title={step < STEPS.length - 1 ? tr('onboarding.next') : tr('onboarding.start')} onPress={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())} />
      <Text variant="footnote" color={t.textSubtle} style={{ textAlign: 'center', marginTop: spacing.md }}>{tr('tagline')}</Text>
    </SafeAreaView>
  );
}
