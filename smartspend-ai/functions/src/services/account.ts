import { newId, type Member, type Role, type Workspace, type WorkspaceType } from '@smartspend/core';
import { HttpsError } from 'firebase-functions/v2/https';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import type { MemberContext } from '../lib/authz';
import { auth, bucket, db, nowIso, paths, storagePaths } from '../lib/firebase';

const ROLES: Role[] = ['owner', 'finance_manager', 'approver', 'employee', 'auditor'];

export async function createWorkspace(
  uid: string,
  input: { type: WorkspaceType; name: string; registrationNumber?: string | null; taxIdentificationNumber?: string | null; sstRegistrationNumber?: string | null; address?: string | null; baseCurrency?: string; retentionYears?: number; approvalRequired?: boolean },
): Promise<Workspace> {
  if (input.type !== 'personal' && input.type !== 'business') throw new HttpsError('invalid-argument', 'Invalid workspace type.');
  const name = input.name?.trim();
  if (!name || name.length > 120) throw new HttpsError('invalid-argument', 'Name is required.');
  const owned = await db.collection('workspaces').where('ownerUid', '==', uid).count().get();
  if (owned.data().count >= 20) throw new HttpsError('resource-exhausted', 'Workspace limit reached.');
  const user = await auth().getUser(uid);
  const id = newId(input.type === 'personal' ? 'wsp' : 'wsb');
  const now = nowIso();
  const ws: Workspace = {
    id,
    type: input.type,
    name,
    ...(input.registrationNumber ? { registrationNumber: input.registrationNumber.trim() } : {}),
    ...(input.taxIdentificationNumber ? { taxIdentificationNumber: input.taxIdentificationNumber.trim() } : {}),
    ...(input.sstRegistrationNumber ? { sstRegistrationNumber: input.sstRegistrationNumber.trim() } : {}),
    ...(input.address ? { address: input.address.trim() } : {}),
    baseCurrency: /^[A-Z]{3}$/.test(input.baseCurrency ?? '') ? input.baseCurrency! : 'MYR',
    ownerUid: uid,
    retentionYears: Math.min(Math.max(Math.round(input.retentionYears ?? 7), 1), 30),
    isSample: false,
    accountingBasis: 'cash',
    createdAt: now,
    approvalRequired: input.type === 'business' ? input.approvalRequired ?? true : false,
  };
  const member: Member = { uid, workspaceId: id, role: 'owner', displayName: user.displayName ?? user.email ?? 'Owner', email: user.email ?? '', joinedAt: now, active: true };
  const batch = db.batch();
  batch.set(db.doc(paths.workspace(id)), ws);
  batch.set(db.doc(paths.member(id, uid)), member);
  batch.set(db.doc(paths.user(uid)), { defaultWorkspaceId: id, workspaceIds: [...((await db.doc(paths.user(uid)).get()).get('workspaceIds') ?? []), id] }, { merge: true });
  await batch.commit();
  return ws;
}

export async function inviteMember(ctx: MemberContext, email: string, role: Role, departmentId: string | null) {
  if (ctx.workspace.type !== 'business') throw new HttpsError('failed-precondition', 'Team members are available for business workspaces.');
  if (!ROLES.includes(role) || role === 'owner') throw new HttpsError('invalid-argument', 'Invalid role.');
  const normalised = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) throw new HttpsError('invalid-argument', 'Invalid email address.');
  const id = newId('inv');
  await db.collection(paths.invites(ctx.workspace.id)).doc(id).set({ id, email: normalised, role, departmentId, invitedBy: ctx.uid, createdAt: nowIso(), status: 'pending', workspaceName: ctx.workspace.name });
  return { inviteId: id };
}

/** Accept every pending invite addressed to the caller's verified email. */
export async function acceptInvites(uid: string) {
  const user = await auth().getUser(uid);
  if (!user.email || !user.emailVerified) return { joined: [] as string[] };
  const invites = await db.collectionGroup('invites').where('email', '==', user.email.toLowerCase()).where('status', '==', 'pending').get();
  const joined: string[] = [];
  for (const inv of invites.docs) {
    const wid = inv.ref.parent.parent!.id;
    const d = inv.data();
    const member: Member = { uid, workspaceId: wid, role: d.role, displayName: user.displayName ?? user.email, email: user.email, departmentId: d.departmentId ?? undefined, invitedBy: d.invitedBy, joinedAt: nowIso(), active: true };
    const batch = db.batch();
    batch.set(db.doc(paths.member(wid, uid)), JSON.parse(JSON.stringify(member)));
    batch.update(inv.ref, { status: 'accepted', acceptedAt: nowIso(), acceptedBy: uid });
    batch.set(db.doc(paths.user(uid)), { workspaceIds: [...new Set([...(((await db.doc(paths.user(uid)).get()).get('workspaceIds') as string[]) ?? []), wid])] }, { merge: true });
    await batch.commit();
    joined.push(wid);
  }
  return { joined };
}

