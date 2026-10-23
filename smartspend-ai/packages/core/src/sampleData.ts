import { BUSINESS_CATEGORIES, PERSONAL_CATEGORIES } from './categories';
import { transactionFingerprint } from './duplicates';
import { shiftMonth } from './analytics';
import type { Budget, Dimension, LineItem, Member, PaymentMethod, Transaction, Workspace } from './types';

/**
 * Deterministic, clearly-flagged SAMPLE data for demos and tests.
 * Every record carries isSample=true and lives in a dedicated sample
 * workspace id prefixed "sample_" so it can never mix with real records.
 */

export const SAMPLE_UID = 'sample_user';
export const SAMPLE_PERSONAL_ID = 'sample_personal';
export const SAMPLE_BUSINESS_ID = 'sample_business';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface ItemSpec {
  d: string;
  brand?: string;
  pc?: string;
  pkg?: string;
  price: number; // RM
  cat: string;
}

const GROCERY_ITEMS: ItemSpec[] = [
  { d: 'BERAS WANGI FAIZA 5KG', brand: 'Faiza', pc: 'rice', pkg: '5KG', price: 23.9, cat: 'p_groceries' },
  { d: 'JASMINE BERAS SUPER 10KG', brand: 'Jasmine', pc: 'rice', pkg: '10KG', price: 42.5, cat: 'p_groceries' },
  { d: 'BERAS CAP RAMBUTAN 5KG', brand: 'Cap Rambutan', pc: 'rice', pkg: '5KG', price: 21.5, cat: 'p_groceries' },
  { d: 'SAJI MINYAK MASAK 5KG', brand: 'Saji', pc: 'cooking oil', pkg: '5KG', price: 29.9, cat: 'p_groceries' },
  { d: 'BURUH MINYAK 2KG', brand: 'Buruh', pc: 'cooking oil', pkg: '2KG', price: 13.2, cat: 'p_groceries' },
  { d: 'DUTCH LADY FULL CREAM 1L', brand: 'Dutch Lady', pc: 'milk', pkg: '1L', price: 7.49, cat: 'p_groceries' },
  { d: 'FARM FRESH MILK 2L', brand: 'Farm Fresh', pc: 'milk', pkg: '2L', price: 13.5, cat: 'p_groceries' },
  { d: 'TELUR AYAM GRED A 30S', pc: 'eggs', pkg: '30PCS', price: 14.9, cat: 'p_groceries' },
  { d: 'GARDENIA ORIGINAL CLASSIC 600G', brand: 'Gardenia', pc: 'bread', pkg: '600G', price: 4.3, cat: 'p_groceries' },
  { d: 'MASSIMO WHEAT GERM 400G', brand: 'Massimo', pc: 'bread', pkg: '400G', price: 3.6, cat: 'p_groceries' },
  { d: 'DYNAMO DETERGENT 3KG', brand: 'Dynamo', pc: 'detergent', pkg: '3KG', price: 26.9, cat: 'p_household' },
  { d: 'SCOTT KITCHEN TOWEL 2ROLLS', brand: 'Scott', pc: 'kitchen towel', pkg: '2ROLLS', price: 7.9, cat: 'p_household' },
];

const GROCERS = ["Lotus's Mutiara Damansara", 'AEON Big Wangsa Maju', 'Mydin Subang Jaya', '99 Speedmart Taman Melawati', 'Jaya Grocer Intermark'];

function li(id: string, spec: ItemSpec, qty: number, priceFactor: number): LineItem {
  const unit = Math.round(spec.price * priceFactor * 100);
  return {
    id,
    description: spec.d,
    brand: spec.brand ?? null,
    productCategory: spec.pc ?? null,
    quantity: qty,
    unit: 'pcs',
    packageSize: spec.pkg ?? null,
    unitPrice: unit,
    discount: 0,
    tax: 0,
    total: unit * qty,
    categoryId: spec.cat,
  };
}

function baseTx(p: Partial<Transaction> & Pick<Transaction, 'id' | 'workspaceId' | 'kind' | 'date' | 'merchant' | 'total' | 'categoryId'>): Transaction {
  const tx: Transaction = {
    receiptNumber: null,
    currency: 'MYR',
    subtotal: null,
    tax: null,
    discount: null,
    rounding: null,
    baseTotal: p.total,
    paymentMethod: 'debit_card',
    classification: 'personal',
    lineItems: [],
    status: 'approved',
    source: 'camera',
    receipt: null,
    ai: null,
    fingerprint: '',
    createdBy: SAMPLE_UID,
    createdAt: `${p.date}T10:00:00.000Z`,
    updatedAt: `${p.date}T10:00:00.000Z`,
    approvedBy: SAMPLE_UID,
    approvedAt: `${p.date}T10:05:00.000Z`,
    version: 1,
    sync: { sheets: 'not_connected' },
    isSample: true,
    ...p,
  };
  tx.baseTotal = p.baseTotal ?? tx.total;
  tx.fingerprint = transactionFingerprint(tx);
  return tx;
}

