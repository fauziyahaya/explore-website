import { describe, expect, it } from 'vitest';
import {
  allocate,
  allocateAll,
  BUSINESS_CATEGORIES,
  distribute,
  monthRange,
  PERSONAL_CATEGORIES,
  personalSummary,
  profitAndLoss,
  reconcile,
  sampleBusinessTransactions,
  samplePersonalTransactions,
  transactionFingerprint,
  type Transaction,
} from '../src';

const TODAY = '2026-10-23';

function tx(p: Partial<Transaction> & Pick<Transaction, 'id' | 'kind' | 'total' | 'categoryId'>): Transaction {
  const t: Transaction = {
    workspaceId: 'w', date: '2026-10-05', merchant: 'M', receiptNumber: null, currency: 'MYR', subtotal: null, tax: null, discount: null, rounding: null,
    baseTotal: p.total, paymentMethod: 'cash', classification: 'business', lineItems: [], status: 'approved', source: 'manual', fingerprint: '',
    createdBy: 'u', createdAt: '', updatedAt: '', version: 1, sync: { sheets: 'not_connected' }, isSample: false, ...p,
  };
  t.fingerprint = transactionFingerprint(t);
  return t;
}

describe('distribute', () => {
  it('splits exactly with largest remainder', () => {
    expect(distribute(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(distribute(1061, [500, 500])).toEqual([531, 530]);
    expect(distribute(7, [0, 0])).toEqual([7, 0]);
  });
});

describe('profit and loss (business)', () => {
  const txs = [
    tx({ id: 'r1', kind: 'income', total: 1_000_000, categoryId: 'b_revenue_sales' }),
    tx({ id: 'r2', kind: 'income', total: 50_000, categoryId: 'b_non_operating_income' }),
    tx({ id: 'c1', kind: 'expense', total: 400_000, categoryId: 'b_cogs' }),
    tx({ id: 'o1', kind: 'expense', total: 200_000, categoryId: 'b_rent' }),
    tx({ id: 'f1', kind: 'expense', total: 10_000, categoryId: 'b_financing' }),
    tx({ id: 'k1', kind: 'expense', total: 500_000, categoryId: 'b_capex' }),
    tx({ id: 'd1', kind: 'expense', total: 100_000, categoryId: 'b_other_expense', classification: 'owner_drawing' }),
    tx({ id: 'l1', kind: 'expense', total: 80_000, categoryId: 'b_loan_principal' }),
    tx({ id: 'p1', kind: 'expense', total: 30_000, categoryId: 'b_meals', classification: 'personal' }),
    tx({ id: 'x1', kind: 'expense', total: 999_999, categoryId: 'b_rent', status: 'submitted' }),
    tx({ id: 'x2', kind: 'expense', total: 999_999, categoryId: 'b_rent', status: 'superseded', supersededBy: 'o1' }),
  ];
  const allocs = allocateAll(txs, BUSINESS_CATEGORIES, { type: 'business' });
  const p = profitAndLoss(allocs);

  it('computes revenue, COGS, gross, operating and net profit', () => {
    expect(p.revenue).toBe(1_000_000);
    expect(p.costOfGoodsSold).toBe(400_000);
    expect(p.grossProfit).toBe(600_000);
    expect(p.operatingExpenses).toBe(200_000);
    expect(p.operatingProfit).toBe(400_000);
    expect(p.nonOperatingIncome).toBe(50_000);
    expect(p.otherExpenses).toBe(10_000);
    expect(p.netProfit).toBe(440_000);
    expect(p.grossMarginPct).toBe(60);
    expect(p.netMarginPct).toBe(44);
  });

  it('does not treat capex, drawings, loan principal or personal spending as expenses', () => {
    expect(p.excluded).toEqual({ capitalExpenditure: 500_000, ownerDrawings: 100_000, ownerContributions: 0, loanPrincipal: 80_000, transfers: 0, personalExpenses: 30_000 });
    // Cash flow is clearly different from profit
    expect(p.netCashFlow).toBe(1_050_000 - (400_000 + 200_000 + 10_000 + 500_000 + 100_000 + 80_000 + 30_000));
    expect(p.netCashFlow).not.toBe(p.netProfit);
  });

  it('ignores unapproved and superseded records, and reconciles', () => {
    expect(allocs.some((a) => a.transactionId === 'x1' || a.transactionId === 'x2')).toBe(false);
    expect(reconcile(txs, allocs).ok).toBe(true);
  });
});

describe('multi-category receipts', () => {
  it('allocates per line item with tax spread so allocations sum to the total', () => {
    const t = tx({
      id: 's1', kind: 'expense', total: 10_600, tax: 600, categoryId: 'b_office_supplies',
      lineItems: [
        { id: 'a', description: 'Toner', quantity: 1, unitPrice: 7000, discount: 0, tax: 0, total: 7000, categoryId: 'b_office_supplies' },
        { id: 'b', description: 'Coffee for client', quantity: 1, unitPrice: 3000, discount: 0, tax: 0, total: 3000, categoryId: 'b_meals' },
      ],
    });
    const a = allocate(t, new Map(BUSINESS_CATEGORIES.map((c) => [c.id, c])), { type: 'business' });
    expect(a.map((x) => [x.categoryId, x.amount])).toEqual([['b_office_supplies', 7420], ['b_meals', 3180]]);
    expect(a.reduce((s, x) => s + x.amount, 0)).toBe(10_600);
  });
});

describe('personal net cash surplus', () => {
  it('= recorded income − recorded expenses, excluding transfers', () => {
    const txs = [
      tx({ id: 'i', kind: 'income', total: 500_000, categoryId: 'p_salary', classification: 'personal' }),
      tx({ id: 'e', kind: 'expense', total: 120_000, categoryId: 'p_groceries', classification: 'personal' }),
      tx({ id: 't', kind: 'expense', total: 100_000, categoryId: 'p_transfer', classification: 'personal' }),
    ];
    const s = personalSummary(allocateAll(txs, PERSONAL_CATEGORIES, { type: 'personal' }));
    expect(s.netCashSurplus).toBe(380_000);
    expect(s.excludedTransfers).toBe(100_000);
    expect(s.savingsRatePct).toBe(76);
  });

  it('sample data reconciles for every month', () => {
    const p = samplePersonalTransactions(TODAY);
    const b = sampleBusinessTransactions(TODAY);
    for (const m of ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']) {
      const r = monthRange(m);
      expect(reconcile(p, allocateAll(p, PERSONAL_CATEGORIES, { type: 'personal' }, r), r).ok).toBe(true);
      expect(reconcile(b, allocateAll(b, BUSINESS_CATEGORIES, { type: 'business' }, r), r).ok).toBe(true);
    }
    expect(p.every((t) => t.isSample)).toBe(true);
  });
});
