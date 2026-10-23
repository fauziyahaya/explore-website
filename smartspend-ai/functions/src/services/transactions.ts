import {
  amendTransaction,
  assertTransition,
  auditInput,
  diff,
  emptyMemory,
  finaliseDraft,
  learnFromTransaction,
  transactionFingerprint,
  validateForSave,
  WorkflowError,
  type CategoryMemory,
  type Transaction,
} from '@smartspend/core';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { readAuditHead, writeAuditEvents } from '../lib/audit';
import type { MemberContext } from '../lib/authz';
import { db, nowIso, paths, todayMY } from '../lib/firebase';

const id = z.string().regex(/^[A-Za-z0-9_-]{6,80}$/);
const minor = z.number().int().min(0).max(10_000_000_000);
const LineItemInput = z.object({
  id: id,
  description: z.string().max(300),
  brand: z.string().max(120).nullish(),
  productCategory: z.string().max(120).nullish(),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().max(30).nullish(),
  packageSize: z.string().max(40).nullish(),
  unitPrice: minor.nullable(),
  discount: minor,
  tax: minor,
  total: minor,
  categoryId: z.string().max(80).nullish(),
});

/** Fields the client may supply. Status, audit, approval and sync fields are server-controlled. */
export const TransactionInput = z.object({
  id,
  kind: z.enum(['expense', 'income']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().max(200).nullable(),
  receiptNumber: z.string().max(80).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  total: minor,
  subtotal: minor.nullable(),
  tax: minor.nullable(),
  discount: minor.nullable(),
  rounding: z.number().int().min(-1000).max(1000).nullable(),
  fxRateToBase: z.number().positive().max(100_000).nullish(),
  paymentMethod: z.enum(['cash', 'debit_card', 'credit_card', 'ewallet', 'bank_transfer', 'duitnow', 'cheque', 'other', 'unknown']),
  classification: z.enum(['business', 'personal', 'owner_drawing']),
  categoryId: z.string().min(1).max(80),
  lineItems: z.array(LineItemInput).max(200),
  description: z.string().max(1000).nullish(),
  businessPurpose: z.string().max(500).nullish(),
  departmentId: z.string().max(80).nullish(),
  costCentreId: z.string().max(80).nullish(),
  projectId: z.string().max(80).nullish(),
  incomeSource: z.string().max(200).nullish(),
  source: z.enum(['camera', 'library', 'pdf', 'manual', 'csv_import']),
  isRecurring: z.boolean().optional(),
  receipt: z
    .object({ storagePath: z.string().max(300), contentType: z.string().max(60), sha256: z.string().regex(/^[a-f0-9]{64}$/), sizeBytes: z.number().int().optional() })
    .nullish(),
  ai: z
    .object({ extractionId: z.string().max(80), suggestedCategoryId: z.string().max(80).nullish(), overallConfidence: z.number().min(0).max(1), model: z.string().max(80), correctedFields: z.array(z.string().max(80)).max(100) })
    .nullish(),
});
export type TransactionInputT = z.infer<typeof TransactionInput>;

export function parseInput<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpsError('invalid-argument', `Invalid input: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 5).join('; ')}`);
  return r.data;
}

function wf<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof WorkflowError) throw new HttpsError('failed-precondition', e.message);
    throw e;
  }
}

export interface SaveResult {
  transaction: Transaction;
  duplicateOf?: string;
  idempotentReplay?: boolean;
}

/**
 * Create or update a transaction. Idempotent: the client generates the id
 * (so an offline retry of the same save is a no-op), and a per-workspace
 * fingerprint index rejects the same receipt being recorded twice.
 */