function day(month: string, d: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function samplePersonalWorkspace(createdAt = '2026-01-01T00:00:00.000Z'): Workspace {
  return {
    id: SAMPLE_PERSONAL_ID,
    type: 'personal',
    name: 'Demo Household (Sample)',
    baseCurrency: 'MYR',
    ownerUid: SAMPLE_UID,
    retentionYears: 7,
    isSample: true,
    accountingBasis: 'cash',
    createdAt,
    approvalRequired: false,
  };
}

export function sampleBusinessWorkspace(createdAt = '2026-01-01T00:00:00.000Z'): Workspace {
  return {
    id: SAMPLE_BUSINESS_ID,
    type: 'business',
    name: 'Teratai Contoh Trading Sdn. Bhd. (Sample)',
    registrationNumber: '202601000000 (SAMPLE)',
    sstRegistrationNumber: 'W10-0000-00000000',
    address: 'No. 1, Jalan Contoh 1/1, 47300 Petaling Jaya, Selangor',
    baseCurrency: 'MYR',
    ownerUid: SAMPLE_UID,
    retentionYears: 7,
    isSample: true,
    accountingBasis: 'cash',
    createdAt,
    approvalRequired: true,
    reportHeader: 'Internal management report — sample data',
  };
}

/** Six months of personal transactions ending in `today`'s month. */
export function samplePersonalTransactions(today: string): Transaction[] {
  const r = rng(42);
  const ws = SAMPLE_PERSONAL_ID;
  const thisMonth = today.slice(0, 7);
  const out: Transaction[] = [];
  let n = 0;
  const id = () => `sample_ptx_${String(++n).padStart(4, '0')}`;
  const maxDay = (month: string) => (month === thisMonth ? Number(today.slice(8, 10)) : 28);

  for (let k = 5; k >= 0; k--) {
    const month = shiftMonth(thisMonth, -k);
    const md = maxDay(month);
    const inflation = 1 + (5 - k) * 0.012; // gentle price drift for price-history charts
    out.push(baseTx({ id: id(), workspaceId: ws, kind: 'income', date: day(month, 1), merchant: 'Employer Payroll', total: 650000, categoryId: 'p_salary', paymentMethod: 'bank_transfer', source: 'manual', incomeSource: 'Salary' }));
    if (k % 2 === 0) out.push(baseTx({ id: id(), workspaceId: ws, kind: 'income', date: day(month, 15), merchant: 'Freelance design client', total: 120000, categoryId: 'p_freelance', paymentMethod: 'duitnow', source: 'manual' }));

    // Weekly groceries with itemised receipts
    for (let w = 0; w < 4; w++) {
      const d = 3 + w * 7;
      if (d > md) break;
      const txId = id();
      const picks = [...GROCERY_ITEMS].sort(() => r() - 0.5).slice(0, 3 + Math.floor(r() * 3));
      const merchant = GROCERS[Math.floor(r() * GROCERS.length)]!;
      const priceFactor = inflation * (merchant.startsWith('Jaya') ? 1.12 : merchant.startsWith('99') ? 0.97 : 1);
      const items = picks.map((p, i) => li(`${txId}_li${i + 1}`, p, 1 + Math.floor(r() * 2), priceFactor));
      const total = items.reduce((a, b) => a + b.total, 0);
      out.push(baseTx({ id: txId, workspaceId: ws, kind: 'expense', date: day(month, d), merchant, receiptNumber: `R${month.replace('-', '')}${w}${Math.floor(r() * 9000 + 1000)}`, total, subtotal: total, tax: 0, categoryId: 'p_groceries', lineItems: items, paymentMethod: r() > 0.5 ? 'debit_card' : 'ewallet' }));
    }
    const fixed: Array<[number, string, number, string, PaymentMethod]> = [
      [5, 'Tenaga Nasional Berhad', 18000 + Math.floor(r() * 6000), 'p_utilities', 'bank_transfer'],
      [6, 'Unifi Home', 12900, 'p_utilities', 'bank_transfer'],
      [7, 'Netflix', 5500, 'p_entertainment', 'credit_card'],
      [9, 'Petronas Jalan Ampang', 8000 + Math.floor(r() * 3000), 'p_petrol', 'debit_card'],
      [20, 'Shell Setiawangsa', 7000 + Math.floor(r() * 3000), 'p_petrol', 'ewallet'],
      [12, 'ZUS Coffee KLCC', 1290 + Math.floor(r() * 800), 'p_food', 'ewallet'],
      [14, 'Restoran Nasi Kandar Pelita', 2350 + Math.floor(r() * 1500), 'p_food', 'cash'],
      [18, 'Grab', 1800 + Math.floor(r() * 2500), 'p_transport', 'ewallet'],
      [22, 'Guardian Pharmacy', 3990 + Math.floor(r() * 2000), 'p_healthcare', 'debit_card'],
      [25, 'Shopee', 4500 + Math.floor(r() * 9000), 'p_shopping', 'credit_card'],
    ];
    for (const [d, merchant, total, cat, pm] of fixed) {
      if (d > md) continue;
      out.push(baseTx({ id: id(), workspaceId: ws, kind: 'expense', date: day(month, d), merchant, total, categoryId: cat, paymentMethod: pm, isRecurring: ['Unifi Home', 'Netflix'].includes(merchant) }));
    }
    // Food spending spike in the current month for the insight demo
    if (k === 0) {
      for (const d of [2, 4, 8, 10]) if (d <= md) out.push(baseTx({ id: id(), workspaceId: ws, kind: 'expense', date: day(month, d), merchant: 'Sushi King Mid Valley', total: 6800 + Math.floor(r() * 2000), categoryId: 'p_food', paymentMethod: 'credit_card' }));
    }
  }
  // A transfer (excluded from surplus) and one pending draft
  out.push(baseTx({ id: id(), workspaceId: ws, kind: 'expense', date: day(thisMonth, 2), merchant: 'Transfer to own savings account', total: 100000, categoryId: 'p_transfer', paymentMethod: 'bank_transfer', source: 'manual' }));
  return out;
}

export function sampleBusinessDimensions(): Dimension[] {
  const ws = SAMPLE_BUSINESS_ID;
  return [
    { id: 'dept_ops', workspaceId: ws, type: 'department', name: 'Operations', code: 'OPS' },
    { id: 'dept_sales', workspaceId: ws, type: 'department', name: 'Sales & Marketing', code: 'SAL' },
    { id: 'dept_admin', workspaceId: ws, type: 'department', name: 'Administration', code: 'ADM' },
    { id: 'proj_kl', workspaceId: ws, type: 'project', name: 'KL Outlet Launch', code: 'P-KL' },
    { id: 'cc_hq', workspaceId: ws, type: 'cost_centre', name: 'Head Office', code: 'CC-HQ' },
  ];
}

export function sampleBusinessMembers(): Member[] {
  const ws = SAMPLE_BUSINESS_ID;
  const at = '2026-01-01T00:00:00.000Z';
  return [
    { uid: SAMPLE_UID, workspaceId: ws, role: 'owner', displayName: 'Aisyah (Owner)', email: 'owner@example.com', joinedAt: at, active: true },
    { uid: 'sample_fm', workspaceId: ws, role: 'finance_manager', displayName: 'Daniel Tan (Finance)', email: 'finance@example.com', joinedAt: at, active: true },
    { uid: 'sample_emp', workspaceId: ws, role: 'employee', displayName: 'Kumar (Sales)', email: 'sales@example.com', departmentId: 'dept_sales', joinedAt: at, active: true },
    { uid: 'sample_aud', workspaceId: ws, role: 'auditor', displayName: 'External Auditor', email: 'auditor@example.com', joinedAt: at, active: true },
  ];
}

export function sampleBusinessTransactions(today: string): Transaction[] {
  const r = rng(7);
  const ws = SAMPLE_BUSINESS_ID;
  const thisMonth = today.slice(0, 7);
  const out: Transaction[] = [];
  let n = 0;
  const id = () => `sample_btx_${String(++n).padStart(4, '0')}`;
  const b = (p: Parameters<typeof baseTx>[0]) => baseTx({ classification: 'business', approvedBy: 'sample_fm', ...p });
  const md = (month: string) => (month === thisMonth ? Number(today.slice(8, 10)) : 28);

  for (let k = 5; k >= 0; k--) {
    const month = shiftMonth(thisMonth, -k);
    const max = md(month);
    const growth = 1 + (5 - k) * 0.04;
    for (const d of [3, 10, 17, 24]) {
      if (d > max) continue;
      out.push(b({ id: id(), workspaceId: ws, kind: 'income', date: day(month, d), merchant: 'Weekly outlet sales', total: Math.round((3400000 + r() * 600000) * growth / 4), categoryId: 'b_revenue_sales', paymentMethod: 'bank_transfer', source: 'manual', departmentId: 'dept_sales' }));
    }
    if (max >= 15) out.push(b({ id: id(), workspaceId: ws, kind: 'income', date: day(month, 15), merchant: 'Corporate catering contract', total: 350000, categoryId: 'b_revenue_service', paymentMethod: 'bank_transfer', source: 'manual', receiptNumber: `INV-${month.replace('-', '')}-01` }));
    const exp: Array<[number, string, number, string, string | null, PaymentMethod, string?]> = [
      [2, 'Borong Segar Supplies Sdn Bhd', Math.round((420000 + r() * 80000) * growth), 'b_cogs', 'dept_ops', 'bank_transfer', 'Stock purchase'],
      [16, 'Borong Segar Supplies Sdn Bhd', Math.round((420000 + r() * 80000) * growth), 'b_cogs', 'dept_ops', 'bank_transfer', 'Stock purchase'],
      [1, 'Hartanah Contoh Management', 450000, 'b_rent', 'dept_admin', 'bank_transfer', 'Shop lot rental'],
      [5, 'Tenaga Nasional Berhad', 85000 + Math.floor(r() * 20000), 'b_utilities', 'dept_ops', 'bank_transfer', 'Electricity'],
      [6, 'Time Fibre Business', 29900, 'b_utilities', 'dept_admin', 'bank_transfer', 'Internet'],
      [27, 'Payroll — staff salaries', 1150000, 'b_payroll', 'dept_admin', 'bank_transfer', 'Monthly payroll incl. EPF/SOCSO/EIS'],
      [8, 'Meta Platforms Ireland (Facebook Ads)', 120000 + Math.floor(r() * 60000), 'b_marketing', 'dept_sales', 'credit_card', 'Social ads'],
      [11, 'Google Workspace', 8400, 'b_software', 'dept_admin', 'credit_card', 'Email & docs'],
      [19, 'Kedai Servis Aircond Jaya', 35000, 'b_maintenance', 'dept_ops', 'cash', 'Aircond servicing'],
      [26, 'Bank charges', 1500, 'b_financing', 'dept_admin', 'bank_transfer', 'Monthly bank fees'],
    ];
    for (const [d, merchant, total, cat, dept, pm, purpose] of exp) {
      if (d > max) continue;
      out.push(b({ id: id(), workspaceId: ws, kind: 'expense', date: day(month, d), merchant, total, categoryId: cat, departmentId: dept, costCentreId: 'cc_hq', paymentMethod: pm, businessPurpose: purpose ?? null, isRecurring: ['b_rent', 'b_software', 'b_payroll'].includes(cat) }));
    }
    // Office supplies with itemised receipt (for price comparison + insight driver)
    if (12 <= max) {
      const txId = id();
      const inkQty = k === 0 ? 4 : 1;
      const items: LineItem[] = [
        { id: `${txId}_li1`, description: 'A4 PAPER 80GSM 500S', brand: 'Double A', productCategory: 'a4 paper', quantity: 5, unit: 'ream', packageSize: '500PCS', unitPrice: 1590, discount: 0, tax: 0, total: 7950, categoryId: 'b_office_supplies' },
        { id: `${txId}_li2`, description: 'HP 680 BLACK INK CARTRIDGE', brand: 'HP', productCategory: 'printer ink', quantity: inkQty, unit: 'pcs', packageSize: '1PCS', unitPrice: 4500, discount: 0, tax: 0, total: 4500 * inkQty, categoryId: 'b_office_supplies' },
      ];
      const total = items.reduce((a, x) => a + x.total, 0);
      out.push(b({ id: txId, workspaceId: ws, kind: 'expense', date: day(month, 12), merchant: 'Popular Book Co. Bangsar', receiptNumber: `PBC${month.replace('-', '')}88`, total, subtotal: total, tax: 0, categoryId: 'b_office_supplies', lineItems: items, departmentId: 'dept_admin', paymentMethod: 'debit_card', businessPurpose: 'Office stationery' }));
    }
  }
  // Non-P&L items to demonstrate correct treatment
  out.push(b({ id: id(), workspaceId: ws, kind: 'expense', date: day(shiftMonth(thisMonth, -2), 9), merchant: 'Machines Contoh (MacBook Air)', total: 549900, categoryId: 'b_capex', departmentId: 'dept_admin', paymentMethod: 'credit_card', businessPurpose: 'Laptop for finance staff (fixed asset)' }));
  out.push(b({ id: id(), workspaceId: ws, kind: 'expense', date: day(shiftMonth(thisMonth, -1), 20), merchant: 'Owner withdrawal', total: 300000, categoryId: 'b_drawings', classification: 'owner_drawing', paymentMethod: 'bank_transfer', source: 'manual' }));
  out.push(b({ id: id(), workspaceId: ws, kind: 'expense', date: day(shiftMonth(thisMonth, -1), 28), merchant: 'Bank Contoh — term loan', total: 250000, categoryId: 'b_loan_principal', paymentMethod: 'bank_transfer', source: 'manual', businessPurpose: 'Loan principal instalment' }));
  // Employee claims awaiting approval
  const claimDay = Math.max(1, Number(today.slice(8, 10)) - 1);
  out.push(b({ id: id(), workspaceId: ws, kind: 'expense', date: day(thisMonth, claimDay), merchant: 'Petronas Bangsar South', total: 12000, categoryId: 'b_travel', departmentId: 'dept_sales', paymentMethod: 'debit_card', status: 'submitted', createdBy: 'sample_emp', approvedBy: null, approvedAt: null, submittedAt: `${today}T03:00:00.000Z`, businessPurpose: 'Client visit — Shah Alam' }));
  out.push(b({ id: id(), workspaceId: ws, kind: 'expense', date: day(thisMonth, claimDay), merchant: 'Restoran Rebung', total: 18650, categoryId: 'b_meals', departmentId: 'dept_sales', paymentMethod: 'credit_card', status: 'submitted', createdBy: 'sample_emp', approvedBy: null, approvedAt: null, submittedAt: `${today}T04:00:00.000Z`, businessPurpose: 'Lunch with prospective client' }));
  return out;
}

export function sampleBudgets(workspaceId: string, type: 'personal' | 'business'): Budget[] {
  const at = '2026-01-01T00:00:00.000Z';
  const mk = (id: string, name: string, amount: number, scope: Budget['scope'], period: Budget['period'] = 'monthly'): Budget => ({
    id, workspaceId, name, period, periodKey: '*', scope, amount, alertThresholds: [80, 100], createdBy: SAMPLE_UID, createdAt: at,
  });
  if (type === 'personal') {
    return [
      mk('sample_bud_overall', 'Monthly spending', 450000, { type: 'overall' }),
      mk('sample_bud_groceries', 'Groceries', 90000, { type: 'category', categoryId: 'p_groceries' }),
      mk('sample_bud_food', 'Food & Dining', 25000, { type: 'category', categoryId: 'p_food' }),
      mk('sample_bud_petrol', 'Petrol', 25000, { type: 'category', categoryId: 'p_petrol' }),
    ];
  }
  return [
    mk('sample_bud_company', 'Company operating budget', 3200000, { type: 'overall' }),
    mk('sample_bud_marketing', 'Marketing', 150000, { type: 'category', categoryId: 'b_marketing' }),
    mk('sample_bud_office', 'Office supplies', 20000, { type: 'category', categoryId: 'b_office_supplies' }),
    mk('sample_bud_sales_dept', 'Sales department', 250000, { type: 'department', dimensionId: 'dept_sales' }),
  ];
}

export const SAMPLE_CATEGORIES = { personal: PERSONAL_CATEGORIES, business: BUSINESS_CATEGORIES };

/** Sample OCR texts of Malaysian receipts used by extraction tests and the demo scanner. */
export const SAMPLE_RECEIPT_TEXTS: Record<string, string> = {
  grocery: `LOTUS'S STORES (MALAYSIA) SDN BHD
(CO. REG. 199701021234)
LOTUS'S MUTIARA DAMANSARA
SST ID: W10-1808-31000123
TAX INVOICE
Receipt No: 0123-456-78901
Date: 14/10/2026 Time: 18:42
BERAS WANGI FAIZA 5KG        23.90
SAJI MINYAK MASAK 5KG        29.90
DUTCH LADY FULL CREAM 1L
 2 x 7.49                    14.98
GARDENIA ORIGINAL 600G        4.30
SUBTOTAL                     73.08
TOTAL                        73.08
VISA                         73.08
THANK YOU / TERIMA KASIH`,
  cafe: `ZUS COFFEE KLCC
LOT C-12 SURIA KLCC
INVOICE NO: ZK-20261015-0042
15-10-2026 09:12
SPANISH LATTE (L)            12.90
CHEESE CROISSANT              9.50
SUBTOTAL                     22.40
SST 6%                        1.34
ROUNDING                      0.01
TOTAL                        23.75
TNG EWALLET                  23.75`,
};
