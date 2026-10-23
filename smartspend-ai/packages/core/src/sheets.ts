import { allocateAll } from './finance';
import { incomeVsExpenses } from './analytics';
import { toMajor } from './money';
import { lineItemQuantity, unitPricePerBase } from './units';
import type { AuditEvent, Budget, Category, Transaction, Workspace } from './types';
import { normaliseName } from './text';

/**
 * Google Sheets is a synchronised REPORTING/EXPORT layer. The backend database
 * is the authoritative record. Transactional tabs are upserted idempotently
 * keyed on a unique ID column; derived tabs are rewritten in full each sync.
 */

export function spreadsheetTitle(workspace: Pick<Workspace, 'name'>): string {
  return `SmartSpend AI — ${workspace.name} — Financial Records`;
}

export type TabName =
  | 'Transactions'
  | 'Receipt Line Items'
  | 'Income Records'
  | 'Expense Categories'
  | 'Merchants and Brands'
  | 'Monthly Budgets'
  | 'Financial Summary'
  | 'Audit Trail Export'
  | 'Reporting Data';

export const TABS: Array<{ name: TabName; mode: 'upsert' | 'replace'; headers: string[] }> = [
  {
    name: 'Transactions',
    mode: 'upsert',
    headers: ['Transaction ID', 'Version', 'Status', 'Date', 'Type', 'Merchant', 'Receipt / Invoice No', 'Description', 'Approved Category', 'AI Suggested Category', 'Classification', 'Accounting Class', 'Currency', 'Subtotal', 'Discount', 'Tax', 'Total', 'Base Total', 'Payment Method', 'Department', 'Cost Centre', 'Project', 'Business Purpose', 'Submitted By', 'Approved By', 'Approved At', 'Entry Timestamp', 'Source', 'Supporting Document', 'Amends Transaction', 'Superseded By', 'Sync Status', 'Synced At'],
  },
  {
    name: 'Receipt Line Items',
    mode: 'upsert',
    headers: ['Line Item ID', 'Transaction ID', 'Date', 'Merchant', 'Description', 'Brand', 'Product Category', 'Quantity', 'Unit', 'Package Size', 'Unit Price', 'Discount', 'Tax', 'Total', 'Category', 'Price per Base Unit', 'Base Unit', 'Transaction Status'],
  },
  {
    name: 'Income Records',
    mode: 'upsert',
    headers: ['Transaction ID', 'Status', 'Date', 'Payer / Source', 'Reference No', 'Income Category', 'Accounting Class', 'Currency', 'Amount', 'Base Amount', 'Payment Method', 'Description', 'Recorded By', 'Entry Timestamp', 'Sync Status'],
  },
  { name: 'Expense Categories', mode: 'replace', headers: ['Category ID', 'Name (EN)', 'Name (BM)', 'Kind', 'Accounting Class', 'Default', 'Archived'] },
  { name: 'Merchants and Brands', mode: 'replace', headers: ['Type', 'Name', 'Transactions', 'Total Spend', 'First Purchase', 'Last Purchase'] },
  { name: 'Monthly Budgets', mode: 'replace', headers: ['Budget ID', 'Name', 'Period', 'Period Key', 'Scope', 'Scope Value', 'Budget Amount', 'Alert Thresholds (%)'] },
  { name: 'Financial Summary', mode: 'replace', headers: ['Month', 'Income', 'Expenses', 'Net', 'Margin %', 'Expense-to-Income %', 'Basis'] },
  { name: 'Audit Trail Export', mode: 'replace', headers: ['Sequence', 'Event ID', 'Timestamp', 'Entity', 'Entity ID', 'Action', 'Actor', 'Field Changes', 'Reason', 'Hash', 'Previous Hash'] },
  { name: 'Reporting Data', mode: 'replace', headers: ['Transaction ID', 'Line Item ID', 'Date', 'Month', 'Type', 'Category ID', 'Category', 'Accounting Class', 'Amount', 'Merchant', 'Brand', 'Department', 'Cost Centre', 'Project', 'Payment Method'] },
];

export type Cell = string | number | boolean | null;

const money = (minor: number | null | undefined, currency = 'MYR'): Cell => (minor == null ? null : toMajor(minor, currency));

