import { useColorScheme } from 'react-native';
import { useApp } from '../state/AppContext';

/** Design tokens: clean Apple-inspired palette — navy, teal and subtle financial green/red. */
const light = {
  bg: '#FFFFFF',
  bgAlt: '#F5F7FA',
  card: '#FFFFFF',
  cardBorder: '#E6EAF0',
  text: '#0B1F3A',
  textMuted: '#5B6B82',
  textSubtle: '#8A97AB',
  navy: '#0B1F3A',
  teal: '#0F766E',
  tealSoft: '#E6F4F2',
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  positive: '#15803D',
  positiveSoft: '#E8F5EC',
  negative: '#C2410C',
  negativeSoft: '#FDEEE6',
  danger: '#B91C1C',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  info: '#1D4ED8',
  separator: '#E6EAF0',
  input: '#F5F7FA',
  chartGrid: '#E6EAF0',
  /** Validated categorical palette (CVD-checked, fixed order — never cycled; 9th+ series fold into “Other”). */
  chart: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  chartOther: '#94A3B8',
};

const dark: typeof light = {
  bg: '#0A1222',
  bgAlt: '#0F1A2E',
  card: '#121E34',
  cardBorder: '#1F2C45',
  text: '#F1F5F9',
  textMuted: '#A3B1C6',
  textSubtle: '#73839B',
  navy: '#E2E8F0',
  teal: '#2DD4BF',
  tealSoft: '#123A3A',
  primary: '#14B8A6',
  onPrimary: '#04201D',
  positive: '#4ADE80',
  positiveSoft: '#123222',
  negative: '#FB923C',
  negativeSoft: '#3A2112',
  danger: '#F87171',
  warning: '#FBBF24',
  warningSoft: '#3A2E10',
  info: '#93C5FD',
  separator: '#1F2C45',
  input: '#0F1A2E',
  chartGrid: '#1F2C45',
  chart: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  chartOther: '#64748B',
};

export type Theme = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const font = {
  largeTitle: { fontSize: 32, fontWeight: '700' as const, letterSpacing: 0.2 },
  title: { fontSize: 24, fontWeight: '700' as const },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  callout: { fontSize: 15, fontWeight: '400' as const },
  footnote: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  money: { fontSize: 28, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
};

/** Minimum touch target (Apple HIG: 44pt). */
export const TOUCH = 44;

export function useTheme(): Theme {
  const system = useColorScheme();
  const { appearance } = useApp();
  const mode = appearance === 'system' ? system : appearance;
  return mode === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  const system = useColorScheme();
  const { appearance } = useApp();
  return (appearance === 'system' ? system : appearance) === 'dark';
}
