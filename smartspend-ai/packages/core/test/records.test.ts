import { describe, expect, it } from 'vitest';
import {
  amendTransaction,
  appendAuditEvent,
  assertTransition,
  auditInput,
  buildReport,
  BUSINESS_CATEGORIES,
  can,
  importBankCsv,
  lineItemRows,
  monthRange,
  planUpsert,
  REPORT_TYPES,
  reportToCsv,
  reportToHtml,
  sampleBudgets,
  sampleBusinessDimensions,
  sampleBusinessMembers,
  sampleBusinessTransactions,
  sampleBusinessWorkspace,
  spreadsheetTitle,
  TABS,
  transactionRow,
  verifyChain,
  WorkflowError,
  type AuditEvent,
  type SheetContext,
} from '../src';

const TODAY = '2026-10-23';
const business = sampleBusinessTransactions(TODAY);
const ws = sampleBusinessWorkspace();

describe('audit trail', () => {
  it('builds a verifiable hash chain and detects tampering', () => {
    let chain: AuditEvent[] = [];
    const t = business[0]!;
    chain = [...chain, appendAuditEvent(chain, auditInput(t, 'created', 'u1', '2026-10-01T00:00:00Z'))];
    chain = [...chain, appendAuditEvent(chain, auditInput(t, 'approved', 'u2', '2026-10-01T01:00:00Z', [{ field: 'status', before: 'submitted', after: 'approved' }]))];
    chain = [...chain, appendAuditEvent(chain, auditInput(t, 'amended', 'u2', '2026-10-02T00:00:00Z', [{ field: 'total', before: 100, after: 120 }], 'Typo'))];
    expect(verifyChain(chain).valid).toBe(true);

    const tampered = chain.map((e, i) => (i === 1 ? { ...e, actorUid: 'attacker' } : e));
    expect(verifyChain(tampered)).toMatchObject({ valid: false, brokenAt: 1 });
    expect(verifyChain([chain[0]!, chain[2]!]).valid).toBe(false); // deletion
  });

  it('amends approved records without overwriting them', () => {
    const original = business.find((t) => t.status === 'approved' && t.kind === 'expense')!;
    const { superseded, amended, changes } = amendTransaction(original, { total: original.total + 500, baseTotal: original.total + 500 }, { actorUid: 'sample_fm', reason: 'Receipt shows RM5 service charge', now: '2026-10-23T00:00:00Z', newId: 'amend1', role: 'finance_manager' });
    expect(superseded).toMatchObject({ id: original.id, status: 'superseded', supersededBy: 'amend1', total: original.total });
    expect(amended).toMatchObject({ id: 'amend1', version: 2, amendsTransactionId: original.id, total: original.total + 500, status: 'approved' });
    expect(changes.map((c) => c.field)).toEqual(expect.arrayContaining(['total', 'baseTotal']));
    expect(() => amendTransaction(original, { total: 1 }, { actorUid: 'x', reason: '', now: '', newId: 'a', role: 'finance_manager' })).toThrow(WorkflowError);
    expect(() => amendTransaction(original, { total: 1 }, { actorUid: 'x', reason: 'r', now: '', newId: 'a', role: 'employee' })).toThrow(/permission/);
    expect(() => amendTransaction(original, { createdBy: 'x' }, { actorUid: 'x', reason: 'r', now: '', newId: 'a', role: 'owner' })).toThrow(/cannot be amended/);
  });

  it('enforces roles and segregation of duties', () => {
    const biz = { workspaceType: 'business' as const, approvalRequired: true };
    expect(() => assertTransition('submitted', 'approved', { role: 'employee', isCreator: true, ...biz })).toThrow();
    expect(() => assertTransition('submitted', 'approved', { role: 'approver', isCreator: true, ...biz })).toThrow(/Segregation/);
    expect(() => assertTransition('submitted', 'approved', { role: 'approver', isCreator: false, ...biz })).not.toThrow();
    expect(() => assertTransition('approved', 'draft', { role: 'owner', isCreator: true, ...biz })).toThrow();
    expect(() => assertTransition('draft', 'approved', { role: 'owner', isCreator: true, workspaceType: 'personal', approvalRequired: false })).not.toThrow();
    expect(can('auditor', 'transaction.create')).toBe(false);
    expect(can('auditor', 'audit.view')).toBe(true);
  });
});

