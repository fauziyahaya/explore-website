import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { defaultCategories, type Budget, type Category, type Dimension, type Member, type Role, type Transaction, type UserProfile, type Workspace } from '@smartspend/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  OAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  // @ts-expect-error — exported from the React Native build of firebase/auth
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { getDownloadURL, getStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import { BackendError, type Backend, type CreateWorkspaceInput, type ExtractResult, type ReportFormat, type SaveResult, type Session, type WorkspaceSnapshot } from './backend';
import { firebaseConfig, googleConfig } from './config';

/** Offline outbox: saves made without connectivity are replayed (idempotently) when back online. */
interface OutboxItem {
  id: string;
  workspaceId: string;
  tx: Transaction;
  intent: 'draft' | 'save';
  localUri?: string;
  contentType?: string;
  queuedAt: string;
  lastError?: string;
}
const OUTBOX_KEY = 'smartspend.outbox.v1';

function mapError(e: unknown): BackendError {
  const err = e as { code?: string; message?: string; details?: Record<string, unknown> };
  const code = String(err.code ?? 'unknown').replace(/^functions\//, '').replace(/^auth\//, 'auth/');
  const friendly: Record<string, string> = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
    'auth/weak-password': 'Please choose a stronger password (at least 8 characters).',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/network-request-failed': 'No internet connection. Please try again when you are online.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/requires-recent-login': 'For your security, please sign in again and retry.',
    unavailable: 'The service is temporarily unavailable. Please try again.',
    'deadline-exceeded': 'This is taking longer than usual. Please try again.',
  };
  return new BackendError(friendly[code] ?? err.message ?? 'Something went wrong.', code, err.details);
}

export class FirebaseBackend implements Backend {
  readonly mode = 'firebase' as const;
  private app: FirebaseApp;
  private auth: Auth;
  private db: Firestore;
  private storage: FirebaseStorage;
  private fns: Functions;
  private online = true;
  private outboxListeners = new Set<() => void>();

  constructor() {
    this.app = getApps()[0] ?? initializeApp(firebaseConfig()!);
    try {
      this.auth = initializeAuth(this.app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      this.auth = getAuth(this.app);
    }
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
    this.fns = getFunctions(this.app, 'asia-southeast1');
    NetInfo.addEventListener((s) => {
      const was = this.online;
      this.online = !!s.isConnected && s.isInternetReachable !== false;
      if (!was && this.online) this.flushOutbox().catch(() => undefined);
    });
  }

  private call<T>(name: string, data: unknown): Promise<T> {
    return httpsCallable<unknown, T>(this.fns, name, { timeout: 120_000 })(data).then((r) => r.data, (e) => { throw mapError(e); });
  }

  // ───────────── Auth ─────────────
  onAuthChange(cb: (s: Session | null) => void) {
    return onAuthStateChanged(this.auth, (u) => {
      if (!u) return cb(null);
      const pid = u.providerData[0]?.providerId;
      cb({ uid: u.uid, email: u.email, displayName: u.displayName ?? u.email ?? 'You', emailVerified: u.emailVerified, provider: pid === 'apple.com' ? 'apple' : pid === 'google.com' ? 'google' : 'password' });
      if (u.emailVerified) this.call('acceptInvites', {}).catch(() => undefined);
    });
  }
  async signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(this.auth, email.trim(), password).catch((e) => { throw mapError(e); });
  }
  async register(name: string, email: string, password: string) {
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await sendEmailVerification(cred.user).catch(() => undefined);
    } catch (e) {
      throw mapError(e);
    }
  }
  async resetPassword(email: string) {
    // Same message regardless of whether the account exists (prevents account enumeration).
    await sendPasswordResetEmail(this.auth, email.trim()).catch(() => undefined);
  }
  async signInWithApple() {
    const rawNonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const res = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce: hashed });
    if (!res.identityToken) throw new BackendError('Apple sign-in did not return a token.', 'auth/apple');
    const credential = new OAuthProvider('apple.com').credential({ idToken: res.identityToken, rawNonce });
    const { user } = await signInWithCredential(this.auth, credential).catch((e) => { throw mapError(e); });
    const name = [res.fullName?.givenName, res.fullName?.familyName].filter(Boolean).join(' ');
    if (name && !user.displayName) await updateProfile(user, { displayName: name });
  }
  private googleSignin() {
    try {
      // Native module — available in development / production builds (not Expo Go).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    } catch {
      throw new BackendError('Google Sign-In requires the SmartSpend development or App Store build.', 'unsupported');
    }
  }
  async signInWithGoogle() {
    const { GoogleSignin } = this.googleSignin();
    const g = googleConfig();
    GoogleSignin.configure({ webClientId: g.webClientId, iosClientId: g.iosClientId, offlineAccess: false });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success' || !res.data.idToken) return;
    await signInWithCredential(this.auth, GoogleAuthProvider.credential(res.data.idToken)).catch((e) => { throw mapError(e); });
  }
  async signOut() {
    await signOut(this.auth);
  }
  async deleteAccount() {
    await this.call('deleteMyAccount', { confirm: 'DELETE' });
    if (this.auth.currentUser) await deleteUser(this.auth.currentUser).catch(() => undefined);
    await AsyncStorage.removeItem(OUTBOX_KEY);
    await signOut(this.auth).catch(() => undefined);
  }
  async exportMyData() {
    return (await this.call<{ url: string }>('exportMyData', {})).url;
  }

  // ───────────── Profile & workspaces ─────────────
  async loadProfile(uid: string) {
    const s = await getDoc(doc(this.db, `users/${uid}`));
    return s.exists() ? ({ uid, ...s.data() } as UserProfile) : null;
  }
  async saveProfile(uid: string, patch: Partial<UserProfile>) {
    const { uid: _ignored, ...rest } = patch;
    void _ignored;
    await setDoc(doc(this.db, `users/${uid}`), JSON.parse(JSON.stringify(rest)), { merge: true });
  }
  async listWorkspaces(uid: string) {
    const ms = await getDocs(query(collectionGroup(this.db, 'members'), where('uid', '==', uid), where('active', '==', true)));
    const out: Array<{ workspace: Workspace; role: Role }> = [];
    for (const m of ms.docs) {
      const wid = m.ref.parent.parent!.id;
      const ws = await getDoc(doc(this.db, `workspaces/${wid}`)).catch(() => null);
      if (ws?.exists()) out.push({ workspace: { ...(ws.data() as Workspace), id: wid }, role: (m.data() as Member).role });
    }
    return out;
  }
  createWorkspace(input: CreateWorkspaceInput) {
    return this.call<Workspace>('createWorkspace', input);
  }
  async updateWorkspace(id: string, patch: Partial<Workspace>) {
    await updateDoc(doc(this.db, `workspaces/${id}`), JSON.parse(JSON.stringify(patch))).catch((e) => { throw mapError(e); });
  }

  subscribe(workspaceId: string, ctx: { uid: string; role: Role }, cb: (s: WorkspaceSnapshot) => void, onError: (e: Error) => void) {
    const snap: WorkspaceSnapshot = { transactions: [], customCategories: [], budgets: [], dimensions: [], members: [], audit: [], memory: null, pendingUploads: 0 };
    let server: Transaction[] = [];
    const emit = async () => {
      const outbox = (await this.readOutbox()).filter((o) => o.workspaceId === workspaceId);
      const queued = outbox.filter((o) => !server.some((s) => s.id === o.id)).map((o) => ({ ...o.tx, sync: { sheets: 'pending' as const, error: 'Waiting for connection' } }));
      cb({ ...snap, transactions: [...queued, ...server], pendingUploads: outbox.length });
    };
    const base = `workspaces/${workspaceId}`;
    const fullAccess = ['owner', 'finance_manager', 'approver', 'auditor'].includes(ctx.role);
    const txQuery = fullAccess
      ? query(collection(this.db, `${base}/transactions`), orderBy('date', 'desc'))
      : query(collection(this.db, `${base}/transactions`), where('createdBy', '==', ctx.uid), orderBy('date', 'desc'));
    const err = (e: Error) => onError(mapError(e));
    const unsubs = [
      onSnapshot(txQuery, (s) => { server = s.docs.map((d) => d.data() as Transaction); emit(); }, err),
      onSnapshot(collection(this.db, `${base}/categories`), (s) => { snap.customCategories = s.docs.map((d) => ({ ...(d.data() as Category), id: d.id })); emit(); }, err),
      onSnapshot(collection(this.db, `${base}/budgets`), (s) => { snap.budgets = s.docs.map((d) => ({ ...(d.data() as Budget), id: d.id })); emit(); }, err),
      onSnapshot(collection(this.db, `${base}/dimensions`), (s) => { snap.dimensions = s.docs.map((d) => ({ ...(d.data() as Dimension), id: d.id })); emit(); }, err),
      onSnapshot(collection(this.db, `${base}/members`), (s) => { snap.members = s.docs.map((d) => d.data() as Member); emit(); }, err),
      onSnapshot(doc(this.db, `${base}/meta/categoryMemory`), (s) => { snap.memory = (s.data() as WorkspaceSnapshot['memory']) ?? null; emit(); }, () => undefined),
    ];
    if (['owner', 'finance_manager', 'auditor'].includes(ctx.role)) {
      unsubs.push(onSnapshot(query(collection(this.db, `${base}/audit`), orderBy('sequence')), (s) => { snap.audit = s.docs.map((d) => d.data() as WorkspaceSnapshot['audit'][number]); emit(); }, err));
    }
    const onOutbox = () => emit();
    this.outboxListeners.add(onOutbox);
    return () => {
      unsubs.forEach((u) => u());
      this.outboxListeners.delete(onOutbox);
    };
  }

  // ───────────── Receipts & transactions ─────────────
  private async upload(workspaceId: string, localUri: string, contentType: string): Promise<string> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new BackendError('Please sign in again.', 'unauthenticated');
    const bytes = await new File(localUri).bytes();
    const ext = contentType === 'application/pdf' ? 'pdf' : contentType === 'image/png' ? 'png' : 'jpg';
    const path = `receipts/${workspaceId}/${uid}/${Crypto.randomUUID()}.${ext}`;
    await uploadBytes(ref(this.storage, path), bytes, { contentType });
    return path;
  }

  async extractReceipt(workspaceId: string, file: { uri: string; mimeType: string }): Promise<ExtractResult> {
    // Keep a durable local copy so an offline capture is never lost.
    const local = new File(Paths.document, `receipt-${Date.now()}.${file.mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`);
    new File(file.uri).copy(local);
    if (!this.online) {
      const { emptyExtraction } = await import('./emptyExtraction');
      return {
        extractionId: '', extraction: emptyExtraction(), duplicateImageOf: null, queuedOffline: true,
        receipt: { storagePath: '', localUri: local.uri, contentType: file.mimeType, sha256: '', uploadedAt: new Date().toISOString() },
        note: 'You are offline. Enter the key details now, or save and AI reading will run later.',
      };
    }
    try {
      const storagePath = await this.upload(workspaceId, local.uri, file.mimeType);
      const res = await this.call<Omit<ExtractResult, 'receipt'> & { receipt: { storagePath: string; contentType: string; sha256: string; sizeBytes: number } }>('extractReceipt', { workspaceId, storagePath });
      return { ...res, receipt: { ...res.receipt, localUri: local.uri, uploadedAt: new Date().toISOString() } };
    } catch (e) {
      throw e instanceof BackendError ? e : mapError(e);
    }
  }

  async saveTransaction(workspaceId: string, tx: Transaction, opts: { intent: 'draft' | 'save'; allowDuplicate?: boolean; duplicateReason?: string }): Promise<SaveResult> {
    if (!this.online || (tx.receipt?.localUri && !tx.receipt.storagePath)) {
      await this.enqueue({ id: tx.id, workspaceId, tx, intent: opts.intent, localUri: tx.receipt?.localUri, contentType: tx.receipt?.contentType, queuedAt: new Date().toISOString() });
      if (this.online) this.flushOutbox().catch(() => undefined);
      return { transaction: { ...tx, status: opts.intent === 'save' ? 'submitted' : 'draft' }, queuedOffline: true };
    }
    return this.call<SaveResult>('saveTransaction', { workspaceId, transaction: stripForServer(tx), intent: opts.intent, allowDuplicate: opts.allowDuplicate, duplicateReason: opts.duplicateReason });
  }
  async reviewTransaction(workspaceId: string, transactionId: string, decision: 'approve' | 'reject', reason?: string) {
    await this.call('reviewTransaction', { workspaceId, transactionId, decision, reason });
  }
  async amendTransaction(workspaceId: string, transactionId: string, patch: Partial<Transaction>, reason: string) {
    return (await this.call<{ amended: Transaction }>('amendTransaction', { workspaceId, transactionId, patch, reason })).amended;
  }
  async deleteDraft(workspaceId: string, transactionId: string) {
    const ob = await this.readOutbox();
    if (ob.some((o) => o.id === transactionId)) return this.writeOutbox(ob.filter((o) => o.id !== transactionId));
    await this.call('deleteDraft', { workspaceId, transactionId });
  }
  async receiptUrl(path: string) {
    if (!path) return null;
    return getDownloadURL(ref(this.storage, path)).catch(() => null);
  }

  // ───────────── Configuration collections (rules enforce roles) ─────────────
  async saveCategory(wid: string, c: Category) { await setDoc(doc(this.db, `workspaces/${wid}/categories/${c.id}`), JSON.parse(JSON.stringify(c))).catch((e) => { throw mapError(e); }); }
  async saveBudget(wid: string, b: Budget) { await setDoc(doc(this.db, `workspaces/${wid}/budgets/${b.id}`), JSON.parse(JSON.stringify(b))).catch((e) => { throw mapError(e); }); }
  async deleteBudget(wid: string, id: string) { await deleteDoc(doc(this.db, `workspaces/${wid}/budgets/${id}`)).catch((e) => { throw mapError(e); }); }
  async saveDimension(wid: string, d: Dimension) { await setDoc(doc(this.db, `workspaces/${wid}/dimensions/${d.id}`), JSON.parse(JSON.stringify(d))).catch((e) => { throw mapError(e); }); }
  async inviteMember(workspaceId: string, email: string, role: Role, departmentId?: string | null) { await this.call('inviteMember', { workspaceId, email, role, departmentId }); }
  async setMemberRole(workspaceId: string, uid: string, role: Role | null) { await this.call('setMemberRole', { workspaceId, uid, role }); }

  async generateReport(workspaceId: string, type: string, range: { from: string; to: string }, format: ReportFormat, reviewedByUid?: string | null) {
    return this.call<{ url: string; reference: string }>('generateReport', { workspaceId, type, from: range.from, to: range.to, format, reviewedByUid });
  }

  // ───────────── Google Sheets (separate from app login) ─────────────
  async connectGoogle() {
    const { GoogleSignin } = this.googleSignin();
    const g = googleConfig();
    GoogleSignin.configure({ webClientId: g.webClientId, iosClientId: g.iosClientId, offlineAccess: true, forceCodeForRefreshToken: true, scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'] });
    await GoogleSignin.signOut().catch(() => undefined);
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') throw new BackendError('Google connection was cancelled.', 'cancelled');
    if (!res.data.serverAuthCode) throw new BackendError('Google did not provide authorisation. Please try again.', 'auth/google');
    return this.call<{ email: string | null }>('connectGoogleAccount', { serverAuthCode: res.data.serverAuthCode });
  }
  async disconnectGoogle() {
    await this.call('disconnectGoogleAccount', {});
    try {
      await this.googleSignin().GoogleSignin.revokeAccess();
    } catch {
      /* not signed in natively */
    }
  }
  async linkSpreadsheet(workspaceId: string) { return this.call<{ spreadsheetUrl: string }>('linkSpreadsheet', { workspaceId }); }
  async unlinkSpreadsheet(workspaceId: string) { await this.call('unlinkSpreadsheet', { workspaceId }); }
  async syncSheetsNow(workspaceId: string) { await this.call('syncSheetsNow', { workspaceId }); }

  // ───────────── Outbox ─────────────
  private async readOutbox(): Promise<OutboxItem[]> {
    try {
      return JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) ?? '[]') as OutboxItem[];
    } catch {
      return [];
    }
  }
  private async writeOutbox(items: OutboxItem[]) {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
    this.outboxListeners.forEach((f) => f());
  }
  private async enqueue(item: OutboxItem) {
    const items = (await this.readOutbox()).filter((o) => o.id !== item.id);
    await this.writeOutbox([...items, item]);
  }
  private flushing: Promise<number> | null = null;
  flushOutbox(): Promise<number> {
    this.flushing ??= (async () => {
      let items = await this.readOutbox();
      for (const item of [...items]) {
        if (!this.online) break;
        try {
          let tx = item.tx;
          if (item.localUri && !tx.receipt?.storagePath) {
            const storagePath = await this.upload(item.workspaceId, item.localUri, item.contentType ?? 'image/jpeg');
            const ex = await this.call<{ receipt: { sha256: string; sizeBytes: number } }>('extractReceipt', { workspaceId: item.workspaceId, storagePath }).catch(() => null);
            tx = { ...tx, receipt: { storagePath, contentType: item.contentType ?? 'image/jpeg', sha256: ex?.receipt.sha256 ?? '', uploadedAt: new Date().toISOString(), localUri: item.localUri } };
          }
          // Same client id → server treats a replay as idempotent.
          await this.call('saveTransaction', { workspaceId: item.workspaceId, transaction: stripForServer(tx), intent: item.intent, allowDuplicate: false });
          items = items.filter((o) => o.id !== item.id);
        } catch (e) {
          const be = e instanceof BackendError ? e : mapError(e);
          if (be.code === 'already-exists' || be.code === 'invalid-argument') {
            // Needs user attention: keep it as a local draft with the reason.
            items = items.map((o) => (o.id === item.id ? { ...o, lastError: be.message, intent: 'draft' } : o));
          } else {
            items = items.map((o) => (o.id === item.id ? { ...o, lastError: be.message } : o));
          }
        }
      }
      await this.writeOutbox(items);
      return items.length;
    })().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }
}

/** Remove client-only fields before sending to the callable (server re-derives status, audit, sync…). */
function stripForServer(tx: Transaction) {
  const { status, fingerprint, createdBy, createdAt, updatedAt, approvedBy, approvedAt, submittedAt, rejectedReason, version, amendsTransactionId, supersededBy, amendmentReason, sync, isSample, workspaceId, baseTotal, ...rest } = tx;
  void [status, fingerprint, createdBy, createdAt, updatedAt, approvedBy, approvedAt, submittedAt, rejectedReason, version, amendsTransactionId, supersededBy, amendmentReason, sync, isSample, workspaceId, baseTotal];
  const receipt = rest.receipt && rest.receipt.storagePath ? { storagePath: rest.receipt.storagePath, contentType: rest.receipt.contentType, sha256: rest.receipt.sha256, sizeBytes: rest.receipt.sizeBytes } : null;
  return JSON.parse(JSON.stringify({ ...rest, receipt: receipt && /^[a-f0-9]{64}$/.test(receipt.sha256) ? receipt : null }));
}

export const isIOS = Platform.OS === 'ios';
export { defaultCategories };