export async function setMemberRole(ctx: MemberContext, targetUid: string, role: Role | null) {
  if (targetUid === ctx.workspace.ownerUid) throw new HttpsError('failed-precondition', 'The business owner role cannot be changed here.');
  const ref = db.doc(paths.member(ctx.workspace.id, targetUid));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Member not found.');
  if (role === null) await ref.update({ active: false, deactivatedAt: nowIso(), deactivatedBy: ctx.uid });
  else {
    if (!ROLES.includes(role) || role === 'owner') throw new HttpsError('invalid-argument', 'Invalid role.');
    await ref.update({ role, active: true });
  }
}

/** PDPA data access request: a ZIP of the caller's profile and the records they created. */
export async function exportUserData(uid: string) {
  const user = await db.doc(paths.user(uid)).get();
  const memberships = await db.collectionGroup('members').where('uid', '==', uid).get();
  const archive = archiver('zip');
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on('data', (c: Buffer) => chunks.push(c));
  const ended = new Promise((r) => out.on('end', r));
  archive.pipe(out);
  archive.append(JSON.stringify({ profile: user.data() ?? null, exportedAt: nowIso() }, null, 2), { name: 'profile.json' });
  for (const m of memberships.docs) {
    const wid = m.ref.parent.parent!.id;
    const ws = await db.doc(paths.workspace(wid)).get();
    const own = await db.collection(paths.transactions(wid)).where('createdBy', '==', uid).get();
    archive.append(JSON.stringify({ workspace: ws.data(), membership: m.data(), transactions: own.docs.map((d) => d.data()) }, null, 2), { name: `workspaces/${wid}.json` });
  }
  await archive.finalize();
  await ended;
  const id = newId('exp');
  const file = bucket().file(storagePaths.export(uid, id));
  await file.save(Buffer.concat(chunks), { contentType: 'application/zip' });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60_000 });
  await db.doc(paths.dataRequests(uid)).set({ lastExportAt: nowIso(), lastExportPath: file.name }, { merge: true });
  return { url };
}

/**
 * Account deletion (App Store Guideline 5.1.1(v)). Personal workspaces and
 * receipts owned by the user are deleted. A business the user solely owns
 * must be transferred or closed first, because its records may be subject to
 * statutory retention (7 years). Memberships elsewhere are deactivated and
 * the member's personal details anonymised; business records they created
 * remain with the business as required for audit.
 */
export async function deleteAccount(uid: string) {
  const owned = await db.collection('workspaces').where('ownerUid', '==', uid).get();
  const businesses = owned.docs.filter((d) => d.get('type') === 'business' && !d.get('isSample'));
  if (businesses.length) {
    throw new HttpsError('failed-precondition', `You own ${businesses.length} business workspace(s). Transfer ownership or close the business (subject to its record-retention policy) before deleting your account.`, { workspaces: businesses.map((b) => b.id) });
  }
  for (const ws of owned.docs) {
    await db.recursiveDelete(ws.ref);
    await bucket().deleteFiles({ prefix: `receipts/${ws.id}/` }).catch(() => undefined);
    await bucket().deleteFiles({ prefix: `reports/${ws.id}/` }).catch(() => undefined);
  }
  const memberships = await db.collectionGroup('members').where('uid', '==', uid).get();
  await Promise.all(memberships.docs.map((m) => m.ref.update({ active: false, displayName: 'Former member', email: '', deletedAt: nowIso() })));
  await db.doc(paths.googleToken(uid)).delete().catch(() => undefined);
  await bucket().deleteFiles({ prefix: `exports/${uid}/` }).catch(() => undefined);
  await db.doc(paths.user(uid)).delete();
  await auth().deleteUser(uid);
  return { deletedWorkspaces: owned.size, deactivatedMemberships: memberships.size };
}
