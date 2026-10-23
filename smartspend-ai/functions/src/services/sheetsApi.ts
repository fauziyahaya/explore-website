import type { Cell } from '@smartspend/core';
import { drive as driveApi } from '@googleapis/drive';
import { sheets as sheetsApi } from '@googleapis/sheets';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'node:stream';

/**
 * Narrow interface over the Google Sheets / Drive APIs used by the sync engine.
 * The real implementation uses the user's OAuth refresh token (held only on
 * the server); tests use the in-memory implementation.
 */
export interface SheetsApi {
  createSpreadsheet(title: string, tabs: Array<{ name: string; headers: string[] }>): Promise<{ spreadsheetId: string; spreadsheetUrl: string }>;
  ensureTabs(spreadsheetId: string, tabs: Array<{ name: string; headers: string[] }>): Promise<void>;
  readColumnA(spreadsheetId: string, tab: string): Promise<string[]>;
  updateRows(spreadsheetId: string, tab: string, rows: Array<{ rowNumber: number; values: Cell[] }>): Promise<void>;
  appendRows(spreadsheetId: string, tab: string, rows: Cell[][]): Promise<void>;
  replaceTab(spreadsheetId: string, tab: string, headers: string[], rows: Cell[][]): Promise<void>;
  uploadFile(folderName: string, name: string, mimeType: string, data: Buffer): Promise<{ fileId: string; webViewLink: string }>;
}

export function colLetter(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}
const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
/** Values are written RAW so user content is never interpreted as a formula. */
const VALUE_INPUT = 'RAW';

export function googleSheetsApi(auth: OAuth2Client): SheetsApi {
  const sheets = sheetsApi({ version: 'v4', auth });
  const drive = driveApi({ version: 'v3', auth });
  const folderCache = new Map<string, string>();

  return {
    async createSpreadsheet(title, tabs) {
      const res = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title, locale: 'en_GB', timeZone: 'Asia/Kuala_Lumpur' },
          sheets: tabs.map((t, i) => ({ properties: { title: t.name, index: i, gridProperties: { frozenRowCount: 1 } } })),
        },
      });
      const spreadsheetId = res.data.spreadsheetId!;
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: VALUE_INPUT, data: tabs.map((t) => ({ range: `${q(t.name)}!A1`, values: [t.headers] })) },
      });
      return { spreadsheetId, spreadsheetUrl: res.data.spreadsheetUrl! };
    },
    async ensureTabs(spreadsheetId, tabs) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
      const have = new Set(meta.data.sheets?.map((s) => s.properties?.title));
      const missing = tabs.filter((t) => !have.has(t.name));
      if (!missing.length) return;
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: missing.map((t) => ({ addSheet: { properties: { title: t.name, gridProperties: { frozenRowCount: 1 } } } })) } });
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: VALUE_INPUT, data: missing.map((t) => ({ range: `${q(t.name)}!A1`, values: [t.headers] })) },
      });
    },
    async readColumnA(spreadsheetId, tab) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${q(tab)}!A2:A`, majorDimension: 'COLUMNS' });
      return (res.data.values?.[0] ?? []).map((v) => String(v ?? ''));
    },
    async updateRows(spreadsheetId, tab, rows) {
      for (let i = 0; i < rows.length; i += 500) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: VALUE_INPUT,
            data: rows.slice(i, i + 500).map((r) => ({ range: `${q(tab)}!A${r.rowNumber}:${colLetter(r.values.length)}${r.rowNumber}`, values: [r.values] })),
          },
        });
      }
    },
    async appendRows(spreadsheetId, tab, rows) {
      if (!rows.length) return;
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `${q(tab)}!A1`, valueInputOption: VALUE_INPUT, insertDataOption: 'INSERT_ROWS', requestBody: { values: rows } });
    },
    async replaceTab(spreadsheetId, tab, headers, rows) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${q(tab)}!A:ZZ` });
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${q(tab)}!A1`, valueInputOption: VALUE_INPUT, requestBody: { values: [headers, ...rows] } });
    },
    async uploadFile(folderName, name, mimeType, data) {
      let folderId = folderCache.get(folderName);
      if (!folderId) {
        const found = await drive.files.list({ q: `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`, fields: 'files(id)', spaces: 'drive' });
        folderId = found.data.files?.[0]?.id ?? undefined;
        if (!folderId) {
          const created = await drive.files.create({ requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' });
          folderId = created.data.id!;
        }
        folderCache.set(folderName, folderId);
      }
      const res = await drive.files.create({ requestBody: { name, parents: [folderId] }, media: { mimeType, body: Readable.from(data) }, fields: 'id,webViewLink' });
      return { fileId: res.data.id!, webViewLink: res.data.webViewLink! };
    },
  };
}

/** In-memory implementation that mimics Sheets semantics (header row 1, data from row 2). */
export class MemorySheetsApi implements SheetsApi {
  books = new Map<string, { title: string; tabs: Map<string, Cell[][]> }>();
  files: Array<{ folder: string; name: string; size: number }> = [];
  calls = { append: 0, update: 0 };
  private n = 0;
  /** Artificial latency to simulate the network (used to test concurrent syncs). */
  constructor(private delayMs = 0) {}

  async createSpreadsheet(title: string, tabs: Array<{ name: string; headers: string[] }>) {
    const id = `mem_sheet_${++this.n}`;
    this.books.set(id, { title, tabs: new Map(tabs.map((t) => [t.name, [t.headers]])) });
    return { spreadsheetId: id, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}` };
  }
  private tab(id: string, tab: string) {
    const b = this.books.get(id);
    if (!b) throw new Error('Spreadsheet not found');
    const t = b.tabs.get(tab);
    if (!t) throw new Error(`Tab ${tab} not found`);
    return t;
  }
  async ensureTabs(id: string, tabs: Array<{ name: string; headers: string[] }>) {
    const b = this.books.get(id)!;
    for (const t of tabs) if (!b.tabs.has(t.name)) b.tabs.set(t.name, [t.headers]);
  }
  async readColumnA(id: string, tab: string) {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    return this.tab(id, tab).slice(1).map((r) => String(r[0] ?? ''));
  }
  async updateRows(id: string, tab: string, rows: Array<{ rowNumber: number; values: Cell[] }>) {
    const t = this.tab(id, tab);
    for (const r of rows) t[r.rowNumber - 1] = r.values;
    this.calls.update += rows.length;
  }
  async appendRows(id: string, tab: string, rows: Cell[][]) {
    this.tab(id, tab).push(...rows);
    this.calls.append += rows.length;
  }
  async replaceTab(id: string, tab: string, headers: string[], rows: Cell[][]) {
    this.books.get(id)!.tabs.set(tab, [headers, ...rows]);
  }
  async uploadFile(folder: string, name: string, _mime: string, data: Buffer) {
    this.files.push({ folder, name, size: data.length });
    return { fileId: `mem_file_${this.files.length}`, webViewLink: `https://drive.google.com/file/d/mem_file_${this.files.length}/view` };
  }
}
