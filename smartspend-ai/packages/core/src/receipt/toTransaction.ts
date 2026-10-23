import { dominantCategory, suggestCategory, type CategoryMemory } from '../categoriser';
import { transactionFingerprint } from '../duplicates';
import { DEFAULT_CURRENCY } from '../money';
import type {
  Category,
  Classification,
  ExtractedReceipt,
  LineItem,
  ReceiptAttachment,
  Transaction,
  TransactionSource,
  Workspace,
} from '../types';

/**
 * Build an editable transaction draft from an AI extraction. Missing values
 * stay null/empty — the review screen requires the user to provide the total
 * and date before saving.
 */
export function draftFromExtraction(input: {
  id: string;
  extraction: ExtractedReceipt;
  extractionId: string;
  workspace: Pick<Workspace, 'id' | 'type' | 'baseCurrency' | 'isSample'>;
  categories: Category[];
  memory?: CategoryMemory;
  uid: string;
  now: string;
  source: TransactionSource;
  receipt?: ReceiptAttachment | null;
}): Transaction {
  const { extraction: x, workspace } = input;
  const merchant = x.merchant.value;
  const lineItems: LineItem[] = x.lineItems.map((li, i) => {
    const s = suggestCategory(
      { merchant, description: [li.description.value, li.productCategory.value].filter(Boolean).join(' '), kind: 'expense' },
      input.categories,
      workspace.type,
      input.memory,
    );
    return {
      id: `${input.id}_li${i + 1}`,
      description: li.description.value ?? '',
      brand: li.brand.value,
      productCategory: li.productCategory.value,
      quantity: li.quantity.value ?? 1,
      unit: li.unit.value,
      packageSize: li.packageSize.value,
      unitPrice: li.unitPrice.value,
      discount: li.discount.value ?? 0,
      tax: 0,
      total: li.total.value ?? 0,
      categoryId: s.categoryId,
    };
  });
  const header = suggestCategory({ merchant, description: lineItems.map((l) => l.description).join(' '), kind: 'expense' }, input.categories, workspace.type, input.memory);
  const categoryId = header.source === 'learned_merchant' ? header.categoryId : dominantCategory(lineItems, header.categoryId);
  const currency = x.currency.value ?? workspace.baseCurrency ?? DEFAULT_CURRENCY;
  const total = x.total.value ?? 0;
  const classification: Classification = workspace.type === 'business' ? 'business' : 'personal';
  const tx: Transaction = {
    id: input.id,
    workspaceId: workspace.id,
    kind: 'expense',
    date: x.date.value ?? '',
    merchant,
    receiptNumber: x.receiptNumber.value,
    currency,
    total,
    subtotal: x.subtotal.value,
    tax: x.tax.value,
    discount: x.discount.value,
    rounding: x.rounding.value,
    fxRateToBase: currency === workspace.baseCurrency ? null : undefined,
    baseTotal: currency === workspace.baseCurrency ? total : 0,
    paymentMethod: x.paymentMethod.value ?? 'unknown',
    classification,
    categoryId,
    lineItems,
    status: 'draft',
    source: input.source,
    receipt: input.receipt ?? null,
    ai: { extractionId: input.extractionId, suggestedCategoryId: categoryId, overallConfidence: x.overallConfidence, model: x.model, correctedFields: [] },
    fingerprint: '',
    createdBy: input.uid,
    createdAt: input.now,
    updatedAt: input.now,
    version: 1,
    sync: { sheets: 'not_connected' },
    isSample: workspace.isSample,
  };
  tx.fingerprint = transactionFingerprint(tx);
  return tx;
}

export interface SaveValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Validation applied before a transaction can be saved / submitted. */
export function validateForSave(tx: Transaction, today: string): SaveValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!tx.date || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) errors.push('Date is required.');
  else if (tx.date > today) errors.push('Date cannot be in the future.');
  if (!(tx.total > 0)) errors.push('Total amount must be greater than zero.');
  if (!tx.categoryId) errors.push('Category is required.');
  if (tx.currency !== 'MYR' && tx.fxRateToBase == null && tx.baseTotal === 0) errors.push('Exchange rate to base currency is required for foreign-currency transactions.');
  if (tx.kind === 'expense' && !tx.merchant) warnings.push('Merchant name is empty.');
  if (tx.lineItems.length) {
    const items = tx.lineItems.reduce((a, l) => a + l.total, 0);
    const expected = (tx.subtotal ?? tx.total);
    if (Math.abs(items - expected) > 2 * tx.lineItems.length && Math.abs(items - tx.total) > 2 * tx.lineItems.length) {
      warnings.push(`Line items add up to ${(items / 100).toFixed(2)}, which differs from the receipt (${(expected / 100).toFixed(2)}).`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Recompute derived fields after the user edits a draft. */
export function finaliseDraft(tx: Transaction, baseCurrency: string): Transaction {
  const baseTotal =
    tx.currency === baseCurrency ? tx.total : tx.fxRateToBase ? Math.round(tx.total * tx.fxRateToBase) : tx.baseTotal;
  const next = { ...tx, baseTotal };
  next.fingerprint = transactionFingerprint(next);
  return next;
}
