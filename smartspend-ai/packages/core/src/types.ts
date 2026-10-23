import type { CurrencyCode } from './money';

/** ISO date string (YYYY-MM-DD) in the workspace's local calendar. */
export type ISODate = string;
/** ISO timestamp (UTC). */
export type ISOTimestamp = string;

export type Locale = 'en' | 'ms';

// ───────────────────────────── Accounts & tenancy ─────────────────────────────

export type WorkspaceType = 'personal' | 'business';

export type Role = 'owner' | 'finance_manager' | 'approver' | 'employee' | 'auditor';

export interface Workspace {
  id: string;
  type: WorkspaceType;
  name: string;
  /** SSM registration number for Malaysian companies. */
  registrationNumber?: string;
  taxIdentificationNumber?: string;
  sstRegistrationNumber?: string;
  address?: string;
  baseCurrency: CurrencyCode;
  ownerUid: string;
  /** Record retention in years (Malaysian default: 7). */
  retentionYears: number;
  logoPath?: string;
  reportHeader?: string;
  /** Marks demo/sample workspaces so sample data never mixes with real records. */
  isSample: boolean;
  /** Accounting basis; accrual is a Phase-3 option. */
  accountingBasis: 'cash' | 'accrual';
  createdAt: ISOTimestamp;
  /** Approval required before an employee-submitted expense is counted. */
  approvalRequired: boolean;
  googleSheets?: GoogleSheetsLink;
}

export interface GoogleSheetsLink {
  spreadsheetId: string;
  spreadsheetUrl: string;
  connectedByUid: string;
  connectedAt: ISOTimestamp;
  lastSyncAt?: ISOTimestamp;
  lastSyncError?: string;
}

export interface Member {
  uid: string;
  workspaceId: string;
  role: Role;
  displayName: string;
  email: string;
  departmentId?: string;
  invitedBy?: string;
  joinedAt: ISOTimestamp;
  active: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  locale: Locale;
  defaultWorkspaceId?: string;
  biometricLock: boolean;
  createdAt: ISOTimestamp;
  /** Consent records (PDPA 2010): what, version, when. */
  consents: Array<{ purpose: ConsentPurpose; version: string; grantedAt: ISOTimestamp; revokedAt?: ISOTimestamp }>;
}

export type ConsentPurpose = 'privacy_policy' | 'terms' | 'ai_processing' | 'google_sheets_sync' | 'analytics';

// ───────────────────────────── Categories & dimensions ─────────────────────────────

/**
 * Determines how a category flows into financial statements. Cash outflows are
 * NOT automatically expenses: owner drawings, capital expenditure, financing
 * (loan principal) and transfers are excluded from profit & loss.
 */
export type AccountingClass =
  | 'revenue'
  | 'other_operating_income'
  | 'non_operating_income'
  | 'cogs'
  | 'operating_expense'
  | 'other_expense'
  | 'capital_expenditure'
  | 'owner_drawing'
  | 'owner_contribution'
  | 'financing'
  | 'transfer'
  | 'personal_income'
  | 'personal_expense';

export interface Category {
  id: string;
  workspaceType: WorkspaceType;
  kind: 'expense' | 'income' | 'non_pl';
  name: { en: string; ms: string };
  accountingClass: AccountingClass;
  icon: string;
  color: string;
  /** Keywords used by the rule-based categoriser (lowercase). */
  keywords: string[];
  isDefault: boolean;
  archived?: boolean;
  /** Plain-language explanation shown for accounting terms. */
  help?: { en: string; ms: string };
}

export interface Dimension {
  id: string;
  workspaceId: string;
  type: 'department' | 'cost_centre' | 'project' | 'business_unit';
  name: string;
  code?: string;
  archived?: boolean;
}

// ───────────────────────────── Transactions ─────────────────────────────

export type TransactionKind = 'expense' | 'income';
export type TransactionStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'superseded';
export type TransactionSource = 'camera' | 'library' | 'pdf' | 'manual' | 'csv_import';
export type PaymentMethod =
  | 'cash'
  | 'debit_card'
  | 'credit_card'
  | 'ewallet'
  | 'bank_transfer'
  | 'duitnow'
  | 'cheque'
  | 'other'
  | 'unknown';
export type Classification = 'business' | 'personal' | 'owner_drawing';
export type SyncState = 'not_connected' | 'pending' | 'synced' | 'failed';

export interface LineItem {
  id: string;
  description: string;
  brand?: string | null;
  productCategory?: string | null;
  quantity: number;
  /** Unit of measurement as printed (pcs, kg, L, pack...). */
  unit?: string | null;
  /** Package size text as printed, e.g. "5kg", "1.5L", "12x330ml". */
  packageSize?: string | null;
  unitPrice: number | null; // minor units
  discount: number; // minor units, positive number
  tax: number; // minor units
  total: number; // minor units, after discount
  categoryId?: string | null;
}

export interface ReceiptAttachment {
  storagePath: string;
  contentType: string;
  sha256: string;
  sizeBytes?: number;
  uploadedAt: ISOTimestamp;
  /** Pending upload while offline (local file uri). */
  localUri?: string;
  /** Copy uploaded to the user's Google Drive (drive.file scope) for Sheets links. */
  driveFileId?: string | null;
  driveLink?: string | null;
}

