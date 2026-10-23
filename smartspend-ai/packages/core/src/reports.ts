import { allocateAll, countable, inRange, profitAndLoss, personalSummary, reconcile, type DateRange, type Allocation } from './finance';
import { budgetStatus } from './budgets';
import { formatMoney, sum, toMajor } from './money';
import { normaliseName } from './text';
import type { Budget, Category, Member, Transaction, Workspace } from './types';
import { bucketsInRange } from './analytics';

export type ReportType =
  | 'monthly_expense_statement'
  | 'annual_expense_statement'
  | 'expense_register'
  | 'departmental'
  | 'cost_centre_project'
  | 'vendor'
  | 'income_expenditure'
  | 'profit_and_loss'
  | 'budget_variance'
  | 'receipt_register';

export const REPORT_TYPES: Array<{ type: ReportType; code: string; title: { en: string; ms: string }; businessOnly: boolean }> = [
  { type: 'monthly_expense_statement', code: 'MES', title: { en: 'Monthly Company Expense Statement', ms: 'Penyata Perbelanjaan Bulanan Syarikat' }, businessOnly: false },
  { type: 'annual_expense_statement', code: 'AES', title: { en: 'Annual Company Expense Statement', ms: 'Penyata Perbelanjaan Tahunan Syarikat' }, businessOnly: false },
  { type: 'expense_register', code: 'REG', title: { en: 'Detailed Expense Register', ms: 'Daftar Perbelanjaan Terperinci' }, businessOnly: false },
  { type: 'departmental', code: 'DEP', title: { en: 'Departmental Expense Report', ms: 'Laporan Perbelanjaan Jabatan' }, businessOnly: true },
  { type: 'cost_centre_project', code: 'PRJ', title: { en: 'Cost Centre / Project Expense Report', ms: 'Laporan Perbelanjaan Pusat Kos / Projek' }, businessOnly: true },
  { type: 'vendor', code: 'VEN', title: { en: 'Supplier and Vendor Expense Report', ms: 'Laporan Perbelanjaan Pembekal' }, businessOnly: false },
  { type: 'income_expenditure', code: 'IES', title: { en: 'Income and Expenditure Statement', ms: 'Penyata Pendapatan dan Perbelanjaan' }, businessOnly: false },
  { type: 'profit_and_loss', code: 'PNL', title: { en: 'Profit and Loss Statement', ms: 'Penyata Untung Rugi' }, businessOnly: true },
  { type: 'budget_variance', code: 'BVR', title: { en: 'Budget Variance Report', ms: 'Laporan Varians Belanjawan' }, businessOnly: false },
  { type: 'receipt_register', code: 'RCP', title: { en: 'Supporting Receipt Register', ms: 'Daftar Resit Sokongan' }, businessOnly: false },
];

export const REPORT_DISCLAIMER =
  'This report was generated from records captured in SmartSpend AI and is prepared on a cash basis unless stated otherwise. ' +
  'It is NOT a certified or audited financial statement, has not been independently reviewed by a professional accountant or auditor, ' +
  'and does not by itself guarantee compliance with LHDN, SSM, MFRS or other regulatory requirements.';

export type ReportCell = string | number | null;

export interface ReportColumn {
  key: string;
  label: string;
  type: 'text' | 'money' | 'date' | 'number' | 'percent' | 'link';
}

export interface ReportSection {
  title: string;
  columns: ReportColumn[];
  rows: Array<{ cells: ReportCell[]; transactionIds?: string[]; emphasis?: 'subtotal' | 'total' }>;
}

export interface ReportDocument {
  type: ReportType;
  title: string;
  reference: string;
  meta: {
    companyName: string;
    registrationNumber: string | null;
    reportingPeriod: DateRange;
    generatedAt: string;
    currency: string;
    basis: 'Cash basis' | 'Accrual basis';
    preparedBy: string;
    reviewedBy: string | null;
    header: string | null;
    logoPath: string | null;
  };
  sections: ReportSection[];
  /** Detailed transaction register supporting every summary amount (drill-down target). */
  register: ReportSection;
  reconciliation: { transactionTotal: number; reportTotal: number; matches: boolean };
  disclaimer: string;
  receiptFiles: Array<{ transactionId: string; storagePath: string; fileName: string; sha256: string }>;
}