export async function saveTransaction(
  ctx: MemberContext,
  raw: unknown,
  opts: { intent: 'draft' | 'save'; allowDuplicate?: boolean; duplicateReason?: string | null },
): Promise<SaveResult> {
  const input = parseInput(TransactionInput, raw);
  const { workspace: ws, uid, role } = ctx;
  const now = nowIso();
  const today = todayMY();
  if (input.receipt && !input.receipt.storagePath.startsWith(`receipts/${ws.id}/`)) {
    throw new HttpsError('invalid-argument', 'Receipt must be stored in this workspace.');
  }
  if (ws.type === 'personal' && input.classification === 'business') input.classification = 'personal';

  return db.runTransaction(async (t) => {
    const ref = db.doc(paths.transaction(ws.id, input.id));
    const existingSnap = await t.get(ref);
    const existing = existingSnap.exists ? (existingSnap.data() as Transaction) : null;

    let draft: Transaction = finaliseDraft(
      {
        ...input,
        workspaceId: ws.id,
        lineItems: input.lineItems.map((l) => ({ ...l, brand: l.brand ?? null, productCategory: l.productCategory ?? null, unit: l.unit ?? null, packageSize: l.packageSize ?? null, categoryId: l.categoryId ?? null })),
        receipt: input.receipt ? { ...input.receipt, uploadedAt: existing?.receipt?.uploadedAt ?? now } : null,
        ai: input.ai ?? null,
        baseTotal: input.currency === ws.baseCurrency ? input.total : 0,
        status: 'draft',
        fingerprint: '',
        createdBy: existing?.createdBy ?? uid,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        version: existing?.version ?? 1,
        sync: { sheets: ws.googleSheets ? 'pending' : 'not_connected' },
        isSample: ws.isSample,
      } as Transaction,
      ws.baseCurrency,
    );

    if (existing) {
      if (existing.fingerprint === draft.fingerprint && existing.status !== 'draft' && existing.status !== 'rejected') {
        return { transaction: existing, idempotentReplay: true };
      }
      if (existing.createdBy !== uid) throw new HttpsError('permission-denied', 'Only the submitter can edit this record.');
      if (!['draft', 'rejected'].includes(existing.status)) {
        throw new HttpsError('failed-precondition', 'Submitted or approved records cannot be edited. Use an amendment instead.');
      }
    }

    const v = validateForSave(draft, today);
    if (!v.ok) throw new HttpsError('invalid-argument', v.errors.join(' '));

    // Duplicate prevention via fingerprint index.
    const fpRef = db.doc(paths.fingerprint(ws.id, draft.fingerprint));
    const fpSnap = await t.get(fpRef);
    const dupOf = fpSnap.exists ? (fpSnap.data() as { transactionId: string }).transactionId : null;
    if (dupOf && dupOf !== draft.id && !opts.allowDuplicate) {
      throw new HttpsError('already-exists', 'This receipt appears to have been recorded already.', { duplicateOf: dupOf });
    }
    if (dupOf && dupOf !== draft.id && opts.allowDuplicate && !opts.duplicateReason?.trim()) {
      throw new HttpsError('invalid-argument', 'Please give a reason for saving a possible duplicate.');
    }

    const oldFpRef = existing && existing.fingerprint !== draft.fingerprint ? db.doc(paths.fingerprint(ws.id, existing.fingerprint)) : null;
    const oldFpSnap = oldFpRef ? await t.get(oldFpRef) : null;
    const memSnap = await t.get(db.doc(paths.categoryMemory(ws.id)));
    const head = await readAuditHead(t, ws.id);

    // Status decision
    const isCreator = draft.createdBy === uid;
    let target: Transaction['status'] = 'draft';
    if (opts.intent === 'save') {
      const autoApprove = ws.type === 'personal' || !ws.approvalRequired || role === 'owner';
      target = autoApprove ? 'approved' : 'submitted';
    }
    const from = existing?.status ?? 'draft';
    if (target !== 'draft' || from !== 'draft') {
      wf(() => assertTransition(from === 'rejected' && target === 'approved' ? 'draft' : from, target, { role, isCreator, workspaceType: ws.type, approvalRequired: ws.approvalRequired }));
    }
    draft = {
      ...draft,
      status: target,
      submittedAt: target === 'submitted' ? now : existing?.submittedAt ?? null,
      approvedBy: target === 'approved' ? uid : null,
      approvedAt: target === 'approved' ? now : null,
      rejectedReason: null,
    };

    t.set(ref, draft);
    if (oldFpRef && oldFpSnap?.data()?.transactionId === draft.id) t.delete(oldFpRef);
    if (!dupOf) t.set(fpRef, { transactionId: draft.id, createdAt: now });

    const events = [auditInput(draft, existing ? 'updated' : 'created', uid, now, diff(existing as never, draft as never), dupOf && dupOf !== draft.id ? `Saved despite possible duplicate of ${dupOf}: ${opts.duplicateReason}` : undefined)];
    if (target === 'submitted') events.push(auditInput(draft, 'submitted', uid, now, [], undefined, `${draft.id}_submitted_${now}_2`));
    if (target === 'approved') events.push(auditInput(draft, 'approved', uid, now, [], ws.type === 'personal' ? 'Personal record (self-approved)' : role === 'owner' ? 'Recorded by business owner' : 'Approval not required', `${draft.id}_approved_${now}_2`));
    writeAuditEvents(t, ws.id, head, events);

    if (target === 'approved') {
      const memory = (memSnap.exists ? (memSnap.data() as CategoryMemory) : emptyMemory());
      t.set(db.doc(paths.categoryMemory(ws.id)), learnFromTransaction(memory, draft));
    }
    return { transaction: draft, duplicateOf: dupOf && dupOf !== draft.id ? dupOf : undefined };
  });
}

