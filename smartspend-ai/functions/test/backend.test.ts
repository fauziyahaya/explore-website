import { GENESIS_HASH, verifyChain, type AuditEvent, type Transaction } from '@smartspend/core';
import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import { bucket, db, paths } from '../src/lib/firebase';
import { renderPdf } from '../src/render/pdf';
import { renderXlsx } from '../src/render/xlsx';
import { renderEvidenceZip } from '../src/render/zip';
import { processReceipt } from '../src/services/receipts';
import { buildReportForWorkspace } from '../src/services/reports';
import { MemorySheetsApi } from '../src/services/sheetsApi';
import { createWorkspaceSpreadsheet, loadWorkspaceData, runSyncWithLease } from '../src/services/sheetsSync';
import { amend, reviewTransaction, saveTransaction } from '../src/services/transactions';
import { clearFirestore, input, seedWorkspace } from './helpers';

async function audit(wid: string): Promise<AuditEvent[]> {
  return (await db.collection(paths.audit(wid)).orderBy('sequence').get()).docs.map((d) => d.data() as AuditEvent);
}

let biz: Awaited<ReturnType<typeof seedWorkspace>>;
let personal: Awaited<ReturnType<typeof seedWorkspace>>;

beforeAll(async () => {
  await clearFirestore();
  biz = await seedWorkspace('ws_biz_test', 'business', [['owner1', 'owner'], ['fm1', 'finance_manager'], ['emp1', 'employee'], ['aud1', 'auditor']]);
  personal = await seedWorkspace('ws_personal_test', 'personal', [['solo', 'owner']]);
});

