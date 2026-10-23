import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { enhance } from '../services/scanner';
import { useApp } from '../state/AppContext';
import { Button, Text } from '../ui/components';
import { Icon } from '../ui/Icon';
import { spacing, useTheme } from '../ui/theme';

/** Fallback camera capture (used when the VisionKit document scanner isn't available, e.g. Expo Go). */
export default function Camera() {
  const t = useTheme();
  const { t: tr } = useApp();
  const [perm, request] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);

  if (!perm) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!perm.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg }}>
        <Icon name="camera" size={48} color={t.primary} />
        <Text variant="title">{tr('scan.permission')}</Text>
        <Button title={tr('scan.grant')} onPress={request} />
        <Button title={tr('common.cancel')} variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const shoot = async () => {
    if (!cam.current || busy) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const uri = await enhance(pic.uri);
      router.replace({ pathname: '/receipt-review', params: { uri, mimeType: 'image/jpeg', source: 'camera' } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cam} style={{ flex: 1 }} facing="back" enableTorch={torch} />
      {/* Framing guide */}
      <View pointerEvents="none" style={{ position: 'absolute', top: '12%', bottom: '22%', left: '10%', right: '10%', borderWidth: 2, borderColor: '#ffffffaa', borderRadius: 16 }} />
      <SafeAreaView edges={['top', 'bottom']} style={{ position: 'absolute', inset: 0, justifyContent: 'space-between' }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tr('common.close')} hitSlop={12}><Icon name="x" color="#fff" size={28} /></Pressable>
          <Pressable onPress={() => setTorch(!torch)} accessibilityRole="button" accessibilityLabel={torch ? 'Turn off flash' : 'Turn on flash'} hitSlop={12}><Icon name="bolt" color={torch ? '#FBBF24' : '#fff'} size={26} /></Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xl }}>
          <Text variant="footnote" color="#fff" style={{ textAlign: 'center', paddingHorizontal: spacing.xl }}>{tr('scan.tip')}</Text>
          <Pressable onPress={shoot} accessibilityRole="button" accessibilityLabel="Capture receipt" style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' }} />}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
