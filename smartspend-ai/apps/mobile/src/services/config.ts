/**
 * Public client configuration, read from EXPO_PUBLIC_* environment variables
 * (see .env.example). These identify the Firebase project and are safe to ship
 * in the app — they grant no access by themselves; access is enforced by
 * Firebase Auth + Security Rules + Cloud Functions. Never put API secrets,
 * OAuth client secrets or service-account keys here.
 */
export function firebaseConfig() {
  const c = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  return c.apiKey && c.projectId && c.appId ? (c as Record<keyof typeof c, string>) : null;
}

export function googleConfig() {
  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  };
}

export const isBackendConfigured = () => firebaseConfig() !== null;

export const LEGAL = {
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://example.com/smartspend/privacy',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://example.com/smartspend/terms',
  policyVersion: '2026-10',
};
