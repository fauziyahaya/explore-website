import { describe, expect, it } from 'vitest';
import {
  draftFromExtraction,
  fieldsNeedingReview,
  normaliseAiReceipt,
  normaliseDate,
  parseOcrText,
  PERSONAL_CATEGORIES,
  SAMPLE_RECEIPT_TEXTS,
  validateForSave,
  type AiReceipt,
} from '../src';

const TODAY = '2026-10-23';
const f = <T>(value: T | null, confidence = 0.95) => ({ value, confidence });

function aiReceipt(overrides: Partial<AiReceipt> = {}): AiReceipt {
  return {
    documentType: 'receipt',
    merchant: f("Lotus's Mutiara Damansara"),
    merchantAddress: f(null, 0),
    merchantTaxId: f('W10-1808-31000123'),
    date: f('14/10/2026'),
    time: f('18:42'),
    receiptNumber: f('0123-456-78901'),
    currency: f('RM'),
    subtotal: f(73.08),
    discount: f(null, 0),
    tax: f(null, 0),
    serviceCharge: f(null, 0),
    rounding: f(null, 0),
    total: f(73.08),
    paymentMethod: f('VISA'),
    lineItems: [
      { description: f('BERAS WANGI FAIZA 5KG'), brand: f('Faiza'), productCategory: f('rice'), quantity: f(1), unit: f('pcs'), packageSize: f('5KG'), unitPrice: f(23.9), discount: f(null, 0), total: f(23.9) },
      { description: f('SAJI MINYAK MASAK 5KG'), brand: f('Saji'), productCategory: f('cooking oil'), quantity: f(1), unit: f('pcs'), packageSize: f('5KG'), unitPrice: f(29.9), discount: f(null, 0), total: f(29.9) },
      { description: f('DUTCH LADY FULL CREAM 1L'), brand: f('Dutch Lady'), productCategory: f('milk'), quantity: f(2), unit: f('pcs'), packageSize: f('1L'), unitPrice: f(7.49), discount: f(null, 0), total: f(14.98) },
      { description: f('GARDENIA ORIGINAL 600G'), brand: f('Gardenia'), productCategory: f('bread'), quantity: f(1), unit: f('pcs'), packageSize: f('600G'), unitPrice: f(4.3), discount: f(null, 0), total: f(4.3) },
    ],
    ...overrides,
  };
}

