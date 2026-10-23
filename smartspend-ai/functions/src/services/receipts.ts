import { findDuplicates, sha256Hex, type ExtractedReceipt, type Transaction } from '@smartspend/core';
import { HttpsError } from 'firebase-functions/v2/https';
import { extractReceipt, ExtractionError, type ExtractOptions } from '../ai/extract';
import type { MemberContext } from '../lib/authz';
import { bucket, db, nowIso, paths } from '../lib/firebase';

export interface ExtractResponse {
  extractionId: string;
  extraction: ExtractedReceipt;
  receipt: { storagePath: string; contentType: string; sha256: string; sizeBytes: number };
  duplicateImageOf: string | null;
}

/**
 * Process an uploaded receipt: verify the caller owns the upload path,
 * hash it (identical images are flagged as duplicates), run AI extraction
 * and keep the raw extraction for audit. Nothing is saved as a transaction
 * until the user reviews and confirms.
 */
export async function processReceipt(ctx: MemberContext, storagePath: string, opts: Omit<ExtractOptions, 'defaultCurrency'>): Promise<ExtractResponse> {
  const prefix = `receipts/${ctx.workspace.id}/${ctx.uid}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) throw new HttpsError('permission-denied', 'You can only process your own uploads.');
  const file = bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError('not-found', 'Upload not found. Please try again.');
  const [[data], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
  const contentType = String(meta.contentType ?? 'image/jpeg');
  const sha256 = sha256Hex(new Uint8Array(data));

  const sameImage = await db.collection(paths.transactions(ctx.workspace.id)).where('receipt.sha256', '==', sha256).limit(1).get();
  const duplicateImageOf = sameImage.docs.find((d) => !['superseded', 'rejected'].includes(d.get('status')))?.id ?? null;

  let extraction: ExtractedReceipt;
  try {
    extraction = await extractReceipt(data, contentType, { ...opts, defaultCurrency: ctx.workspace.baseCurrency });
  } catch (e) {
    if (e instanceof ExtractionError) throw new HttpsError(e.retryable ? 'unavailable' : 'invalid-argument', e.message);
    throw e;
  }
  const extractionRef = db.collection(paths.extractions(ctx.workspace.id)).doc();
  await extractionRef.set({ id: extractionRef.id, storagePath, sha256, contentType, extraction: JSON.parse(JSON.stringify(extraction)), createdBy: ctx.uid, createdAt: nowIso() });
  return { extractionId: extractionRef.id, extraction, receipt: { storagePath, contentType, sha256, sizeBytes: data.length }, duplicateImageOf };
}

/** Check a draft against existing records before saving (fuzzy duplicate warning for the review screen). */
export async function checkDuplicates(ctx: MemberContext, candidate: Pick<Transaction, 'id' | 'kind' | 'merchant' | 'date' | 'total' | 'currency' | 'receiptNumber' | 'fingerprint'>) {
  const from = new Date(Date.parse(candidate.date) - 3 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.parse(candidate.date) + 3 * 86_400_000).toISOString().slice(0, 10);
  const nearby = await db.collection(paths.transactions(ctx.workspace.id)).where('date', '>=', from).where('date', '<=', to).get();
  return findDuplicates({ ...candidate, workspaceId: ctx.workspace.id }, nearby.docs.map((d) => d.data() as Transaction));
}
