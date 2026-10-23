import { Redirect } from 'expo-router';
import { useApp } from '../state/AppContext';
import { Loading, Screen } from '../ui/components';

/** Entry gate: onboarding → sign in → account type / profile → main tabs. */
export default function Index() {
  const { ready, onboarded, session, workspaces, workspacesLoaded, workspace } = useApp();
  if (!ready) return <Screen scroll={false}><Loading /></Screen>;
  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!session) return <Redirect href="/login" />;
  if (!workspacesLoaded) return <Screen scroll={false}><Loading /></Screen>;
  if (!workspaces.length) return <Redirect href="/account-type" />;
  if (!workspace) return <Screen scroll={false}><Loading /></Screen>;
  return <Redirect href="/(tabs)" />;
}
