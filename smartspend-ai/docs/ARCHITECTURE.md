# Architecture

```
 iPhone app (Expo / React Native)                 Firebase (asia-southeast1)                     Google
 ────────────────────────────────                 ─────────────────────────                     ──────
 UI screens (expo-router)                         Cloud Functions (callable, Node 22)
   │                                                ├─ extractReceipt ──────────────────────►  Gemini (structured JSON)
   ▼                                                │                   └─ fallback ──────────► Cloud Vision OCR
 AppContext (session, workspace, live data)        ├─ save/review/amend/deleteDraft  ← RBAC, validation,
   │                                                │                                     duplicate index, audit chain
   ├─ FirebaseBackend ──── HTTPS callable ───────► ├─ connect/disconnectGoogleAccount  (refresh token AES-GCM encrypted)
   │    ├─ Firestore listeners (read-only)          ├─ linkSpreadsheet / syncSheetsNow / onTransactionWrite ──► Sheets API + Drive (drive.file)
   │    ├─ Storage upload (receipts)                ├─ generateReport (PDF/XLSX/CSV/ZIP/Sheets)
   │    └─ offline outbox (AsyncStorage)            └─ createWorkspace / invites / roles / export / delete
   └─ DemoBackend (sample data, on-device)        Firestore  ← security rules: tenant isolation, read-only finance data
                                                  Storage    ← receipts immutable, per-user upload folders
        ▲                       ▲
        └──── @smartspend/core ─┘   (same financial engine on device and server)
```

## Layers (separated as required)

| Concern | Where |
|---|---|
| Mobile UI & navigation | `apps/mobile/src/app/*` (screens), `src/ui/*`, `src/charts/*` |
| Business logic / financial calculation engine | `packages/core/src/finance.ts`, `analytics.ts`, `budgets.ts`, `insights.ts`, `priceComparison.ts` |
| AI processing | `functions/src/ai/extract.ts` (Gemini + Vision), validation in `packages/core/src/receipt/*` |
| Cloud integration | `functions/src/services/sheetsApi.ts`, `sheetsSync.ts`, `googleAuth.ts`, `reports.ts` |
| Security | `firebase/*.rules`, `functions/src/lib/authz.ts`, `lib/crypto.ts`, `lib/audit.ts` |

Android: the code avoids iOS-only APIs except through Expo modules, all of which ship Android implementations. The icons map to both SF Symbols and Material Symbols, so an Android build only needs QA and Play Console setup.

## Data model (Firestore)

```
users/{uid}                         profile, locale, biometricLock, consents[], googleConnection
workspaces/{wid}                    type personal|business, name, SSM reg no, TIN, SST no, baseCurrency, retentionYears,
                                    approvalRequired, accountingBasis, isSample, googleSheets{spreadsheetId,url,lastSyncAt}
  members/{uid}                     role owner|finance_manager|approver|employee|auditor, active, departmentId
  transactions/{tid}                kind, date, merchant, receiptNumber, currency, total, subtotal, tax, discount, rounding,
                                    fxRateToBase, baseTotal, paymentMethod, classification business|personal|owner_drawing,
                                    categoryId, lineItems[{description, brand, productCategory, qty, unit, packageSize,
                                    unitPrice, discount, tax, total, categoryId}], department/project/costCentre,
                                    businessPurpose, status draft|submitted|approved|rejected|superseded, source,
                                    receipt{storagePath, sha256, contentType, driveLink}, ai{model, confidence, correctedFields},
                                    fingerprint, createdBy/At, approvedBy/At, version, amendsTransactionId, supersededBy,
                                    sync{sheets, syncedAt, error}, isSample
  fingerprints/{hash}               duplicate-prevention index (server only)
  extractions/{id}                  raw AI extraction kept for audit
  audit/{seq}                       hash-chained events {action, actor, at, changes[before→after], reason, prevHash, hash}
  categories/{id} budgets/{id} dimensions/{id} reports/{ref} invites/{id}
  meta/auditHead meta/categoryMemory meta/sheets meta/reportCounter
private_googleTokens/{uid}          encrypted refresh token (no client access)
```
Money is stored as **integer sen** (minor units) everywhere.

## Key design decisions

- **Server-authoritative financial records.** Clients can't write transactions at all (see the rules). Every save goes through a callable that validates the input, works out the status from the caller's role, applies the duplicate index and appends to the audit chain, all in a single Firestore transaction.
- **Corrections never overwrite approved records.** An amendment creates version *n+1* that points to the original. The original is marked `superseded` and kept. Both changes, with the reason, are recorded in the audit trail.
- **Tamper-evident audit trail.** Each event hashes the previous event's hash plus its own canonical JSON (SHA-256). `verifyChain` detects any edit, deletion or reordering, and the app shows the verification status.
- **Idempotency end-to-end.** The client creates transaction ids, so an offline retry replays as the same record. The fingerprint index blocks the same receipt being recorded under a new id, and identical images are caught by SHA-256. Sheets sync upserts on the ID column under a per-workspace lease, so concurrent triggers can't append the same row twice.
- **Google Sheets is a reporting mirror, not the source of truth.** Transaction tabs are upserted row by row. Derived tabs (summary, budgets, audit export, reporting data) are rebuilt from the database on every sync, and values are written `RAW` so a cell can never be turned into a formula.
- **Cash flow ≠ profit.** Capital expenditure, owner drawings and contributions, loan principal, transfers, and personal spending in a business are kept out of P&L and shown separately. `reconcile()` proves that P&L plus these excluded items equals all cash moved.
- **No invented data.** The AI prompt and schema require `null` for anything not printed. Arithmetic checks only *lower confidence*; they never "fix" values. Insights and alerts carry the exact calculation that produced them.
- **Learning categoriser.** It suggests from approved history first (merchant, then item), then keywords, then a low-confidence fallback. It learns only from approved records, and the memory is stored per workspace.
