import { describe, expect, it } from 'vitest';
import {
  allAlerts,
  analyseSpike,
  budgetStatus,
  buildMemory,
  BUSINESS_CATEGORIES,
  compareBrands,
  compareMerchants,
  expenseTrend,
  allocateAll,
  extractObservations,
  findDuplicates,
  generateAnalytics,
  lineItemQuantity,
  parsePackageSize,
  PERSONAL_CATEGORIES,
  priceChange,
  sampleBudgets,
  sampleBusinessTransactions,
  samplePersonalTransactions,
  savingOpportunities,
  suggestCategory,
  transactionFingerprint,
  lastNMonthsRange,
  SAMPLE_PERSONAL_ID,
  type Transaction,
} from '../src';

const TODAY = '2026-10-23';
const personal = samplePersonalTransactions(TODAY);
const business = sampleBusinessTransactions(TODAY);

describe('categorisation', () => {
  it('uses keywords, then learns from approved history', () => {
    const kw = suggestCategory({ merchant: 'Petronas Jalan Ampang', kind: 'expense' }, PERSONAL_CATEGORIES, 'personal');
    expect(kw).toMatchObject({ categoryId: 'p_petrol', source: 'keyword' });

    const unknown = suggestCategory({ merchant: 'Kedai Pak Abu', kind: 'expense' }, PERSONAL_CATEGORIES, 'personal');
    expect(unknown.source).toBe('fallback');
    expect(unknown.confidence).toBeLessThan(0.5);

    const history = [1, 2, 3].map((i) => ({ ...personal[0]!, id: `h${i}`, kind: 'expense' as const, merchant: 'Kedai Pak Abu', categoryId: 'p_household', status: 'approved' as const }));
    const learned = suggestCategory({ merchant: 'KEDAI PAK ABU', kind: 'expense' }, PERSONAL_CATEGORIES, 'personal', buildMemory(history));
    expect(learned).toMatchObject({ categoryId: 'p_household', source: 'learned_merchant' });
    expect(learned.confidence).toBeGreaterThan(0.9);
  });

  it('does not learn from unapproved records', () => {
    const drafts = [{ ...personal[0]!, id: 'd1', merchant: 'Kedai Pak Abu', categoryId: 'p_household', status: 'draft' as const }];
    expect(suggestCategory({ merchant: 'Kedai Pak Abu', kind: 'expense' }, PERSONAL_CATEGORIES, 'personal', buildMemory(drafts)).source).toBe('fallback');
  });

  it('suggests business accounting categories', () => {
    expect(suggestCategory({ merchant: 'Popular Book Co', description: 'HP toner ink', kind: 'expense' }, BUSINESS_CATEGORIES, 'business').categoryId).toBe('b_office_supplies');
    expect(suggestCategory({ merchant: 'X', description: 'loan repayment', kind: 'expense' }, BUSINESS_CATEGORIES, 'business').categoryId).toBe('b_loan_principal');
  });
});

describe('duplicate detection', () => {
  const original = personal.find((t) => t.lineItems.length > 0)!;
  it('flags an exact re-scan as a certain duplicate', () => {
    const rescan = { ...original, id: 'new1' };
    const d = findDuplicates(rescan, personal);
    expect(d[0]).toMatchObject({ transactionId: original.id, score: 1 });
  });
  it('flags same amount at a similar merchant within a day', () => {
    const near: Transaction = { ...original, id: 'new2', merchant: original.merchant!.toUpperCase() + ' SDN BHD', receiptNumber: null, date: original.date };
    near.fingerprint = transactionFingerprint(near);
    expect(findDuplicates(near, personal)[0]?.transactionId).toBe(original.id);
  });
  it('does not flag a different purchase', () => {
    const other: Transaction = { ...original, id: 'new3', total: original.total + 1234, baseTotal: original.total + 1234, receiptNumber: 'ZZZ' };
    other.fingerprint = transactionFingerprint(other);
    expect(findDuplicates(other, personal)).toEqual([]);
  });
});

