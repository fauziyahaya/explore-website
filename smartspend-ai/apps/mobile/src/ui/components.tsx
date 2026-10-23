import { formatMoney, REVIEW_THRESHOLD } from '@smartspend/core';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, spacing, TOUCH, useTheme } from './theme';
import { Icon, type IconName } from './Icon';

type Variant = keyof typeof font;

export function Text({ children, variant = 'body', color, style, numberOfLines, accessibilityRole, selectable, fit }: {
  children: ReactNode; variant?: Variant; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number; accessibilityRole?: 'header' | 'text' | 'link'; selectable?: boolean; fit?: boolean;
}) {
  const t = useTheme();
  return (
    <RNText maxFontSizeMultiplier={1.6} numberOfLines={fit ? 1 : numberOfLines} adjustsFontSizeToFit={fit} minimumFontScale={fit ? 0.6 : undefined} accessibilityRole={accessibilityRole} selectable={selectable} style={[font[variant], { color: color ?? t.text }, style]}>
      {children}
    </RNText>
  );
}

export function Screen({ children, scroll = true, padded = true, edges = ['top'] as Array<'top' | 'bottom'>, refresh }: { children: ReactNode; scroll?: boolean; padded?: boolean; edges?: Array<'top' | 'bottom'>; refresh?: ReactNode }) {
  const t = useTheme();
  const inner = padded ? { padding: spacing.lg, paddingBottom: 120 } : { paddingBottom: 120 };
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bgAlt }}>
      {refresh}
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded ? { padding: spacing.lg } : null]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel, accessibilityHint }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; accessibilityHint?: string }) {
  const t = useTheme();
  const base = [{ backgroundColor: t.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: t.cardBorder, padding: spacing.lg }, style];
  if (!onPress) return <View style={base} accessibilityLabel={accessibilityLabel}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, style, accessibilityHint, small }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; accessibilityHint?: string; small?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : variant === 'danger' ? t.danger : variant === 'secondary' ? t.tealSoft : 'transparent';
  const fg = variant === 'primary' ? t.onPrimary : variant === 'danger' ? '#fff' : t.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        { minHeight: small ? 36 : 52, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text variant={small ? 'callout' : 'headline'} color={fg}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, autoComplete, highlight, confidence, multiline, autoCapitalize, textContentType, editable = true, help, error }: {
  label: string; value: string; onChangeText?: (s: string) => void; placeholder?: string; keyboardType?: TextInputProps['keyboardType']; secureTextEntry?: boolean; autoComplete?: TextInputProps['autoComplete'];
  highlight?: boolean; confidence?: number | null; multiline?: boolean; autoCapitalize?: TextInputProps['autoCapitalize']; textContentType?: TextInputProps['textContentType']; editable?: boolean; help?: string; error?: string | null;
}) {
  const t = useTheme();
  const border = error ? t.danger : highlight ? t.warning : t.cardBorder;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text variant="footnote" color={t.textMuted}>{label}</Text>
        {confidence != null ? <ConfidenceBadge value={confidence} /> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textSubtle}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        textContentType={textContentType}
        editable={editable}
        multiline={multiline}
        accessibilityLabel={label}
        accessibilityHint={highlight ? 'Please verify this value' : help}
        maxFontSizeMultiplier={1.6}
        style={[font.body, { minHeight: TOUCH + 4, borderRadius: radius.md, borderWidth: highlight || error ? 1.5 : StyleSheet.hairlineWidth, borderColor: border, backgroundColor: highlight ? t.warningSoft : t.input, color: t.text, paddingHorizontal: spacing.md, paddingVertical: multiline ? spacing.sm : 0 }, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      />
      {error ? <Text variant="footnote" color={t.danger} style={{ marginTop: 4 }}>{error}</Text> : help ? <Text variant="footnote" color={t.textSubtle} style={{ marginTop: 4 }}>{help}</Text> : null}
    </View>
  );
}

/** Money input in major units; reports integer minor units (sen) or null when empty. */
export function MoneyField({ label, minor, onChange, highlight, confidence, currency = 'MYR', error, placeholder }: { label: string; minor: number | null; onChange: (v: number | null) => void; highlight?: boolean; confidence?: number | null; currency?: string; error?: string | null; placeholder?: string }) {
  const [text, setText] = useState(minor == null ? '' : (minor / 100).toFixed(2));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Math.round(Number(text.replace(/,/g, '')) * 100);
    if (parsed !== minor) setText(minor == null ? '' : (minor / 100).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minor]);
  return (
    <Field
      label={`${label} (${currency === 'MYR' ? 'RM' : currency})`}
      value={text}
      placeholder={placeholder ?? '0.00'}
      keyboardType="decimal-pad"
      highlight={highlight}
      confidence={confidence}
      error={error}
      onChangeText={(s) => {
        const clean = s.replace(/[^0-9.,]/g, '');
        setText(clean);
        if (clean.trim() === '') return onChange(null);
        const n = Number(clean.replace(/,/g, ''));
        if (Number.isFinite(n)) onChange(Math.round(n * 100));
      }}
    />
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const t = useTheme();
  const level = value >= REVIEW_THRESHOLD ? 'high' : value >= 0.5 ? 'medium' : 'low';
  const color = level === 'high' ? t.positive : level === 'medium' ? t.warning : t.danger;
  const label = level === 'high' ? 'High' : level === 'medium' ? 'Check' : 'Verify';
  return (
    <View accessibilityLabel={`AI confidence ${Math.round(value * 100)} percent, ${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: level === 'high' ? t.positiveSoft : t.warningSoft }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" color={color}>{`${label} · ${Math.round(value * 100)}%`}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label}
      style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: selected ? t.primary : t.card, borderWidth: StyleSheet.hairlineWidth, borderColor: selected ? t.primary : t.cardBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
      {icon ? <Icon name={icon} size={16} color={selected ? t.onPrimary : t.textMuted} /> : null}
      <Text variant="callout" color={selected ? t.onPrimary : t.text}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>{children}</ScrollView>;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.input, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }}
          style={{ flex: 1, minHeight: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: o.value === value ? t.card : 'transparent' }}>
          <Text variant="footnote" style={{ fontWeight: o.value === value ? '600' : '400' }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ icon, iconColor, title, subtitle, right, onPress, accessibilityLabel, destructive }: { icon?: IconName; iconColor?: string; title: string; subtitle?: string | null; right?: ReactNode; onPress?: () => void; accessibilityLabel?: string; destructive?: boolean }) {
  const t = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: spacing.md, paddingVertical: spacing.sm }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (iconColor ?? t.primary) + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={iconColor ?? t.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1} color={destructive ? t.danger : t.text}>{title}</Text>
        {subtitle ? <Text variant="footnote" color={t.textMuted} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && !right ? <Icon name="chevron-right" size={18} color={t.textSubtle} /> : null}
    </View>
  );
  if (!onPress) return <View accessibilityLabel={accessibilityLabel}>{content}</View>;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={({ pressed }) => pressed && { opacity: 0.6 }}>{content}</Pressable>;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.separator }} />;
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm }}>
      <Text variant="headline" accessibilityRole="header">{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={12}><Text variant="callout" color={t.primary}>{action.label}</Text></Pressable>
      ) : null}
    </View>
  );
}

export function SwitchRow({ title, subtitle, value, onValueChange, icon }: { title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void; icon?: IconName }) {
  const t = useTheme();
  return <Row icon={icon} title={title} subtitle={subtitle} right={<Switch value={value} onValueChange={onValueChange} trackColor={{ true: t.primary }} accessibilityLabel={title} />} />;
}

export function Money({ minor, currency = 'MYR', variant = 'headline', signed, colorize, style }: { minor: number; currency?: string; variant?: Variant; signed?: boolean; colorize?: boolean; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const color = colorize ? (minor > 0 ? t.positive : minor < 0 ? t.negative : t.text) : undefined;
  return <Text variant={variant} color={color} style={[{ fontVariant: ['tabular-nums'] }, style]}>{formatMoney(minor, currency, { showSign: signed })}</Text>;
}

export function EmptyState({ icon = 'inbox', title, message, action }: { icon?: IconName; title: string; message?: string; action?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.md }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.tealSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={30} color={t.primary} /></View>
      <Text variant="headline" style={{ textAlign: 'center' }}>{title}</Text>
      {message ? <Text variant="callout" color={t.textMuted} style={{ textAlign: 'center' }}>{message}</Text> : null}
      {action ? <Button title={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ backgroundColor: t.negativeSoft, borderColor: t.negative, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Icon name="alert" size={20} color={t.negative} />
        <Text variant="callout" style={{ flex: 1 }}>{message}</Text>
      </View>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="ghost" small /> : null}
    </Card>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: spacing.xxl, alignItems: 'center', gap: spacing.md }} accessibilityLiveRegion="polite" accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator size="large" color={t.primary} />
      {label ? <Text variant="callout" color={t.textMuted}>{label}</Text> : null}
    </View>
  );
}

export function Banner({ tone = 'info', icon = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'danger'; icon?: IconName; children: ReactNode }) {
  const t = useTheme();
  const bg = tone === 'warning' ? t.warningSoft : tone === 'success' ? t.positiveSoft : tone === 'danger' ? t.negativeSoft : t.tealSoft;
  const fg = tone === 'warning' ? t.warning : tone === 'success' ? t.positive : tone === 'danger' ? t.negative : t.primary;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
      <Icon name={icon} size={18} color={fg} />
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text variant="footnote">{children}</Text> : children}</View>
    </View>
  );
}

/** Simple bottom-sheet picker used for categories, departments, payment methods… */
export function PickerSheet<T extends string>({ visible, title, options, value, onSelect, onClose }: { visible: boolean; title: string; options: Array<{ value: T; label: string; subtitle?: string; color?: string }>; value?: T | null; onSelect: (v: T) => void; onClose: () => void }) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.bgAlt }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg }}>
          <Text variant="headline" accessibilityRole="header">{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}><Text color={t.primary}>Done</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
          {options.map((o) => (
            <View key={o.value}>
              <Row
                title={o.label}
                subtitle={o.subtitle}
                icon={o.color ? 'tag' : undefined}
                iconColor={o.color}
                onPress={() => { onSelect(o.value); onClose(); }}
                right={o.value === value ? <Icon name="check" size={20} color={t.primary} /> : <View />}
              />
              <Divider />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function SelectField({ label, valueLabel, onPress, highlight, confidence }: { label: string; valueLabel: string; onPress: () => void; highlight?: boolean; confidence?: number | null }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text variant="footnote" color={t.textMuted}>{label}</Text>
        {confidence != null ? <ConfidenceBadge value={confidence} /> : null}
      </View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${valueLabel}`} accessibilityHint="Opens a list of options"
        style={{ minHeight: TOUCH + 4, borderRadius: radius.md, borderWidth: highlight ? 1.5 : StyleSheet.hairlineWidth, borderColor: highlight ? t.warning : t.cardBorder, backgroundColor: highlight ? t.warningSoft : t.input, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{valueLabel}</Text>
        <Icon name="chevron-down" size={18} color={t.textSubtle} />
      </Pressable>
    </View>
  );
}

export function ProgressBar({ pct, color, label }: { pct: number; color?: string; label?: string }) {
  const t = useTheme();
  const c = color ?? (pct > 100 ? t.danger : pct >= 80 ? t.warning : t.positive);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(pct)) }} style={{ height: 8, borderRadius: 4, backgroundColor: t.input, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', backgroundColor: c, borderRadius: 4 }} />
    </View>
  );
}