export interface ReportInput {
  type: ReportType;
  workspace: Workspace;
  range: DateRange;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  members: Member[];
  dimensionNames: Record<string, string>;
  documentLinks: Record<string, string>;
  preparedByUid: string;
  reviewedByUid?: string | null;
  generatedAt: string;
  sequence: number;
}

const REGISTER_COLUMNS: ReportColumn[] = [
  { key: 'ref', label: 'Transaction Ref', type: 'text' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'vendor', label: 'Vendor', type: 'text' },
  { key: 'items', label: 'Item Description', type: 'text' },
  { key: 'category', label: 'Expense Category', type: 'text' },
  { key: 'net', label: 'Amount (excl. tax)', type: 'money' },
  { key: 'tax', label: 'Tax', type: 'money' },
  { key: 'total', label: 'Total', type: 'money' },
  { key: 'payment', label: 'Payment Method', type: 'text' },
  { key: 'dept', label: 'Department / Cost Centre', type: 'text' },
  { key: 'purpose', label: 'Business Purpose', type: 'text' },
  { key: 'status', label: 'Approval Status', type: 'text' },
  { key: 'approvedBy', label: 'Approved By', type: 'text' },
  { key: 'receiptRef', label: 'Receipt / Invoice Ref', type: 'text' },
  { key: 'doc', label: 'Supporting Document', type: 'link' },
];

const m = (minor: number) => toMajor(minor);

export function reportReference(workspace: Pick<Workspace, 'id'>, type: ReportType, generatedAt: string, sequence: number): string {
  const code = REPORT_TYPES.find((r) => r.type === type)!.code;
  return `SSA-${workspace.id.slice(-6).toUpperCase()}-${code}-${generatedAt.slice(0, 10).replace(/-/g, '')}-${String(sequence).padStart(4, '0')}`;
}