describe('Google Sheets mapping', () => {
  const ctx: SheetContext = { categories: new Map(BUSINESS_CATEGORIES.map((c) => [c.id, c])), dimensionNames: {}, memberNames: {}, documentLinks: {}, syncedAt: '2026-10-23T00:00:00Z' };

  it('names the spreadsheet and defines the nine tabs', () => {
    expect(spreadsheetTitle(ws)).toBe('SmartSpend AI — Teratai Contoh Trading Sdn. Bhd. (Sample) — Financial Records');
    expect(TABS.map((t) => t.name)).toEqual(['Transactions', 'Receipt Line Items', 'Income Records', 'Expense Categories', 'Merchants and Brands', 'Monthly Budgets', 'Financial Summary', 'Audit Trail Export', 'Reporting Data']);
    for (const t of TABS.filter((x) => x.name === 'Transactions')) expect(transactionRow(business[0]!, ctx)).toHaveLength(t.headers.length);
    const withItems = business.find((t) => t.lineItems.length)!;
    expect(lineItemRows(withItems, ctx)[0]!.values).toHaveLength(TABS[1]!.headers.length);
  });

  it('upsert is idempotent: re-syncing produces updates only, never duplicate rows', () => {
    const rows = business.slice(0, 5).map((t) => ({ id: t.id, values: transactionRow(t, ctx) }));
    const first = planUpsert([], rows);
    expect(first.appends).toHaveLength(5);
    expect(first.updates).toHaveLength(0);
    const sheetIds = first.appends.map((r) => r[0] as string);
    const second = planUpsert(sheetIds, rows);
    expect(second.appends).toHaveLength(0);
    expect(second.updates.map((u) => u.rowNumber)).toEqual([2, 3, 4, 5, 6]);
    const third = planUpsert(sheetIds, [...rows, rows[0]!, { id: 'new', values: [] }]);
    expect(third.appends).toHaveLength(1);
    expect(planUpsert(['a', 'a'], []).duplicateIdsInSheet).toEqual(['a']);
  });
});

describe('reports', () => {
  const base = {
    workspace: ws, transactions: business, categories: BUSINESS_CATEGORIES, budgets: sampleBudgets(ws.id, 'business'), members: sampleBusinessMembers(),
    dimensionNames: Object.fromEntries(sampleBusinessDimensions().map((d) => [d.id, d.name])), documentLinks: {}, preparedByUid: 'sample_fm', reviewedByUid: 'sample_uid',
    generatedAt: '2026-10-23T08:00:00.000Z', sequence: 1, range: monthRange('2026-09'),
  };

  it('every report type reconciles to the recorded transactions and includes required metadata', () => {
    for (const r of REPORT_TYPES) {
      const doc = buildReport({ ...base, type: r.type });
      expect(doc.reconciliation.matches, r.type).toBe(true);
      expect(doc.meta.companyName).toBe(ws.name);
      expect(doc.meta.registrationNumber).toBe(ws.registrationNumber);
      expect(doc.reference).toMatch(/^SSA-[A-Z_]+-\w{3}-20261023-0001$/);
      expect(doc.disclaimer).toMatch(/NOT a certified or audited financial statement/);
      expect(doc.register.columns.map((c) => c.label)).toEqual(expect.arrayContaining(['Transaction Ref', 'Vendor', 'Tax', 'Payment Method', 'Business Purpose', 'Approval Status', 'Receipt / Invoice Ref', 'Supporting Document']));
    }
  });

  it('P&L report totals match the engine and drill down to source transactions', () => {
    const doc = buildReport({ ...base, type: 'profit_and_loss' });
    const pl = doc.sections[0]!;
    const net = pl.rows.find((r) => r.cells[0] === 'Net Profit / (Loss)')!.cells[1] as number;
    const revenueRow = pl.rows.find((r) => r.cells[0] === 'Revenue')!;
    const ids = new Set(business.map((t) => t.id));
    expect(revenueRow.transactionIds!.every((id) => ids.has(id))).toBe(true);
    const revenue = business.filter((t) => t.status === 'approved' && t.date.startsWith('2026-09') && t.categoryId.startsWith('b_revenue')).reduce((s, t) => s + t.baseTotal, 0);
    expect(revenueRow.cells[1]).toBe(revenue / 100);
    expect(typeof net).toBe('number');
  });

  it('CSV export neutralises formula injection and HTML escapes content', () => {
    const target = business.find((t) => t.kind === 'expense' && t.status === 'approved' && t.date.startsWith('2026-09'))!;
    const evil = business.map((t) => (t.id === target.id ? { ...t, merchant: '=HYPERLINK("http://evil")' } : t));
    const doc = buildReport({ ...base, transactions: evil, type: 'expense_register' });
    const csv = reportToCsv(doc);
    expect(csv).not.toMatch(/,=HYPERLINK/);
    expect(csv).toContain(`'=HYPERLINK`);
    expect(reportToHtml({ ...doc, meta: { ...doc.meta, companyName: '<script>x</script>' } })).not.toContain('<script>x');
  });
});

describe('CSV bank statement import', () => {
  it('parses debit/credit statements with quoted fields', () => {
    const csv = 'Date,Description,Debit,Credit,Reference\r\n01/10/2026,"TNB, ELECTRICITY",180.50,,REF1\r\n02/10/2026,SALARY OCT,,6500.00,REF2\r\nbad,row,1,,\r\n';
    const r = importBankCsv(csv);
    expect(r.rows).toEqual([
      { line: 2, date: '2026-10-01', description: 'TNB, ELECTRICITY', kind: 'expense', amount: 18050, reference: 'REF1' },
      { line: 3, date: '2026-10-02', description: 'SALARY OCT', kind: 'income', amount: 650000, reference: 'REF2' },
    ]);
    expect(r.errors).toHaveLength(1);
  });
  it('parses signed amount columns', () => {
    const r = importBankCsv('Tarikh,Keterangan,Amaun\n2026-10-03,GRAB,-23.40\n');
    expect(r.rows[0]).toMatchObject({ kind: 'expense', amount: 2340 });
  });
});