export async function reviewTransaction(ctx: MemberContext, transactionId: string, decision: 'approve' | 'reject', reason: string | null): Promise<Transaction> {
  const { workspace: ws, uid, role } = ctx;
  const now = nowIso();
  return db.runTransaction(async (t) => {
    const ref = db.doc(paths.transaction(ws.id, transactionId));
    const snap = await t.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Transaction not found.');
    const tx = snap.data() as Transaction;
    const memSnap = await t.get(db.doc(paths.categoryMemory(ws.id)));
    const head = await readAuditHead(t, ws.id);
    const to = decision === 'approve' ? 'approved' : 'rejected';
    wf(() => assertTransition(tx.status, to, { role, isCreator: tx.createdBy === uid, workspaceType: ws.type, approvalRequired: ws.approvalRequired }));
    if (to === 'rejected' && !reason?.trim()) throw new HttpsError('invalid-argument', 'A rejection reason is required.');
    const next: Transaction = {
      ...tx,
      status: to,
      approvedBy: to === 'approved' ? uid : null,
      approvedAt: to === 'approved' ? now : null,
      rejectedReason: to === 'rejected' ? reason : null,
      updatedAt: now,
      sync: { sheets: ws.googleSheets ? 'pending' : 'not_connected' },
    };
    t.set(ref, next);
    writeAuditEvents(t, ws.id, head, [auditInput(next, to, uid, now, [{ field: 'status', before: tx.status, after: to }], reason ?? undefined)]);
    if (to === 'approved') {
      const memory = memSnap.exists ? (memSnap.data() as CategoryMemory) : emptyMemory();
      t.set(db.doc(paths.categoryMemory(ws.id)), learnFromTransaction(memory, next));
    }
    return next;
  });
}

const AmendPatch = TransactionInput.omit({ id: true, source: true, receipt: true, ai: true }).partial();

export async function amend(ctx: MemberContext, transactionId: string, rawPatch: unknown, reason: string, newId: string): Promise<{ superseded: Transaction; amended: Transaction }> {
  const patch = parseInput(AmendPatch, rawPatch);
  const { workspace: ws, uid, role } = ctx;
  const now = nowIso();
  return db.runTransaction(async (t) => {
    const ref = db.doc(paths.transaction(ws.id, transactionId));
    const snap = await t.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Transaction not found.');
    const original = snap.data() as Transaction;
    const newRef = db.doc(paths.transaction(ws.id, newId));
    if ((await t.get(newRef)).exists) throw new HttpsError('already-exists', 'Amendment id already used.');
    const origFpRef = db.doc(paths.fingerprint(ws.id, original.fingerprint));
    const origFpSnap = await t.get(origFpRef);
    const head = await readAuditHead(t, ws.id);
    const { superseded, amended } = wf(() =>
      amendTransaction(original, patch as Partial<Transaction>, { actorUid: uid, reason, now, newId, role }),
    );
    const finalAmended = finaliseDraft({ ...amended, sync: { sheets: ws.googleSheets ? 'pending' : 'not_connected' } }, ws.baseCurrency);
    finalAmended.fingerprint = transactionFingerprint(finalAmended);
    const v = validateForSave(finalAmended, todayMY());
    if (!v.ok) throw new HttpsError('invalid-argument', v.errors.join(' '));
    t.set(ref, superseded);
    t.create(newRef, finalAmended);
    if (origFpSnap.data()?.transactionId === original.id) t.delete(origFpRef);
    t.set(db.doc(paths.fingerprint(ws.id, finalAmended.fingerprint)), { transactionId: newId, createdAt: now });
    writeAuditEvents(t, ws.id, head, [
      auditInput(finalAmended, 'amended', uid, now, diff(original as never, finalAmended as never).filter((c) => !['id', 'version', 'amendsTransactionId', 'amendmentReason', 'approvedAt', 'approvedBy', 'supersededBy', 'status'].includes(c.field)), reason, `${original.id}_amended_${now}`),
    ]);
    return { superseded, amended: finalAmended };
  });
}

/** Deleting is only possible for the creator's own unsubmitted drafts. Approved records are retained. */
export async function deleteDraft(ctx: MemberContext, transactionId: string): Promise<void> {
  const { workspace: ws, uid } = ctx;
  const now = nowIso();
  await db.runTransaction(async (t) => {
    const ref = db.doc(paths.transaction(ws.id, transactionId));
    const snap = await t.get(ref);
    if (!snap.exists) return;
    const tx = snap.data() as Transaction;
    if (tx.createdBy !== uid || !['draft', 'rejected'].includes(tx.status)) {
      throw new HttpsError('failed-precondition', 'Only your own drafts can be deleted. Approved records are retained for audit.');
    }
    const fpRef = db.doc(paths.fingerprint(ws.id, tx.fingerprint));
    const fpSnap = await t.get(fpRef);
    const head = await readAuditHead(t, ws.id);
    t.delete(ref);
    if (fpSnap.data()?.transactionId === tx.id) t.delete(fpRef);
    writeAuditEvents(t, ws.id, head, [auditInput(tx, 'deleted', uid, now, [{ field: 'status', before: tx.status, after: 'deleted' }])]);
  });
}
