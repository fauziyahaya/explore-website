/**
 * Evidence generator: produces verifiable artefacts from SAMPLE data showing
 *  1. receipts are extracted correctly (and nothing is invented),
 *  2. transactions are saved without duplication,
 *  3. Google Sheets sync is idempotent (in-memory Sheets API with real semantics),
 *  4. financial calculations reconcile,
 *  5. generated reports match the recorded transactions.
 * Output: ../evidence/ (EVIDENCE.md + PDF, XLSX, CSV and ZIP report files).
 *
 *   npm run evidence -w @smartspend/functions
 */
import {
  allocateAll,
  buildReport,
  BUSINESS_CATEGORIES,
  findDuplicates,
  formatMoney,
  incomeRow,
  lineItemRows,
  monthRange,
  normaliseAiReceipt,
  parseOcrText,
  personalSummary,
  PERSONAL_CATEGORIES,
  planUpsert,
  profitAndLoss,
  reconcile,
  reportToCsv,
  SAMPLE_RECEIPT_TEXTS,
  sampleBudgets,
  sampleBusinessDimensions,
  sampleBusinessMembers,
  sampleBusinessTransactions,
  sampleBusinessWorkspace,
  samplePersonalTransactions,
  shiftMonth,
  spreadsheetTitle,
  TABS,
  transactionFingerprint,
  transactionRow,
  type SheetContext,
  type Transaction,
} from '@smartspend/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPdf } from '../src/render/pdf';
import { renderXlsx } from '../src/render/xlsx';
import { renderEvidenceZip } from '../src/render/zip';
import { MemorySheetsApi } from '../src/services/sheetsApi';

