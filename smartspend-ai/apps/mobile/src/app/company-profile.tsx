import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Banner, Button, Field, Screen, SwitchRow, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

export default function CompanyProfile() {
  const t = useTheme();
  const { workspace, backend, refreshWorkspaces, t: tr } = useApp();
  const [name, setName] = useState(workspace?.name ?? '');
  const [regNo, setRegNo] = useState(workspace?.registrationNumber ?? '');
  const [tin, setTin] = useState(workspace?.taxIdentificationNumber ?? '');
  const [sst, setSst] = useState(workspace?.sstRegistrationNumber ?? '');
  const [address, setAddress] = useState(workspace?.address ?? '');
  const [header, setHeader] = useState(workspace?.reportHeader ?? '');
  const [retention, setRetention] = useState(String(workspace?.retentionYears ?? 7));
  const [approval, setApproval] = useState(workspace?.approvalRequired ?? true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!workspace) return null;
  const business = workspace.type === 'business';
  return (
    <Screen edges={[]}>
      {msg ? <Banner tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Banner> : null}
      <Field label={business ? tr('profile.companyName') : 'Profile name'} value={name} onChangeText={setName} />
      {business ? (
        <>
          <Field label={tr('profile.regNo')} value={regNo} onChangeText={setRegNo} autoCapitalize="characters" />
          <Field label={tr('profile.tin')} value={tin} onChangeText={setTin} autoCapitalize="characters" help="Required for future LHDN MyInvois e-Invoice integration." />
          <Field label={tr('profile.sst')} value={sst} onChangeText={setSst} autoCapitalize="characters" />
          <Field label={tr('profile.address')} value={address} onChangeText={setAddress} multiline />
          <Field label="Report header" value={header} onChangeText={setHeader} placeholder="e.g. Management accounts — for internal use" />
          <SwitchRow title={tr('profile.approval')} value={approval} onValueChange={setApproval} />
        </>
      ) : null}
      <Field label={tr('profile.retention')} value={retention} onChangeText={setRetention} keyboardType="number-pad" />
      <Text variant="footnote" color={t.textSubtle} style={{ marginBottom: spacing.lg }}>Base currency: {workspace.baseCurrency} (fixed after creation so historical totals stay consistent).</Text>
      <Button title={tr('common.save')} onPress={async () => {
        try {
          await backend.updateWorkspace(workspace.id, { name, registrationNumber: regNo || undefined, taxIdentificationNumber: tin || undefined, sstRegistrationNumber: sst || undefined, address: address || undefined, reportHeader: header || undefined, retentionYears: Math.min(30, Math.max(1, Number(retention) || 7)), approvalRequired: approval });
          await refreshWorkspaces();
          setMsg({ ok: true, text: 'Saved.' });
        } catch (e) {
          setMsg({ ok: false, text: (e as Error).message });
        }
      }} />
    </Screen>
  );
}
