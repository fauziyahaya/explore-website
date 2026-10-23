import { DEFAULT_CURRENCY, toMinor } from '../money';
import type {
  ExtractedField,
  ExtractedLineItem,
  ExtractedReceipt,
  ExtractionCheck,
  PaymentMethod,
} from '../types';
import { AiReceiptSchema, type AiReceipt } from './schema';

/** Fields with confidence below this are highlighted for human verification. */
export const REVIEW_THRESHOLD = 0.8;
/** Rounding tolerance (minor units) when reconciling printed totals. */
const TOLERANCE = 2;

const PAYMENT_ALIASES: Array<[RegExp, PaymentMethod]> = [
  [/duit\s*now|qr\s*pay/i, 'duitnow'],
  [/tng|touch\s*'?n\s*go|grab\s*pay|boost|shopee\s*pay|e-?wallet|mae/i, 'ewallet'],
  [/credit|visa|master|amex/i, 'credit_card'],
  [/debit|mydebit|card/i, 'debit_card'],
  [/cash|tunai/i, 'cash'],
  [/transfer|fpx|ibg|jompay|online banking/i, 'bank_transfer'],
  [/cheque|cek/i, 'cheque'],
];

export function normalisePaymentMethod(raw: string | null | undefined): PaymentMethod | null {
  if (!raw) return null;
  const known: PaymentMethod[] = ['cash', 'debit_card', 'credit_card', 'ewallet', 'bank_transfer', 'duitnow', 'cheque', 'other'];
  if ((known as string[]).includes(raw)) return raw as PaymentMethod;
  for (const [re, pm] of PAYMENT_ALIASES) if (re.test(raw)) return pm;
  return 'other';
}

export function normaliseCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (s === 'RM' || s === 'MYR' || s === 'RINGGIT') return 'MYR';
  if (s === 'S$' || s === 'SGD') return 'SGD';
  if (s === '$' || s === 'US$' || s === 'USD') return 'USD';
  return /^[A-Z]{3}$/.test(s) ? s : null;
}

