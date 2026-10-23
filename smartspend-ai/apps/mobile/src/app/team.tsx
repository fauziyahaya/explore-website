import { can, ROLE_LABELS, type Role } from '@smartspend/core';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Banner, Button, Card, Chip, ChipRow, Divider, Field, PickerSheet, Row, Screen, SectionHeader, Text } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

const ROLES: Role[] = ['finance_manager', 'approver', 'employee', 'auditor'];

export default function Team() {
  const t = useTheme();
  const { workspace, data, role, backend, demo, session, locale, t: tr } = useApp();
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('employee');
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  if (!workspace || !data) return null;
  const manage = can(role, 'member.manage');
  const members = data.members;

  const run = async (fn: () => Promise<void>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'success', text: ok });
    } catch (e) {
      setMsg({ tone: 'danger', text: (e as Error).message });
    }
  };

  return (
    <Screen edges={[]}>
      {msg ? <Banner tone={msg.tone} icon={msg.tone === 'success' ? 'check-circle' : 'alert'}>{msg.text}</Banner> : null}
      <SectionHeader title={`Members (${members.filter((m) => m.active).length})`} />
      <Card style={{ paddingVertical: spacing.xs }}>
        {members.map((m, i) => (
          <View key={m.uid}>
            {i ? <Divider /> : null}
            <Row icon="user" title={`${m.displayName}${m.uid === session?.uid ? ' (you)' : ''}`} subtitle={`${ROLE_LABELS[m.role][locale]}${m.active ? '' : ' · inactive'} · ${m.email}`}
              onPress={manage && m.role !== 'owner' ? () => setEditing(m.uid) : undefined} />
          </View>
        ))}
      </Card>

      {manage ? (
        <>
          <SectionHeader title={tr('team.invite')} />
          <Card>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <ChipRow>{ROLES.map((r) => <Chip key={r} label={ROLE_LABELS[r][locale]} selected={newRole === r} onPress={() => setNewRole(r)} />)}</ChipRow>
            <Button title={tr('team.invite')} icon="plus" style={{ marginTop: spacing.md }} disabled={!/.+@.+\..+/.test(email)} onPress={() => run(async () => { await backend.inviteMember(workspace.id, email, newRole); setEmail(''); }, `Invitation sent. ${email} joins when they sign in with a verified email.`)} />
          </Card>
        </>
      ) : <Banner>Only the business owner can manage team members.</Banner>}

      <SectionHeader title="What each role can do" />
      <Card style={{ gap: spacing.sm }}>
        {[
          ['owner', 'Everything, including team, company profile and Google Sheets.'],
          ['finance_manager', 'Record, approve and amend expenses; budgets; categories; reports; audit trail.'],
          ['approver', 'Review and approve or reject submitted claims; reports.'],
          ['employee', 'Snap receipts and submit claims. Sees only their own claims.'],
          ['auditor', 'Read-only access to all records, reports and the audit trail.'],
        ].map(([r, d]) => <Text key={r} variant="footnote"><Text variant="footnote" style={{ fontWeight: '600' }}>{ROLE_LABELS[r as Role][locale]}: </Text>{d}</Text>)}
        <Text variant="caption" color={t.textSubtle}>Permissions are enforced on the server, not only in the app.</Text>
      </Card>

      {backend.mode === 'demo' ? (
        <>
          <SectionHeader title="Demo: act as another member" />
          <Card style={{ paddingVertical: spacing.xs }}>
            {members.map((m, i) => <View key={m.uid}>{i ? <Divider /> : null}<Row title={m.displayName} subtitle={ROLE_LABELS[m.role][locale]} onPress={() => demo.setActingUser(m.uid).then(() => Alert.alert('Switched', `You are now acting as ${m.displayName}.`))} /></View>)}
          </Card>
        </>
      ) : null}

      <PickerSheet visible={!!editing} title="Change role" options={[...ROLES.map((r) => ({ value: r as string, label: ROLE_LABELS[r][locale] })), { value: '__remove', label: 'Remove from company', subtitle: 'Their past records are kept for audit' }]}
        value={members.find((m) => m.uid === editing)?.role} onSelect={(v) => editing && run(() => backend.setMemberRole(workspace.id, editing, v === '__remove' ? null : (v as Role)), 'Member updated.')} onClose={() => setEditing(null)} />
    </Screen>
  );
}
