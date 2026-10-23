import { z } from 'zod';

/**
 * Shape the AI model (Gemini) is instructed to return. Amounts are decimal
 * major units as printed on the receipt. Every field is nullable: the model is
 * told to return null rather than guess, and each carries its own confidence.
 */
const conf = z.number().min(0).max(1);
const field = <T extends z.ZodTypeAny>(t: T) => z.object({ value: t.nullable(), confidence: conf });

export const AiLineItemSchema = z.object({
  description: field(z.string()),
  brand: field(z.string()),
  productCategory: field(z.string()),
  quantity: field(z.number()),
  unit: field(z.string()),
  packageSize: field(z.string()),
  unitPrice: field(z.number()),
  discount: field(z.number()),
  total: field(z.number()),
});

export const AiReceiptSchema = z.object({
  documentType: z.enum(['receipt', 'invoice', 'unknown']),
  merchant: field(z.string()),
  merchantAddress: field(z.string()),
  merchantTaxId: field(z.string()),
  date: field(z.string()), // YYYY-MM-DD
  time: field(z.string()),
  receiptNumber: field(z.string()),
  currency: field(z.string()),
  subtotal: field(z.number()),
  discount: field(z.number()),
  tax: field(z.number()),
  serviceCharge: field(z.number()),
  rounding: field(z.number()),
  total: field(z.number()),
  paymentMethod: field(z.string()),
  lineItems: z.array(AiLineItemSchema),
});

export type AiReceipt = z.infer<typeof AiReceiptSchema>;

/** OpenAPI-subset schema passed to Gemini `generationConfig.responseSchema`. */
function f(type: 'STRING' | 'NUMBER') {
  return {
    type: 'OBJECT',
    properties: { value: { type, nullable: true }, confidence: { type: 'NUMBER' } },
    required: ['value', 'confidence'],
  };
}
const lineItemProps = {
  description: f('STRING'),
  brand: f('STRING'),
  productCategory: f('STRING'),
  quantity: f('NUMBER'),
  unit: f('STRING'),
  packageSize: f('STRING'),
  unitPrice: f('NUMBER'),
  discount: f('NUMBER'),
  total: f('NUMBER'),
};
const receiptProps = {
  documentType: { type: 'STRING', enum: ['receipt', 'invoice', 'unknown'] },
  merchant: f('STRING'),
  merchantAddress: f('STRING'),
  merchantTaxId: f('STRING'),
  date: f('STRING'),
  time: f('STRING'),
  receiptNumber: f('STRING'),
  currency: f('STRING'),
  subtotal: f('NUMBER'),
  discount: f('NUMBER'),
  tax: f('NUMBER'),
  serviceCharge: f('NUMBER'),
  rounding: f('NUMBER'),
  total: f('NUMBER'),
  paymentMethod: f('STRING'),
  lineItems: {
    type: 'ARRAY',
    items: { type: 'OBJECT', properties: lineItemProps, required: Object.keys(lineItemProps) },
  },
};
export const GEMINI_RECEIPT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: receiptProps,
  required: Object.keys(receiptProps),
};

export const RECEIPT_EXTRACTION_PROMPT = `You are a meticulous accounting data-entry assistant for Malaysian receipts and invoices.
Extract the data from the attached document image or PDF.

STRICT RULES:
- Transcribe ONLY what is printed. If a value is not visible or illegible, return null. NEVER guess, infer or calculate missing values.
- Amounts are decimal numbers in the document currency exactly as printed (e.g. 12.90). Discounts are positive numbers.
- "tax" is the SST / GST / service tax amount actually printed. Do not compute it.
- date must be ISO YYYY-MM-DD. Malaysian receipts usually print DD/MM/YYYY.
- currency is an ISO 4217 code (RM -> MYR). Return null if no currency indicator is shown.
- paymentMethod: one of cash, debit_card, credit_card, ewallet, bank_transfer, duitnow, cheque, other — or null.
- For each purchased line item give description as printed, brand only if a brand name is visible, quantity, unit (pcs/kg/g/L/ml/pack), packageSize as printed (e.g. "5KG", "1.5L", "12X330ML"), unitPrice, line discount and line total.
- productCategory is a short generic product type (e.g. "rice", "cooking oil", "printer ink").
- confidence is your probability (0..1) that the value is exactly correct. Use < 0.6 for partially legible values.
- Do not include payment/tender/change lines as items.`;