describe('unit normalisation & price comparison', () => {
  it('parses package sizes into comparable base units', () => {
    expect(parsePackageSize('5KG')).toEqual({ baseUnit: 'kg', amount: 5 });
    expect(parsePackageSize('600G')).toEqual({ baseUnit: 'kg', amount: 0.6 });
    expect(parsePackageSize('12 x 330ml')).toEqual({ baseUnit: 'L', amount: 3.96 });
    expect(parsePackageSize('30S')).toEqual({ baseUnit: 'pc', amount: 30 });
    expect(parsePackageSize('large')).toBeNull();
    expect(lineItemQuantity({ description: 'BERAS 10KG', quantity: 2 })).toEqual({ baseUnit: 'kg', amount: 20 });
  });

  it('compares rice per kg across brands, not per package', () => {
    const obs = extractObservations(personal);
    const res = compareBrands(obs, 'rice');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.baseUnit).toBe('kg');
    // 10kg Jasmine (≈RM4.25/kg) is cheaper per kg than 5kg Faiza (≈RM4.78/kg) even though the pack costs more.
    const jas = res.groups.find((g) => g.key === 'Jasmine');
    const fai = res.groups.find((g) => g.key === 'Faiza');
    if (jas && fai) expect(jas.avgPricePerBase).toBeLessThan(fai.avgPricePerBase);
    expect(res.disclaimer).toMatch(/historical/);
    expect(compareMerchants(obs, 'rice').status).toBe('ok');
  });

  it('returns "Insufficient comparison data" instead of inventing prices', () => {
    const obs = extractObservations(personal);
    const res = compareBrands(obs, 'caviar');
    expect(res.status).toBe('insufficient');
    if (res.status === 'insufficient') expect(res.message).toMatch(/^Insufficient comparison data/);
  });

  it('tracks price changes and computes reproducible saving opportunities', () => {
    const obs = extractObservations(personal);
    expect(priceChange(obs, 'milk')).not.toBeNull();
    const savings = savingOpportunities(obs);
    for (const s of savings) {
      expect(s.potentialSaving).toBe(Math.round((s.usualAvgPricePerBase - s.cheaperAvgPricePerBase) * s.quantityBought));
      expect(s.calculation).toContain('=');
    }
  });
});

describe('analytics', () => {
  it('generates trends with zero-filled buckets and drill-down ids', () => {
    const range = lastNMonthsRange(TODAY, 6);
    const bundle = generateAnalytics({ type: 'personal' }, personal, PERSONAL_CATEGORIES, { range }, 'month');
    expect(bundle.expenseTrend.map((p) => p.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    const allIds = new Set(personal.map((t) => t.id));
    for (const p of bundle.expenseTrend) for (const id of p.transactionIds) expect(allIds.has(id)).toBe(true);
    expect(bundle.categories[0]!.sharePct).toBeGreaterThan(0);
    expect(bundle.categories.reduce((s, c) => s + c.amount, 0)).toBe(bundle.totals.expenses);
    expect(bundle.recurring.recurringMerchants).toContain('netflix');
    // Transfers excluded from expense totals
    expect(bundle.categories.some((c) => c.key === 'p_transfer')).toBe(false);
  });

  it('daily trend sums equal monthly trend sums', () => {
    const range = { from: '2026-09-01', to: '2026-09-30' };
    const allocs = allocateAll(personal, PERSONAL_CATEGORIES, { type: 'personal' });
    const daily = expenseTrend(allocs, range, 'day').reduce((s, p) => s + p.amount, 0);
    const monthly = expenseTrend(allocs, range, 'month')[0]!.amount;
    expect(daily).toBe(monthly);
    expect(expenseTrend(allocs, range, 'week').reduce((s, p) => s + p.amount, 0)).toBe(monthly);
  });
});

describe('budgets, alerts & insights', () => {
  it('alerts at 80% and when exceeded with a reproducible calculation', () => {
    const budgets = sampleBudgets(SAMPLE_PERSONAL_ID, 'personal');
    const { alerts, statuses } = allAlerts({ type: 'personal' }, personal, PERSONAL_CATEGORIES, budgets, TODAY, `${TODAY}T00:00:00Z`);
    const food = statuses.find((s) => s.budget.id === 'sample_bud_food')!;
    expect(food.exceeded).toBe(true);
    const a = alerts.find((x) => x.budgetId === 'sample_bud_food')!;
    expect(a.type).toBe('budget_exceeded');
    expect(a.calculation).toContain('÷');
    expect(alerts.some((x) => x.type === 'spending_spike')).toBe(true);
  });

  it('threshold logic is exact', () => {
    const b = { id: 'b', workspaceId: 'w', name: 'Test', period: 'monthly' as const, periodKey: '2026-10', scope: { type: 'category' as const, categoryId: 'p_groceries' }, amount: 10_000, alertThresholds: [80, 100], createdBy: 'u', createdAt: '' };
    const mk = (total: number): Transaction => ({ ...personal.find((t) => t.categoryId === 'p_groceries')!, id: `t${total}`, date: '2026-10-02', total, baseTotal: total, lineItems: [] });
    expect(budgetStatus(b, [mk(7999)], PERSONAL_CATEGORIES, { type: 'personal' }, TODAY).thresholdCrossed).toBeNull();
    expect(budgetStatus(b, [mk(8000)], PERSONAL_CATEGORIES, { type: 'personal' }, TODAY).thresholdCrossed).toBe(80);
    const over = budgetStatus(b, [mk(10_001)], PERSONAL_CATEGORIES, { type: 'personal' }, TODAY);
    expect(over.thresholdCrossed).toBe(100);
    expect(over.exceeded).toBe(true);
  });

  it('explains a spending increase by its driver', () => {
    const ins = analyseSpike({ type: 'business' }, business, BUSINESS_CATEGORIES, '2026-10-28', { compareFullMonths: true, minAmount: 1000 });
    const office = ins.find((i) => i.categoryId === 'b_office_supplies');
    expect(office).toBeDefined();
    expect(office!.message).toMatch(/Office Supplies expenses increased by \d+% compared with last month\. Most of the increase came from printer ink/);
    expect(office!.calculation).toMatch(/÷/);
  });
});
