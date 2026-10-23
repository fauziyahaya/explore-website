import { formatMoney } from '@smartspend/core';
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

/**
 * Lightweight interactive SVG charts. Conventions: thin marks, rounded data
 * ends anchored to the baseline, 2px gaps between adjacent fills, recessive
 * grid, single y-axis, tap a mark to select it (value callout + drill-down).
 */

const fmt = (v: number) => formatMoney(v, 'MYR', { compact: true });

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export interface Series {
  key: string;
  label: string;
  values: number[];
  color?: string;
}

export function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm }} accessibilityRole="summary">
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: i.color }} />
          <Text variant="footnote" color={t.textMuted}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Vertical bar chart; one series = plain bars, several = grouped bars. */
export function BarChart({ labels, series, height = 200, onSelect, formatLabel = (l) => l }: { labels: string[]; series: Series[]; height?: number; onSelect?: (index: number) => void; formatLabel?: (l: string) => string }) {
  const t = useTheme();
  const { width: screenW } = useWindowDimensions();
  const width = screenW - spacing.lg * 4;
  const [sel, setSel] = useState<number | null>(null);
  const padL = 44, padB = 22, padT = 8;
  const plotW = width - padL, plotH = height - padB - padT;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const groupW = plotW / Math.max(1, labels.length);
  const gap = 2;
  const barW = Math.max(3, Math.min(28, (groupW * 0.72 - gap * (series.length - 1)) / series.length));
  const colors = series.map((s, i) => s.color ?? t.chart[i] ?? t.chartOther);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const step = Math.ceil(labels.length / 6);

  return (
    <View>
      {series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i]! }))} /> : null}
      <Svg width={width} height={height} accessibilityElementsHidden>
        {ticks.map((v) => {
          const y = padT + plotH - (v / max) * plotH;
          return (
            <G key={v}>
              <Line x1={padL} x2={width} y1={y} y2={y} stroke={t.chartGrid} strokeWidth={1} />
              <SvgText x={padL - 6} y={y + 4} fontSize={10} fill={t.textSubtle} textAnchor="end">{fmt(v)}</SvgText>
            </G>
          );
        })}
        {labels.map((l, i) => {
          const gx = padL + i * groupW + (groupW - (barW * series.length + gap * (series.length - 1))) / 2;
          return (
            <G key={l}>
              {sel === i ? <Rect x={padL + i * groupW} y={padT} width={groupW} height={plotH} fill={t.tealSoft} opacity={0.6} /> : null}
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const h = (Math.max(0, v) / max) * plotH;
                return <Path key={s.key} d={roundedTopBar(gx + si * (barW + gap), padT + plotH - h, barW, h, 4)} fill={colors[si]} opacity={sel == null || sel === i ? 1 : 0.45} />;
              })}
              {i % step === 0 ? <SvgText x={padL + i * groupW + groupW / 2} y={height - 6} fontSize={10} fill={t.textSubtle} textAnchor="middle">{formatLabel(l)}</SvgText> : null}
            </G>
          );
        })}
        <Line x1={padL} x2={width} y1={padT + plotH} y2={padT + plotH} stroke={t.textSubtle} strokeWidth={1} />
      </Svg>
      {/* Hit targets larger than the marks, one per category, accessible to VoiceOver. */}
      <View style={{ position: 'absolute', left: padL, top: series.length > 1 ? 28 : 0, width: plotW, height: plotH + padT, flexDirection: 'row' }}>
        {labels.map((l, i) => (
          <Pressable
            key={l}
            style={{ width: groupW, height: '100%' }}
            onPress={() => setSel(sel === i ? null : i)}
            accessibilityRole="button"
            accessibilityLabel={`${formatLabel(l)}: ${series.map((s) => `${s.label} ${formatMoney(s.values[i] ?? 0)}`).join(', ')}`}
            accessibilityHint="Shows the value and its transactions"
          />
        ))}
      </View>
      {sel != null ? (
        <Callout
          title={formatLabel(labels[sel]!)}
          lines={series.map((s, i) => ({ label: s.label, value: formatMoney(s.values[sel] ?? 0), color: colors[i]! }))}
          onDrill={onSelect ? () => onSelect(sel) : undefined}
        />
      ) : null}
    </View>
  );
}

