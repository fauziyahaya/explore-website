import { parseAmount } from '../money';
import type { AiReceipt } from './schema';

/**
 * Deterministic fallback parser for plain OCR text (Google Cloud Vision
 * TEXT_DETECTION output, or on-device text recognition). Produces the same
 * shape as the AI extractor so it runs through the same validation pipeline.
 * Confidence values are deliberately conservative.
 */

const AMOUNT = String.raw`-?(?:RM\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?(?:RM\s*)?\d+\.\d{2}`;
const AMOUNT_RE = new RegExp(`(${AMOUNT})\\s*[A-Z]?\\s*$`, 'i');

const SUMMARY_PATTERNS: Array<[keyof Pick<AiReceipt, 'subtotal' | 'discount' | 'tax' | 'serviceCharge' | 'rounding' | 'total'>, RegExp]> = [
  ['subtotal', /\b(sub\s*-?\s*total|jumlah\s*kecil|total\s*before\s*tax|total\s*excl)/i],
  ['discount', /\b(discount|diskaun|potongan|disc\b|savings)/i],
  ['tax', /\b(sst|gst|service\s*tax|sales\s*tax|cukai|tax\b)/i],
  ['serviceCharge', /\b(service\s*charge|svc\s*chg|caj\s*perkhidmatan)/i],
  ['rounding', /\b(rounding|pembundaran|round\s*adj)/i],
  ['total', /\b(grand\s*total|total\s*amount|net\s*total|jumlah\s*besar|jumlah|total|amount\s*due|nett)\b/i],
];
const NON_ITEM = /\b(cash|tunai|change|baki|tendered|visa|master|card|kad|ewallet|tng|duitnow|qty|item\(s\)|no\.? of items|thank|terima kasih|tel|fax|gst\s*id|sst\s*no|reg\.?\s*no|invoice|receipt|resit|cashier|kaunter|counter|member|points)\b/i;

const f = <T>(value: T | null, confidence: number) => ({ value, confidence: value == null ? 0 : confidence });

export function parseOcrText(text: string): AiReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Merchant: first line with letters that isn't an address / number line.
  const merchantLine = lines.slice(0, 5).find((l) => /[A-Za-z]{3,}/.test(l) && !/^(tel\b|no\.|lot\b|jalan\b|jln\b|\(|\d)/i.test(l)) ?? null;
  const taxIdMatch = text.match(/\b(?:SST|GST)\s*(?:ID|NO|REG(?:\.|ISTRATION)?)?\s*[:.]?\s*([A-Z0-9-]{8,})/i);

  const dateMatch = text.match(/\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)?\b/i);
  const receiptNo = text.match(/\b(?:receipt|resit|invoice|invois|inv|bill|doc|trans(?:action)?)[ \t]*(?:no\.?|#|number|num)[ \t]*[:.]?[ \t]*([A-Z0-9][A-Z0-9\-/]{3,})/i);

  const summary: Partial<Record<string, number>> = {};
  const items: AiReceipt['lineItems'] = [];
  let reachedSummary = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const am = AMOUNT_RE.exec(line);
    const summaryHit = SUMMARY_PATTERNS.find(([, re]) => re.test(line));
    if (summaryHit) {
      reachedSummary = summaryHit[0] === 'total' || summaryHit[0] === 'subtotal' || reachedSummary;
      const value = am ? parseAmount(am[1]!) : null;
      // Prefer the first match for each summary key, except "total" which may be refined by "grand total".
      if (value != null && (summary[summaryHit[0]] == null || /grand|net|nett|amount due/i.test(line))) {
        summary[summaryHit[0]] = summaryHit[0] === 'discount' ? Math.abs(value) : value;
      }
      continue;
    }
    if (reachedSummary || !am || NON_ITEM.test(line)) continue;
    const total = parseAmount(am[1]!);
    if (total == null || total <= 0) continue;
    let desc = line.slice(0, am.index).trim();
    let quantity: number | null = null;
    let unitPrice: number | null = null;
    // "2 x 3.50" / "2 @ 3.50" pattern on the same line or the following line
    const qtyRe = /(\d+(?:\.\d+)?)\s*[x@]\s*(?:RM\s*)?(\d+\.\d{2})/i;
    const qm = qtyRe.exec(desc);
    if (qm) {
      quantity = Number(qm[1]);
      unitPrice = Number(qm[2]);
      desc = desc.replace(qm[0], '').trim();
    } else if (!/[A-Za-z]{2,}/.test(desc) && items.length > 0) {
      continue;
    }
    if (!/[A-Za-z]{2,}/.test(desc)) {
      // Description may be on the previous line (two-line item format).
      const prev = lines[i - 1];
      if (prev && /[A-Za-z]{2,}/.test(prev) && !AMOUNT_RE.test(prev)) desc = prev;
      else continue;
    }
    desc = desc.replace(/^\d{6,}\s+/, ''); // strip barcode/SKU prefix
    const pkg = desc.match(/\b(\d+(?:\.\d+)?\s*(?:kg|g|gm|l|ltr|ml|pcs|s)|\d+\s*[x×]\s*\d+(?:\.\d+)?\s*(?:g|ml|l|kg))\b/i);
    items.push({
      description: f(desc, 0.6),
      brand: f(null, 0),
      productCategory: f(null, 0),
      quantity: f(quantity ?? 1, quantity ? 0.6 : 0.4),
      unit: f(null, 0),
      packageSize: f(pkg ? pkg[1]!.toUpperCase().replace(/\s/g, '') : null, 0.5),
      unitPrice: f(unitPrice ?? (quantity ? null : total), unitPrice ? 0.6 : 0.4),
      discount: f(null, 0),
      total: f(total, 0.6),
    });
  }

  const pmMatch = text.match(/\b(cash|tunai|visa|mastercard|master|debit|credit|duitnow|tng|touch ?n ?go|grabpay|boost|shopeepay|fpx|jompay)\b/i);
  const hasRM = /\bRM\b|MYR/i.test(text);

  return {
    documentType: /invoice|invois/i.test(text) ? 'invoice' : 'receipt',
    merchant: f(merchantLine, 0.55),
    merchantAddress: f(null, 0),
    merchantTaxId: f(taxIdMatch?.[1] ?? null, 0.5),
    date: f(dateMatch?.[1] ?? null, 0.6),
    time: f(timeMatch?.[0] ?? null, 0.6),
    receiptNumber: f(receiptNo?.[1] ?? null, 0.5),
    currency: f(hasRM ? 'MYR' : null, 0.7),
    subtotal: f(summary.subtotal ?? null, 0.65),
    discount: f(summary.discount ?? null, 0.6),
    tax: f(summary.tax ?? null, 0.6),
    serviceCharge: f(summary.serviceCharge ?? null, 0.6),
    rounding: f(summary.rounding ?? null, 0.6),
    total: f(summary.total ?? null, 0.7),
    paymentMethod: f(pmMatch?.[1]?.toLowerCase() ?? null, 0.6),
    lineItems: items,
  };
}
