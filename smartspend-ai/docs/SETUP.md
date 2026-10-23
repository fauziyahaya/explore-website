# Setup: services, credentials & environment variables

Items marked 💳 need a **paid plan or billing**, 🔐 need **credentials you create**, ⏳ need **external approval or review**.

## 1. Firebase project 🔐 💳
1. Create a project at console.firebase.google.com. Upgrade to **Blaze** 💳 (needed for Cloud Functions, Secret Manager and outbound calls to Google APIs).
2. Enable **Authentication** providers:
   - Email/Password.
   - **Apple**. Needs an Apple Developer Services ID and key 🔐. Firebase → Auth → Apple has the steps.
   - **Google**.
3. Create **Firestore** (production mode, region `asia-southeast1`) and **Storage** in the same region.
4. Add an **iOS app** (bundle id = `IOS_BUNDLE_ID`, default `my.smartspend.ai`) and a **Web app**. Copy the web config values into `apps/mobile/.env` (see `apps/mobile/.env.example`).
5. Deploy rules, indexes and functions:
   ```bash
   npm i -g firebase-tools && firebase login
   # edit .firebaserc → your project id
   firebase deploy --only firestore,storage
   npm run deploy -w @smartspend/functions
   ```
6. Grant the functions' service account **Service Account Token Creator** on itself. `getSignedUrl` needs this to return report download links.
7. Optional (recommended): enable **App Check** with App Attest, then set `ENFORCE_APP_CHECK=true` for the functions.

## 2. Server secrets (Google Secret Manager) 🔐
Never put these in the app.
```bash
firebase functions:secrets:set GEMINI_API_KEY               # Google AI Studio / Vertex key 💳 (usage-billed)
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET   # secret of the *Web* OAuth client (step 3)
firebase functions:secrets:set TOKEN_ENCRYPTION_KEY         # 32 random bytes, base64: openssl rand -base64 32
```
Parameters (asked for at deploy time, or set in `functions/.env.<project>`):

| Param | Example | Purpose |
|---|---|---|
| `GOOGLE_OAUTH_WEB_CLIENT_ID` | `123-abc.apps.googleusercontent.com` | OAuth client for the server auth-code exchange |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Multimodal model used for receipts (set to the current recommended Flash model) |
| `VISION_FALLBACK` | `true` | Use Cloud Vision OCR + rules if Gemini fails. Enable the **Cloud Vision API** 💳 |
| `UPLOAD_RECEIPTS_TO_DRIVE` | `true` | Copy receipts to the user's Drive so Sheets rows link to the evidence |

## 3. Google Cloud OAuth for Sheets & Drive 🔐 ⏳
1. In the same GCP project: **APIs & Services → enable** Google Sheets API, Google Drive API, Cloud Vision API (optional) and Generative Language API.
2. **OAuth consent screen**: External, app name "SmartSpend AI", support email, privacy policy URL, terms URL, authorised domain. Scopes: `.../auth/spreadsheets` and `.../auth/drive.file`.
   - ⏳ `spreadsheets` is a **sensitive scope**, so Google **verification** is required before going public. Allow 1–4 weeks. You'll need a demo video of the consent flow and a privacy policy that explains how Sheets data is used. While testing, add testers under "Test users" (up to 100).
3. Create OAuth clients:
   - **Web application** → its client ID goes to `GOOGLE_OAUTH_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; its secret goes to `GOOGLE_OAUTH_CLIENT_SECRET`.
   - **iOS** (bundle id) → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Put its *reversed* client ID in `GOOGLE_IOS_URL_SCHEME`.

How it works: the app gets a one-time `serverAuthCode` (Google Sign-In with `offlineAccess`). The `connectGoogleAccount` function exchanges it for a refresh token, checks the granted scopes, encrypts the token with AES-256-GCM and stores it in `private_googleTokens/{uid}`, which no client can read. This Google connection is separate from how the user logs in to the app.

## 4. Mobile app environment (`apps/mobile/.env`)
These are public identifiers only. See `.env.example`. If you leave every value blank, the app runs in **demo mode**.

## 5. Apple 🔐 💳 ⏳
- **Apple Developer Program** (USD 99/year) 💳. Create the App ID with the **Sign in with Apple** capability.
- App Store Connect app record ⏳ (review is described in DEPLOYMENT.md).

## 6. Local development
```bash
npm install
npx firebase emulators:start --only auth,firestore,storage,functions --project demo-smartspend
npm run start -w @smartspend/mobile
```
Native features (VisionKit scanner, Google Sign-In, Apple Sign-In, Face ID) need a **development build**: `npx eas-cli build --profile development --platform ios`. Expo Go is enough for the demo.

Sandboxed Linux CI note: if the Java-based emulators run behind a proxy, unset `JAVA_TOOL_OPTIONS` and `HTTPS_PROXY` for the emulator process. Otherwise Storage→Firestore cross-service rule lookups fail.

## 7. Future integrations (not yet configured)
- **LHDN MyInvois e-Invoice**: needs a MyInvois taxpayer account, client credentials ⏳ and (for some flows) a digital certificate. The data model already stores TIN and SST numbers.
- **Bank feeds**: needs an aggregator contract (e.g. via a Malaysian open-finance provider) 💳 ⏳. CSV import works today.
- **Subscriptions**: App Store in-app purchases (StoreKit, for example via RevenueCat) 💳.