/** Line chart with markers; tap a point to select it. */
export function LineChart({ labels, series, height = 200, onSelect, formatLabel = (l) => l }: { labels: string[]; series: Series[]; height?: number; onSelect?: (index: number) => void; formatLabel?: (l: string) => string }) {
  const t = useTheme();
  const { width: screenW } = useWindowDimensions();
  const width = screenW - spacing.lg * 4;
  const [sel, setSel] = useState<number | null>(null);
  const padL = 44, padB = 22, padT = 10, padR = 8;
  const plotW = width - padL - padR, plotH = height - padB - padT;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const x = (i: number) => padL + (labels.length <= 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (Math.max(0, v) / max) * plotH;
  const colors = series.map((s, i) => s.color ?? t.chart[i] ?? t.chartOther);
  const step = Math.ceil(labels.length / 6);
  const slot = plotW / Math.max(1, labels.length);

  return (
    <View>
      {series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i]! }))} /> : null}
      <Svg width={width} height={height} accessibilityElementsHidden>
        {[0, 0.5, 1].map((f) => (
          <G key={f}>
            <Line x1={padL} x2={width - padR} y1={y(f * max)} y2={y(f * max)} stroke={t.chartGrid} strokeWidth={1} />
            <SvgText x={padL - 6} y={y(f * max) + 4} fontSize={10} fill={t.textSubtle} textAnchor="end">{fmt(f * max)}</SvgText>
          </G>
        ))}
        {sel != null ? <Line x1={x(sel)} x2={x(sel)} y1={padT} y2={padT + plotH} stroke={t.textSubtle} strokeWidth={1} strokeDasharray="3,3" /> : null}
        {series.map((s, si) => (
          <G key={s.key}>
            <Path d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')} stroke={colors[si]} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (labels.length <= 31 || sel === i ? <Circle key={i} cx={x(i)} cy={y(v)} r={sel === i ? 5 : 3} fill={colors[si]} stroke={t.card} strokeWidth={2} /> : null))}
          </G>
        ))}
        {labels.map((l, i) => (i % step === 0 ? <SvgText key={l} x={x(i)} y={height - 6} fontSize={10} fill={t.textSubtle} textAnchor="middle">{formatLabel(l)}</SvgText> : null))}
      </Svg>
      <View style={{ position: 'absolute', left: padL - slot / 2, top: series.length > 1 ? 28 : 0, height: plotH + padT, flexDirection: 'row' }}>
        {labels.map((l, i) => (
          <Pressable key={l} style={{ width: slot, height: '100%' }} onPress={() => setSel(sel === i ? null : i)} accessibilityRole="button"
            accessibilityLabel={`${formatLabel(l)}: ${series.map((s) => `${s.label} ${formatMoney(s.values[i] ?? 0)}`).join(', ')}`} />
        ))}
      </View>
      {sel != null ? <Callout title={formatLabel(labels[sel]!)} lines={series.map((s, i) => ({ label: s.label, value: formatMoney(s.values[sel] ?? 0), color: colors[i]! }))} onDrill={onSelect ? () => onSelect(sel) : undefined} /> : null}
    </View>
  );
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color?: string;
}

/**
 * Doughnut with at most 7 named slices + "Other" (never a generated 9th hue).
 * Legend with values doubles as the direct labels and the accessible list.
 */
