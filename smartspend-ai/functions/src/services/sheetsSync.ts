import {
  buildDerivedTabs,
  defaultCategories,
  incomeRow,
  lineItemRows,
  planUpsert,
  receiptFileName,
  spreadsheetTitle,
  TABS,
  transactionRow,
  type AuditEvent,
  type Budget,
  type Category,
  type Dimension,
  type Member,
  type Transaction,
  type Workspace,
} from '@smartspend/core';
import { logger } from 'firebase-functions';
import { bucket, db, nowIso, paths } from '../lib/firebase';
import type { SheetsApi } from './sheetsApi';

export interface WorkspaceData {
  workspace: Workspace;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  members: Member[];
  dimensions: Dimension[];
  audit: AuditEvent[];
}

export async function loadWorkspaceData(workspaceId: string): Promise<WorkspaceData> {
  const [ws, txs, cats, budgets, members, dims, audit] = await Promise.all([
    db.doc(paths.workspace(workspaceId)).get(),
    db.collection(paths.transactions(workspaceId)).get(),
    db.collection(paths.categories(workspaceId)).get(),
    db.collection(paths.budgets(workspaceId)).get(),
    db.collection(paths.members(workspaceId)).get(),
    db.collection(paths.dimensions(workspaceId)).get(),
    db.collection(paths.audit(workspaceId)).orderBy('sequence').get(),
  ]);
  const workspace = { ...(ws.data() as Workspace), id: workspaceId };
  const custom = cats.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
  const customIds = new Set(custom.map((c) => c.id));
  return {
    workspace,
    transactions: txs.docs.map((d) => d.data() as Transaction),
    categories: [...defaultCategories(workspace.type).filter((c) => !customIds.has(c.id)), ...custom],
    budgets: budgets.docs.map((d) => ({ ...(d.data() as Budget), id: d.id })),
    members: members.docs.map((d) => d.data() as Member),
    dimensions: dims.docs.map((d) => ({ ...(d.data() as Dimension), id: d.id })),
    audit: audit.docs.map((d) => d.data() as AuditEvent),
  };
}

export async function createWorkspaceSpreadsheet(api: SheetsApi, workspace: Workspace) {
  return api.createSpreadsheet(spreadsheetTitle(workspace), TABS.map((t) => ({ name: t.name, headers: t.headers })));
}

export interface SyncReport {
  spreadsheetId: string;
  appended: Record<string, number>;
  updated: Record<string, number>;
  derivedRows: Record<string, number>;
  duplicateIdsInSheet: string[];
  receiptsUploaded: number;
  syncedTransactionIds: string[];
}

/**
 * Full, idempotent synchronisation of one workspace to its spreadsheet.
 * The database is authoritative; the sheet is rebuilt/updated from it.
 */
export async function syncWorkspace(api: SheetsApi, data: WorkspaceData, opts: { uploadReceipts: boolean; readFile?: (path: string) => Promise<Buffer> }): Promise<SyncReport> {
  const link = data.workspace.googleSheets;
  if (!link) throw new Error('Workspace is not connected to Google Sheets.');
  const sid = link.spreadsheetId;
  await api.ensureTabs(sid, TABS.map((t) => ({ name: t.name, headers: t.headers })));

  const syncedAt = nowIso();
  const memberNames = Object.fromEntries(data.members.map((m) => [m.uid, m.displayName]));
  const dimensionNames = Object.fromEntries(data.dimensions.map((d) => [d.id, d.name]));
  const visible = data.transactions.filter((t) => t.status === 'approved' || t.status === 'superseded');

  // Supporting documents: upload each receipt to the user's Drive once (idempotent via driveFileId).
  const documentLinks: Record<string, string> = {};
  let receiptsUploaded = 0;
  const readFile = opts.readFile ?? (async (p: string) => (await bucket().file(p).download())[0]);
  for (const tx of visible) {
    if (!tx.receipt) continue;
    if (tx.receipt.driveLink) {
      documentLinks[tx.id] = tx.receipt.driveLink;
      continue;
    }
    if (!opts.uploadReceipts) continue;
    try {
      const file = await readFile(tx.receipt.storagePath);
      const up = await api.uploadFile(`SmartSpend AI Receipts — ${data.workspace.name}`, receiptFileName(tx), tx.receipt.contentType, file);
      documentLinks[tx.id] = up.webViewLink;
      tx.receipt = { ...tx.receipt, driveFileId: up.fileId, driveLink: up.webViewLink };
      await db.doc(paths.transaction(data.workspace.id, tx.id)).update({ 'receipt.driveFileId': up.fileId, 'receipt.driveLink': up.webViewLink });
      receiptsUploaded++;
    } catch (e) {
      logger.warn('Receipt upload to Drive failed', { tx: tx.id, error: String(e) });
    }
  }

  const ctx = { categories: new Map(data.categories.map((c) => [c.id, c])), dimensionNames, memberNames, documentLinks, syncedAt };
  const appended: Record<string, number> = {};
  const updated: Record<string, number> = {};
  const dupes: string[] = [];

  const upsert = async (tab: string, rows: Array<{ id: string; values: ReturnType<typeof transactionRow> }>) => {
    const existing = await api.readColumnA(sid, tab);
    const plan = planUpsert(existing, rows);
    await api.updateRows(sid, tab, plan.updates);
    await api.appendRows(sid, tab, plan.appends);
    appended[tab] = plan.appends.length;
    updated[tab] = plan.updates.length;
    dupes.push(...plan.duplicateIdsInSheet);
  };

  await upsert('Transactions', visible.map((t) => ({ id: t.id, values: transactionRow(t, ctx) })));
  await upsert('Receipt Line Items', visible.filter((t) => t.kind === 'expense').flatMap((t) => lineItemRows(t, ctx)));
  await upsert('Income Records', visible.filter((t) => t.kind === 'income').map((t) => ({ id: t.id, values: incomeRow(t, ctx) })));

  const derived = buildDerivedTabs({ workspace: data.workspace, transactions: data.transactions, categories: data.categories, budgets: data.budgets, audit: data.audit, dimensionNames, memberNames });
  const derivedRows: Record<string, number> = {};
  for (const tab of TABS.filter((t) => t.mode === 'replace')) {
    const rows = derived[tab.name as keyof typeof derived];
    await api.replaceTab(sid, tab.name, tab.headers, rows);
    derivedRows[tab.name] = rows.length;
  }
  return { spreadsheetId: sid, appended, updated, derivedRows, duplicateIdsInSheet: [...new Set(dupes)], receiptsUploaded, syncedTransactionIds: visible.map((t) => t.id) };
}

