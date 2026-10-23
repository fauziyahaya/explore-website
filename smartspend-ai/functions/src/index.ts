/**
 * SmartSpend AI — Cloud Functions entry point.
 *
 * All financial writes (transactions, approvals, amendments) go through these
 * callables so that validation, role-based access control, duplicate
 * prevention and the tamper-evident audit trail are enforced server-side.
 */
import { newId, type ReportType, type Role } from '@smartspend/core';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import { isoDate, optStr, requireAuth, requireMember, str } from './lib/authz';
import { todayMY } from './lib/firebase';
import * as account from './services/account';
import { authorisedClient, connectGoogle, disconnectGoogle, type GoogleOAuthConfig } from './services/googleAuth';
import { checkDuplicates, processReceipt } from './services/receipts';
import { buildReportForWorkspace, renderAndStore, type ReportFormat } from './services/reports';
import { googleSheetsApi } from './services/sheetsApi';
import { createWorkspaceSpreadsheet, runSyncWithLease } from './services/sheetsSync';
import * as txs from './services/transactions';
import { db, nowIso, paths } from './lib/firebase';

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 20 });

// ── Configuration (see docs/SETUP.md). Secrets live in Google Secret Manager. ──
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
const TOKEN_ENCRYPTION_KEY = defineSecret('TOKEN_ENCRYPTION_KEY');
const GOOGLE_OAUTH_WEB_CLIENT_ID = defineString('GOOGLE_OAUTH_WEB_CLIENT_ID');
const GEMINI_MODEL = defineString('GEMINI_MODEL', { default: 'gemini-2.5-flash' });
const VISION_FALLBACK = defineBoolean('VISION_FALLBACK', { default: true });
const UPLOAD_RECEIPTS_TO_DRIVE = defineBoolean('UPLOAD_RECEIPTS_TO_DRIVE', { default: true });

const oauthCfg = (): GoogleOAuthConfig => ({
  clientId: GOOGLE_OAUTH_WEB_CLIENT_ID.value(),
  clientSecret: GOOGLE_OAUTH_CLIENT_SECRET.value(),
  encryptionKey: TOKEN_ENCRYPTION_KEY.value(),
});
const googleSecrets = [GOOGLE_OAUTH_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY];
const callOpts = { enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true', cors: false };

// ───────────────────────────── Accounts & workspaces ─────────────────────────────

export const createWorkspace = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const d = (req.data ?? {}) as Record<string, unknown>;
  return account.createWorkspace(uid, {
    type: d.type as 'personal' | 'business',
    name: str(d.name, 'Name', 120),
    registrationNumber: optStr(d.registrationNumber, 40),
    taxIdentificationNumber: optStr(d.taxIdentificationNumber, 40),
    sstRegistrationNumber: optStr(d.sstRegistrationNumber, 40),
    address: optStr(d.address, 300),
    baseCurrency: optStr(d.baseCurrency, 3) ?? 'MYR',
    retentionYears: typeof d.retentionYears === 'number' ? d.retentionYears : 7,
    approvalRequired: d.approvalRequired !== false,
  });
});

export const inviteMember = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'member.manage');
  return account.inviteMember(ctx, str(req.data?.email, 'Email', 200), req.data?.role as Role, optStr(req.data?.departmentId, 80));
});

export const acceptInvites = onCall(callOpts, async (req) => account.acceptInvites(requireAuth(req)));

export const setMemberRole = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'member.manage');
  await account.setMemberRole(ctx, str(req.data?.uid, 'Member', 128), (req.data?.role ?? null) as Role | null);
  return { ok: true };
});

export const exportMyData = onCall({ ...callOpts, timeoutSeconds: 300, memory: '1GiB' }, async (req) => account.exportUserData(requireAuth(req)));

export const deleteMyAccount = onCall({ ...callOpts, timeoutSeconds: 540 }, async (req) => {
  const uid = requireAuth(req);
  if (req.data?.confirm !== 'DELETE') throw new HttpsError('invalid-argument', 'Confirmation required.');
  return account.deleteAccount(uid);
});

// ───────────────────────────── Receipts & transactions ─────────────────────────────

export const extractReceipt = onCall({ ...callOpts, secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '1GiB' }, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'transaction.create');
  return processReceipt(ctx, str(req.data?.storagePath, 'File', 300), {
    geminiApiKey: GEMINI_API_KEY.value() || undefined,
    geminiModel: GEMINI_MODEL.value(),
    visionFallback: VISION_FALLBACK.value(),
    today: todayMY(),
  });
});

export const checkDuplicate = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'transaction.create');
  const c = req.data?.candidate ?? {};
  return { matches: await checkDuplicates(ctx, { id: String(c.id ?? ''), kind: c.kind, merchant: c.merchant ?? null, date: isoDate(c.date, 'Date'), total: Number(c.total), currency: String(c.currency ?? 'MYR'), receiptNumber: c.receiptNumber ?? null, fingerprint: String(c.fingerprint ?? '') }) };
});

