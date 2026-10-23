import type { AccountingClass, Category, WorkspaceType } from './types';

type Def = [
  id: string,
  kind: Category['kind'],
  en: string,
  ms: string,
  accountingClass: AccountingClass,
  icon: string,
  color: string,
  keywords: string[],
  help?: [string, string],
];

const PERSONAL: Def[] = [
  ['p_groceries', 'expense', 'Groceries', 'Barangan Runcit', 'personal_expense', 'cart', '#0E9F6E',
    ['tesco', 'lotus', 'aeon', 'giant', 'mydin', 'jaya grocer', 'village grocer', 'nsk', '99 speedmart', 'econsave', 'rice', 'beras', 'milk', 'susu', 'egg', 'telur', 'sugar', 'gula', 'flour', 'tepung', 'oil', 'minyak masak', 'bread', 'roti', 'vegetable', 'sayur', 'chicken', 'ayam', 'fish', 'ikan']],
  ['p_food', 'expense', 'Food & Dining', 'Makanan & Minuman', 'personal_expense', 'restaurant', '#F59E0B',
    ['restoran', 'restaurant', 'cafe', 'kopitiam', 'mamak', 'mcdonald', 'kfc', 'starbucks', 'zus coffee', 'tealive', 'grabfood', 'foodpanda', 'nasi', 'mee', 'teh tarik', 'kopi', 'burger', 'pizza']],
  ['p_transport', 'expense', 'Transport', 'Pengangkutan', 'personal_expense', 'bus', '#3B82F6',
    ['grab', 'mrt', 'lrt', 'rapidkl', 'touch n go', 'tng', 'toll', 'tol', 'parking', 'letak kereta', 'ktm', 'airasia ride']],
  ['p_petrol', 'expense', 'Petrol', 'Petrol', 'personal_expense', 'fuel', '#EF4444',
    ['petronas', 'shell', 'petron', 'caltex', 'bhpetrol', 'ron95', 'ron97', 'diesel', 'fuel', 'petrol']],
  ['p_utilities', 'expense', 'Utilities', 'Utiliti', 'personal_expense', 'bolt', '#8B5CF6',
    ['tnb', 'tenaga nasional', 'air selangor', 'syabas', 'indah water', 'unifi', 'maxis', 'celcom', 'digi', 'u mobile', 'time fibre', 'astro', 'electric', 'elektrik', 'water bill']],
  ['p_shopping', 'expense', 'Shopping', 'Membeli-belah', 'personal_expense', 'bag', '#EC4899',
    ['shopee', 'lazada', 'uniqlo', 'h&m', 'zara', 'padini', 'mr diy', 'ikea', 'daiso', 'clothing', 'shoes', 'kasut']],
  ['p_healthcare', 'expense', 'Healthcare', 'Kesihatan', 'personal_expense', 'heart', '#14B8A6',
    ['klinik', 'clinic', 'hospital', 'pharmacy', 'farmasi', 'guardian', 'watsons', 'caring', 'aa pharmacy', 'dental', 'pergigian', 'medicine', 'ubat']],
  ['p_education', 'expense', 'Education', 'Pendidikan', 'personal_expense', 'book', '#6366F1',
    ['popular', 'mph', 'tuition', 'tuisyen', 'school', 'sekolah', 'university', 'universiti', 'ptptn', 'course', 'kursus', 'book', 'buku']],
  ['p_entertainment', 'expense', 'Entertainment', 'Hiburan', 'personal_expense', 'film', '#F97316',
    ['gsc', 'tgv', 'mbo', 'netflix', 'spotify', 'disney', 'cinema', 'pawagam', 'karaoke', 'steam', 'playstation']],
  ['p_travel', 'expense', 'Travel', 'Pelancongan', 'personal_expense', 'plane', '#0EA5E9',
    ['airasia', 'malaysia airlines', 'mas', 'firefly', 'batik air', 'hotel', 'agoda', 'booking.com', 'airbnb', 'resort']],
  ['p_household', 'expense', 'Household', 'Isi Rumah', 'personal_expense', 'home', '#84CC16',
    ['detergent', 'sabun', 'tissue', 'tisu', 'cleaning', 'pembersih', 'furniture', 'perabot', 'rent', 'sewa rumah', 'maintenance', 'penyelenggaraan']],
  ['p_other_exp', 'expense', 'Other Expenses', 'Perbelanjaan Lain', 'personal_expense', 'dots', '#94A3B8', []],
  ['p_salary', 'income', 'Salary', 'Gaji', 'personal_income', 'briefcase', '#0E9F6E', ['salary', 'gaji', 'payroll']],
  ['p_freelance', 'income', 'Freelance Earnings', 'Pendapatan Bebas', 'personal_income', 'laptop', '#10B981', ['freelance', 'invoice payment', 'project fee']],
  ['p_rental', 'income', 'Rental Income', 'Pendapatan Sewa', 'personal_income', 'key', '#22C55E', ['rental', 'sewa']],
  ['p_investment', 'income', 'Investments', 'Pelaburan', 'personal_income', 'trending-up', '#16A34A', ['dividend', 'dividen', 'asb', 'interest', 'faedah', 'hibah', 'unit trust']],
  ['p_other_inc', 'income', 'Other Income', 'Pendapatan Lain', 'personal_income', 'plus', '#4ADE80', []],
  ['p_transfer', 'non_pl', 'Transfer Between Accounts', 'Pindahan Antara Akaun', 'transfer', 'swap', '#64748B', ['transfer to own', 'pindahan']],
];

