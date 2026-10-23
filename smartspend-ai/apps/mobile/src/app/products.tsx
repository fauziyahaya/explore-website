import { baseUnitLabel, compareBrands, compareMerchants, extractObservations, formatMoney, frequentProducts, lowestObserved, priceHistory, savingOpportunities } from '@smartspend/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart, LineChart } from '../charts/Charts';
import { shortDate } from '../services/dates';
import { useApp } from '../state/AppContext';
import { Banner, Card, Chip, ChipRow, Divider, EmptyState, Row, Screen, SectionHeader, Segmented, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

export default function Products() {
  const t = useTheme();
  const { data, t: tr, locale } = useApp();
  const obs = useMemo(() => extractObservations(data?.transactions ?? []), [data?.transactions]);
  const frequent = useMemo(() => frequentProducts(obs, 12), [obs]);
  const savings = useMemo(() => savingOpportunities(obs), [obs]);
  const [product, setProduct] = useState<string | null>(null);
  const [by, setBy] = useState<'brand' | 'merchant'>('brand');
  const selected = product ?? frequent[0]?.productType ?? null;
  const cmp = selected ? (by === 'brand' ? compareBrands(obs, selected) : compareMerchants(obs, selected)) : null;
  const hist = selected ? priceHistory(obs, selected) : [];
  const low = selected ? lowestObserved(obs, selected) : null;

  if (!obs.length) return <Screen edges={[]}><EmptyState icon="cart" title="No item-level purchases yet" message="Scan itemised receipts (e.g. groceries) to compare brands and prices per kg, litre or piece." /></Screen>;

  return (
    <Screen edges={[]}>
      <Banner icon="info">{tr('products.disclaimer')}</Banner>
      <Text variant="footnote" color={t.textMuted} style={{ marginBottom: 6 }}>{tr('products.frequent')}</Text>
      <ChipRow>{frequent.map((f) => <Chip key={f.productType} label={`${f.productType} (${f.count})`} selected={selected === f.productType} onPress={() => setProduct(f.productType)} />)}</ChipRow>

      {selected ? (
        <>
          <SectionHeader title={`${selected.replace(/^\w/, (c) => c.toUpperCase())}`} />
          <Segmented options={[{ value: 'brand', label: 'By brand' }, { value: 'merchant', label: 'By merchant' }]} value={by} onChange={setBy} />
          <Card style={{ marginTop: spacing.md }}>
            {cmp?.status === 'ok' ? (
              <>
                <Text variant="footnote" color={t.textMuted}>Average price per {baseUnitLabel(cmp.baseUnit, locale)} (equal quantities compared)</Text>
                <BarChart labels={cmp.groups.map((g) => g.key)} series={[{ key: 'p', label: `RM / ${cmp.baseUnit}`, values: cmp.groups.map((g) => g.avgPricePerBase) }]} formatLabel={(l) => l.slice(0, 10)} />
                <Divider />
                {cmp.groups.map((g, i) => (
                  <Row key={g.key} title={`${i === 0 ? '★ ' : ''}${g.key}`} subtitle={`${g.observations} purchase(s) · range ${formatMoney(g.minPricePerBase)}–${formatMoney(g.maxPricePerBase)} · last ${shortDate(g.lastDate, locale)}`} right={<Text variant="callout">{formatMoney(g.avgPricePerBase)}/{cmp.baseUnit}</Text>} />
                ))}
                <Text variant="caption" color={t.textSubtle}>★ lowest average observed price per unit.</Text>
              </>
            ) : (
              <Text color={t.textMuted}>{cmp?.status === 'insufficient' ? cmp.message : tr('products.insufficient')}</Text>
            )}
          </Card>
          {hist.length >= 2 ? (
            <>
              <SectionHeader title="Price history" />
              <Card>
                <LineChart labels={hist.map((h, i) => `${h.date}#${i}`)} formatLabel={(l) => shortDate(l.split('#')[0]!, locale).slice(0, 6)} series={[{ key: 'h', label: `RM / ${cmp?.status === 'ok' ? cmp.baseUnit : 'unit'}`, values: hist.map((h) => h.pricePerBase) }]}
                  onSelect={(i) => router.push(`/transaction/${hist[i]!.transactionId}`)} />
                {low ? <Text variant="footnote" color={t.textMuted} style={{ marginTop: spacing.sm }}>Lowest observed: {formatMoney(low.pricePerBase!)}/{low.baseUnit} — {low.brand ?? 'unbranded'} at {low.merchant} on {shortDate(low.date, locale)}</Text> : null}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      <SectionHeader title={tr('products.savings')} />
      {savings.length ? (
        <Card style={{ gap: spacing.md }}>
          {savings.slice(0, 6).map((s, i) => (
            <View key={`${s.productType}${s.cheaperChoice}${i}`} style={{ gap: 2 }}>
              {i ? <Divider /> : null}
              <Text variant="callout" style={{ fontWeight: '600', marginTop: i ? spacing.sm : 0 }}>{s.productType}: try {s.cheaperChoice}</Text>
              <Text variant="footnote" color={t.textMuted}>You usually buy {s.usualChoice} at {formatMoney(s.usualAvgPricePerBase)}/{s.baseUnit}; {s.cheaperChoice} averaged {formatMoney(s.cheaperAvgPricePerBase)}/{s.baseUnit} in your receipts.</Text>
              <Text variant="footnote" color={t.positive}>Potential saving on recorded purchases: {formatMoney(s.potentialSaving)}</Text>
              <Text variant="caption" color={t.textSubtle}>{s.calculation}</Text>
            </View>
          ))}
        </Card>
      ) : <Card><Text color={t.textMuted}>{tr('products.insufficient')} — buy and scan comparable items from different brands or shops to see savings.</Text></Card>}
    </Screen>
  );
}
