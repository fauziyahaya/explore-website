import { parseAmount, toMinor } from './money';
import { normaliseDate } from './receipt/normalise';

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface ColumnMapping {
  date: number;
  description: number;
  /** Either a single signed amount column, or separate debit / credit columns. */
  amount?: number;
  debit?: number;
  credit?: number;
  reference?: number;
}

/** Guess column roles from a bank statement header (Maybank, CIMB, Public Bank, RHB style headers). */
export function guessMapping(header: string[]): ColumnMapping | null {
  const h = header.map((x) => x.toLowerCase().trim());
  const find = (...res: RegExp[]) => h.findIndex((c) => res.some((r) => r.test(c)));
  const date = find(/date|tarikh/);
  const description = find(/desc|details|particular|keterangan|transaction|narration|butiran/);
  const debit = find(/debit|withdrawal|pengeluaran|money out/);
  const credit = find(/credit|deposit|kredit|money in/);
  const amount = find(/^amount|amaun|jumlah/);
  const reference = find(/ref|cheque|no\.?$/);
  if (date < 0 || description < 0) return null;
  if (debit >= 0 && credit >= 0) return { date, description, debit, credit, reference: reference >= 0 ? reference : undefined };
  if (amount >= 0) return { date, description, amount, reference: reference >= 0 ? reference : undefined };
  return null;
}

export interface ImportedRow {
  line: number;
  date: string;
  description: string;
  kind: 'expense' | 'income';
  amount: number; // minor, positive
  reference: string | null;
}

export interface ImportResult {
  rows: ImportedRow[];
  errors: Array<{ line: number; message: string }>;
}

export function importBankCsv(text: string, mapping?: ColumnMapping, currency = 'MYR'): ImportResult {
  const all = parseCsv(text);
  const header = all[0] ?? [];
  const map = mapping ?? guessMapping(header);
  if (!map) return { rows: [], errors: [{ line: 1, message: 'Could not recognise the columns. Please map Date, Description and Amount.' }] };
  const rows: ImportedRow[] = [];
  const errors: ImportResult['errors'] = [];
  all.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const date = normaliseDate(r[map.date]);
    if (!date) return errors.push({ line, message: `Invalid date “${r[map.date] ?? ''}”` });
    let signed: number | null = null;
    if (map.amount != null) signed = parseAmount(r[map.amount] ?? '');
    else {
      const d = parseAmount(r[map.debit!] ?? '');
      const c = parseAmount(r[map.credit!] ?? '');
      if (d) signed = -Math.abs(d);
      else if (c) signed = Math.abs(c);
    }
    if (signed == null || signed === 0) return errors.push({ line, message: 'Missing amount' });
    rows.push({
      line,
      date,
      description: (r[map.description] ?? '').trim(),
      kind: signed < 0 ? 'expense' : 'income',
      amount: toMinor(Math.abs(signed), currency),
      reference: map.reference != null ? (r[map.reference] ?? '').trim() || null : null,
    });
  });
  return { rows, errors };
}