const BUSINESS: Def[] = [
  ['b_revenue_sales', 'income', 'Sales Revenue', 'Hasil Jualan', 'revenue', 'tag', '#0E9F6E', ['sales', 'jualan'],
    ['Money earned from selling goods.', 'Wang yang diperoleh daripada menjual barangan.']],
  ['b_revenue_service', 'income', 'Service Revenue', 'Hasil Perkhidmatan', 'revenue', 'briefcase', '#10B981', ['service fee', 'consulting fee', 'yuran perkhidmatan'],
    ['Money earned from services provided to customers.', 'Wang daripada perkhidmatan kepada pelanggan.']],
  ['b_other_operating_income', 'income', 'Other Operating Income', 'Pendapatan Operasi Lain', 'other_operating_income', 'plus', '#22C55E', ['commission', 'komisen', 'rebate'],
    ['Income from normal business activities other than core sales.', 'Pendapatan daripada aktiviti biasa selain jualan teras.']],
  ['b_non_operating_income', 'income', 'Non-operating Income', 'Pendapatan Bukan Operasi', 'non_operating_income', 'trending-up', '#16A34A', ['interest income', 'dividend', 'gain on disposal'],
    ['Income not from day-to-day operations, e.g. interest received.', 'Pendapatan bukan daripada operasi harian, cth. faedah diterima.']],
  ['b_customer_payment', 'income', 'Customer Payments', 'Bayaran Pelanggan', 'revenue', 'cash', '#4ADE80', ['payment received', 'bayaran diterima'],
    ['Cash received from customers for sales (cash basis).', 'Tunai diterima daripada pelanggan (asas tunai).']],
  ['b_cogs', 'expense', 'Cost of Goods Sold', 'Kos Barang Dijual', 'cogs', 'box', '#B45309', ['stock', 'stok', 'inventory', 'raw material', 'bahan mentah', 'wholesale', 'borong', 'supplier'],
    ['Direct cost of the products you sold.', 'Kos langsung barangan yang dijual.']],
  ['b_rent', 'expense', 'Rent', 'Sewa', 'operating_expense', 'building', '#7C3AED', ['rent', 'sewa', 'rental of premises', 'tenancy']],
  ['b_utilities', 'expense', 'Utilities', 'Utiliti', 'operating_expense', 'bolt', '#8B5CF6', ['tnb', 'tenaga nasional', 'air selangor', 'indah water', 'unifi', 'maxis', 'celcom', 'digi', 'time fibre', 'electric', 'elektrik']],
  ['b_payroll', 'expense', 'Payroll & Staff Costs', 'Gaji & Kos Pekerja', 'operating_expense', 'users', '#2563EB', ['salary', 'gaji', 'epf', 'kwsp', 'socso', 'perkeso', 'eis', 'payroll', 'bonus', 'allowance', 'elaun']],
  ['b_marketing', 'expense', 'Marketing & Advertising', 'Pemasaran & Pengiklanan', 'operating_expense', 'megaphone', '#DB2777', ['facebook ads', 'meta', 'google ads', 'tiktok ads', 'advertising', 'iklan', 'banner', 'flyer', 'printing promo']],
  ['b_travel', 'expense', 'Travel & Accommodation', 'Perjalanan & Penginapan', 'operating_expense', 'plane', '#0EA5E9', ['airasia', 'malaysia airlines', 'hotel', 'grab', 'toll', 'tol', 'parking', 'petronas', 'shell', 'petrol', 'mileage']],
  ['b_office_supplies', 'expense', 'Office Supplies', 'Bekalan Pejabat', 'operating_expense', 'paperclip', '#0891B2', ['popular', 'stationery', 'alat tulis', 'paper', 'kertas', 'a4', 'toner', 'ink', 'dakwat', 'printer', 'pen', 'file', 'mr diy']],
  ['b_maintenance', 'expense', 'Repairs & Maintenance', 'Pembaikan & Penyelenggaraan', 'operating_expense', 'wrench', '#65A30D', ['repair', 'baiki', 'service', 'servis', 'maintenance', 'penyelenggaraan', 'aircond']],
  ['b_software', 'expense', 'Software Subscriptions', 'Langganan Perisian', 'operating_expense', 'cloud', '#4F46E5', ['google workspace', 'microsoft', 'adobe', 'zoom', 'slack', 'aws', 'canva', 'notion', 'subscription', 'langganan', 'saas']],
  ['b_professional', 'expense', 'Professional Fees', 'Yuran Profesional', 'operating_expense', 'scale', '#9333EA', ['audit fee', 'accounting', 'perakaunan', 'legal', 'guaman', 'company secretary', 'setiausaha syarikat', 'consultant', 'perunding', 'tax agent']],
  ['b_meals', 'expense', 'Meals & Entertainment', 'Makan & Keraian', 'operating_expense', 'restaurant', '#F59E0B', ['restoran', 'restaurant', 'cafe', 'kopitiam', 'mamak', 'starbucks', 'catering', 'katering'],
    ['Business meals and client entertainment; tax deductibility may be limited.', 'Makan dan keraian perniagaan; potongan cukai mungkin terhad.']],
  ['b_financing', 'expense', 'Financing Charges', 'Caj Pembiayaan', 'other_expense', 'percent', '#DC2626', ['interest', 'faedah', 'bank charges', 'caj bank', 'late payment', 'profit charge'],
    ['Interest and bank charges. Loan principal repayments are NOT expenses.', 'Faedah dan caj bank. Bayaran balik pokok pinjaman BUKAN perbelanjaan.']],
  ['b_other_expense', 'expense', 'Other Expenses', 'Perbelanjaan Lain', 'operating_expense', 'dots', '#94A3B8', []],
  ['b_capex', 'non_pl', 'Capital Expenditure (Assets)', 'Perbelanjaan Modal (Aset)', 'capital_expenditure', 'cube', '#475569', ['laptop', 'computer', 'komputer', 'machine', 'mesin', 'vehicle', 'kenderaan', 'furniture', 'perabot', 'renovation'],
    ['Purchase of long-term assets. Recorded as an asset, not a P&L expense (depreciation applies).', 'Pembelian aset jangka panjang. Direkod sebagai aset, bukan perbelanjaan Untung Rugi.']],
  ['b_drawings', 'non_pl', 'Owner Drawings', 'Pengeluaran Pemilik', 'owner_drawing', 'user-minus', '#334155', ['drawing', 'personal use', 'kegunaan peribadi'],
    ['Money taken out by the owner for personal use. Not a business expense.', 'Wang diambil pemilik untuk kegunaan peribadi. Bukan perbelanjaan perniagaan.']],
  ['b_owner_contribution', 'non_pl', 'Owner Capital Contribution', 'Sumbangan Modal Pemilik', 'owner_contribution', 'user-plus', '#334155', ['capital injection', 'suntikan modal'],
    ['Money put into the business by the owner. Not revenue.', 'Wang dimasukkan oleh pemilik. Bukan hasil.']],
  ['b_loan_principal', 'non_pl', 'Loan Principal Repayment', 'Bayaran Balik Pokok Pinjaman', 'financing', 'bank', '#334155', ['loan repayment', 'bayaran pinjaman', 'hire purchase'],
    ['Repaying the borrowed amount. A balance-sheet movement, not an expense.', 'Membayar balik jumlah dipinjam. Pergerakan kunci kira-kira, bukan perbelanjaan.']],
  ['b_transfer', 'non_pl', 'Transfer Between Accounts', 'Pindahan Antara Akaun', 'transfer', 'swap', '#64748B', ['transfer to own', 'pindahan']],
];

