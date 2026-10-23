import { sha256Hex, transactionFingerprint } from './duplicates';
import type { AuditAction, AuditEvent, ISOTimestamp, Role, Transaction, TransactionStatus } from './types';

export const GENESIS_HASH = '0'.repeat(64);

/** Deterministic JSON (sorted keys) so hashes are reproducible across platforms. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function hashEvent(e: Omit<AuditEvent, 'hash'>): string {
  return sha256Hex(`${e.prevHash}|${canonicalJson({ ...e, prevHash: undefined })}`);
}

export function appendAuditEvent(
  chain: AuditEvent[],
  input: Omit<AuditEvent, 'hash' | 'prevHash' | 'sequence'>,
): AuditEvent {
  const prev = chain[chain.length - 1];
  const draft = { ...input, sequence: (prev?.sequence ?? 0) + 1, prevHash: prev?.hash ?? GENESIS_HASH };
  return { ...draft, hash: hashEvent(draft) };
}

/** Verify a hash chain. Any edited, removed or reordered event breaks verification. */
export function verifyChain(chain: AuditEvent[]): { valid: boolean; brokenAt: number | null; reason?: string } {
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i]!;
    if (e.sequence !== i + 1) return { valid: false, brokenAt: i, reason: `Sequence gap at ${i + 1}` };
    if (e.prevHash !== prevHash) return { valid: false, brokenAt: i, reason: 'Previous hash mismatch' };
    const { hash, ...rest } = e;
    if (hashEvent(rest) !== hash) return { valid: false, brokenAt: i, reason: 'Event content altered' };
    prevHash = hash;
  }
  return { valid: true, brokenAt: null };
}

const IGNORED_DIFF_FIELDS = new Set(['updatedAt', 'sync', 'fingerprint']);

export function diff(before: Record<string, unknown> | null, after: Record<string, unknown>): AuditEvent['changes'] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  const changes: AuditEvent['changes'] = [];
  for (const k of keys) {
    if (IGNORED_DIFF_FIELDS.has(k)) continue;
    const b = before?.[k];
    const a = after[k];
    if (canonicalJson(b) !== canonicalJson(a)) changes.push({ field: k, before: b ?? null, after: a ?? null });
  }
  return changes;
}

// ───────────────────────────── Permissions ─────────────────────────────

export type Permission =
  | 'transaction.create'
  | 'transaction.submit'
  | 'transaction.approve'
  | 'transaction.amend'
  | 'transaction.viewAll'
  | 'budget.manage'
  | 'category.manage'
  | 'member.manage'
  | 'report.generate'
  | 'workspace.manage'
  | 'sheets.manage'
  | 'audit.view';

const MATRIX: Record<Role, Permission[]> = {
  owner: ['transaction.create', 'transaction.submit', 'transaction.approve', 'transaction.amend', 'transaction.viewAll', 'budget.manage', 'category.manage', 'member.manage', 'report.generate', 'workspace.manage', 'sheets.manage', 'audit.view'],
  finance_manager: ['transaction.create', 'transaction.submit', 'transaction.approve', 'transaction.amend', 'transaction.viewAll', 'budget.manage', 'category.manage', 'report.generate', 'sheets.manage', 'audit.view'],
  approver: ['transaction.create', 'transaction.submit', 'transaction.approve', 'transaction.viewAll', 'report.generate'],
  employee: ['transaction.create', 'transaction.submit'],
  auditor: ['transaction.viewAll', 'report.generate', 'audit.view'],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, { en: string; ms: string }> = {
  owner: { en: 'Business Owner / Administrator', ms: 'Pemilik Perniagaan / Pentadbir' },
  finance_manager: { en: 'Finance Manager', ms: 'Pengurus Kewangan' },
  approver: { en: 'Approver', ms: 'Pelulus' },
  employee: { en: 'Employee / Expense Submitter', ms: 'Pekerja / Penghantar Perbelanjaan' },
  auditor: { en: 'Auditor (read-only)', ms: 'Juruaudit (baca sahaja)' },
};

// ───────────────────────────── Workflow ─────────────────────────────

const TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  draft: ['submitted', 'approved'],
  submitted: ['approved', 'rejected', 'draft'],
  rejected: ['draft', 'submitted'],
  approved: ['superseded'],
  superseded: [],
};

