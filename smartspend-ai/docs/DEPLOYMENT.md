# iOS build, TestFlight & release

Builds run in the cloud with **EAS**, so you don't need a Mac or Xcode.

## One-time
```bash
cd smartspend-ai/apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init                    # writes the projectId → set EAS_PROJECT_ID
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_FIREBASE_API_KEY --value ... --visibility plaintext
# …repeat for every EXPO_PUBLIC_* in .env.example, plus GOOGLE_IOS_URL_SCHEME and IOS_BUNDLE_ID
```
EAS creates and manages your distribution certificate and provisioning profile on the first build. Choose "Let EAS handle it".

## Development build (real device testing of native features)
```bash
npx eas-cli build --profile development --platform ios
npx expo start --dev-client
```
Test on a device: the VisionKit document scanner, Face ID lock, Sign in with Apple and Google, camera and photo permissions, and offline capture (airplane mode, then reconnect and check the outbox flushes).

## TestFlight
```bash
npx eas-cli build --profile production --platform ios     # auto-increments buildNumber
npx eas-cli submit --platform ios --latest                # uploads to App Store Connect
```
1. In App Store Connect → TestFlight, wait for processing (about 10–30 min) and fill in **Export Compliance**. The app uses only standard HTTPS/TLS and declares `ITSAppUsesNonExemptEncryption=false`.
2. **Internal testing** (up to 100 team members) is available immediately.
3. **External testing** needs Beta App Review (usually under 48 h). Provide a demo account (see the checklist) and "What to test" notes.

## Production release
1. Complete the [App Store checklist](APP_STORE_CHECKLIST.md).
2. App Store Connect → the version → select the build → **Submit for Review**.
3. Release manually after approval, or use phased release.

## Backend release order
1. `firebase deploy --only firestore:rules,firestore:indexes,storage`
2. `npm run deploy -w @smartspend/functions`. Functions stay backwards-compatible with the previous app version, because callables ignore unknown fields.
3. Then ship the app build.

## Over-the-air updates
JS-only fixes can ship with `npx eas-cli update --branch production`. Native or config changes need a new store build.
