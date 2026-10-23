import { buildReport, REPORT_TYPES, reportToCsv, type ReportDocument, type ReportType } from '@smartspend/core';
import { HttpsError } from 'firebase-functions/v2/https';
import type { MemberContext } from '../lib/authz';
import { bucket, db, nowIso, paths, storagePaths } from '../lib/firebase';
import { renderPdf } from '../render/pdf';
import { renderXlsx } from '../render/xlsx';
import { renderEvidenceZip } from '../render/zip';
import type { SheetsApi } from './sheetsApi';
import { loadWorkspaceData } from './sheetsSync';

export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'zip' | 'gsheet';

const CONTENT_TYPES: Record<Exclude<ReportFormat, 'gsheet'>, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  zip: 'application/zip',
};

export async function buildReportForWorkspace(ctx: MemberContext, type: ReportType, range: { from: string; to: string }, reviewedByUid: string | null): Promise<ReportDocument> {
  const meta = REPORT_TYPES.find((r) => r.type === type);
  if (!meta) throw new HttpsError('invalid-argument', 'Unknown report type.');
  if (meta.businessOnly && ctx.workspace.type !== 'business') throw new HttpsError('failed-precondition', 'This report is available for business workspaces.');
  if (range.from > range.to) throw new HttpsError('invalid-argument', 'Start date must be before end date.');
  const data = await loadWorkspaceData(ctx.workspace.id);
  // Sequence for document reference numbers.
  const counterRef = db.doc(`${paths.workspace(ctx.workspace.id)}/meta/reportCounter`);
  const sequence = await db.runTransaction(async (t) => {
    const n = ((await t.get(counterRef)).get('n') as number | undefined) ?? 0;
    t.set(counterRef, { n: n + 1 });
    return n + 1;
  });
  const documentLinks = Object.fromEntries(data.transactions.filter((t) => t.receipt?.driveLink).map((t) => [t.id, t.receipt!.driveLink!]));
  return buildReport({
    type,
    workspace: data.workspace,
    range,
    transactions: data.transactions,
    categories: data.categories,
    budgets: data.budgets,
    members: data.members,
    dimensionNames: Object.fromEntries(data.dimensions.map((d) => [d.id, d.name])),
    documentLinks,
    preparedByUid: ctx.uid,
    reviewedByUid,
    generatedAt: nowIso(),
    sequence,
  });
}

async function readStorage(path: string): Promise<Buffer | null> {
  try {
    return (await bucket().file(path).download())[0];
  } catch {
    return null;
  }
}

export async function renderAndStore(ctx: MemberContext, doc: ReportDocument, format: ReportFormat, getSheetsApi?: () => Promise<SheetsApi>) {
  if (format === 'gsheet') {
    if (!getSheetsApi) throw new HttpsError('failed-precondition', 'Connect a Google account to export to Google Sheets.');
    const api = await getSheetsApi();
    const tabs = [...doc.sections, doc.register].map((s, i) => ({ name: `${i + 1}. ${s.title}`.slice(0, 90), headers: s.columns.map((c) => c.label) }));
    const created = await api.createSpreadsheet(`${doc.title} — ${doc.meta.companyName} — ${doc.reference}`, tabs);
    for (const [i, s] of [...doc.sections, doc.register].entries()) await api.appendRows(created.spreadsheetId, tabs[i]!.name, s.rows.map((r) => r.cells));
    await logReport(ctx, doc, format, null, created.spreadsheetUrl);
    return { url: created.spreadsheetUrl, reference: doc.reference };
  }
  const logo = ctx.workspace.logoPath ? await readStorage(ctx.workspace.logoPath) : null;
  let data: Buffer;
  if (format === 'pdf') data = await renderPdf(doc, logo ?? undefined);
  else if (format === 'xlsx') data = await renderXlsx(doc);
  else if (format === 'csv') data = Buffer.from(`﻿${reportToCsv(doc)}`, 'utf8');
  else data = await renderEvidenceZip(doc, { pdf: await renderPdf(doc, logo ?? undefined), xlsx: await renderXlsx(doc) }, readStorage);

  const path = storagePaths.report(ctx.workspace.id, doc.reference, format);
  const file = bucket().file(path);
  await file.save(data, { contentType: CONTENT_TYPES[format], metadata: { metadata: { reference: doc.reference, generatedBy: ctx.uid } } });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60_000, responseDisposition: `attachment; filename="${doc.reference}.${format}"` });
  await logReport(ctx, doc, format, path, null);
  return { url, reference: doc.reference, storagePath: path, bytes: data.length };
}

async function logReport(ctx: MemberContext, doc: ReportDocument, format: string, storagePath: string | null, externalUrl: string | null) {
  await db.collection(paths.reports(ctx.workspace.id)).doc(doc.reference).set({
    reference: doc.reference,
    type: doc.type,
    title: doc.title,
    format,
    range: doc.meta.reportingPeriod,
    generatedAt: doc.meta.generatedAt,
    generatedBy: ctx.uid,
    reconciliationMatches: doc.reconciliation.matches,
    storagePath,
    externalUrl,
  });
}
