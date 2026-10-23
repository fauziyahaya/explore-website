import { HttpsError } from 'firebase-functions/v2/https';
import { OAuth2Client } from 'google-auth-library';
import { decrypt, encrypt } from '../lib/crypto';
import { db, nowIso, paths } from '../lib/firebase';

/** Minimal scopes: Sheets, plus Drive access limited to files this app creates. */
export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
}

/**
 * Exchange the one-time server auth code obtained by the mobile app
 * (Google Sign-In with offlineAccess) for a refresh token. The refresh token
 * is encrypted and stored server-side only; the app never sees it.
 */
export async function connectGoogle(uid: string, serverAuthCode: string, cfg: GoogleOAuthConfig) {
  const client = new OAuth2Client({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, redirectUri: '' });
  let tokens;
  try {
    ({ tokens } = await client.getToken(serverAuthCode));
  } catch (e) {
    throw new HttpsError('invalid-argument', `Google authorisation failed: ${(e as Error).message}`);
  }
  if (!tokens.refresh_token) throw new HttpsError('failed-precondition', 'Google did not return offline access. Please disconnect SmartSpend AI in your Google account permissions and try again.');
  const granted = new Set((tokens.scope ?? '').split(' '));
  const missing = GOOGLE_SCOPES.filter((s) => !granted.has(s));
  if (missing.length) throw new HttpsError('permission-denied', `Please allow access to: ${missing.map((m) => m.split('/').pop()).join(', ')}.`);
  let email: string | null = null;
  if (tokens.id_token) {
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: cfg.clientId }).catch(() => null);
    email = ticket?.getPayload()?.email ?? null;
  }
  await db.doc(paths.googleToken(uid)).set({
    refreshToken: encrypt(tokens.refresh_token, cfg.encryptionKey, uid),
    scopes: [...granted],
    email,
    connectedAt: nowIso(),
  });
  await db.doc(paths.user(uid)).set({ googleConnection: { email, connectedAt: nowIso() } }, { merge: true });
  return { email };
}

export async function authorisedClient(uid: string, cfg: GoogleOAuthConfig): Promise<OAuth2Client> {
  const snap = await db.doc(paths.googleToken(uid)).get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Google account is not connected.');
  const client = new OAuth2Client({ clientId: cfg.clientId, clientSecret: cfg.clientSecret });
  client.setCredentials({ refresh_token: decrypt(snap.get('refreshToken'), cfg.encryptionKey, uid) });
  return client;
}

export async function disconnectGoogle(uid: string, cfg: GoogleOAuthConfig) {
  const ref = db.doc(paths.googleToken(uid));
  const snap = await ref.get();
  if (snap.exists) {
    try {
      const client = new OAuth2Client({ clientId: cfg.clientId, clientSecret: cfg.clientSecret });
      await client.revokeToken(decrypt(snap.get('refreshToken'), cfg.encryptionKey, uid));
    } catch {
      // Token may already be revoked by the user; deletion below still applies.
    }
    await ref.delete();
  }
  await db.doc(paths.user(uid)).set({ googleConnection: null }, { merge: true });
  // Workspaces linked with this user's Google account stop syncing (the spreadsheet itself remains theirs).
  const linked = await db.collection('workspaces').where('googleSheets.connectedByUid', '==', uid).get();
  await Promise.all(linked.docs.map((d) => d.ref.update({ googleSheets: null })));
  return { unlinkedWorkspaces: linked.size };
}