describe('AI receipt normalisation', () => {
  it('converts amounts to sen, normalises date/currency/payment and passes all reconciliation checks', () => {
    const r = normaliseAiReceipt(aiReceipt(), { model: 'gemini-test', today: TODAY });
    expect(r.total.value).toBe(7308);
    expect(r.date.value).toBe('2026-10-14');
    expect(r.currency.value).toBe('MYR');
    expect(r.paymentMethod.value).toBe('credit_card');
    expect(r.lineItems).toHaveLength(4);
    expect(r.lineItems[2]!.total.value).toBe(1498);
    expect(r.checks.every((c) => c.passed)).toBe(true);
    expect(r.overallConfidence).toBeGreaterThan(0.85);
    expect(fieldsNeedingReview(r)).toEqual([]);
  });

  it('never invents missing values: a missing total stays null and blocks saving', () => {
    const r = normaliseAiReceipt(aiReceipt({ total: f(null, 0), subtotal: f(null, 0) }), { model: 'm', today: TODAY });
    expect(r.total.value).toBeNull();
    expect(r.checks.find((c) => c.code === 'TOTAL_PRESENT')!.passed).toBe(false);
    expect(fieldsNeedingReview(r)).toContain('total');
    const draft = draftFromExtraction({
      id: 'tx1', extraction: r, extractionId: 'ex1',
      workspace: { id: 'w', type: 'personal', baseCurrency: 'MYR', isSample: false },
      categories: PERSONAL_CATEGORIES, uid: 'u', now: `${TODAY}T00:00:00Z`, source: 'camera',
    });
    expect(draft.total).toBe(0);
    const v = validateForSave(draft, TODAY);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain('Total amount must be greater than zero.');
  });

  it('flags arithmetic inconsistencies and lowers confidence instead of correcting values', () => {
    const r = normaliseAiReceipt(aiReceipt({ total: f(78.08) }), { model: 'm', today: TODAY });
    const check = r.checks.find((c) => c.code === 'SUBTOTAL_TAX_MATCH_TOTAL')!;
    expect(check.passed).toBe(false);
    expect(r.total.value).toBe(7808); // unchanged
    expect(r.total.confidence).toBeLessThan(0.8);
    expect(fieldsNeedingReview(r)).toContain('total');
  });

  it('detects a misread line item via quantity × unit price', () => {
    const bad = aiReceipt();
    bad.lineItems[2]!.total = f(15.98);
    const r = normaliseAiReceipt(bad, { model: 'm', today: TODAY });
    expect(r.checks.some((c) => c.code === 'QTY_X_PRICE_MATCH' && !c.passed)).toBe(true);
    expect(fieldsNeedingReview(r)).toContain('lineItems.2.total');
  });

  it('rejects future dates and malformed AI output', () => {
    const r = normaliseAiReceipt(aiReceipt({ date: f('2027-01-01') }), { model: 'm', today: TODAY });
    expect(r.checks.find((c) => c.code === 'DATE_NOT_FUTURE')!.passed).toBe(false);
    expect(() => normaliseAiReceipt({ merchant: 'x' }, { model: 'm', today: TODAY })).toThrow();
  });

  it('parses Malaysian date formats strictly', () => {
    expect(normaliseDate('14/10/2026')).toBe('2026-10-14');
    expect(normaliseDate('5-1-26')).toBe('2026-01-05');
    expect(normaliseDate('31/02/2026')).toBeNull();
    expect(normaliseDate('Oct 14')).toBeNull();
  });

  it('auto-categorises each line item and the receipt header', () => {
    const r = normaliseAiReceipt(aiReceipt(), { model: 'm', today: TODAY });
    const draft = draftFromExtraction({
      id: 'tx1', extraction: r, extractionId: 'ex1',
      workspace: { id: 'w', type: 'personal', baseCurrency: 'MYR', isSample: false },
      categories: PERSONAL_CATEGORIES, uid: 'u', now: `${TODAY}T00:00:00Z`, source: 'camera',
    });
    expect(draft.categoryId).toBe('p_groceries');
    expect(draft.lineItems.every((l) => l.categoryId === 'p_groceries')).toBe(true);
    expect(draft.status).toBe('draft');
    expect(validateForSave(draft, TODAY).ok).toBe(true);
  });
});

describe('OCR text fallback parser', () => {
  it('extracts a grocery receipt and reconciles', () => {
    const raw = parseOcrText(SAMPLE_RECEIPT_TEXTS.grocery!);
    const r = normaliseAiReceipt(raw, { model: 'ocr-heuristic', today: TODAY });
    expect(r.merchant.value).toMatch(/LOTUS/);
    expect(r.date.value).toBe('2026-10-14');
    expect(r.receiptNumber.value).toBe('0123-456-78901');
    expect(r.total.value).toBe(7308);
    expect(r.subtotal.value).toBe(7308);
    expect(r.lineItems.map((l) => l.total.value)).toEqual([2390, 2990, 1498, 430]);
    expect(r.lineItems[2]!.quantity.value).toBe(2);
    expect(r.checks.find((c) => c.code === 'LINE_ITEMS_MATCH_SUBTOTAL')!.passed).toBe(true);
    expect(r.paymentMethod.value).toBe('credit_card');
  });

  it('extracts SST and rounding from a cafe receipt', () => {
    const r = normaliseAiReceipt(parseOcrText(SAMPLE_RECEIPT_TEXTS.cafe!), { model: 'ocr-heuristic', today: TODAY });
    expect(r.tax.value).toBe(134);
    expect(r.rounding.value).toBe(1);
    expect(r.total.value).toBe(2375);
    expect(r.checks.find((c) => c.code === 'SUBTOTAL_TAX_MATCH_TOTAL')!.passed).toBe(true);
    expect(r.paymentMethod.value).toBe('ewallet');
    // OCR heuristics are deliberately low-confidence so the user verifies.
    expect(fieldsNeedingReview(r).length).toBeGreaterThan(0);
  });
});