export class WorkflowError extends Error {}

export function assertTransition(
  from: TransactionStatus,
  to: TransactionStatus,
  ctx: { role: Role | null; isCreator: boolean; workspaceType: 'personal' | 'business'; approvalRequired: boolean },
): void {
  if (!TRANSITIONS[from].includes(to)) throw new WorkflowError(`Cannot move a ${from} transaction to ${to}.`);
  if (to === 'approved') {
    const selfApprove = ctx.workspaceType === 'personal' || !ctx.approvalRequired;
    if (!(can(ctx.role, 'transaction.approve') || (selfApprove && ctx.isCreator && can(ctx.role, 'transaction.create')))) {
      throw new WorkflowError('You do not have permission to approve this transaction.');
    }
    if (ctx.workspaceType === 'business' && ctx.approvalRequired && ctx.isCreator && ctx.role !== 'owner') {
      throw new WorkflowError('Segregation of duties: you cannot approve your own expense claim.');
    }
  }
  if (to === 'rejected' && !can(ctx.role, 'transaction.approve')) throw new WorkflowError('Only approvers can reject.');
  if ((to === 'submitted' || to === 'draft') && !ctx.isCreator && !can(ctx.role, 'transaction.approve')) {
    throw new WorkflowError('Only the submitter can change this draft.');
  }
}

/**
 * Approved records are never overwritten. An amendment produces a new version
 * that references the original; the original is marked superseded. Both are
 * kept, and the audit trail records before/after values and the reason.
 */
export function amendTransaction(
  original: Transaction,
  patch: Partial<Transaction>,
  ctx: { actorUid: string; reason: string; now: ISOTimestamp; newId: string; role: Role },
): { superseded: Transaction; amended: Transaction; changes: AuditEvent['changes'] } {
  if (original.status !== 'approved') throw new WorkflowError('Only approved transactions need amendments; edit drafts directly.');
  if (!can(ctx.role, 'transaction.amend')) throw new WorkflowError('You do not have permission to amend approved records.');
  if (!ctx.reason.trim()) throw new WorkflowError('An amendment reason is required.');
  const forbidden: Array<keyof Transaction> = ['id', 'workspaceId', 'createdBy', 'createdAt', 'version', 'amendsTransactionId', 'supersededBy', 'isSample'];
  for (const f of forbidden) if (f in patch) throw new WorkflowError(`Field ${String(f)} cannot be amended.`);

  const amendedBase: Transaction = {
    ...original,
    ...patch,
    id: ctx.newId,
    version: original.version + 1,
    amendsTransactionId: original.id,
    amendmentReason: ctx.reason,
    supersededBy: null,
    status: 'approved',
    approvedBy: ctx.actorUid,
    approvedAt: ctx.now,
    updatedAt: ctx.now,
    sync: { sheets: original.sync.sheets === 'not_connected' ? 'not_connected' : 'pending' },
  };
  const amended = { ...amendedBase, fingerprint: transactionFingerprint(amendedBase) };
  const superseded: Transaction = { ...original, status: 'superseded', supersededBy: ctx.newId, updatedAt: ctx.now, sync: { ...original.sync, sheets: original.sync.sheets === 'not_connected' ? 'not_connected' : 'pending' } };
  const changes = diff(original as unknown as Record<string, unknown>, amended as unknown as Record<string, unknown>).filter(
    (c) => !['id', 'version', 'amendsTransactionId', 'amendmentReason', 'approvedAt', 'approvedBy', 'supersededBy'].includes(c.field),
  );
  return { superseded, amended, changes };
}

export function auditInput(
  tx: Pick<Transaction, 'id' | 'workspaceId'>,
  action: AuditAction,
  actorUid: string,
  at: ISOTimestamp,
  changes: AuditEvent['changes'] = [],
  reason?: string,
  id?: string,
): Omit<AuditEvent, 'hash' | 'prevHash' | 'sequence'> {
  return { id: id ?? `${tx.id}_${action}_${at}`, workspaceId: tx.workspaceId, entityType: 'transaction', entityId: tx.id, action, actorUid, at, changes, reason: reason ?? null };
}