describe('transactions: saving, duplicates and idempotency', () => {
  it('personal records are auto-approved and audit-logged', async () => {
    const r = await saveTransaction(personal.solo!, input({ classification: 'personal', categoryId: 'p_groceries' }), { intent: 'save' });
    expect(r.transaction.status).toBe('approved');
    expect(r.transaction.classification).toBe('personal');
    const events = await audit('ws_personal_test');
    expect(events.map((e) => e.action)).toEqual(['created', 'approved']);
    expect(events[0]!.prevHash).toBe(GENESIS_HASH);
    expect(verifyChain(events).valid).toBe(true);
  });

  it('replaying the same save (offline retry) is idempotent', async () => {
    const tx = input({ classification: 'personal', categoryId: 'p_groceries', receiptNumber: 'REPLAY-1' });
    const a = await saveTransaction(personal.solo!, tx, { intent: 'save' });
    const b = await saveTransaction(personal.solo!, tx, { intent: 'save' });
    expect(b.idempotentReplay).toBe(true);
    expect(b.transaction.id).toBe(a.transaction.id);
    const all = await db.collection(paths.transactions('ws_personal_test')).where('receiptNumber', '==', 'REPLAY-1').get();
    expect(all.size).toBe(1);
  });

  it('rejects the same receipt saved under a new id, unless explicitly confirmed with a reason', async () => {
    const tx = input({ classification: 'personal', categoryId: 'p_groceries', receiptNumber: 'DUP-1' });
    await saveTransaction(personal.solo!, tx, { intent: 'save' });
    const again = { ...tx, id: `${tx.id}_rescan` };
    await expect(saveTransaction(personal.solo!, again, { intent: 'save' })).rejects.toMatchObject({ code: 'already-exists' });
    await expect(saveTransaction(personal.solo!, again, { intent: 'save', allowDuplicate: true })).rejects.toMatchObject({ code: 'invalid-argument' });
    const ok = await saveTransaction(personal.solo!, again, { intent: 'save', allowDuplicate: true, duplicateReason: 'Bought twice the same day' });
    expect(ok.duplicateOf).toBe(tx.id);
    const ev = (await audit('ws_personal_test')).filter((e) => e.entityId === again.id);
    expect(ev[0]!.reason).toMatch(/possible duplicate/);
  });

  it('validates input server-side and never accepts client-set status or approval fields', async () => {
    await expect(saveTransaction(personal.solo!, { ...input(), total: -5 }, { intent: 'save' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(saveTransaction(personal.solo!, { ...input(), date: '2099-01-01', classification: 'personal' }, { intent: 'save' })).rejects.toThrow(/future/);
    const r = await saveTransaction(personal.solo!, { ...input({ classification: 'personal', categoryId: 'p_food' }), status: 'approved', approvedBy: 'attacker', createdBy: 'attacker' } as never, { intent: 'draft' });
    expect(r.transaction.status).toBe('draft');
    expect(r.transaction.createdBy).toBe('solo');
    expect(r.transaction.approvedBy).toBeNull();
  });
});

describe('business approval workflow', () => {
  let claim: Transaction;
  it('employee claims are submitted, not approved', async () => {
    claim = (await saveTransaction(biz.emp1!, input({ categoryId: 'b_travel', merchant: 'Petronas Bangsar', total: 12000, subtotal: 12000, lineItems: [] }), { intent: 'save' })).transaction;
    expect(claim.status).toBe('submitted');
  });
  it('the submitter cannot edit after submission; an employee cannot approve', async () => {
    await expect(saveTransaction(biz.emp1!, { ...input({ categoryId: 'b_travel', merchant: 'Petronas Bangsar', total: 15000, subtotal: 15000, lineItems: [] }), id: claim.id }, { intent: 'save' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(reviewTransaction(biz.emp1!, claim.id, 'approve', null)).rejects.toMatchObject({ code: 'failed-precondition' });
  });
  it('a finance manager approves it; the approval is in the audit trail', async () => {
    const approved = await reviewTransaction(biz.fm1!, claim.id, 'approve', null);
    expect(approved).toMatchObject({ status: 'approved', approvedBy: 'fm1' });
    const ev = (await audit('ws_biz_test')).filter((e) => e.entityId === claim.id).map((e) => e.action);
    expect(ev).toEqual(['created', 'submitted', 'approved']);
  });
  it('rejection requires a reason', async () => {
    const c = (await saveTransaction(biz.emp1!, input({ categoryId: 'b_meals', merchant: 'Restoran X', total: 9900, subtotal: 9900, lineItems: [] }), { intent: 'save' })).transaction;
    await expect(reviewTransaction(biz.fm1!, c.id, 'reject', null)).rejects.toMatchObject({ code: 'invalid-argument' });
    expect((await reviewTransaction(biz.fm1!, c.id, 'reject', 'Personal meal')).status).toBe('rejected');
  });
  it('amending an approved record supersedes it instead of overwriting it', async () => {
    const r = await amend(biz.fm1!, claim.id, { total: 12500, subtotal: 12500 }, 'Receipt shows RM125.00', 'tx_amend_test_1');
    const orig = (await db.doc(paths.transaction('ws_biz_test', claim.id)).get()).data() as Transaction;
    expect(orig).toMatchObject({ status: 'superseded', supersededBy: 'tx_amend_test_1', total: 12000 });
    expect(r.amended).toMatchObject({ id: 'tx_amend_test_1', version: 2, total: 12500, amendsTransactionId: claim.id });
    const ev = (await audit('ws_biz_test')).find((e) => e.action === 'amended')!;
    expect(ev.changes).toEqual(expect.arrayContaining([{ field: 'total', before: 12000, after: 12500 }]));
    expect(ev.reason).toBe('Receipt shows RM125.00');
    expect(verifyChain(await audit('ws_biz_test')).valid).toBe(true);
  });
});

describe('Google Sheets synchronisation (in-memory Sheets API)', () => {
  it('creates the workspace spreadsheet with 9 tabs and syncs idempotently', async () => {
    const api = new MemorySheetsApi();
    const data = await loadWorkspaceData('ws_biz_test');
    const created = await createWorkspaceSpreadsheet(api, data.workspace);
    await db.doc(paths.workspace('ws_biz_test')).update({ googleSheets: { ...created, connectedByUid: 'owner1', connectedAt: new Date().toISOString() } });
    // Owner-recorded expense (auto-approved) → pending sync
    await saveTransaction({ ...biz.owner1!, workspace: { ...biz.owner1!.workspace, googleSheets: created as never } }, input(), { intent: 'save' });

    const first = await runSyncWithLease('ws_biz_test', async () => api, { uploadReceipts: false });
    if (typeof first === 'string') throw new Error(first);
    const book = api.books.get(created.spreadsheetId)!;
    expect(book.title).toBe('SmartSpend AI — Ujian Trading Sdn. Bhd. — Financial Records');
    expect([...book.tabs.keys()]).toHaveLength(9);
    const txRows = book.tabs.get('Transactions')!.length - 1;
    const approvedOrSuperseded = (await db.collection(paths.transactions('ws_biz_test')).get()).docs.filter((d) => ['approved', 'superseded'].includes(d.get('status'))).length;
    expect(txRows).toBe(approvedOrSuperseded);

    const second = await runSyncWithLease('ws_biz_test', async () => api, { uploadReceipts: false });
    if (typeof second === 'string') throw new Error(second);
    expect(second.appended.Transactions).toBe(0);
    expect(second.updated.Transactions).toBe(txRows);
    expect(book.tabs.get('Transactions')!.length - 1).toBe(txRows); // no duplicate rows
    const ids = book.tabs.get('Transactions')!.slice(1).map((r) => r[0]);
    expect(new Set(ids).size).toBe(ids.length);

    // Every synced transaction is marked synced in the authoritative database.
    const statuses = (await db.collection(paths.transactions('ws_biz_test')).get()).docs.filter((d) => ['approved', 'superseded'].includes(d.get('status'))).map((d) => d.get('sync.sheets'));
    expect(statuses.every((s) => s === 'synced')).toBe(true);
    expect(book.tabs.get('Audit Trail Export')!.length - 1).toBe((await audit('ws_biz_test')).length);
  });

  it('concurrent sync requests are serialised by the lease (no double-append)', async () => {
    const api = new MemorySheetsApi(400);
    const data = await loadWorkspaceData('ws_biz_test');
    const created = await createWorkspaceSpreadsheet(api, data.workspace);
    await db.doc(paths.workspace('ws_biz_test')).update({ 'googleSheets.spreadsheetId': created.spreadsheetId });
    const results = await Promise.all([1, 2, 3].map(() => runSyncWithLease('ws_biz_test', async () => api, { uploadReceipts: false })));
    expect(results.filter((r) => r === 'queued').length).toBeGreaterThanOrEqual(1);
    const ids = api.books.get(created.spreadsheetId)!.tabs.get('Transactions')!.slice(1).map((r) => r[0]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('receipt extraction pipeline (storage emulator + mocked Gemini)', () => {
  it('uploads, hashes, extracts and flags an identical re-upload', async () => {
    const path = 'receipts/ws_personal_test/solo/r1.jpg';
    const image = Buffer.from('fake-jpeg-bytes-for-test');
    await bucket().file(path).save(image, { contentType: 'image/jpeg' });
    const f = <T>(value: T | null, confidence = 0.95) => ({ value, confidence });
    const gemini = {
      documentType: 'receipt', merchant: f('ZUS Coffee KLCC'), merchantAddress: f(null, 0), merchantTaxId: f(null, 0), date: f('15-10-2026'), time: f('09:12'),
      receiptNumber: f('ZK-0042'), currency: f('RM'), subtotal: f(22.4), discount: f(null, 0), tax: f(1.34), serviceCharge: f(null, 0), rounding: f(0.01), total: f(23.75), paymentMethod: f('TNG eWallet'),
      lineItems: [
        { description: f('SPANISH LATTE (L)'), brand: f(null, 0), productCategory: f('coffee'), quantity: f(1), unit: f(null, 0), packageSize: f(null, 0), unitPrice: f(12.9), discount: f(null, 0), total: f(12.9) },
        { description: f('CHEESE CROISSANT'), brand: f(null, 0), productCategory: f('pastry'), quantity: f(1), unit: f(null, 0), packageSize: f(null, 0), unitPrice: f(9.5), discount: f(null, 0), total: f(9.5) },
      ],
    };
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemini) }] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await processReceipt(personal.solo!, path, { geminiApiKey: 'test-key', geminiModel: 'gemini-test', visionFallback: false, today: '2026-10-23', fetchImpl });
    expect(calls[0]).toContain('gemini-test:generateContent');
    expect(res.extraction).toMatchObject({ total: { value: 2375 }, tax: { value: 134 }, date: { value: '2026-10-15' }, paymentMethod: { value: 'ewallet' } });
    expect(res.extraction.checks.every((c) => c.passed)).toBe(true);
    expect(res.receipt.sha256).toHaveLength(64);
    expect(res.duplicateImageOf).toBeNull();

    const saved = await saveTransaction(personal.solo!, input({ id: 'tx_with_receipt_1', classification: 'personal', categoryId: 'p_food', merchant: 'ZUS Coffee KLCC', receiptNumber: 'ZK-0042', date: '2026-10-15', total: 2375, subtotal: 2240, tax: 134, lineItems: [], receipt: { ...res.receipt, uploadedAt: '' } } as never), { intent: 'save' });
    expect(saved.transaction.receipt?.sha256).toBe(res.receipt.sha256);

    const path2 = 'receipts/ws_personal_test/solo/r1-again.jpg';
    await bucket().file(path2).save(image, { contentType: 'image/jpeg' });
    const again = await processReceipt(personal.solo!, path2, { geminiApiKey: 'k', geminiModel: 'gemini-test', visionFallback: false, today: '2026-10-23', fetchImpl });
    expect(again.duplicateImageOf).toBe('tx_with_receipt_1');
  });

  it("refuses to process another user's upload", async () => {
    await expect(processReceipt(personal.solo!, 'receipts/ws_biz_test/emp1/x.jpg', { geminiModel: 'g', visionFallback: false, today: '2026-10-23' })).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('reports from recorded data', () => {
  it('builds reconciled reports and renders PDF, XLSX and ZIP evidence packages', async () => {
    const ctx = biz.fm1!;
    const doc = await buildReportForWorkspace(ctx, 'expense_register', { from: '2026-10-01', to: '2026-10-31' }, 'owner1');
    expect(doc.reconciliation.matches).toBe(true);
    const recorded = (await db.collection(paths.transactions('ws_biz_test')).get()).docs.map((d) => d.data() as Transaction).filter((t) => t.status === 'approved' && t.kind === 'expense' && t.date.startsWith('2026-10'));
    expect(doc.register.rows).toHaveLength(recorded.length);
    expect(doc.reconciliation.transactionTotal).toBe(recorded.reduce((s, t) => s + t.baseTotal, 0));
    expect(doc.reference).toMatch(/^SSA-.*-REG-\d{8}-0001$/);

    const pdf = await renderPdf(doc);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const xlsx = await renderXlsx(doc);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Report Info', 'Summary', 'Transaction Register']);
    const zip = await renderEvidenceZip(doc, { pdf, xlsx }, async () => null);
    expect(zip.subarray(0, 2).toString()).toBe('PK');

    const pl = await buildReportForWorkspace(ctx, 'profit_and_loss', { from: '2026-10-01', to: '2026-10-31' }, null);
    expect(pl.reconciliation.matches).toBe(true);
    expect(pl.reference).toMatch(/-0002$/); // sequential document numbers
  });

  it('personal workspaces cannot generate business-only statements', async () => {
    await expect(buildReportForWorkspace(personal.solo!, 'profit_and_loss', { from: '2026-10-01', to: '2026-10-31' }, null)).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
