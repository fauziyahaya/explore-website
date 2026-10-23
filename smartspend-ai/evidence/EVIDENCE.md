# SmartSpend AI — Verification Evidence

Generated 2026-10-23T12:05:09.449Z from **SAMPLE data only** (reference date 2026-10-23). Re-run with `npm run evidence`.

## 1. Receipt extraction

**grocery** — merchant “LOTUS'S STORES (MALAYSIA) SDN BHD”, date 2026-10-14, receipt 0123-456-78901, total RM73.08, tax not printed, 4 items, overall confidence 0.57

| Item | Qty | Total | Confidence |
|---|---:|---:|---:|
| BERAS WANGI FAIZA 5KG | 1 | RM23.90 | 0.6 |
| SAJI MINYAK MASAK 5KG | 1 | RM29.90 | 0.6 |
| DUTCH LADY FULL CREAM 1L | 2 | RM14.98 | 0.6 |
| GARDENIA ORIGINAL 600G | 1 | RM4.30 | 0.6 |

- ✅ TOTAL_PRESENT: Total found.
- ✅ DATE_PRESENT: Date found.
- ✅ MERCHANT_PRESENT: Merchant found.
- ✅ DATE_NOT_FUTURE: Date is not in the future.
- ✅ QTY_X_PRICE_MATCH: Item 1: quantity × unit price matches.
- ✅ QTY_X_PRICE_MATCH: Item 2: quantity × unit price matches.
- ✅ QTY_X_PRICE_MATCH: Item 3: quantity × unit price matches.
- ✅ QTY_X_PRICE_MATCH: Item 4: quantity × unit price matches.
- ✅ LINE_ITEMS_MATCH_SUBTOTAL: Line items add up to the subtotal.
- ✅ SUBTOTAL_TAX_MATCH_TOTAL: Subtotal, discount, tax and rounding reconcile to the total.

**cafe** — merchant “ZUS COFFEE KLCC”, date 2026-10-15, receipt ZK-20261015-0042, total RM23.75, tax RM1.34, 2 items, overall confidence 0.57

| Item | Qty | Total | Confidence |
|---|---:|---:|---:|
| SPANISH LATTE (L) | 1 | RM12.90 | 0.6 |
| CHEESE CROISSANT | 1 | RM9.50 | 0.6 |

- ✅ TOTAL_PRESENT: Total found.
- ✅ DATE_PRESENT: Date found.
- ✅ MERCHANT_PRESENT: Merchant found.
- ✅ DATE_NOT_FUTURE: Date is not in the future.
- ✅ QTY_X_PRICE_MATCH: Item 1: quantity × unit price matches.
- ✅ QTY_X_PRICE_MATCH: Item 2: quantity × unit price matches.
- ✅ LINE_ITEMS_MATCH_SUBTOTAL: Line items add up to the subtotal.
- ✅ SUBTOTAL_TAX_MATCH_TOTAL: Subtotal, discount, tax and rounding reconcile to the total.
- ✅ A receipt without a printed total is NOT given an invented total (value stays null, user must enter it)

## 2. Duplicate prevention
- ✅ Re-scanning Lotus's Mutiara Damansara RM201.00 (2026-05-03) is detected as a duplicate (fingerprint e5d8dd06d42a…)
- ✅ A different purchase at the same shop is not flagged
- Server-side: a per-workspace fingerprint index rejects a second save with `already-exists`; replaying the same client id is idempotent (see functions/test/backend.test.ts).

## 3. Google Sheets synchronisation (idempotent)

Spreadsheet: “SmartSpend AI — Teratai Contoh Trading Sdn. Bhd. (Sample) — Financial Records” with tabs: Transactions, Receipt Line Items, Income Records, Expense Categories, Merchants and Brands, Monthly Budgets, Financial Summary, Audit Trail Export, Reporting Data.

| Tab | 1st sync appended | 1st sync updated | 2nd sync appended | 2nd sync updated |
|---|---:|---:|---:|---:|
| Transactions | 96 | 0 | 0 | 96 |
| Receipt Line Items | 12 | 0 | 0 | 12 |
| Income Records | 29 | 0 | 0 | 29 |

- ✅ Transactions tab has exactly 96 rows = approved records in the database (no duplicates after re-sync)
- ✅ Second sync appended nothing (idempotent)

## 4. Financial calculations reconcile

| Month | Personal income | Personal expenses | Net cash surplus | Business revenue | Business net profit | Net cash flow | Reconciled |
|---|---:|---:|---:|---:|---:|---:|:---:|
| 2026-05 | RM6,500.00 | RM1,315.58 | RM5,184.42 | RM41,537.62 | RM13,386.97 | RM13,386.97 | ✅ |
| 2026-06 | RM7,700.00 | RM1,180.80 | RM6,519.20 | RM42,848.57 | RM13,770.87 | RM13,770.87 | ✅ |
| 2026-07 | RM6,500.00 | RM1,237.84 | RM5,262.16 | RM44,309.11 | RM15,117.56 | RM15,117.56 | ✅ |
| 2026-08 | RM7,700.00 | RM1,470.35 | RM6,229.65 | RM45,532.92 | RM16,529.51 | RM11,030.51 | ✅ |
| 2026-09 | RM6,500.00 | RM1,131.47 | RM5,368.53 | RM45,711.80 | RM15,216.24 | RM9,716.24 | ✅ |
| 2026-10 | RM7,700.00 | RM1,214.24 | RM6,485.76 | RM36,220.34 | RM17,061.14 | RM17,061.14 | ✅ |

Excluded from profit in 2026-09 (cash flow ≠ profit): owner drawings RM3,000.00, loan principal RM2,500.00, capex RM0.00.
- ✅ Net profit − net cash flow = exactly the excluded non-P&L movements

## 5. Reports match recorded transactions

| Report | Reference | Register rows | Recorded total | Report total | Match |
|---|---|---:|---:|---:|:---:|
| Monthly Company Expense Statement | SSA-SINESS-MES-20261023-0001 | 13 | RM35,995.56 | RM35,995.56 | ✅ |
| Detailed Expense Register | SSA-SINESS-REG-20261023-0002 | 13 | RM35,995.56 | RM35,995.56 | ✅ |
| Departmental Expense Report | SSA-SINESS-DEP-20261023-0003 | 13 | RM35,995.56 | RM35,995.56 | ✅ |
| Supplier and Vendor Expense Report | SSA-SINESS-VEN-20261023-0004 | 13 | RM35,995.56 | RM35,995.56 | ✅ |
| Income and Expenditure Statement | SSA-SINESS-IES-20261023-0005 | 18 | RM9,716.24 | RM9,716.24 | ✅ |
| Profit and Loss Statement | SSA-SINESS-PNL-20261023-0006 | 18 | RM9,716.24 | RM9,716.24 | ✅ |
| Budget Variance Report | SSA-SINESS-BVR-20261023-0007 | 13 | RM35,995.56 | RM35,995.56 | ✅ |
| Supporting Receipt Register | SSA-SINESS-RCP-20261023-0008 | 13 | RM35,995.56 | RM35,995.56 | ✅ |

Files: `sample-profit-and-loss.pdf`, `sample-expense-register.pdf`, `.xlsx`, `.csv`, `sample-evidence-package.zip` (sample data has no receipt images, so the manifest lists them as missing — exactly how a real gap would be reported).

---
**Result: ALL CHECKS PASSED**