/** Accept YYYY-MM-DD, DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY. Returns null if invalid. */
export function normaliseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s))) {
    // Malaysian convention: day first.
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y.toString().padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const nullField = <T>(): ExtractedField<T> => ({ value: null, confidence: 0 });

function str(f: { value: string | null; confidence: number }): ExtractedField<string> {
  const v = f.value?.trim();
  return v ? { value: v, confidence: f.confidence } : nullField();
}
function amt(f: { value: number | null; confidence: number }, currency: string): ExtractedField<number> {
  return f.value == null || !Number.isFinite(f.value) ? nullField() : { value: toMinor(Math.abs(f.value), currency), confidence: f.confidence };
}
function signedAmt(f: { value: number | null; confidence: number }, currency: string): ExtractedField<number> {
  return f.value == null || !Number.isFinite(f.value) ? nullField() : { value: toMinor(f.value, currency), confidence: f.confidence };
}
function num(f: { value: number | null; confidence: number }): ExtractedField<number> {
  return f.value == null || !Number.isFinite(f.value) || f.value <= 0 ? nullField() : { value: f.value, confidence: f.confidence };
}

function capConfidence<T>(field: ExtractedField<T>, cap: number): void {
  if (field.value != null) field.confidence = Math.min(field.confidence, cap);
}

/**
 * Validate and convert the AI output into an ExtractedReceipt, running
 * arithmetic reconciliation. Values are never filled in or recalculated —
 * failed checks only lower confidence so the UI asks the user to verify.
 */
export function normaliseAiReceipt(
  input: unknown,
  opts: { model: string; today: string; defaultCurrency?: string; rawText?: string },
): ExtractedReceipt {
  const parsed: AiReceipt = AiReceiptSchema.parse(input);
  const currencyValue = normaliseCurrency(parsed.currency.value);
  const currency: ExtractedField<string> = currencyValue
    ? { value: currencyValue, confidence: parsed.currency.confidence }
    : { value: null, confidence: 0 };
  const cur = currency.value ?? opts.defaultCurrency ?? DEFAULT_CURRENCY;

  const dateValue = normaliseDate(parsed.date.value);
  const pm = normalisePaymentMethod(parsed.paymentMethod.value);

  const lineItems: ExtractedLineItem[] = parsed.lineItems
    .filter((li) => li.description.value?.trim())
    .map((li) => ({
      description: str(li.description),
      brand: str(li.brand),
      productCategory: str(li.productCategory),
      quantity: num(li.quantity),
      unit: str(li.unit),
      packageSize: str(li.packageSize),
      unitPrice: amt(li.unitPrice, cur),
      discount: amt(li.discount, cur),
      total: amt(li.total, cur),
    }));

  const receipt: ExtractedReceipt = {
    documentType: parsed.documentType,
    merchant: str(parsed.merchant),
    merchantAddress: str(parsed.merchantAddress),
    merchantTaxId: str(parsed.merchantTaxId),
    date: dateValue ? { value: dateValue, confidence: parsed.date.confidence } : nullField(),
    time: str(parsed.time),
    receiptNumber: str(parsed.receiptNumber),
    currency,
    subtotal: amt(parsed.subtotal, cur),
    discount: amt(parsed.discount, cur),
    tax: amt(parsed.tax, cur),
    serviceCharge: amt(parsed.serviceCharge, cur),
    rounding: signedAmt(parsed.rounding, cur),
    total: amt(parsed.total, cur),
    paymentMethod: pm ? { value: pm, confidence: parsed.paymentMethod.confidence } : nullField(),
    lineItems,
    checks: [],
    overallConfidence: 0,
    model: opts.model,
    rawText: opts.rawText,
  };
  return validateExtraction(receipt, opts.today);
}

/** Re-run reconciliation checks (also used after the user edits fields). */
export function validateExtraction(r: ExtractedReceipt, today: string): ExtractedReceipt {
  const checks: ExtractionCheck[] = [];
  const total = r.total.value;

  checks.push({ code: 'TOTAL_PRESENT', passed: total != null, message: total != null ? 'Total found.' : 'Total amount not found — please enter it.' });
  checks.push({ code: 'DATE_PRESENT', passed: r.date.value != null, message: r.date.value ? 'Date found.' : 'Date not found — please enter it.' });
  checks.push({ code: 'MERCHANT_PRESENT', passed: r.merchant.value != null, message: r.merchant.value ? 'Merchant found.' : 'Merchant name not found.' });
  if (r.date.value) {
    const ok = r.date.value <= today;
    checks.push({ code: 'DATE_NOT_FUTURE', passed: ok, message: ok ? 'Date is not in the future.' : `Date ${r.date.value} is in the future.` });
    if (!ok) capConfidence(r.date, 0.4);
  }

  r.lineItems.forEach((li, i) => {
    const q = li.quantity.value, up = li.unitPrice.value, t = li.total.value;
    if (q != null && up != null && t != null) {
      const expected = Math.round(q * up) - (li.discount.value ?? 0);
      const ok = Math.abs(expected - t) <= TOLERANCE;
      checks.push({
        code: 'QTY_X_PRICE_MATCH',
        passed: ok,
        message: ok ? `Item ${i + 1}: quantity × unit price matches.` : `Item ${i + 1}: ${q} × ${up / 100} − discount ≠ ${t / 100}.`,
      });
      if (!ok) {
        capConfidence(li.total, 0.5);
        capConfidence(li.unitPrice, 0.5);
        capConfidence(li.quantity, 0.5);
      }
    }
  });

  const itemTotals = r.lineItems.map((li) => li.total.value);
  if (itemTotals.length > 0 && itemTotals.every((v) => v != null)) {
    const itemsSum = (itemTotals as number[]).reduce((a, b) => a + b, 0);
    const target = r.subtotal.value ?? null;
    if (target != null) {
      const ok = Math.abs(itemsSum - target) <= TOLERANCE * Math.max(1, r.lineItems.length);
      checks.push({
        code: 'LINE_ITEMS_MATCH_SUBTOTAL',
        passed: ok,
        message: ok ? 'Line items add up to the subtotal.' : `Line items sum to ${itemsSum / 100} but subtotal is ${target / 100}. Some items may be missing or misread.`,
      });
      if (!ok) {
        capConfidence(r.subtotal, 0.55);
        r.lineItems.forEach((li) => capConfidence(li.total, 0.6));
      }
    }
  }

  if (total != null && r.subtotal.value != null) {
    const expected =
      r.subtotal.value - (r.discount.value ?? 0) + (r.tax.value ?? 0) + (r.serviceCharge.value ?? 0) + (r.rounding.value ?? 0);
    const ok = Math.abs(expected - total) <= TOLERANCE;
    checks.push({
      code: 'SUBTOTAL_TAX_MATCH_TOTAL',
      passed: ok,
      message: ok ? 'Subtotal, discount, tax and rounding reconcile to the total.' : `Subtotal − discount + tax + service + rounding = ${expected / 100}, but total is ${total / 100}.`,
    });
    if (!ok) {
      capConfidence(r.total, 0.55);
      capConfidence(r.tax, 0.55);
    }
  }

  r.checks = checks;
  r.overallConfidence = overallConfidence(r);
  return r;
}

function overallConfidence(r: ExtractedReceipt): number {
  const key = [r.total, r.date, r.merchant];
  const keyScores = key.map((f) => (f.value == null ? 0 : f.confidence));
  const minKey = Math.min(...keyScores);
  const failed = r.checks.filter((c) => !c.passed).length;
  const itemScores = r.lineItems.flatMap((li) => [li.description.confidence, li.total.confidence]);
  const itemMean = itemScores.length ? itemScores.reduce((a, b) => a + b, 0) / itemScores.length : 1;
  const score = 0.6 * minKey + 0.4 * itemMean - 0.1 * failed;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

/** List of field paths the UI must highlight for verification. */
export function fieldsNeedingReview(r: ExtractedReceipt): string[] {
  const out: string[] = [];
  const top: Array<keyof ExtractedReceipt> = ['merchant', 'date', 'receiptNumber', 'subtotal', 'tax', 'total', 'paymentMethod', 'currency'];
  for (const k of top) {
    const f = r[k] as ExtractedField<unknown>;
    if (k === 'total' || k === 'date' || k === 'merchant') {
      if (f.value == null || f.confidence < REVIEW_THRESHOLD) out.push(k);
    } else if (f.value != null && f.confidence < REVIEW_THRESHOLD) out.push(k);
  }
  r.lineItems.forEach((li, i) => {
    for (const k of ['description', 'quantity', 'unitPrice', 'total'] as const) {
      const f = li[k];
      if (f.value != null && f.confidence < REVIEW_THRESHOLD) out.push(`lineItems.${i}.${k}`);
    }
    if (li.total.value == null) out.push(`lineItems.${i}.total`);
  });
  return out;
}
