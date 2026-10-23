import { reportToCsv, sectionToCsv, type ReportDocument } from '@smartspend/core';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';

/**
 * Evidence package: report PDF + XLSX + CSV register + every referenced
 * receipt file + a manifest with SHA-256 hashes so the auditor can verify
 * nothing was altered.
 */
export async function renderEvidenceZip(
  doc: ReportDocument,
  files: { pdf: Buffer; xlsx: Buffer },
  readReceipt: (storagePath: string) => Promise<Buffer | null>,
): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((res, rej) => {
    out.on('end', () => res());
    archive.on('error', rej);
  });
  archive.pipe(out);

  const manifest: Array<{ path: string; sha256: string; transactionId?: string; status: string }> = [];
  const add = (path: string, data: Buffer, extra: Partial<(typeof manifest)[number]> = {}) => {
    archive.append(data, { name: path });
    manifest.push({ path, sha256: createHash('sha256').update(data).digest('hex'), status: 'included', ...extra });
  };
  add(`${doc.reference}.pdf`, files.pdf);
  add(`${doc.reference}.xlsx`, files.xlsx);
  add(`${doc.reference}.csv`, Buffer.from(reportToCsv(doc), 'utf8'));
  add('transaction-register.csv', Buffer.from(sectionToCsv(doc.register), 'utf8'));

  for (const f of doc.receiptFiles) {
    const data = await readReceipt(f.storagePath);
    if (!data) {
      manifest.push({ path: `receipts/${f.fileName}`, sha256: f.sha256, transactionId: f.transactionId, status: 'missing' });
      continue;
    }
    const actual = createHash('sha256').update(data).digest('hex');
    archive.append(data, { name: `receipts/${f.fileName}` });
    manifest.push({ path: `receipts/${f.fileName}`, sha256: actual, transactionId: f.transactionId, status: actual === f.sha256 ? 'verified' : 'HASH MISMATCH' });
  }
  archive.append(JSON.stringify({ reference: doc.reference, generatedAt: doc.meta.generatedAt, company: doc.meta.companyName, files: manifest, disclaimer: doc.disclaimer }, null, 2), { name: 'manifest.json' });
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}