export interface SheetContext {
  categories: Map<string, Category>;
  dimensionNames: Record<string, string>;
  memberNames: Record<string, string>;
  /** transactionId -> link to supporting document (e.g. Drive webViewLink). */
  documentLinks: Record<string, string>;
  syncedAt: string;
}

export function transactionRow(tx: Transaction, ctx: SheetContext): Cell[] {
  const cat = ctx.categories.get(tx.categoryId);
  const aiCat = tx.ai?.suggestedCategoryId ? ctx.categories.get(tx.ai.suggestedCategoryId) : undefined;
  return [
    tx.id, tx.version, tx.status, tx.date, tx.kind, tx.merchant, tx.receiptNumber, tx.description ?? null,
    cat?.name.en ?? tx.categoryId, aiCat?.name.en ?? tx.ai?.suggestedCategoryId ?? null, tx.classification, cat?.accountingClass ?? null,
    tx.currency, money(tx.subtotal, tx.currency), money(tx.discount, tx.currency), money(tx.tax, tx.currency), money(tx.total, tx.currency), money(tx.baseTotal),
    tx.paymentMethod,
    tx.departmentId ? ctx.dimensionNames[tx.departmentId] ?? tx.departmentId : null,
    tx.costCentreId ? ctx.dimensionNames[tx.costCentreId] ?? tx.costCentreId : null,
    tx.projectId ? ctx.dimensionNames[tx.projectId] ?? tx.projectId : null,
    tx.businessPurpose ?? null,
    ctx.memberNames[tx.createdBy] ?? tx.createdBy,
    tx.approvedBy ? ctx.memberNames[tx.approvedBy] ?? tx.approvedBy : null,
    tx.approvedAt ?? null, tx.createdAt, tx.source,
    ctx.documentLinks[tx.id] ?? null,
    tx.amendsTransactionId ?? null, tx.supersededBy ?? null, 'synced', ctx.syncedAt,
  ];
}

export function lineItemRows(tx: Transaction, ctx: SheetContext): Array<{ id: string; values: Cell[] }> {
  return tx.lineItems.map((li) => {
    const q = lineItemQuantity({ description: li.description, packageSize: li.packageSize, quantity: li.quantity || 1, unit: li.unit });
    const ppu = unitPricePerBase(li.total, q);
    return {
      id: li.id,
      values: [
        li.id, tx.id, tx.date, tx.merchant, li.description, li.brand ?? null, li.productCategory ?? null, li.quantity, li.unit ?? null, li.packageSize ?? null,
        money(li.unitPrice, tx.currency), money(li.discount, tx.currency), money(li.tax, tx.currency), money(li.total, tx.currency),
        ctx.categories.get(li.categoryId ?? tx.categoryId)?.name.en ?? li.categoryId ?? tx.categoryId,
        ppu == null ? null : money(ppu, tx.currency), q?.baseUnit ?? null, tx.status,
      ],
    };
  });
}

export function incomeRow(tx: Transaction, ctx: SheetContext): Cell[] {
  const cat = ctx.categories.get(tx.categoryId);
  return [
    tx.id, tx.status, tx.date, tx.merchant ?? tx.incomeSource ?? null, tx.receiptNumber, cat?.name.en ?? tx.categoryId, cat?.accountingClass ?? null,
    tx.currency, money(tx.total, tx.currency), money(tx.baseTotal), tx.paymentMethod, tx.description ?? null,
    ctx.memberNames[tx.createdBy] ?? tx.createdBy, tx.createdAt, 'synced',
  ];
}

export interface UpsertPlan {
  updates: Array<{ rowNumber: number; values: Cell[] }>;
  appends: Cell[][];
  /** IDs that appear more than once in the sheet (e.g. manual copy/paste) — reported, never silently merged. */
  duplicateIdsInSheet: string[];
}

/**
 * Plan an idempotent upsert. `existingIds` is column A from row 2 downward
 * (header in row 1). Re-running the same sync produces only updates — never
 * a second copy of a row.
 */
