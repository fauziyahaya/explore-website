import { can, makeCustomCategory, newId, type AccountingClass, type Dimension } from '@smartspend/core';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Banner, Button, Card, Chip, ChipRow, Divider, Field, PickerSheet, Row, Screen, SectionHeader, Segmented, SelectField, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

const CLASS_OPTIONS: Array<{ value: AccountingClass; label: string; subtitle: string; business: boolean }> = [
  { value: 'personal_expense', label: 'Personal expense', subtitle: 'Everyday spending', business: false },
  { value: 'personal_income', label: 'Personal income', subtitle: 'Money you receive', business: false },
  { value: 'operating_expense', label: 'Operating expense', subtitle: 'Running costs (rent, utilities, salaries…)', business: true },
  { value: 'cogs', label: 'Cost of goods sold', subtitle: 'Direct cost of what you sell', business: true },
  { value: 'other_expense', label: 'Other expense', subtitle: 'Interest, bank and financing charges', business: true },
  { value: 'revenue', label: 'Revenue', subtitle: 'Sales and service income', business: true },
  { value: 'other_operating_income', label: 'Other operating income', subtitle: 'Commission, rebates', business: true },
  { value: 'non_operating_income', label: 'Non-operating income', subtitle: 'Interest received, gains', business: true },
  { value: 'capital_expenditure', label: 'Capital expenditure (asset)', subtitle: 'Not a P&L expense', business: true },
  { value: 'transfer', label: 'Transfer', subtitle: 'Between your own accounts — excluded', business: false },
];

export default function Categories() {
  const t = useTheme();
  const { categories, workspace, role, backend, locale, data } = useApp();
  const [tab, setTab] = useState<'categories' | 'dimensions'>('categories');
  const [name, setName] = useState('');
  const [nameMs, setNameMs] = useState('');
  const [keywords, setKeywords] = useState('');
  const [cls, setCls] = useState<AccountingClass>(workspace?.type === 'business' ? 'operating_expense' : 'personal_expense');
  const [picker, setPicker] = useState(false);
  const [dimType, setDimType] = useState<Dimension['type']>('department');
  const [dimName, setDimName] = useState('');
  const [dimCode, setDimCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!workspace) return null;
  const business = workspace.type === 'business';
  const manage = can(role, 'category.manage');
  const opts = CLASS_OPTIONS.filter((o) => o.business === business || o.value === 'transfer');

  const addCategory = async () => {
    setError(null);
    const kind = ['revenue', 'other_operating_income', 'non_operating_income', 'personal_income'].includes(cls) ? 'income' : ['capital_expenditure', 'transfer'].includes(cls) ? 'non_pl' : 'expense';
    try {
      await backend.saveCategory(workspace.id, makeCustomCategory({ id: newId('cat'), name, nameMs: nameMs || name, kind, accountingClass: cls, keywords: keywords.split(',') }, workspace.type));
      setName(''); setNameMs(''); setKeywords('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Screen edges={[]}>
      {business ? <Segmented options={[{ value: 'categories', label: 'Categories' }, { value: 'dimensions', label: 'Departments & projects' }]} value={tab} onChange={setTab} /> : null}
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      {tab === 'categories' ? (
        <>
          {manage ? (
            <>
              <SectionHeader title="Add a custom category" />
              <Card>
                <Field label="Name (English)" value={name} onChangeText={setName} />
                <Field label="Nama (Bahasa Malaysia)" value={nameMs} onChangeText={setNameMs} placeholder="Optional" />
                <SelectField label="Accounting treatment" valueLabel={CLASS_OPTIONS.find((o) => o.value === cls)!.label} onPress={() => setPicker(true)} />
                <Field label="Keywords for auto-categorisation" value={keywords} onChangeText={setKeywords} placeholder="e.g. courier, poslaju, j&t" help="Comma separated. SmartSpend also learns from your approved choices." />
                <Button title="Add category" disabled={!name.trim()} onPress={addCategory} />
              </Card>
            </>
          ) : <Banner>Only owners and finance managers can add categories.</Banner>}
          <SectionHeader title={`All categories (${categories.length})`} />
          <Card style={{ paddingVertical: spacing.xs }}>
            {categories.map((c, i) => (
              <View key={c.id}>
                {i ? <Divider /> : null}
                <Row icon="tag" iconColor={c.color} title={c.name[locale]} subtitle={`${c.accountingClass.replace(/_/g, ' ')}${c.isDefault ? '' : ' · custom'}${c.help ? ` — ${c.help[locale]}` : ''}`}
                  onPress={manage && !c.isDefault ? () => Alert.alert('Archive category?', 'Past transactions keep this category; it will no longer be suggested.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', onPress: () => backend.saveCategory(workspace.id, { ...c, archived: true }) }]) : undefined} />
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          {manage ? (
            <Card style={{ marginTop: spacing.lg }}>
              <ChipRow>
                {(['department', 'project', 'cost_centre', 'business_unit'] as const).map((d) => <Chip key={d} label={d.replace('_', ' ')} selected={dimType === d} onPress={() => setDimType(d)} />)}
              </ChipRow>
              <Field label="Name" value={dimName} onChangeText={setDimName} />
              <Field label="Code" value={dimCode} onChangeText={setDimCode} autoCapitalize="characters" placeholder="Optional" />
              <Button title="Add" disabled={!dimName.trim()} onPress={async () => {
                try {
                  await backend.saveDimension(workspace.id, { id: newId('dim'), workspaceId: workspace.id, type: dimType, name: dimName.trim(), code: dimCode || undefined });
                  setDimName(''); setDimCode('');
                } catch (e) {
                  setError((e as Error).message);
                }
              }} />
            </Card>
          ) : null}
          {(['department', 'project', 'cost_centre', 'business_unit'] as const).map((type) => {
            const list = (data?.dimensions ?? []).filter((d) => d.type === type && !d.archived);
            return list.length ? (
              <View key={type}>
                <SectionHeader title={type.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) + 's'} />
                <Card style={{ paddingVertical: spacing.xs }}>{list.map((d, i) => <View key={d.id}>{i ? <Divider /> : null}<Row title={d.name} subtitle={d.code} /></View>)}</Card>
              </View>
            ) : null;
          })}
          {!data?.dimensions.length ? <Text color={t.textMuted} style={{ marginTop: spacing.lg }}>No departments or projects yet.</Text> : null}
        </>
      )}
      <PickerSheet visible={picker} title="Accounting treatment" options={opts} value={cls} onSelect={setCls} onClose={() => setPicker(false)} />
    </Screen>
  );
}
