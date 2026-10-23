import { formatCell, formatMoney, type ReportDocument, type ReportSection } from '@smartspend/core';
import PDFDocument from 'pdfkit';

const NAVY = '#0B1F3A';
const TEAL = '#0F766E';
const GREY = '#64748B';

function weights(section: ReportSection): number[] {
  return section.columns.map((c) => (c.type === 'money' || c.type === 'percent' || c.type === 'number' || c.type === 'date' ? 1 : c.type === 'link' ? 1.6 : 1.8));
}

/** Server-side PDF rendering of a ReportDocument (A4 landscape). */
export function renderPdf(doc: ReportDocument, logo?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: doc.title, Author: 'SmartSpend AI', Subject: doc.reference } });
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const left = pdf.page.margins.left;
    const width = pdf.page.width - left - pdf.page.margins.right;
    const bottom = () => pdf.page.height - pdf.page.margins.bottom - 20;

    const footer = () => {
      // Write inside the bottom margin without triggering an automatic page break.
      const { x, y } = pdf;
      const margin = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf.fontSize(7).fillColor(GREY).text(`${doc.reference} · ${doc.meta.companyName} · Generated ${doc.meta.generatedAt}`, left, pdf.page.height - 24, { width, align: 'left', lineBreak: false });
      pdf.page.margins.bottom = margin;
      pdf.x = x;
      pdf.y = y;
    };
    pdf.on('pageAdded', footer);

    // Header
    if (logo) {
      try {
        pdf.image(logo, left + width - 90, 30, { fit: [90, 45] });
      } catch {
        /* ignore invalid logo */
      }
    }
    pdf.fillColor(NAVY).fontSize(16).font('Helvetica-Bold').text(doc.title, left, 36);
    if (doc.meta.header) pdf.font('Helvetica').fontSize(9).fillColor(GREY).text(doc.meta.header);
    pdf.moveDown(0.4).font('Helvetica').fontSize(8.5).fillColor(NAVY);
    const meta: Array<[string, string]> = [
      ['Company', doc.meta.companyName],
      ['Registration No', doc.meta.registrationNumber ?? '—'],
      ['Reporting Period', `${doc.meta.reportingPeriod.from} to ${doc.meta.reportingPeriod.to}`],
      ['Report Generated', doc.meta.generatedAt],
      ['Basis / Currency', `${doc.meta.basis} · ${doc.meta.currency}`],
      ['Document Reference', doc.reference],
      ['Prepared By', doc.meta.preparedBy],
      ['Reviewed / Approved By', doc.meta.reviewedBy ?? '—'],
    ];
    for (const [k, v] of meta) pdf.text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v).font('Helvetica');
    pdf.moveTo(left, pdf.y + 4).lineTo(left + width, pdf.y + 4).strokeColor(TEAL).lineWidth(1.5).stroke();
    pdf.moveDown(0.8);

    const table = (s: ReportSection) => {
      if (pdf.y > bottom() - 60) pdf.addPage();
      pdf.font('Helvetica-Bold').fontSize(11).fillColor(TEAL).text(s.title, left, pdf.y);
      pdf.moveDown(0.3);
      const w = weights(s);
      const total = w.reduce((a, b) => a + b, 0);
      const cols = w.map((x) => (x / total) * width);
      const fontSize = s.columns.length > 10 ? 6.2 : 8;
      const drawRow = (cells: string[], opts: { bold?: boolean; fill?: string; align?: Array<'left' | 'right'> }) => {
        pdf.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
        const h = Math.max(...cells.map((c, i) => pdf.heightOfString(c, { width: cols[i]! - 4 }))) + 4;
        if (pdf.y + h > bottom()) {
          pdf.addPage();
        }
        const y = pdf.y;
        if (opts.fill) pdf.rect(left, y, width, h).fill(opts.fill);
        let x = left;
        cells.forEach((c, i) => {
          pdf.fillColor(NAVY).text(c, x + 2, y + 2, { width: cols[i]! - 4, align: opts.align?.[i] ?? 'left' });
          x += cols[i]!;
        });
        pdf.moveTo(left, y + h).lineTo(left + width, y + h).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
        pdf.y = y + h;
        pdf.x = left;
      };
      const align = s.columns.map((c) => (['money', 'percent', 'number'].includes(c.type) ? 'right' : 'left') as 'left' | 'right');
      drawRow(s.columns.map((c) => c.label), { bold: true, fill: '#F1F5F9', align });
      for (const r of s.rows) {
        drawRow(r.cells.map((v, i) => formatCell(v, s.columns[i]?.type ?? 'text', doc.meta.currency)), { bold: !!r.emphasis, align });
      }
      pdf.moveDown(0.8);
    };

    doc.sections.forEach(table);
    table(doc.register);

    pdf.font('Helvetica').fontSize(8).fillColor(doc.reconciliation.matches ? TEAL : '#B91C1C').text(
      `Reconciliation: recorded transactions ${formatMoney(doc.reconciliation.transactionTotal)} · report total ${formatMoney(doc.reconciliation.reportTotal)} · ${doc.reconciliation.matches ? 'MATCHED' : 'MISMATCH — investigate before use'}`,
      left,
    );
    pdf.moveDown(2);
    if (pdf.y > bottom() - 80) pdf.addPage();
    const y = pdf.y + 20;
    pdf.strokeColor(NAVY).lineWidth(0.8).moveTo(left, y).lineTo(left + 220, y).stroke();
    pdf.moveTo(left + 300, y).lineTo(left + 520, y).stroke();
    pdf.fillColor(NAVY).fontSize(8).text(`Prepared by: ${doc.meta.preparedBy}`, left, y + 4);
    pdf.text(`Reviewed / Approved by: ${doc.meta.reviewedBy ?? ''}`, left + 300, y + 4);
    pdf.moveDown(2).fontSize(7).fillColor(GREY).text(doc.disclaimer, left, pdf.y, { width });
    footer();
    pdf.end();
  });
}
