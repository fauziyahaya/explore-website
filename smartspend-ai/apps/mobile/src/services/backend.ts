import type {
  AuditEvent,
  Budget,
  Category,
  CategoryMemory,
  Dimension,
  ExtractedReceipt,
  Member,
  ReceiptAttachment,
  ReportType,
  Role,
  Transaction,
  TransactionSource,
  UserProfile,
  Workspace,
  WorkspaceType,
} from '@smartspend/core';

export interface Session {
  uid: string;
  email: string | null;
  displayName: string;
  emailVerified: boolean;
  provider: 'demo' | 'password' | 'apple' | 'google';
}

export interface WorkspaceSnapshot {
  transactions: Transaction[];
  customCategories: Category[];
  budgets: Budget[];
  dimensions: Dimension[];
  members: Member[];
  audit: AuditEvent[];
  memory: CategoryMemory | null;
  /** Saves waiting in the offline outbox. */
  pendingUploads: number;
}

export interface ExtractResult {
  extractionId: string;
  extraction: ExtractedReceipt;
  receipt: ReceiptAttachment;
  duplicateImageOf: string | null;
  /** Offline: the image is stored locally and extraction will run on reconnect. */
  queuedOffline?: boolean;
  note?: string;
}

export interface SaveResult {
  transaction: Transaction;
  duplicateOf?: string;
  idempotentReplay?: boolean;
  queuedOffline?: boolean;
}

export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'zip' | 'gsheet';

export interface CreateWorkspaceInput {
  type: WorkspaceType;
  name: string;
  registrationNumber?: string | null;
  taxIdentificationNumber?: string | null;
  sstRegistrationNumber?: string | null;
  address?: string | null;
  baseCurrency?: string;
  retentionYears?: number;
  approvalRequired?: boolean;
}

export class BackendError extends Error {
  constructor(message: string, readonly code: string, readonly details?: Record<string, unknown>) {
    super(message);
  }
}

/**
 * Everything the UI needs from a backend. Implemented by FirebaseBackend
 * (production) and DemoBackend (offline sample data, no credentials needed).
 */
export interface Backend {
  readonly mode: 'demo' | 'firebase';
  onAuthChange(cb: (s: Session | null) => void): () => void;
  signInWithEmail(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signInWithApple(): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  exportMyData(): Promise<string | null>;

  loadProfile(uid: string): Promise<UserProfile | null>;
  saveProfile(uid: string, patch: Partial<UserProfile>): Promise<void>;
  listWorkspaces(uid: string): Promise<Array<{ workspace: Workspace; role: Role }>>;
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>;
  updateWorkspace(id: string, patch: Partial<Workspace>): Promise<void>;
  subscribe(workspaceId: string, ctx: { uid: string; role: Role }, cb: (s: WorkspaceSnapshot) => void, onError: (e: Error) => void): () => void;

  extractReceipt(workspaceId: string, file: { uri: string; mimeType: string }, source: TransactionSource): Promise<ExtractResult>;
  saveTransaction(workspaceId: string, tx: Transaction, opts: { intent: 'draft' | 'save'; allowDuplicate?: boolean; duplicateReason?: string }): Promise<SaveResult>;
  reviewTransaction(workspaceId: string, id: string, decision: 'approve' | 'reject', reason?: string): Promise<void>;
  amendTransaction(workspaceId: string, id: string, patch: Partial<Transaction>, reason: string): Promise<Transaction>;
  deleteDraft(workspaceId: string, id: string): Promise<void>;
  receiptUrl(path: string): Promise<string | null>;

  saveCategory(workspaceId: string, c: Category): Promise<void>;
  saveBudget(workspaceId: string, b: Budget): Promise<void>;
  deleteBudget(workspaceId: string, id: string): Promise<void>;
  saveDimension(workspaceId: string, d: Dimension): Promise<void>;
  inviteMember(workspaceId: string, email: string, role: Role, departmentId?: string | null): Promise<void>;
  setMemberRole(workspaceId: string, uid: string, role: Role | null): Promise<void>;

  generateReport(workspaceId: string, type: ReportType, range: { from: string; to: string }, format: ReportFormat, reviewedByUid?: string | null): Promise<{ url: string; reference: string } | null>;

  connectGoogle(): Promise<{ email: string | null }>;
  disconnectGoogle(): Promise<void>;
  linkSpreadsheet(workspaceId: string): Promise<{ spreadsheetUrl: string }>;
  unlinkSpreadsheet(workspaceId: string): Promise<void>;
  syncSheetsNow(workspaceId: string): Promise<void>;

  /** Try to flush the offline outbox; returns remaining items. */
  flushOutbox(): Promise<number>;
}