export const saveTransaction = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'transaction.create');
  return txs.saveTransaction(ctx, req.data?.transaction, {
    intent: req.data?.intent === 'draft' ? 'draft' : 'save',
    allowDuplicate: req.data?.allowDuplicate === true,
    duplicateReason: optStr(req.data?.duplicateReason, 300),
  });
});

export const reviewTransaction = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'transaction.approve');
  const decision = req.data?.decision === 'reject' ? 'reject' : 'approve';
  return txs.reviewTransaction(ctx, str(req.data?.transactionId, 'Transaction', 80), decision, optStr(req.data?.reason, 500));
});

export const amendTransaction = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'transaction.amend');
  return txs.amend(ctx, str(req.data?.transactionId, 'Transaction', 80), req.data?.patch, str(req.data?.reason, 'Reason', 500), newId('tx'));
});

export const deleteDraft = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'transaction.create');
  await txs.deleteDraft(ctx, str(req.data?.transactionId, 'Transaction', 80));
  return { ok: true };
});

// ───────────────────────────── Google Sheets / Drive ─────────────────────────────

export const connectGoogleAccount = onCall({ ...callOpts, secrets: googleSecrets }, async (req) => {
  const uid = requireAuth(req);
  return connectGoogle(uid, str(req.data?.serverAuthCode, 'Authorisation code', 2000), oauthCfg());
});

export const disconnectGoogleAccount = onCall({ ...callOpts, secrets: googleSecrets }, async (req) => disconnectGoogle(requireAuth(req), oauthCfg()));

export const linkSpreadsheet = onCall({ ...callOpts, secrets: googleSecrets, timeoutSeconds: 300 }, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'sheets.manage');
  if (ctx.workspace.isSample) throw new HttpsError('failed-precondition', 'Sample workspaces cannot be synced to Google Sheets.');
  const api = googleSheetsApi(await authorisedClient(uid, oauthCfg()));
  const created = ctx.workspace.googleSheets ?? { ...(await createWorkspaceSpreadsheet(api, ctx.workspace)), connectedByUid: uid, connectedAt: nowIso() };
  await db.doc(paths.workspace(ctx.workspace.id)).update({ googleSheets: created });
  const report = await runSyncWithLease(ctx.workspace.id, async () => api, { uploadReceipts: UPLOAD_RECEIPTS_TO_DRIVE.value() });
  return { spreadsheetUrl: created.spreadsheetUrl, report };
});

export const unlinkSpreadsheet = onCall(callOpts, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'sheets.manage');
  await db.doc(paths.workspace(ctx.workspace.id)).update({ googleSheets: null });
  return { ok: true };
});

export const syncSheetsNow = onCall({ ...callOpts, secrets: googleSecrets, timeoutSeconds: 300 }, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'transaction.create');
  const report = await runSyncWithLease(ctx.workspace.id, async (ws) => googleSheetsApi(await authorisedClient(ws.googleSheets!.connectedByUid, oauthCfg())), { uploadReceipts: UPLOAD_RECEIPTS_TO_DRIVE.value() });
  return { report };
});

/** Automatic sync: every transaction change marked "pending" triggers an idempotent workspace sync. */
export const onTransactionWrite = onDocumentWritten({ document: 'workspaces/{wid}/transactions/{tid}', secrets: googleSecrets, timeoutSeconds: 300 }, async (event) => {
  const after = event.data?.after.data();
  if (!after || after.sync?.sheets !== 'pending' || after.isSample) return;
  await runSyncWithLease(event.params.wid, async (ws) => googleSheetsApi(await authorisedClient(ws.googleSheets!.connectedByUid, oauthCfg())), { uploadReceipts: UPLOAD_RECEIPTS_TO_DRIVE.value() });
});

// ───────────────────────────── Reports ─────────────────────────────

export const generateReport = onCall({ ...callOpts, secrets: googleSecrets, timeoutSeconds: 300, memory: '1GiB' }, async (req) => {
  const uid = requireAuth(req);
  const ctx = await requireMember(uid, req.data?.workspaceId, 'report.generate');
  const format = (['pdf', 'xlsx', 'csv', 'zip', 'gsheet'] as const).find((f) => f === req.data?.format) ?? 'pdf';
  const doc = await buildReportForWorkspace(ctx, req.data?.type as ReportType, { from: isoDate(req.data?.from, 'From'), to: isoDate(req.data?.to, 'To') }, optStr(req.data?.reviewedByUid, 128));
  return renderAndStore(ctx, doc, format as ReportFormat, async () => googleSheetsApi(await authorisedClient(uid, oauthCfg())));
});