export function buildReport(input: ReportInput): ReportDocument {
  const { workspace, range, categories } = input;
  const cats = new Map(categories.map((c) => [c.id, c]));
  const names: Record<string, string> = Object.fromEntries(input.members.map((mb) => [mb.uid, mb.displayName]));
  const dim = (id?: string | null) => (id ? input.dimensionNames[id] ?? id : null);
  const catName = (id: string) => cats.get(id)?.name.en ?? id;
  const allocs = allocateAll(input.transactions, categories, workspace, range);
  const expenseAllocs = allocs.filter((a) => a.kind === 'expense');
  const txInRange = input.transactions.filter((t) => countable(t) && inRange(t.date, range));
  const expenses = txInRange.filter((t) => t.kind === 'expense');

  const registerFor = (txs: Transaction[]): ReportSection => ({
    title: 'Transaction Register',
    columns: REGISTER_COLUMNS,
    rows: [...txs]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      .map((t) => ({
        transactionIds: [t.id],
        cells: [
          t.id, t.date, t.merchant ?? '—',
          t.lineItems.length ? t.lineItems.map((l) => l.description).join('; ') : t.description ?? '—',
          [...new Set([t.categoryId, ...t.lineItems.map((l) => l.categoryId).filter(Boolean)])].map((c) => catName(c as string)).join(', '),
          m(t.baseTotal - (t.tax ?? 0)), m(t.tax ?? 0), m(t.baseTotal),
          t.paymentMethod.replace(/_/g, ' '),
          [dim(t.departmentId), dim(t.costCentreId), dim(t.projectId)].filter(Boolean).join(' / ') || '—',
          t.businessPurpose ?? '—', t.status, t.approvedBy ? names[t.approvedBy] ?? t.approvedBy : '—',
          t.receiptNumber ?? '—', input.documentLinks[t.id] ?? (t.receipt ? t.receipt.storagePath : '—'),
        ],
      })),
  });

  const groupSection = (title: string, label: string, keyFn: (a: Allocation) => string, labelFn: (k: string) => string): ReportSection => {
    const g = new Map<string, { amount: number; ids: Set<string> }>();
    for (const a of expenseAllocs) {
      const k = keyFn(a);
      const e = g.get(k) ?? { amount: 0, ids: new Set() };
      e.amount += a.amount;
      e.ids.add(a.transactionId);
      g.set(k, e);
    }
    const totalAmt = sum([...g.values()].map((e) => e.amount));
    const rows: ReportSection['rows'] = [...g.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([k, e]) => ({ cells: [labelFn(k), e.ids.size, m(e.amount), totalAmt ? Math.round((e.amount / totalAmt) * 10000) / 100 : 0], transactionIds: [...e.ids] }));
    rows.push({ cells: ['Total', new Set(expenseAllocs.map((a) => a.transactionId)).size, m(totalAmt), 100], emphasis: 'total' });
    return {
      title,
      columns: [
        { key: 'k', label, type: 'text' },
        { key: 'n', label: 'Transactions', type: 'number' },
        { key: 'amt', label: 'Amount', type: 'money' },
        { key: 'pct', label: '% of Total', type: 'percent' },
      ],
      rows,
    };
  };

  let sections: ReportSection[] = [];
  let registerTxs: Transaction[] = expenses;
  let reportTotal = sum(expenseAllocs.map((a) => a.amount));
  let txTotal = sum(expenses.map((t) => t.baseTotal));

  switch (input.type) {
    case 'monthly_expense_statement':
    case 'expense_register':
      sections = input.type === 'monthly_expense_statement' ? [groupSection('Expenses by Category', 'Expense Category', (a) => a.categoryId, catName)] : [];
      break;
    case 'annual_expense_statement': {
      const months = bucketsInRange(range, 'month');
      const catIds = [...new Set(expenseAllocs.map((a) => a.categoryId))];
      const rows: ReportSection['rows'] = catIds.map((c) => {
        const per = months.map((mo) => sum(expenseAllocs.filter((a) => a.categoryId === c && a.date.startsWith(mo)).map((a) => a.amount)));
        return { cells: [catName(c), ...per.map(m), m(sum(per))], transactionIds: [...new Set(expenseAllocs.filter((a) => a.categoryId === c).map((a) => a.transactionId))] };
      });
      const colTotals = months.map((mo) => sum(expenseAllocs.filter((a) => a.date.startsWith(mo)).map((a) => a.amount)));
      rows.push({ cells: ['Total', ...colTotals.map(m), m(sum(colTotals))], emphasis: 'total' });
      sections = [
        {
          title: 'Expenses by Category and Month',
          columns: [{ key: 'c', label: 'Category', type: 'text' }, ...months.map((mo) => ({ key: mo, label: mo, type: 'money' as const })), { key: 't', label: 'Total', type: 'money' }],
          rows,
        },
        groupSection('Expenses by Category', 'Expense Category', (a) => a.categoryId, catName),
      ];
      break;
    }
    case 'departmental':
      sections = [groupSection('Expenses by Department', 'Department', (a) => a.departmentId ?? 'unassigned', (k) => (k === 'unassigned' ? 'Unassigned' : dim(k)!))];
      break;
    case 'cost_centre_project':
      sections = [
        groupSection('Expenses by Project', 'Project', (a) => a.projectId ?? 'unassigned', (k) => (k === 'unassigned' ? 'Unassigned' : dim(k)!)),
        groupSection('Expenses by Cost Centre', 'Cost Centre', (a) => a.costCentreId ?? 'unassigned', (k) => (k === 'unassigned' ? 'Unassigned' : dim(k)!)),
      ];
      break;
    case 'vendor':
      sections = [groupSection('Expenses by Supplier / Vendor', 'Vendor', (a) => normaliseName(a.merchant) || 'unknown', (k) => {
        const tx = expenses.find((t) => normaliseName(t.merchant) === k);
        return tx?.merchant ?? 'Unknown vendor';
      })];
      break;
    case 'income_expenditure': {
      const ps = personalSummary(allocs);
      const incomeAllocs = allocs.filter((a) => a.kind === 'income');
      const byCat = (list: Allocation[]) => {
        const g = new Map<string, { amt: number; ids: Set<string> }>();
        list.forEach((a) => {
          const e = g.get(a.categoryId) ?? { amt: 0, ids: new Set() };
          e.amt += a.amount;
          e.ids.add(a.transactionId);
          g.set(a.categoryId, e);
        });
        return [...g.entries()].sort((a, b) => b[1].amt - a[1].amt).map(([k, e]) => ({ cells: [catName(k), m(e.amt)] as ReportCell[], transactionIds: [...e.ids] }));
      };
      const cols: ReportColumn[] = [{ key: 'l', label: 'Line', type: 'text' }, { key: 'a', label: 'Amount', type: 'money' }];
      sections = [
        { title: 'Income', columns: cols, rows: [...byCat(incomeAllocs), { cells: ['Total Income', m(ps.income)], emphasis: 'total' }] },
        { title: 'Expenditure', columns: cols, rows: [...byCat(expenseAllocs), { cells: ['Total Expenditure', m(ps.expenses)], emphasis: 'total' }] },
        { title: 'Result', columns: cols, rows: [{ cells: ['Net Surplus / (Deficit)', m(ps.netCashSurplus)], emphasis: 'total' }] },
      ];
      registerTxs = txInRange;
      reportTotal = sum(allocs.map((a) => (a.kind === 'income' ? a.amount : -a.amount)));
      txTotal = sum(txInRange.map((t) => (t.kind === 'income' ? t.baseTotal : -t.baseTotal)));
      break;
    }
    case 'profit_and_loss': {
      const p = profitAndLoss(allocs);
      const ids = (pred: (a: Allocation) => boolean) => [...new Set(allocs.filter(pred).map((a) => a.transactionId))];
      const line = (label: string, amount: number, cls?: string[], emphasis?: 'subtotal' | 'total') => ({
        cells: [label, m(amount)] as ReportCell[],
        transactionIds: cls ? ids((a) => cls.includes(a.accountingClass)) : undefined,
        emphasis,
      });
      const cols: ReportColumn[] = [{ key: 'l', label: 'Line', type: 'text' }, { key: 'a', label: 'Amount', type: 'money' }];
      sections = [
        {
          title: 'Profit and Loss (Cash Basis)',
          columns: cols,
          rows: [
            line('Revenue', p.revenue, ['revenue']),
            line('Less: Cost of Goods Sold', -p.costOfGoodsSold, ['cogs']),
            line('Gross Profit', p.grossProfit, undefined, 'subtotal'),
            line('Add: Other Operating Income', p.otherOperatingIncome, ['other_operating_income']),
            line('Less: Operating Expenses', -p.operatingExpenses, ['operating_expense']),
            line('Operating Profit', p.operatingProfit, undefined, 'subtotal'),
            line('Add: Non-operating Income', p.nonOperatingIncome, ['non_operating_income']),
            line('Less: Other Expenses (incl. financing charges)', -p.otherExpenses, ['other_expense']),
            line('Net Profit / (Loss)', p.netProfit, undefined, 'total'),
          ],
        },
        {
          title: 'Operating Expenses Breakdown',
          columns: cols,
          rows: p.byCategory.filter((c) => c.accountingClass === 'operating_expense').map((c) => ({ cells: [catName(c.categoryId), m(c.amount)], transactionIds: ids((a) => a.categoryId === c.categoryId) })),
        },
        {
          title: 'Margins',
          columns: [{ key: 'l', label: 'Measure', type: 'text' }, { key: 'v', label: 'Value', type: 'percent' }],
          rows: [
            { cells: ['Gross margin', p.grossMarginPct] },
            { cells: ['Operating margin', p.operatingMarginPct] },
            { cells: ['Net margin', p.netMarginPct] },
          ],
        },
        {
          title: 'Cash movements excluded from profit',
          columns: cols,
          rows: [
            line('Capital expenditure (assets)', p.excluded.capitalExpenditure, ['capital_expenditure']),
            line('Owner drawings', p.excluded.ownerDrawings, ['owner_drawing']),
            line('Owner capital contributions', p.excluded.ownerContributions, ['owner_contribution']),
            line('Loan principal repayments', p.excluded.loanPrincipal, ['financing']),
            line('Transfers between accounts', p.excluded.transfers, ['transfer']),
            line('Personal expenses (excluded)', p.excluded.personalExpenses, ['personal_excluded']),
            line('Net cash flow (not profit)', p.netCashFlow, undefined, 'total'),
          ],
        },
      ];
      registerTxs = txInRange;
      reportTotal = sum(allocs.map((a) => (a.kind === 'income' ? a.amount : -a.amount)));
      txTotal = sum(txInRange.map((t) => (t.kind === 'income' ? t.baseTotal : -t.baseTotal)));
      break;
    }
    case 'budget_variance': {
      const months = bucketsInRange(range, 'month');
      const rows: ReportSection['rows'] = [];
      for (const b of input.budgets) {
        const keys = b.period === 'monthly' ? (b.periodKey === '*' ? months : [b.periodKey]) : [b.periodKey === '*' ? range.from.slice(0, 4) : b.periodKey];
        for (const k of keys) {
          const s = budgetStatus({ ...b, periodKey: k }, input.transactions, categories, workspace, `${k.length === 4 ? `${k}-12` : k}-28`);
          rows.push({ cells: [b.name, s.periodLabel, m(b.amount), m(s.spent), m(b.amount - s.spent), s.utilisedPct, s.exceeded ? 'Over budget' : 'Within budget'], transactionIds: s.transactionIds });
        }
      }
      sections = [
        {
          title: 'Budget versus Actual',
          columns: [
            { key: 'b', label: 'Budget', type: 'text' },
            { key: 'p', label: 'Period', type: 'text' },
            { key: 'bud', label: 'Budgeted', type: 'money' },
            { key: 'act', label: 'Actual', type: 'money' },
            { key: 'var', label: 'Variance (favourable +)', type: 'money' },
            { key: 'u', label: '% Utilised', type: 'percent' },
            { key: 's', label: 'Status', type: 'text' },
          ],
          rows,
        },
      ];
      break;
    }
    case 'receipt_register':
      sections = [
        {
          title: 'Supporting Documents',
          columns: [
            { key: 'ref', label: 'Transaction Ref', type: 'text' },
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'vendor', label: 'Vendor', type: 'text' },
            { key: 'rno', label: 'Receipt / Invoice No', type: 'text' },
            { key: 'amt', label: 'Amount', type: 'money' },
            { key: 'file', label: 'Evidence File', type: 'text' },
            { key: 'sha', label: 'SHA-256 (first 16)', type: 'text' },
            { key: 'link', label: 'Link', type: 'link' },
          ],
          rows: expenses.map((t) => ({
            transactionIds: [t.id],
            cells: [t.id, t.date, t.merchant ?? '—', t.receiptNumber ?? '—', m(t.baseTotal), t.receipt ? receiptFileName(t) : 'MISSING — no receipt attached', t.receipt?.sha256.slice(0, 16) ?? '—', input.documentLinks[t.id] ?? '—'],
          })),
        },
      ];
      break;
  }

  const reviewer = input.reviewedByUid ? names[input.reviewedByUid] ?? input.reviewedByUid : null;
  const meta = REPORT_TYPES.find((r) => r.type === input.type)!;
  const rec = reconcile(input.transactions, allocs, range);
  return {
    type: input.type,
    title: meta.title.en,
    reference: reportReference(workspace, input.type, input.generatedAt, input.sequence),
    meta: {
      companyName: workspace.name,
      registrationNumber: workspace.registrationNumber ?? null,
      reportingPeriod: range,
      generatedAt: input.generatedAt,
      currency: workspace.baseCurrency,
      basis: workspace.accountingBasis === 'accrual' ? 'Accrual basis' : 'Cash basis',
      preparedBy: names[input.preparedByUid] ?? input.preparedByUid,
      reviewedBy: reviewer,
      header: workspace.reportHeader ?? null,
      logoPath: workspace.logoPath ?? null,
    },
    sections,
    register: registerFor(registerTxs),
    reconciliation: { transactionTotal: txTotal, reportTotal, matches: txTotal === reportTotal && rec.ok },
    disclaimer: REPORT_DISCLAIMER,
    receiptFiles: registerTxs.filter((t) => t.receipt).map((t) => ({ transactionId: t.id, storagePath: t.receipt!.storagePath, fileName: receiptFileName(t), sha256: t.receipt!.sha256 })),
  };
}

