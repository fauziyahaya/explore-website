import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Banner, Button, Field, Screen, SwitchRow, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

/** Personal / company profile creation. Creates the workspace server-side (owner role). */
export default function ProfileSetup() {
  const t = useTheme();
  const { type } = useLocalSearchParams<{ type: 'personal' | 'business' }>();
  const business = type === 'business';
  const { backend, t: tr, session, refreshWorkspaces, selectWorkspace } = useApp();
  const [name, setName] = useState(business ? '' : `${session?.displayName ?? 'My'} — Personal`);
  const [regNo, setRegNo] = useState('');
  const [tin, setTin] = useState('');
  const [sst, setSst] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [retention, setRetention] = useState('7');
  const [approval, setApproval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const ws = await backend.createWorkspace({
        type: business ? 'business' : 'personal', name, registrationNumber: regNo || null, taxIdentificationNumber: tin || null, sstRegistrationNumber: sst || null,
        address: address || null, baseCurrency: currency.toUpperCase(), retentionYears: Number(retention) || 7, approvalRequired: business ? approval : false,
      });
      await refreshWorkspaces();
      selectWorkspace(ws.id);
      router.replace('/(tabs)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Text variant="title" accessibilityRole="header" style={{ marginBottom: spacing.lg }}>{business ? tr('profile.companyTitle') : tr('profile.title')}</Text>
      {error ? <Banner tone="danger" icon="alert">{error}</Banner> : null}
      <Field label={business ? tr('profile.companyName') : 'Profile name'} value={name} onChangeText={setName} autoCapitalize="words" />
      {business ? (
        <>
          <Field label={tr('profile.regNo')} value={regNo} onChangeText={setRegNo} placeholder="e.g. 202301012345 (1234567-A)" autoCapitalize="characters" help="Shown on audit reports." />
          <Field label={tr('profile.tin')} value={tin} onChangeText={setTin} autoCapitalize="characters" help="Optional. Needed later for LHDN MyInvois e-Invoicing." />
          <Field label={tr('profile.sst')} value={sst} onChangeText={setSst} autoCapitalize="characters" />
          <Field label={tr('profile.address')} value={address} onChangeText={setAddress} multiline />
        </>
      ) : null}
      <Field label={tr('profile.currency')} value={currency} onChangeText={(s) => setCurrency(s.toUpperCase().slice(0, 3))} autoCapitalize="characters" help="Ringgit Malaysia (MYR) is the default. Foreign-currency receipts are converted with the rate you enter." />
      <Field label={tr('profile.retention')} value={retention} onChangeText={setRetention} keyboardType="number-pad" help="Malaysian default is 7 years. Records are kept for at least this long." />
      {business ? <SwitchRow title={tr('profile.approval')} subtitle="Employee claims need a finance manager or approver before they count." value={approval} onValueChange={setApproval} /> : null}
      <Button title={tr('profile.save')} loading={busy} disabled={!name.trim()} onPress={save} style={{ marginTop: spacing.lg }} />
      <Text variant="footnote" color={t.textSubtle} style={{ marginTop: spacing.md }}>You will be the owner of this {business ? 'company' : 'profile'}. Data is kept strictly separate from your other profiles.</Text>
    </Screen>
  );
}
