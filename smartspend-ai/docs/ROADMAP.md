# Delivery status & roadmap

## Phase 1 — Functional MVP ✅ built
| Feature | Status |
|---|---|
| Email/password, Apple, Google login; Face ID lock; password reset; account deletion | ✅ (native sign-in to be device-tested) |
| Personal and business profiles; multiple businesses per user | ✅ |
| Receipt capture: VisionKit scanner (auto edges/crop), camera fallback, photo library, PDF, manual | ✅ |
| AI extraction (Gemini structured output) + Vision OCR fallback + arithmetic validation + confidence highlighting | ✅ (mock-tested; needs `GEMINI_API_KEY` for live runs) |
| Review and correction; multi-category receipts; duplicate warnings | ✅ |
| Expense and income recording; auto-categorisation that learns from approvals | ✅ |
| Google Sheets sync (9 tabs, idempotent, Drive-linked receipts) | ✅ (in-memory API tested; needs OAuth setup for live runs) |
| Dashboard; Generate Analytics with interactive charts and drill-down | ✅ |
| PDF / XLSX / CSV / Sheets / ZIP reports | ✅ |

## Phase 2 — Business & audit ✅ mostly built
| Feature | Status |
|---|---|
| Roles: owner, finance manager, approver, employee, auditor; server-enforced | ✅ |
| Employee submission, approval/rejection, segregation of duties | ✅ |
| Tamper-evident audit trail, amendments instead of overwrites | ✅ |
| P&L, income & expenditure, 10 audit report types, evidence ZIP with SHA-256 manifest | ✅ |
| Budgets (category / department / business unit / project / merchant / overall), 80% and 100% alerts, anomaly and duplicate alerts | ✅ |
| Brand and merchant unit-price comparison, price history, saving opportunities | ✅ |
| Explainable insights ("Office supplies +22%… mostly printer ink") | ✅ |
| Company logo on reports | 🟡 renderer supports it; logo upload UI still to add |
| Approval signatures (drawn) | ⬜ Phase 2b. "Prepared by / Reviewed by" names are printed |
| Push notifications for alerts and approvals | ⬜ Phase 2b. Alerts appear in the app now; add Expo push + a scheduled function |
| Scheduled retention enforcement / archival | ⬜ Phase 2b. Retention is configured; deletion is blocked for approved records |

## Phase 3 — Commercial expansion ⬜
Subscriptions (StoreKit), accrual accounting (receivables and payables, period matching), bank feeds, accounting software export (e.g. SQL Account, AutoCount, Xero), LHDN MyInvois e-Invoice submission and validation, advanced AI insights, Android release (the code is ready; needs QA and a Play listing), and multi-currency FX rate feeds.