const LEASE_MS = 120_000;

/**
 * Serialise syncs per workspace with a lease. If a sync is already running,
 * mark the workspace dirty; the running sync loops once more. This prevents
 * two concurrent appends of the same new row.
 */
export async function runSyncWithLease(workspaceId: string, getApi: (ws: Workspace) => Promise<SheetsApi>, opts: { uploadReceipts: boolean }): Promise<SyncReport | 'queued' | 'not_connected'> {
  const stateRef = db.doc(paths.sheetsState(workspaceId));
  const holder = `${process.pid}_${Math.random().toString(36).slice(2)}`;
  const acquired = await db.runTransaction(async (t) => {
    const s = (await t.get(stateRef)).data() ?? {};
    if (s.leaseHolder && s.leaseUntil > Date.now()) {
      t.set(stateRef, { dirty: true }, { merge: true });
      return false;
    }
    t.set(stateRef, { leaseHolder: holder, leaseUntil: Date.now() + LEASE_MS, dirty: false }, { merge: true });
    return true;
  });
  if (!acquired) return 'queued';

  let last: SyncReport | 'not_connected' = 'not_connected';
  try {
    for (let round = 0; round < 3; round++) {
      const data = await loadWorkspaceData(workspaceId);
      if (!data.workspace.googleSheets) return 'not_connected';
      const api = await getApi(data.workspace);
      try {
        const report = await syncWorkspace(api, data, opts);
        last = report;
        const now = nowIso();
        const pending = data.transactions.filter((t) => report.syncedTransactionIds.includes(t.id) && t.sync.sheets !== 'synced');
        for (let i = 0; i < pending.length; i += 400) {
          const batch = db.batch();
          for (const t of pending.slice(i, i + 400)) batch.update(db.doc(paths.transaction(workspaceId, t.id)), { sync: { sheets: 'synced', syncedAt: now, error: null } });
          await batch.commit();
        }
        await db.doc(paths.workspace(workspaceId)).update({ 'googleSheets.lastSyncAt': now, 'googleSheets.lastSyncError': null });
        await stateRef.set({ lastReport: { ...report, syncedTransactionIds: report.syncedTransactionIds.length }, lastSyncAt: now }, { merge: true });
      } catch (e) {
        const msg = String((e as Error).message ?? e).slice(0, 300);
        logger.error('Sheets sync failed', { workspaceId, error: msg });
        await db.doc(paths.workspace(workspaceId)).update({ 'googleSheets.lastSyncError': msg });
        const failed = data.transactions.filter((t) => t.sync.sheets === 'pending');
        for (let i = 0; i < failed.length; i += 400) {
          const batch = db.batch();
          for (const t of failed.slice(i, i + 400)) batch.update(db.doc(paths.transaction(workspaceId, t.id)), { sync: { sheets: 'failed', syncedAt: null, error: msg } });
          await batch.commit();
        }
        throw e;
      }
      const again = await db.runTransaction(async (t) => {
        const s = (await t.get(stateRef)).data() ?? {};
        if (s.dirty) {
          t.set(stateRef, { dirty: false, leaseUntil: Date.now() + LEASE_MS }, { merge: true });
          return true;
        }
        return false;
      });
      if (!again) break;
    }
  } finally {
    await stateRef.set({ leaseHolder: null, leaseUntil: 0 }, { merge: true });
  }
  return last;
}