export interface Transaction {
  id: string;
  workspaceId: string;
  kind: TransactionKind;
  date: ISODate;
  merchant: string | null;
  receiptNumber: string | null;
  currency: CurrencyCode;
  /** Amount in transaction currency, minor units, always positive. */
  total: number;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  rounding: number | null;
  /** Exchange rate to workspace base currency, if currency differs. */
  fxRateToBase?: number | null;
  /** Total converted to workspace base currency (minor units). */
  baseTotal: number;
  paymentMethod: PaymentMethod;
  classification: Classification;
  categoryId: string;
  lineItems: LineItem[];
  description?: string | null;
  businessPurpose?: string | null;
  departmentId?: string | null;
  costCentreId?: string | null;
  projectId?: string | null;
  incomeSource?: string | null;
  status: TransactionStatus;
  source: TransactionSource;
  receipt?: ReceiptAttachment | null;
  ai?: {
    extractionId: string;
    suggestedCategoryId?: string | null;
    overallConfidence: number;
    model: string;
    /** Fields the user changed from the AI suggestion. */
    correctedFields: string[];
  } | null;
  isRecurring?: boolean;
  fingerprint: string;
  createdBy: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  submittedAt?: ISOTimestamp | null;
  approvedBy?: string | null;
  approvedAt?: ISOTimestamp | null;
  rejectedReason?: string | null;
  /** Amendment chain: approved records are never overwritten. */
  version: number;
  amendsTransactionId?: string | null;
  supersededBy?: string | null;
  amendmentReason?: string | null;
  sync: { sheets: SyncState; syncedAt?: ISOTimestamp | null; error?: string | null };
  isSample: boolean;
}

// ───────────────────────────── AI extraction ─────────────────────────────

export interface ExtractedField<T> {
  value: T | null;
  /** 0..1 — below REVIEW_THRESHOLD the UI highlights the field for verification. */
  confidence: number;
}

export interface ExtractedLineItem {
  description: ExtractedField<string>;
  brand: ExtractedField<string>;
  productCategory: ExtractedField<string>;
  quantity: ExtractedField<number>;
  unit: ExtractedField<string>;
  packageSize: ExtractedField<string>;
  unitPrice: ExtractedField<number>; // minor units
  discount: ExtractedField<number>;
  total: ExtractedField<number>;
}

export interface ExtractedReceipt {
  merchant: ExtractedField<string>;
  merchantAddress: ExtractedField<string>;
  merchantTaxId: ExtractedField<string>;
  date: ExtractedField<ISODate>;
  time: ExtractedField<string>;
  receiptNumber: ExtractedField<string>;
  currency: ExtractedField<CurrencyCode>;
  subtotal: ExtractedField<number>;
  discount: ExtractedField<number>;
  tax: ExtractedField<number>;
  serviceCharge: ExtractedField<number>;
  rounding: ExtractedField<number>;
  total: ExtractedField<number>;
  paymentMethod: ExtractedField<PaymentMethod>;
  lineItems: ExtractedLineItem[];
  documentType: 'receipt' | 'invoice' | 'unknown';
  /** Arithmetic and plausibility checks performed on the extraction. */
  checks: ExtractionCheck[];
  overallConfidence: number;
  model: string;
  rawText?: string;
}

export interface ExtractionCheck {
  code:
    | 'LINE_ITEMS_MATCH_SUBTOTAL'
    | 'SUBTOTAL_TAX_MATCH_TOTAL'
    | 'TOTAL_PRESENT'
    | 'DATE_PRESENT'
    | 'DATE_NOT_FUTURE'
    | 'MERCHANT_PRESENT'
    | 'QTY_X_PRICE_MATCH';
  passed: boolean;
  message: string;
}

// ───────────────────────────── Budgets & alerts ─────────────────────────────

export type BudgetScope =
  | { type: 'overall' }
  | { type: 'category'; categoryId: string }
  | { type: 'department'; dimensionId: string }
  | { type: 'business_unit'; dimensionId: string }
  | { type: 'project'; dimensionId: string }
  | { type: 'merchant'; merchant: string };

export interface Budget {
  id: string;
  workspaceId: string;
  name: string;
  period: 'monthly' | 'annual';
  /** For monthly budgets "YYYY-MM", annual "YYYY". Recurring budgets have periodKey '*' */
  periodKey: string;
  scope: BudgetScope;
  amount: number; // minor units, base currency
  alertThresholds: number[]; // e.g. [80, 100]
  createdBy: string;
  createdAt: ISOTimestamp;
}

export type AlertType =
  | 'budget_threshold'
  | 'budget_exceeded'
  | 'spending_spike'
  | 'duplicate_suspected'
  | 'unusual_amount';

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  /** Transparent, reproducible calculation backing the alert. */
  calculation: string;
  transactionIds: string[];
  budgetId?: string;
  createdAt: ISOTimestamp;
}

// ───────────────────────────── Audit trail ─────────────────────────────

export type AuditAction =
  | 'created'
  | 'updated'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'amended'
  | 'deleted'
  | 'synced'
  | 'exported'
  | 'receipt_attached';

export interface AuditEvent {
  id: string;
  workspaceId: string;
  sequence: number;
  entityType: 'transaction' | 'budget' | 'category' | 'member' | 'workspace' | 'report';
  entityId: string;
  action: AuditAction;
  actorUid: string;
  actorName?: string;
  at: ISOTimestamp;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
  reason?: string | null;
  prevHash: string;
  hash: string;
}
