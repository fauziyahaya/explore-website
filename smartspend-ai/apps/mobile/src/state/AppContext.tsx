import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultCategories, translate, type Category, type Locale, type Role, type StringKey, type UserProfile, type Workspace } from '@smartspend/core';
import { getLocales } from 'expo-localization';
import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Backend, Session, WorkspaceSnapshot } from '../services/backend';
import { isBackendConfigured } from '../services/config';
import { DemoBackend } from '../services/demoBackend';

type Appearance = 'system' | 'light' | 'dark';

interface Prefs {
  onboarded: boolean;
  locale: Locale;
  appearance: Appearance;
  mode: 'demo' | 'firebase';
  lastWorkspaceId?: string;
}

interface AppValue {
  ready: boolean;
  backend: Backend;
  demo: DemoBackend;
  session: Session | null;
  profile: UserProfile | null;
  workspaces: Array<{ workspace: Workspace; role: Role }>;
  workspacesLoaded: boolean;
  workspace: Workspace | null;
  role: Role | null;
  data: WorkspaceSnapshot | null;
  dataError: string | null;
  categories: Category[];
  locale: Locale;
  appearance: Appearance;
  onboarded: boolean;
  locked: boolean;
  t: (k: StringKey) => string;
  setLocale: (l: Locale) => void;
  setAppearance: (a: Appearance) => void;
  completeOnboarding: () => void;
  startDemo: () => Promise<void>;
  useRealAccount: () => void;
  selectWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  saveProfile: (patch: Partial<UserProfile>) => Promise<void>;
  setBiometricLock: (on: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppValue | null>(null);
const PREFS_KEY = 'smartspend.prefs.v1';

const demo = new DemoBackend();
let firebase: Backend | null = null;
function firebaseBackend(): Backend | null {
  if (!isBackendConfigured()) return null;
  if (!firebase) {
    // Lazy so the demo works in Expo Go without native Google Sign-In.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FirebaseBackend } = require('../services/firebaseBackend') as typeof import('../services/firebaseBackend');
    firebase = new FirebaseBackend();
  }
  return firebase;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const deviceLocale: Locale = getLocales()[0]?.languageCode === 'ms' ? 'ms' : 'en';
  const [prefs, setPrefs] = useState<Prefs>({ onboarded: false, locale: deviceLocale, appearance: 'system', mode: isBackendConfigured() ? 'firebase' : 'demo' });
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<Array<{ workspace: Workspace; role: Role }>>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspacesLoaded, setWorkspacesLoaded] = useState(false);
  const [data, setData] = useState<WorkspaceSnapshot | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  const backend: Backend = prefs.mode === 'firebase' ? firebaseBackend() ?? demo : demo;

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => raw && setPrefs((p) => ({ ...p, ...(JSON.parse(raw) as Partial<Prefs>), ...(isBackendConfigured() ? {} : { mode: 'demo' as const }) })))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);
  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    if (!session) return;
    const list = await backend.listWorkspaces(session.uid).finally(() => setWorkspacesLoaded(true));
    setWorkspaces(list);
    setWorkspaceId((cur) => (cur && list.some((w) => w.workspace.id === cur) ? cur : prefs.lastWorkspaceId && list.some((w) => w.workspace.id === prefs.lastWorkspaceId) ? prefs.lastWorkspaceId : list[0]?.workspace.id ?? null));
  }, [backend, session, prefs.lastWorkspaceId]);

  // Auth
  useEffect(() => {
    if (!ready) return;
    return backend.onAuthChange(async (s) => {
      setSession(s);
      setWorkspacesLoaded(false);
      if (!s) {
        setProfile(null);
        setWorkspaces([]);
        setWorkspaceId(null);
        setData(null);
        return;
      }
      const p = await backend.loadProfile(s.uid).catch(() => null);
      setProfile(p);
      if (p?.biometricLock) setLocked(true);
      if (p?.locale) updatePrefs({ locale: p.locale });
    });
  }, [backend, ready, updatePrefs]);

  useEffect(() => {
    refreshWorkspaces().catch(() => undefined);
  }, [refreshWorkspaces]);

  const current = workspaces.find((w) => w.workspace.id === workspaceId) ?? null;

  // Live data subscription for the selected workspace
  useEffect(() => {
    if (!session || !current) return;
    setData(null);
    setDataError(null);
    return backend.subscribe(current.workspace.id, { uid: session.uid, role: current.role }, (s) => setData(s), (e) => setDataError(e.message));
  }, [backend, session, current?.workspace.id, current?.role]);

  // Re-lock with Face ID after 60s in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') backgroundAt.current = Date.now();
      if (st === 'active' && profile?.biometricLock && backgroundAt.current && Date.now() - backgroundAt.current > 60_000) setLocked(true);
    });
    return () => sub.remove();
  }, [profile?.biometricLock]);

  const categories = useMemo(() => {
    if (!current) return [];
    const custom = data?.customCategories ?? [];
    const ids = new Set(custom.map((c) => c.id));
    return [...defaultCategories(current.workspace.type).filter((c) => !ids.has(c.id)), ...custom].filter((c) => !c.archived);
  }, [current, data?.customCategories]);

  const unlock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: translate(prefs.locale, 'auth.unlock'), fallbackLabel: 'Use passcode' });
    if (res.success) setLocked(false);
    return res.success;
  }, [prefs.locale]);

  const value: AppValue = {
    ready,
    backend,
    demo,
    session,
    profile,
    workspaces,
    workspacesLoaded,
    workspace: current?.workspace ?? null,
    role: current?.role ?? null,
    data,
    dataError,
    categories,
    locale: prefs.locale,
    appearance: prefs.appearance,
    onboarded: prefs.onboarded,
    locked: locked && !!session,
    t: (k) => translate(prefs.locale, k),
    setLocale: (l) => {
      updatePrefs({ locale: l });
      if (session) backend.saveProfile(session.uid, { locale: l }).catch(() => undefined);
    },
    setAppearance: (a) => updatePrefs({ appearance: a }),
    completeOnboarding: () => updatePrefs({ onboarded: true }),
    startDemo: async () => {
      updatePrefs({ mode: 'demo', onboarded: true });
      await demo.startDemo();
    },
    useRealAccount: () => {
      if (isBackendConfigured()) updatePrefs({ mode: 'firebase' });
    },
    selectWorkspace: (id) => {
      setWorkspaceId(id);
      updatePrefs({ lastWorkspaceId: id });
    },
    refreshWorkspaces,
    saveProfile: async (patch) => {
      if (!session) return;
      await backend.saveProfile(session.uid, patch);
      setProfile((p) => ({ ...(p ?? ({ uid: session.uid, displayName: session.displayName, email: session.email ?? '', locale: prefs.locale, biometricLock: false, createdAt: new Date().toISOString(), consents: [] } as UserProfile)), ...patch }));
    },
    setBiometricLock: async (on) => {
      if (on) {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHw || !enrolled) return false;
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable Face ID for SmartSpend AI' });
        if (!res.success) return false;
      }
      await value.saveProfile({ biometricLock: on });
      return true;
    },
    unlock,
    signOut: async () => {
      await backend.signOut();
      if (backend.mode === 'demo' && isBackendConfigured()) updatePrefs({ mode: 'firebase' });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