export function receiptFileName(t: Transaction): string {
  const ext = t.receipt?.contentType === 'application/pdf' ? 'pdf' : t.receipt?.contentType === 'image/png' ? 'png' : 'jpg';
  const vendor = normaliseName(t.merchant).replace(/\s+/g, '-').slice(0, 30) || 'receipt';
  return `${t.date}_${vendor}_${t.id}.${ext}`;
}

// ───────────────────────────── Serialisers ─────────────────────────────

function csvEscape(v: ReportCell): string {
  if (v == null) return '';
  const s = String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function sectionToCsv(section: ReportSection): string {
  const lines = [section.columns.map((c) => csvEscape(c.label)).join(',')];
  for (const r of section.rows) lines.push(r.cells.map(csvEscape).join(','));
  return lines.join('\r\n');
}

export function reportToCsv(doc: ReportDocument): string {
  const head = [
    ['Report', doc.title],
    ['Reference', doc.reference],
    ['Company', doc.meta.companyName],
    ['Registration No', doc.meta.registrationNumber ?? '—'],
    ['Reporting Period', `${doc.meta.reportingPeriod.from} to ${doc.meta.reportingPeriod.to}`],
    ['Generated', doc.meta.generatedAt],
    ['Basis', doc.meta.basis],
    ['Currency', doc.meta.currency],
    ['Prepared By', doc.meta.preparedBy],
    ['Reviewed / Approved By', doc.meta.reviewedBy ?? '—'],
  ].map((r) => r.map(csvEscape).join(','));
  const parts = [head.join('\r\n'), ...doc.sections.map((s) => `${csvEscape(s.title)}\r\n${sectionToCsv(s)}`), `${csvEscape(doc.register.title)}\r\n${sectionToCsv(doc.register)}`, csvEscape(doc.disclaimer)];
  return parts.join('\r\n\r\n');
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function formatCell(v: ReportCell, type: ReportColumn['type'], currency = 'MYR'): string {
  if (v == null) return '—';
  if (type === 'money' && typeof v === 'number') return formatMoney(Math.round(v * 100), currency);
  if (type === 'percent' && typeof v === 'number') return `${v.toFixed(2)}%`;
  return String(v);
}

/** Printable HTML (used by expo-print on device for offline PDF export). */
export function reportToHtml(doc: ReportDocument, opts: { logoDataUri?: string } = {}): string {
  const table = (s: ReportSection) => `
    <h2>${esc(s.title)}</h2>
    <table><thead><tr>${s.columns.map((c) => `<th class="${c.type}">${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${s.rows
      .map((r) => `<tr class="${r.emphasis ?? ''}">${r.cells.map((v, i) => `<td class="${s.columns[i]?.type}">${esc(formatCell(v, s.columns[i]?.type ?? 'text', doc.meta.currency))}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)}</title>
<style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0B1F3A;font-size:10px;margin:24px}
  header{display:flex;justify-content:space-between;border-bottom:2px solid #0F766E;padding-bottom:8px;margin-bottom:12px}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:13px;margin:18px 0 6px;color:#0F766E}
  table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #E2E8F0;padding:4px;text-align:left;vertical-align:top}
  th{background:#F1F5F9} .money,.number,.percent{text-align:right;white-space:nowrap}
  tr.subtotal td{font-weight:600;border-top:1px solid #94A3B8} tr.total td{font-weight:700;border-top:2px solid #0B1F3A}
  .meta td{border:none;padding:1px 8px 1px 0} .disclaimer{margin-top:18px;font-size:9px;color:#475569;border-top:1px solid #CBD5E1;padding-top:8px}
  .sig{display:flex;gap:48px;margin-top:28px} .sig div{border-top:1px solid #0B1F3A;width:200px;padding-top:4px}
  .rec{margin-top:10px;font-size:9px}
</style></head><body>
<header><div><h1>${esc(doc.title)}</h1>${doc.meta.header ? `<div>${esc(doc.meta.header)}</div>` : ''}
<table class="meta">
<tr><td>Company</td><td><b>${esc(doc.meta.companyName)}</b></td></tr>
<tr><td>Registration No</td><td>${esc(doc.meta.registrationNumber ?? '—')}</td></tr>
<tr><td>Reporting Period</td><td>${esc(doc.meta.reportingPeriod.from)} to ${esc(doc.meta.reportingPeriod.to)}</td></tr>
<tr><td>Generated</td><td>${esc(doc.meta.generatedAt)}</td></tr>
<tr><td>Basis / Currency</td><td>${esc(doc.meta.basis)} · ${esc(doc.meta.currency)}</td></tr>
<tr><td>Document Ref</td><td>${esc(doc.reference)}</td></tr>
</table></div>${opts.logoDataUri ? `<img src="${opts.logoDataUri}" style="max-height:60px">` : ''}</header>
${doc.sections.map(table).join('')}
${table(doc.register)}
<div class="rec">Reconciliation: transactions ${esc(formatMoney(doc.reconciliation.transactionTotal))} · report ${esc(formatMoney(doc.reconciliation.reportTotal))} · ${doc.reconciliation.matches ? 'MATCHED' : 'MISMATCH — investigate before use'}</div>
<div class="sig"><div>Prepared by: ${esc(doc.meta.preparedBy)}</div><div>Reviewed / Approved by: ${esc(doc.meta.reviewedBy ?? '')}</div></div>
<p class="disclaimer">${esc(doc.disclaimer)}</p>
</body></html>`;
}