function build(defs: Def[], workspaceType: WorkspaceType): Category[] {
  return defs.map(([id, kind, en, ms, accountingClass, icon, color, keywords, help]) => ({
    id,
    workspaceType,
    kind,
    name: { en, ms },
    accountingClass,
    icon,
    color,
    keywords,
    isDefault: true,
    ...(help ? { help: { en: help[0], ms: help[1] } } : {}),
  }));
}

export const PERSONAL_CATEGORIES: Category[] = build(PERSONAL, 'personal');
export const BUSINESS_CATEGORIES: Category[] = build(BUSINESS, 'business');

export function defaultCategories(type: WorkspaceType): Category[] {
  return type === 'personal' ? PERSONAL_CATEGORIES : BUSINESS_CATEGORIES;
}

export function fallbackCategoryId(type: WorkspaceType, kind: 'expense' | 'income'): string {
  if (type === 'personal') return kind === 'expense' ? 'p_other_exp' : 'p_other_inc';
  return kind === 'expense' ? 'b_other_expense' : 'b_other_operating_income';
}

/** True when a category's amounts appear in the profit & loss / surplus calculation. */
export function isProfitAndLoss(cls: AccountingClass): boolean {
  return !['capital_expenditure', 'owner_drawing', 'owner_contribution', 'financing', 'transfer'].includes(cls);
}

export function categoryLabel(c: Pick<Category, 'name'> | undefined, locale: 'en' | 'ms' = 'en'): string {
  return c ? c.name[locale] : locale === 'ms' ? 'Tidak dikategorikan' : 'Uncategorised';
}

export function makeCustomCategory(
  input: { id: string; name: string; nameMs?: string; kind: Category['kind']; accountingClass: AccountingClass; color?: string; icon?: string; keywords?: string[] },
  workspaceType: WorkspaceType,
): Category {
  return {
    id: input.id,
    workspaceType,
    kind: input.kind,
    name: { en: input.name, ms: input.nameMs ?? input.name },
    accountingClass: input.accountingClass,
    icon: input.icon ?? 'tag',
    color: input.color ?? '#0F766E',
    keywords: (input.keywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean),
    isDefault: false,
  };
}