const OUT = join(__dirname, '..', '..', 'evidence');
const TODAY = '2026-10-23';
const lines: string[] = [];
const log = (s = '') => lines.push(s);
let failures = 0;
const check = (ok: boolean, label: string) => {
  if (!ok) failures++;
  log(`- ${ok ? '✅' : '❌'} ${label}`);
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  log('# SmartSpend AI — Verification Evidence');
  log();
  log(`Generated ${new Date().toISOString()} from **SAMPLE data only** (reference date ${TODAY}). Re-run with \`npm run evidence\`.`);

  // 1. Extraction
  log('\n## 1. Receipt extraction');
  for (const [name, text] of Object.entries(SAMPLE_RECEIPT_TEXTS)) {
    const r = normaliseAiReceipt(parseOcrText(text), { model: 'ocr-heuristic', today: TODAY });
    log(`\n**${name}** — merchant “${r.merchant.value}”, date ${r.date.value}, receipt ${r.receiptNumber.value}, total ${formatMoney(r.total.value ?? 0)}, tax ${r.tax.value == null ? 'not printed' : formatMoney(r.tax.value)}, ${r.lineItems.length} items, overall confidence ${r.overallConfidence}`);
    log('\n| Item | Qty | Total | Confidence |\n|---|---:|---:|---:|');
    for (const li of r.lineItems) log(`| ${li.description.value} | ${li.quantity.value} | ${formatMoney(li.total.value ?? 0)} | ${li.total.confidence} |`);
    log();
    for (const c of r.checks) log(`- ${c.passed ? '✅' : '⚠️'} ${c.code}: ${c.message}`);
  }
  const noTotal = normaliseAiReceipt(parseOcrText('KEDAI RUNCIT ABU\n01/10/2026\nGULA 1KG 2.85\nTHANK YOU'), { model: 'ocr-heuristic', today: TODAY });
  check(noTotal.total.value === null && !noTotal.checks.find((c) => c.code === 'TOTAL_PRESENT')!.passed, 'A receipt without a printed total is NOT given an invented total (value stays null, user must enter it)');

  // 2. Duplicates
  log('\n## 2. Duplicate prevention');
  const personal = samplePersonalTransactions(TODAY);
  const original = personal.find((t) => t.lineItems.length)!;
  const rescan: Transaction = { ...original, id: 'rescan_1' };
  check(findDuplicates(rescan, personal)[0]?.transactionId === original.id, `Re-scanning ${original.merchant} ${formatMoney(original.total)} (${original.date}) is detected as a duplicate (fingerprint ${original.fingerprint.slice(0, 12)}…)`);
  const different: Transaction = { ...original, id: 'other_1', total: original.total + 990, baseTotal: original.total + 990, receiptNumber: 'NEW-1' };
  different.fingerprint = transactionFingerprint(different);
  check(findDuplicates(different, personal).length === 0, 'A different purchase at the same shop is not flagged');
  log('- Server-side: a per-workspace fingerprint index rejects a second save with `already-exists`; replaying the same client id is idempotent (see functions/test/backend.test.ts).');

  // 3. Sheets sync
  log('\n## 3. Google Sheets synchronisation (idempotent)');
  const ws = { ...sampleBusinessWorkspace(), id: 'sample_business' };
  const business = sampleBusinessTransactions(TODAY);
  const api = new MemorySheetsApi();
  const { spreadsheetId } = await api.createSpreadsheet(spreadsheetTitle(ws), TABS.map((t) => ({ name: t.name, headers: t.headers })));
  const ctx: SheetContext = { categories: new Map(BUSINESS_CATEGORIES.map((c) => [c.id, c])), dimensionNames: Object.fromEntries(sampleBusinessDimensions().map((d) => [d.id, d.name])), memberNames: Object.fromEntries(sampleBusinessMembers().map((m) => [m.uid, m.displayName])), documentLinks: {}, syncedAt: `${TODAY}T08:00:00Z` };
  const approved = business.filter((t) => t.status === 'approved');
  const sync = async () => {
    const report: Record<string, [number, number]> = {};
    const tabs: Array<[string, Array<{ id: string; values: ReturnType<typeof transactionRow> }>]> = [
      ['Transactions', approved.map((t) => ({ id: t.id, values: transactionRow(t, ctx) }))],
      ['Receipt Line Items', approved.flatMap((t) => lineItemRows(t, ctx))],
      ['Income Records', approved.filter((t) => t.kind === 'income').map((t) => ({ id: t.id, values: incomeRow(t, ctx) }))],
    ];
    for (const [tab, rows] of tabs) {
      const plan = planUpsert(await api.readColumnA(spreadsheetId, tab), rows);
      await api.updateRows(spreadsheetId, tab, plan.updates);
      await api.appendRows(spreadsheetId, tab, plan.appends);
      report[tab] = [plan.appends.length, plan.updates.length];
    }
    return report;
  };
  const first = await sync();
  const second = await sync();
  const sheetRows = api.books.get(spreadsheetId)!.tabs.get('Transactions')!.length - 1;
  log(`\nSpreadsheet: “${spreadsheetTitle(ws)}” with tabs: ${TABS.map((t) => t.name).join(', ')}.`);
  log('\n| Tab | 1st sync appended | 1st sync updated | 2nd sync appended | 2nd sync updated |\n|---|---:|---:|---:|---:|');
  for (const k of Object.keys(first)) log(`| ${k} | ${first[k]![0]} | ${first[k]![1]} | ${second[k]![0]} | ${second[k]![1]} |`);
  log();
  check(sheetRows === approved.length, `Transactions tab has exactly ${approved.length} rows = approved records in the database (no duplicates after re-sync)`);
  check(Object.values(second).every(([a]) => a === 0), 'Second sync appended nothing (idempotent)');

  // 4. Calculations
  log('\n## 4. Financial calculations reconcile');
  log('\n| Month | Personal income | Personal expenses | Net cash surplus | Business revenue | Business net profit | Net cash flow | Reconciled |\n|---|---:|---:|---:|---:|---:|---:|:---:|');
  for (let k = 5; k >= 0; k--) {
    const m = shiftMonth(TODAY.slice(0, 7), -k);
    const r = monthRange(m);
    const pa = allocateAll(personal, PERSONAL_CATEGORIES, { type: 'personal' }, r);
    const ba = allocateAll(business, BUSINESS_CATEGORIES, { type: 'business' }, r);
    const ps = personalSummary(pa);
    const pl = profitAndLoss(ba);
    const ok = reconcile(personal, pa, r).ok && reconcile(business, ba, r).ok;
    if (!ok) failures++;
    log(`| ${m} | ${formatMoney(ps.income)} | ${formatMoney(ps.expenses)} | ${formatMoney(ps.netCashSurplus)} | ${formatMoney(pl.revenue)} | ${formatMoney(pl.netProfit)} | ${formatMoney(pl.netCashFlow)} | ${ok ? '✅' : '❌'} |`);
  }
  const sep = monthRange(shiftMonth(TODAY.slice(0, 7), -1));
  const plSep = profitAndLoss(allocateAll(business, BUSINESS_CATEGORIES, { type: 'business' }, sep));
  log(`\nExcluded from profit in ${sep.from.slice(0, 7)} (cash flow ≠ profit): owner drawings ${formatMoney(plSep.excluded.ownerDrawings)}, loan principal ${formatMoney(plSep.excluded.loanPrincipal)}, capex ${formatMoney(plSep.excluded.capitalExpenditure)}.`);
  check(plSep.netProfit - plSep.netCashFlow === plSep.excluded.ownerDrawings + plSep.excluded.loanPrincipal + plSep.excluded.capitalExpenditure + plSep.excluded.transfers + plSep.excluded.personalExpenses - plSep.excluded.ownerContributions, 'Net profit − net cash flow = exactly the excluded non-P&L movements');

  // 5. Reports
  log('\n## 5. Reports match recorded transactions');
  const docArgs = { workspace: ws, transactions: business, categories: BUSINESS_CATEGORIES, budgets: sampleBudgets(ws.id, 'business'), members: sampleBusinessMembers(), dimensionNames: ctx.dimensionNames, documentLinks: {}, preparedByUid: 'sample_fm', reviewedByUid: 'sample_user', generatedAt: `${TODAY}T08:00:00.000Z`, range: sep };
  const types = ['monthly_expense_statement', 'expense_register', 'departmental', 'vendor', 'income_expenditure', 'profit_and_loss', 'budget_variance', 'receipt_register'] as const;
  log('\n| Report | Reference | Register rows | Recorded total | Report total | Match |\n|---|---|---:|---:|---:|:---:|');
  let seq = 1;
  for (const type of types) {
    const doc = buildReport({ ...docArgs, type, sequence: seq++ });
    if (!doc.reconciliation.matches) failures++;
    log(`| ${doc.title} | ${doc.reference} | ${doc.register.rows.length} | ${formatMoney(doc.reconciliation.transactionTotal)} | ${formatMoney(doc.reconciliation.reportTotal)} | ${doc.reconciliation.matches ? '✅' : '❌'} |`);
  }
  const pnl = buildReport({ ...docArgs, type: 'profit_and_loss', sequence: 99 });
  const reg = buildReport({ ...docArgs, type: 'expense_register', sequence: 100 });
  const pdf = await renderPdf(pnl);
  const xlsx = await renderXlsx(reg);
  writeFileSync(join(OUT, 'sample-profit-and-loss.pdf'), pdf);
  writeFileSync(join(OUT, 'sample-expense-register.pdf'), await renderPdf(reg));
  writeFileSync(join(OUT, 'sample-expense-register.xlsx'), xlsx);
  writeFileSync(join(OUT, 'sample-expense-register.csv'), reportToCsv(reg));
  writeFileSync(join(OUT, 'sample-evidence-package.zip'), await renderEvidenceZip(reg, { pdf: await renderPdf(reg), xlsx }, async () => null));
  log('\nFiles: `sample-profit-and-loss.pdf`, `sample-expense-register.pdf`, `.xlsx`, `.csv`, `sample-evidence-package.zip` (sample data has no receipt images, so the manifest lists them as missing — exactly how a real gap would be reported).');

  log(`\n---\n**Result: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}**`);
  writeFileSync(join(OUT, 'EVIDENCE.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