export function DonutChart({ slices, onSelect, centerLabel }: { slices: Slice[]; onSelect?: (key: string) => void; centerLabel?: string }) {
  const t = useTheme();
  const [sel, setSel] = useState<string | null>(null);
  const top = slices.slice(0, 7);
  const rest = slices.slice(7);
  const data: Slice[] = rest.length ? [...top, { key: '__other', label: 'Other', value: rest.reduce((a, s) => a + s.value, 0), color: t.chartOther }] : top;
  const total = data.reduce((a, s) => a + s.value, 0);
  const size = 180, r = 80, stroke = 26, cx = size / 2, cy = size / 2;
  let angle = -Math.PI / 2;
  const gapAngle = data.length > 1 ? 2 / r : 0; // 2px surface gap
  const arcs = data.map((s, i) => {
    const sweep = total ? (s.value / total) * Math.PI * 2 : 0;
    const a0 = angle + gapAngle / 2, a1 = angle + sweep - gapAngle / 2;
    angle += sweep;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    return { ...s, color: s.color ?? t.chart[i] ?? t.chartOther, d: sweep >= Math.PI * 2 - 0.001 ? `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r}` : `M${p(a0)} A${r},${r} 0 ${large} 1 ${p(a1)}` };
  });
  const selected = arcs.find((a) => a.key === sel);
  return (
    <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center', flexWrap: 'wrap' }}>
      <Svg width={size} height={size} accessibilityElementsHidden>
        {arcs.map((a) => (
          <Path key={a.key} d={a.d} stroke={a.color} strokeWidth={sel === a.key ? stroke + 6 : stroke} fill="none" opacity={sel == null || sel === a.key ? 1 : 0.4} onPress={() => setSel(sel === a.key ? null : a.key)} />
        ))}
        <SvgText x={cx} y={cy - 4} fontSize={12} fill={t.textMuted} textAnchor="middle">{selected ? selected.label.slice(0, 16) : centerLabel ?? 'Total'}</SvgText>
        <SvgText x={cx} y={cy + 16} fontSize={16} fontWeight="700" fill={t.text} textAnchor="middle">{fmt(selected ? selected.value : total)}</SvgText>
      </Svg>
      <View style={{ flex: 1, minWidth: 140, gap: 6 }}>
        {arcs.map((a) => (
          <Pressable key={a.key} onPress={() => (a.key !== '__other' && onSelect ? onSelect(a.key) : setSel(sel === a.key ? null : a.key))} accessibilityRole="button"
            accessibilityLabel={`${a.label}: ${formatMoney(a.value)}, ${total ? Math.round((a.value / total) * 100) : 0} percent`} accessibilityHint={onSelect ? 'Shows transactions' : undefined}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: a.color }} />
            <Text variant="footnote" style={{ flex: 1 }} numberOfLines={1}>{a.label}</Text>
            <Text variant="footnote" color={t.textMuted}>{total ? Math.round((a.value / total) * 100) : 0}%</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Ranked horizontal bars (top merchants / brands / categories). */
export function RankBars({ rows, onSelect, max: maxRows = 8 }: { rows: Array<{ key: string; label: string; value: number; sub?: string }>; onSelect?: (key: string) => void; max?: number }) {
  const t = useTheme();
  const list = rows.slice(0, maxRows);
  const max = Math.max(1, ...list.map((r) => r.value));
  return (
    <View style={{ gap: spacing.sm }}>
      {list.map((r) => (
        <Pressable key={r.key} onPress={onSelect ? () => onSelect(r.key) : undefined} accessibilityRole={onSelect ? 'button' : undefined}
          accessibilityLabel={`${r.label}: ${formatMoney(r.value)}${r.sub ? `, ${r.sub}` : ''}`} style={{ gap: 4, minHeight: 40, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="footnote" numberOfLines={1} style={{ flex: 1 }}>{r.label}</Text>
            <Text variant="footnote" color={t.textMuted}>{formatMoney(r.value)}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: t.input, borderRadius: 4 }}>
            <View style={{ width: `${(r.value / max) * 100}%`, height: 8, backgroundColor: t.chart[0], borderRadius: 4 }} />
          </View>
          {r.sub ? <Text variant="caption" color={t.textSubtle}>{r.sub}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

function Callout({ title, lines, onDrill }: { title: string; lines: Array<{ label: string; value: string; color: string }>; onDrill?: () => void }) {
  const t = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ marginTop: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: t.bgAlt, gap: 4 }}>
      <Text variant="footnote" style={{ fontWeight: '600' }}>{title}</Text>
      {lines.map((l) => (
        <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color }} />
          <Text variant="footnote" color={t.textMuted} style={{ flex: 1 }}>{l.label}</Text>
          <Text variant="footnote">{l.value}</Text>
        </View>
      ))}
      {onDrill ? (
        <Pressable onPress={onDrill} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}>
          <Text variant="footnote" color={t.primary}>View transactions ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
