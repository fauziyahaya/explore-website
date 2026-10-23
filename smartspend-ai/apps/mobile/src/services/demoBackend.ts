import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  amendTransaction,
  appendAuditEvent,
  assertTransition,
  auditInput,
  buildMemory,
  buildReport,
  defaultCategories,
  diff,
  finaliseDraft,
  learnFromTransaction,
  newId,
  normaliseAiReceipt,
  parseOcrText,
  reportToCsv,
  reportToHtml,
  SAMPLE_BUSINESS_ID,
  SAMPLE_PERSONAL_ID,
  SAMPLE_RECEIPT_TEXTS,
  SAMPLE_UID,
  sampleBudgets,
  sampleBusinessDimensions,
  sampleBusinessMembers,
  sampleBusinessTransactions,
  sampleBusinessWorkspace,
  samplePersonalTransactions,
  samplePersonalWorkspace,
  sha256Hex,
  validateForSave,
  WorkflowError,
  type AuditEvent,
  type Budget,
  type Category,
  type CategoryMemory,
  type Dimension,
  type Member,
  type Role,
  type Transaction,
  type UserProfile,
  type Workspace,
} from '@smartspend/core';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { BackendError, type Backend, type Session, type WorkspaceSnapshot } from './backend';
import { todayLocal } from './dates';

/**
 * Offline demo backend with clearly-flagged SAMPLE data. All workflows
 * (validation, duplicate prevention, approvals, amendments, audit chain) run
 * on-device through @smartspend/core so the app is fully explorable without
 * any credentials. Nothing here is ever sent to a server.
 */

const KEY = 'smartspend.demo.v1';

interface WsState {
  workspace: Workspace;
  transactions: Transaction[];
  customCategories: Category[];
  budgets: Budget[];
  dimensions: Dimension[];
  members: Member[];
  audit: AuditEvent[];
  fingerprints: Record<string, string>;
}

interface DemoState {
  session: Session | null;
  profile: UserProfile | null;
  /** Lets the demo user act as another role to try approvals. */
  actingUid: string;
  workspaces: Record<string, WsState>;
}

