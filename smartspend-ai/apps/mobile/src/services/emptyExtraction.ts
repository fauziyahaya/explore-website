import type { ExtractedReceipt } from '@smartspend/core';

/** An extraction with every field empty — used for manual entry and offline capture. Never pre-filled. */
export function emptyExtraction(model = 'manual'): ExtractedReceipt {
  const e = { value: null, confidence: 0 };
  return {
    merchant: e, merchantAddress: e, merchantTaxId: e, date: e, time: e, receiptNumber: e, currency: e,
    subtotal: e, discount: e, tax: e, serviceCharge: e, rounding: e, total: e, paymentMethod: e,
    lineItems: [], documentType: 'unknown', checks: [], overallConfidence: 1, model,
  };
}
