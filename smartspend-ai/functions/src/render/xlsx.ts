import type { ReportDocument, ReportSection } from '@smartspend/core';
import ExcelJS from 'exceljs';

const FMT: Record<string, string> = { money: '#,##0.00;[Red]-#,##0.00', percent: '0.00"%"', number: '0', date: '@' };

function addSection(ws: ExcelJS.Worksheet, s: ReportSection, startRow: number): number {
  ws.getCell(startRow, 1).value = s.title;
  ws.getCell(startRow, 1).font = { bold: true, size: 12, color: { argb: 'FF0F766E' } };
  const header = ws.getRow(startRow + 1);
  s.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  let r = startRow + 2;
  for (const row of s.rows) {
    const xr = ws.getRow(r);
    row.cells.forEach((v, i) => {
      const col = s.columns[i];
      const cell = xr.getCell(i + 1);
      if (col?.type === 'link' && typeof v === 'string' && /^https:\/\//.test(v)) cell.value = { text: 'Open', hyperlink: v };
      else cell.value = v;
      if (col && FMT[col.type]) cell.numFmt = FMT[col.type]!;
    });
    if (row.emphasis) xr.font = { bold: true };
    if (row.transactionIds?.length && row.transactionIds.length <= 50) {
      xr.getCell(s.columns.length + 1).value = row.transactionIds.join(', ');
      xr.getCell(s.columns.length + 1).font = { color: { argb: 'FF94A3B8' }, size: 8 };
    }
    r++;
  }
  ws.getRow(startRow + 1).getCell(s.columns.length + 1).value = 'Drill-down: transaction refs';
  return r + 1;
}

/** XLSX export: Summary sheet + Register sheet + Metadata sheet. */
export async function renderXlsx(doc: ReportDocument): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SmartSpend AI';
  wb.created = new Date(doc.meta.generatedAt);
  wb.title = doc.title;

  const meta = wb.addWorksheet('Report Info');
  meta.columns = [{ width: 28 }, { width: 80 }];
  const rows: Array<[string, string]> = [
    ['Report', doc.title],
    ['Document Reference', doc.reference],
    ['Company', doc.meta.companyName],
    ['Registration No', doc.meta.registrationNumber ?? '—'],
    ['Reporting Period', `${doc.meta.reportingPeriod.from} to ${doc.meta.reportingPeriod.to}`],
    ['Generated', doc.meta.generatedAt],
    ['Basis', doc.meta.basis],
    ['Currency', doc.meta.currency],
    ['Prepared By', doc.meta.preparedBy],
    ['Reviewed / Approved By', doc.meta.reviewedBy ?? '—'],
    ['Reconciliation', doc.reconciliation.matches ? 'MATCHED' : 'MISMATCH'],
    ['Disclaimer', doc.disclaimer],
  ];
  rows.forEach((r) => meta.addRow(r));
  meta.getColumn(1).font = { bold: true };
  meta.getCell('B12').alignment = { wrapText: true };

  const summary = wb.addWorksheet('Summary');
  let next = 1;
  for (const s of doc.sections) next = addSection(summary, s, next);
  if (!doc.sections.length) summary.getCell(1, 1).value = 'See the Transaction Register sheet for the detailed records.';
  (summary.columns ?? []).forEach((c) => (c.width = 20));
  summary.getColumn(1).width = 40;

  const reg = wb.addWorksheet('Transaction Register', { views: [{ state: 'frozen', ySplit: 2 }] });
  addSection(reg, doc.register, 1);
  (reg.columns ?? []).forEach((c) => (c.width = 16));
  reg.getColumn(4).width = 40;
  reg.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: doc.register.columns.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