function seed(): DemoState {
  const today = todayLocal();
  const mk = (workspace: Workspace, transactions: Transaction[], extra: Partial<WsState>): WsState => {
    const audit: AuditEvent[] = [];
    for (const t of transactions) audit.push(appendAuditEvent(audit, auditInput(t, 'created', t.createdBy, t.createdAt)));
    return {
      workspace,
      transactions,
      customCategories: [],
      budgets: [],
      dimensions: [],
      members: [],
      audit,
      fingerprints: Object.fromEntries(transactions.map((t) => [t.fingerprint, t.id])),
      ...extra,
    };
  };
  const at = new Date().toISOString();
  return {
    session: null,
    profile: null,
    actingUid: SAMPLE_UID,
    workspaces: {
      [SAMPLE_PERSONAL_ID]: mk(samplePersonalWorkspace(at), samplePersonalTransactions(today), {
        budgets: sampleBudgets(SAMPLE_PERSONAL_ID, 'personal'),
        members: [{ uid: SAMPLE_UID, workspaceId: SAMPLE_PERSONAL_ID, role: 'owner', displayName: 'Demo User', email: 'demo@example.com', joinedAt: at, active: true }],
      }),
      [SAMPLE_BUSINESS_ID]: mk(sampleBusinessWorkspace(at), sampleBusinessTransactions(today), {
        budgets: sampleBudgets(SAMPLE_BUSINESS_ID, 'business'),
        dimensions: sampleBusinessDimensions(),
        members: sampleBusinessMembers(),
      }),
    },
  };
}

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const;
  private state: DemoState | null = null;
  private authListeners = new Set<(s: Session | null) => void>();
  private wsListeners = new Map<string, Set<() => void>>();
  private demoScanCount = 0;

  private async load(): Promise<DemoState> {
    if (this.state) return this.state;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      this.state = raw ? (JSON.parse(raw) as DemoState) : seed();
    } catch {
      this.state = seed();
    }
    return this.state;
  }
  private async persist() {
    if (this.state) await AsyncStorage.setItem(KEY, JSON.stringify(this.state)).catch(() => undefined);
  }
  private ws(id: string): WsState {
    const w = this.state?.workspaces[id];
    if (!w) throw new BackendError('Workspace not found', 'not-found');
    return w;
  }
  private emit(id: string) {
    this.wsListeners.get(id)?.forEach((f) => f());
  }
  private actor(w: WsState): { uid: string; role: Role } {
    const uid = this.state!.actingUid;
    const m = w.members.find((x) => x.uid === uid) ?? w.members.find((x) => x.uid === SAMPLE_UID);
    return { uid: m?.uid ?? SAMPLE_UID, role: m?.role ?? 'owner' };
  }

  /** Demo-only: act as another sample member (e.g. employee → submit, finance → approve). */
  async setActingUser(uid: string) {
    const s = await this.load();
    s.actingUid = uid;
    await this.persist();
    Object.keys(s.workspaces).forEach((id) => this.emit(id));
    this.authListeners.forEach((f) => f(s.session ? { ...s.session, uid } : null));
  }
  async resetDemo() {
    const session = (await this.load()).session;
    this.state = { ...seed(), session };
    await this.persist();
    Object.keys(this.state.workspaces).forEach((id) => this.emit(id));
  }

  onAuthChange(cb: (s: Session | null) => void) {
    this.authListeners.add(cb);
    this.load().then((s) => cb(s.session ? { ...s.session, uid: s.actingUid } : null));
    return () => this.authListeners.delete(cb);
  }
  async startDemo() {
    const s = await this.load();
    s.session = { uid: SAMPLE_UID, email: 'demo@example.com', displayName: 'Demo User', emailVerified: true, provider: 'demo' };
    s.profile ??= { uid: SAMPLE_UID, displayName: 'Demo User', email: 'demo@example.com', locale: 'en', biometricLock: false, createdAt: new Date().toISOString(), consents: [], defaultWorkspaceId: SAMPLE_PERSONAL_ID };
    await this.persist();
    this.authListeners.forEach((f) => f({ ...s.session!, uid: s.actingUid }));
  }
  private notConfigured(): never {
    throw new BackendError('Sign-in needs the SmartSpend backend. Add your Firebase configuration (see docs/SETUP.md) or explore with sample data.', 'not-configured');
  }
  async signInWithEmail() { this.notConfigured(); }
  async register() { this.notConfigured(); }
  async resetPassword() { this.notConfigured(); }
  async signInWithApple() { this.notConfigured(); }
  async signInWithGoogle() { this.notConfigured(); }
  async signOut() {
    const s = await this.load();
    s.session = null;
    await this.persist();
    this.authListeners.forEach((f) => f(null));
  }
  async deleteAccount() {
    await AsyncStorage.removeItem(KEY);
    this.state = null;
    this.authListeners.forEach((f) => f(null));
  }
  async exportMyData() {
    const s = await this.load();
    const file = new File(Paths.cache, `smartspend-demo-export-${Date.now()}.json`);
    file.write(JSON.stringify({ note: 'SAMPLE DATA export', profile: s.profile, workspaces: s.workspaces }, null, 2));
    return file.uri;
  }

  async loadProfile() { return (await this.load()).profile; }
  async saveProfile(_uid: string, patch: Partial<UserProfile>) {
    const s = await this.load();
    s.profile = { ...(s.profile as UserProfile), ...patch };
    await this.persist();
  }
  async listWorkspaces() {
    const s = await this.load();
    return Object.values(s.workspaces).map((w) => ({ workspace: w.workspace, role: this.actor(w).role }));
  }
  async createWorkspace(): Promise<Workspace> {
    throw new BackendError('Creating real workspaces requires the SmartSpend backend. The demo includes a sample personal and business workspace.', 'not-configured');
  }
  async updateWorkspace(id: string, patch: Partial<Workspace>) {
    await this.load();
    const w = this.ws(id);
    w.workspace = { ...w.workspace, ...patch, id, isSample: true };
    await this.persist();
    this.emit(id);
  }
  subscribe(workspaceId: string, _ctx: { uid: string; role: Role }, cb: (s: WorkspaceSnapshot) => void, onError: (e: Error) => void) {
    const push = () => {
      try {
        const w = this.ws(workspaceId);
        const { uid, role } = this.actor(w);
        const visible = ['owner', 'finance_manager', 'approver', 'auditor'].includes(role) ? w.transactions : w.transactions.filter((t) => t.createdBy === uid);
        cb({
          transactions: [...visible].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
          customCategories: w.customCategories,
          budgets: w.budgets,
          dimensions: w.dimensions,
          members: w.members,
          audit: ['owner', 'finance_manager', 'auditor'].includes(role) ? w.audit : [],
          memory: buildMemory(w.transactions),
          pendingUploads: 0,
        });
      } catch (e) {
        onError(e as Error);
      }
    };
    const set = this.wsListeners.get(workspaceId) ?? new Set();
    set.add(push);
    this.wsListeners.set(workspaceId, set);
    this.load().then(push);
    return () => set.delete(push);
  }

  async extractReceipt(workspaceId: string, file: { uri: string; mimeType: string }) {
    await this.load();
    const w = this.ws(workspaceId);
    let sha = sha256Hex(`${file.uri}|${Date.now()}`);
    try {
      sha = sha256Hex(await new File(file.uri).bytes());
    } catch {
      /* simulator / unsupported uri — fall back to a unique id */
    }
    const dup = w.transactions.find((t) => t.receipt?.sha256 === sha && t.status !== 'superseded');
    const keys = Object.keys(SAMPLE_RECEIPT_TEXTS);
    const sample = SAMPLE_RECEIPT_TEXTS[keys[this.demoScanCount++ % keys.length]!]!;
    const extraction = normaliseAiReceipt(parseOcrText(sample), { model: 'demo (sample receipt text)', today: todayLocal(), defaultCurrency: w.workspace.baseCurrency });
    return {
      extractionId: newId('ext'),
      extraction,
      receipt: { storagePath: `local/${sha.slice(0, 16)}`, localUri: file.uri, contentType: file.mimeType, sha256: sha, uploadedAt: new Date().toISOString() },
      duplicateImageOf: dup?.id ?? null,
      note: 'Demo mode: a sample Malaysian receipt is shown instead of reading your photo. Connect the SmartSpend backend for real AI extraction.',
    };
  }

  async saveTransaction(workspaceId: string, input: Transaction, opts: { intent: 'draft' | 'save'; allowDuplicate?: boolean; duplicateReason?: string }) {
    await this.load();
    const w = this.ws(workspaceId);
    const { uid, role } = this.actor(w);
    const now = new Date().toISOString();
    const existing = w.transactions.find((t) => t.id === input.id) ?? null;
    let tx = finaliseDraft({ ...input, workspaceId, isSample: true, createdBy: existing?.createdBy ?? uid, createdAt: existing?.createdAt ?? now, updatedAt: now, version: existing?.version ?? 1, sync: { sheets: 'not_connected' } }, w.workspace.baseCurrency);
    if (existing && existing.fingerprint === tx.fingerprint && !['draft', 'rejected'].includes(existing.status)) return { transaction: existing, idempotentReplay: true };
    if (existing && !['draft', 'rejected'].includes(existing.status)) throw new BackendError('Submitted or approved records cannot be edited. Use an amendment instead.', 'failed-precondition');
    const v = validateForSave(tx, todayLocal());
    if (!v.ok) throw new BackendError(v.errors.join(' '), 'invalid-argument');
    const dupOf = w.fingerprints[tx.fingerprint];
    if (dupOf && dupOf !== tx.id && !opts.allowDuplicate) throw new BackendError('This receipt appears to have been recorded already.', 'already-exists', { duplicateOf: dupOf });
    let target: Transaction['status'] = 'draft';
    if (opts.intent === 'save') target = w.workspace.type === 'personal' || !w.workspace.approvalRequired || role === 'owner' ? 'approved' : 'submitted';
    try {
      if (target !== 'draft') assertTransition(existing?.status === 'rejected' && target === 'approved' ? 'draft' : existing?.status ?? 'draft', target, { role, isCreator: tx.createdBy === uid, workspaceType: w.workspace.type, approvalRequired: w.workspace.approvalRequired });
    } catch (e) {
      if (e instanceof WorkflowError) throw new BackendError(e.message, 'failed-precondition');
      throw e;
    }
    tx = { ...tx, status: target, submittedAt: target === 'submitted' ? now : null, approvedBy: target === 'approved' ? uid : null, approvedAt: target === 'approved' ? now : null };
    w.transactions = existing ? w.transactions.map((t) => (t.id === tx.id ? tx : t)) : [tx, ...w.transactions];
    if (!dupOf) w.fingerprints[tx.fingerprint] = tx.id;
    w.audit.push(appendAuditEvent(w.audit, auditInput(tx, existing ? 'updated' : 'created', uid, now, diff(existing as never, tx as never), dupOf && dupOf !== tx.id ? `Saved despite possible duplicate of ${dupOf}: ${opts.duplicateReason ?? ''}` : undefined)));
    if (target !== 'draft') w.audit.push(appendAuditEvent(w.audit, auditInput(tx, target === 'approved' ? 'approved' : 'submitted', uid, now, [], undefined, `${tx.id}_${target}_${now}`)));
    await this.persist();
    this.emit(workspaceId);
    return { transaction: tx, duplicateOf: dupOf && dupOf !== tx.id ? dupOf : undefined };
  }

  async reviewTransaction(workspaceId: string, id: string, decision: 'approve' | 'reject', reason?: string) {
    await this.load();
    const w = this.ws(workspaceId);
    const { uid, role } = this.actor(w);
    const tx = w.transactions.find((t) => t.id === id);
    if (!tx) throw new BackendError('Transaction not found', 'not-found');
    const to = decision === 'approve' ? 'approved' : 'rejected';
    try {
      assertTransition(tx.status, to, { role, isCreator: tx.createdBy === uid, workspaceType: w.workspace.type, approvalRequired: w.workspace.approvalRequired });
    } catch (e) {
      throw new BackendError((e as Error).message, 'failed-precondition');
    }
    if (to === 'rejected' && !reason?.trim()) throw new BackendError('A rejection reason is required.', 'invalid-argument');
    const now = new Date().toISOString();
    const next: Transaction = { ...tx, status: to, approvedBy: to === 'approved' ? uid : null, approvedAt: to === 'approved' ? now : null, rejectedReason: to === 'rejected' ? reason ?? null : null, updatedAt: now };
    w.transactions = w.transactions.map((t) => (t.id === id ? next : t));
    w.audit.push(appendAuditEvent(w.audit, auditInput(next, to, uid, now, [{ field: 'status', before: tx.status, after: to }], reason)));
    await this.persist();
    this.emit(workspaceId);
  }

  async amendTransaction(workspaceId: string, id: string, patch: Partial<Transaction>, reason: string) {
    await this.load();
    const w = this.ws(workspaceId);
    const { uid, role } = this.actor(w);
    const original = w.transactions.find((t) => t.id === id);
    if (!original) throw new BackendError('Transaction not found', 'not-found');
    const now = new Date().toISOString();
    try {
      const { superseded, amended, changes } = amendTransaction(original, patch, { actorUid: uid, reason, now, newId: newId('tx'), role });
      const final = finaliseDraft(amended, w.workspace.baseCurrency);
      w.transactions = [final, ...w.transactions.map((t) => (t.id === id ? superseded : t))];
      w.fingerprints[final.fingerprint] = final.id;
      w.audit.push(appendAuditEvent(w.audit, auditInput(final, 'amended', uid, now, changes, reason)));
      await this.persist();
      this.emit(workspaceId);
      return final;
    } catch (e) {
      throw new BackendError((e as Error).message, 'failed-precondition');
    }
  }

  async deleteDraft(workspaceId: string, id: string) {
    await this.load();
    const w = this.ws(workspaceId);
    const tx = w.transactions.find((t) => t.id === id);
    if (!tx) return;
    if (!['draft', 'rejected'].includes(tx.status)) throw new BackendError('Only drafts can be deleted. Approved records are retained for audit.', 'failed-precondition');
    w.transactions = w.transactions.filter((t) => t.id !== id);
    if (w.fingerprints[tx.fingerprint] === id) delete w.fingerprints[tx.fingerprint];
    w.audit.push(appendAuditEvent(w.audit, auditInput(tx, 'deleted', this.actor(w).uid, new Date().toISOString())));
    await this.persist();
    this.emit(workspaceId);
  }

  async receiptUrl(path: string) {
    await this.load();
    for (const w of Object.values(this.state!.workspaces)) {
      const t = w.transactions.find((x) => x.receipt?.storagePath === path);
      if (t?.receipt?.localUri) return t.receipt.localUri;
    }
    return null;
  }

  private async mutate(workspaceId: string, fn: (w: WsState) => void) {
    await this.load();
    fn(this.ws(workspaceId));
    await this.persist();
    this.emit(workspaceId);
  }
  saveCategory(wid: string, c: Category) { return this.mutate(wid, (w) => { w.customCategories = [...w.customCategories.filter((x) => x.id !== c.id), c]; }); }
  saveBudget(wid: string, b: Budget) { return this.mutate(wid, (w) => { w.budgets = [...w.budgets.filter((x) => x.id !== b.id), b]; }); }
  deleteBudget(wid: string, id: string) { return this.mutate(wid, (w) => { w.budgets = w.budgets.filter((x) => x.id !== id); }); }
  saveDimension(wid: string, d: Dimension) { return this.mutate(wid, (w) => { w.dimensions = [...w.dimensions.filter((x) => x.id !== d.id), d]; }); }
  inviteMember(wid: string, email: string, role: Role) {
    return this.mutate(wid, (w) => {
      const uid = `sample_${newId('u')}`;
      w.members.push({ uid, workspaceId: wid, role, displayName: email.split('@')[0]!, email, joinedAt: new Date().toISOString(), active: true });
    });
  }
  setMemberRole(wid: string, uid: string, role: Role | null) {
    return this.mutate(wid, (w) => { w.members = w.members.map((m) => (m.uid === uid ? (role ? { ...m, role, active: true } : { ...m, active: false }) : m)); });
  }

  async generateReport(workspaceId: string, type: Parameters<Backend['generateReport']>[1], range: { from: string; to: string }, format: Parameters<Backend['generateReport']>[3], reviewedByUid?: string | null) {
    await this.load();
    const w = this.ws(workspaceId);
    const doc = buildReport({
      type, workspace: w.workspace, range, transactions: w.transactions,
      categories: [...defaultCategories(w.workspace.type), ...w.customCategories], budgets: w.budgets, members: w.members,
      dimensionNames: Object.fromEntries(w.dimensions.map((d) => [d.id, d.name])), documentLinks: {},
      preparedByUid: this.actor(w).uid, reviewedByUid: reviewedByUid ?? null, generatedAt: new Date().toISOString(), sequence: w.audit.length,
    });
    if (format === 'csv') {
      const file = new File(Paths.cache, `${doc.reference}.csv`);
      file.write(`﻿${reportToCsv(doc)}`);
      return { url: file.uri, reference: doc.reference };
    }
    if (format !== 'pdf') throw new BackendError('XLSX, ZIP and Google Sheets exports are generated by the SmartSpend backend. PDF and CSV work offline.', 'not-configured');
    const { uri } = await Print.printToFileAsync({ html: reportToHtml(doc) });
    return { url: uri, reference: doc.reference };
  }

  async connectGoogle(): Promise<{ email: string | null }> { throw new BackendError('Google Sheets sync is not available for sample data. Sign in with a real account to connect Google.', 'not-configured'); }
  async disconnectGoogle() {}
  async linkSpreadsheet(): Promise<{ spreadsheetUrl: string }> { return this.connectGoogle() as never; }
  async unlinkSpreadsheet() {}
  async syncSheetsNow() {}
  async flushOutbox() { return 0; }

  /** Expose memory for tests / debugging. */
  async memory(workspaceId: string): Promise<CategoryMemory> {
    await this.load();
    return this.ws(workspaceId).transactions.reduce(learnFromTransaction, { merchants: {}, items: {} } as CategoryMemory);
  }
}
