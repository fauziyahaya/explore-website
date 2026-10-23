# App Store submission checklist

## Account & legal
- [ ] Apple Developer Program membership active. For a company, enrol as an **organisation** (needs a D-U-N-S number), since this is a business/finance app.
- [ ] Privacy Policy URL live (`EXPO_PUBLIC_PRIVACY_URL`). It must cover: receipt images, financial records, AI processing by Google (Gemini/Vision), Google Sheets/Drive sync, retention (7 years by default), account deletion, and PDPA 2010 rights (access, correction, withdrawal of consent).
- [ ] Terms of Use URL live. State that reports are not audited statements and that this is not financial or tax advice.
- [ ] Google OAuth verification for the `spreadsheets` scope approved (or Sheets sync hidden for external users until it is).

## App Store Connect metadata
- [ ] Name: **SmartSpend AI** · Subtitle (≤30): "Receipt scanner & expenses"
- [ ] Category: **Finance** (secondary: Business, Productivity)
- [ ] Keywords: receipt,expense,scanner,budget,SST,invois,belanja,resit,perbelanjaan,akaun,Malaysia
- [ ] Description in **English and Malay** (both localisations are supported).
- [ ] Screenshots: 6.9" (1320×2868) and 6.5" (1284×2778). Suggested set: Snap → Review → Dashboard → Analytics → Reports → P&L. `docs/screenshots` has drafts. Capture final ones from a device or simulator build.
- [ ] Age rating questionnaire (no objectionable content → 4+).
- [ ] Support URL and marketing URL.

## App Privacy ("nutrition label") — must match `app.config.ts → privacyManifests`
- [ ] Data linked to the user: Contact Info (email, name), **Financial Info** (other financial info), User Content (photos: receipts), Identifiers (user ID). Purpose: App Functionality. **No tracking.**
- [ ] Third-party processors disclosed in the privacy policy: Google Firebase and Cloud, Google Gemini/Vision.

## Review guidelines that apply
- [ ] **5.1.1(v) account deletion**: in-app at Settings → Delete account. It deletes personal workspaces, receipts and tokens. A sole owner of a business workspace is asked to transfer or close it first because of statutory retention; this is explained in the dialog.
- [ ] **4.8 Sign in with Apple** is offered alongside Google sign-in.
- [ ] **2.1 demo account for review**: create `appreview@<yourdomain>` with a business workspace containing *sample* data (use the demo workspace content). Put the credentials in Review Notes. Also mention "Explore with sample data" on the login screen.
- [ ] **5.1.2 data use**: Google Sheets sync is opt-in, is a separate connection from login, and can be disconnected at any time.
- [ ] **3.1.1 payments**: if subscriptions are added (Phase 3), use In-App Purchase.
- [ ] **Permission strings** present and specific: Camera, Photo Library, Face ID (in `app.config.ts`).
- [ ] Financial-advice disclaimer is visible on Reports and P&L ("Not an audited financial statement…").

## Technical
- [ ] `ITSAppUsesNonExemptEncryption = false` (HTTPS only).
- [ ] Privacy manifest (`PrivacyInfo.xcprivacy`) is generated from `privacyManifests` with required-reason APIs: UserDefaults CA92.1, FileTimestamp C617.1, DiskSpace E174.1.
- [ ] Production Firebase config, App Check enabled, `ENFORCE_APP_CHECK=true`.
- [ ] Crash/error monitoring (e.g. Sentry or Firebase Crashlytics) added and DSN configured.
- [ ] Device test of every native feature (see DEPLOYMENT.md), including VoiceOver and Dynamic Type at the largest size, plus Dark Mode.
- [ ] Bahasa Malaysia strings reviewed by a native speaker.
- [ ] Remove the demo "act as another member" tool or keep it limited to sample workspaces (it already only exists in demo mode).