export function planUpsert(existingIds: Array<string | null | undefined>, rows: Array<{ id: string; values: Cell[] }>): UpsertPlan {
  const index = new Map<string, number>();
  const dupes = new Set<string>();
  existingIds.forEach((id, i) => {
    if (!id) return;
    if (index.has(id)) dupes.add(id);
    else index.set(id, i + 2);
  });
  const updates: UpsertPlan['updates'] = [];
  const appends: Cell[][] = [];
  const seenInBatch = new Set<string>();
  for (const r of rows) {
    if (seenInBatch.has(r.id)) continue;
    seenInBatch.add(r.id);
    const rowNumber = index.get(r.id);
    if (rowNumber) updates.push({ rowNumber, values: r.values });
    else appends.push(r.values);
  }
  return { updates, appends, duplicateIdsInSheet: [...dupes] };
}

export function buildDerivedTabs(input: {
  workspace: Pick<Workspace, 'type'>;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  audit: AuditEvent[];
  dimensionNames: Record<string, string>;
  memberNames: Record<string, string>;
}): Record<Exclude<TabName, 'Transactions' | 'Receipt Line Items' | 'Income Records'>, Cell[][]> {
  const { transactions, categories } = input;
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const approved = transactions.filter((t) => t.status === 'approved');

  const merchantRows = new Map<string, { type: string; name: string; n: number; total: number; first: string; last: string }>();
  const add = (type: string, name: string, amount: number, date: string) => {
    const key = `${type}:${normaliseName(name)}`;
    const e = merchantRows.get(key) ?? { type, name, n: 0, total: 0, first: date, last: date };
    e.n++;
    e.total += amount;
    if (date < e.first) e.first = date;
    if (date > e.last) e.last = date;
    merchantRows.set(key, e);
  };
  for (const t of approved.filter((t) => t.kind === 'expense')) {
    if (t.merchant) add('Merchant', t.merchant, t.baseTotal, t.date);
    for (const li of t.lineItems) if (li.brand) add('Brand', li.brand, li.total, t.date);
  }

  const allocs = allocateAll(transactions, categories, input.workspace);
  const dates = approved.map((t) => t.date).sort();
  const summary =
    dates.length > 0
      ? incomeVsExpenses(allocs, { from: dates[0]!, to: dates[dates.length - 1]! }, 'month')
      : [];

  return {
    'Expense Categories': categories.map((c) => [c.id, c.name.en, c.name.ms, c.kind, c.accountingClass, c.isDefault, !!c.archived]),
    'Merchants and Brands': [...merchantRows.values()]
      .sort((a, b) => b.total - a.total)
      .map((m) => [m.type, m.name, m.n, money(m.total), m.first, m.last]),
    'Monthly Budgets': input.budgets.map((b) => [
      b.id, b.name, b.period, b.periodKey, b.scope.type,
      b.scope.type === 'category' ? catMap.get(b.scope.categoryId)?.name.en ?? b.scope.categoryId
        : b.scope.type === 'merchant' ? b.scope.merchant
        : b.scope.type === 'overall' ? 'All' : input.dimensionNames[b.scope.dimensionId] ?? b.scope.dimensionId,
      money(b.amount), b.alertThresholds.join(', '),
    ]),
    'Financial Summary': summary.map((p) => [p.key, money(p.income), money(p.expenses), money(p.net), p.marginPct, p.expenseToIncomePct, 'Cash basis']),
    'Audit Trail Export': input.audit.map((e) => [
      e.sequence, e.id, e.at, e.entityType, e.entityId, e.action, input.memberNames[e.actorUid] ?? e.actorUid,
      e.changes.map((c) => `${c.field}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`).join('; '),
      e.reason ?? null, e.hash, e.prevHash,
    ]),
    'Reporting Data': allocs.map((a) => [
      a.transactionId, a.lineItemId, a.date, a.date.slice(0, 7), a.kind, a.categoryId, catMap.get(a.categoryId)?.name.en ?? a.categoryId,
      a.accountingClass, money(a.amount), a.merchant, a.brand,
      a.departmentId ? input.dimensionNames[a.departmentId] ?? a.departmentId : null,
      a.costCentreId ? input.dimensionNames[a.costCentreId] ?? a.costCentreId : null,
      a.projectId ? input.dimensionNames[a.projectId] ?? a.projectId : null,
      a.paymentMethod,
    ]),
  };
}
