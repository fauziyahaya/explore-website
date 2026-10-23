import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const W = 'ws_rules';
const RUN = `r_${Date.now()}`;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-smartspend',
    firestore: { rules: readFileSync(new URL('../../firebase/firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync(new URL('../../firebase/storage.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9199 },
  });
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, `workspaces/${W}`), { name: 'Rules Co', type: 'business', ownerUid: 'owner', retentionYears: 7, approvalRequired: true });
    for (const [uid, role] of [['owner', 'owner'], ['fm', 'finance_manager'], ['emp', 'employee'], ['emp2', 'employee'], ['aud', 'auditor']]) {
      await setDoc(doc(db, `workspaces/${W}/members/${uid}`), { uid, role, active: true });
    }
    await setDoc(doc(db, `workspaces/${W}/members/gone`), { uid: 'gone', role: 'finance_manager', active: false });
    await setDoc(doc(db, `workspaces/${W}/transactions/t_emp`), { createdBy: 'emp', total: 100, status: 'submitted' });
    await setDoc(doc(db, `workspaces/${W}/transactions/t_fm`), { createdBy: 'fm', total: 200, status: 'approved' });
    await setDoc(doc(db, `workspaces/${W}/audit/0000000001`), { sequence: 1 });
    await setDoc(doc(db, `workspaces/other_ws`), { name: 'Other Co', type: 'business', ownerUid: 'stranger' });
    await setDoc(doc(db, `workspaces/other_ws/members/stranger`), { uid: 'stranger', role: 'owner', active: true });
    await setDoc(doc(db, 'private_googleTokens/owner'), { refreshToken: 'v1.secret' });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('tenant isolation', () => {
  it('members read their workspace; non-members and anonymous users cannot', async () => {
    await assertSucceeds(getDoc(doc(as('emp'), `workspaces/${W}`)));
    await assertFails(getDoc(doc(as('stranger'), `workspaces/${W}`)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `workspaces/${W}`)));
    await assertFails(getDoc(doc(as('owner'), 'workspaces/other_ws')));
  });
  it('deactivated members lose access', async () => {
    await assertFails(getDoc(doc(as('gone'), `workspaces/${W}`)));
  });
  it('OAuth tokens are never readable by any client', async () => {
    await assertFails(getDoc(doc(as('owner'), 'private_googleTokens/owner')));
  });
});

describe('role-based access to financial records', () => {
  it('employees only see their own claims', async () => {
    await assertSucceeds(getDoc(doc(as('emp'), `workspaces/${W}/transactions/t_emp`)));
    await assertFails(getDoc(doc(as('emp'), `workspaces/${W}/transactions/t_fm`)));
    await assertFails(getDoc(doc(as('emp2'), `workspaces/${W}/transactions/t_emp`)));
    await assertSucceeds(getDocs(query(collection(as('emp'), `workspaces/${W}/transactions`), where('createdBy', '==', 'emp'))));
    await assertFails(getDocs(collection(as('emp'), `workspaces/${W}/transactions`)));
  });
  it('finance roles and auditors see all records', async () => {
    await assertSucceeds(getDocs(collection(as('fm'), `workspaces/${W}/transactions`)));
    await assertSucceeds(getDocs(collection(as('aud'), `workspaces/${W}/transactions`)));
    await assertSucceeds(getDocs(collection(as('aud'), `workspaces/${W}/audit`)));
    await assertFails(getDocs(collection(as('emp'), `workspaces/${W}/audit`)));
  });
  it('no client — not even the owner — can write transactions or the audit trail directly', async () => {
    await assertFails(setDoc(doc(as('owner'), `workspaces/${W}/transactions/new`), { createdBy: 'owner', total: 1, status: 'approved' }));
    await assertFails(updateDoc(doc(as('owner'), `workspaces/${W}/transactions/t_fm`), { total: 1 }));
    await assertFails(deleteDoc(doc(as('owner'), `workspaces/${W}/transactions/t_fm`)));
    await assertFails(updateDoc(doc(as('owner'), `workspaces/${W}/audit/0000000001`), { sequence: 9 }));
    await assertFails(setDoc(doc(as('owner'), `workspaces/${W}/members/emp`), { uid: 'emp', role: 'owner', active: true }));
  });
  it('budgets and categories: finance roles only, auditor read-only', async () => {
    const budget = { workspaceId: W, amount: 10000, period: 'monthly', name: 'Ops' };
    await assertSucceeds(setDoc(doc(as('fm'), `workspaces/${W}/budgets/b1`), budget));
    await assertFails(setDoc(doc(as('emp'), `workspaces/${W}/budgets/b2`), budget));
    await assertFails(setDoc(doc(as('aud'), `workspaces/${W}/budgets/b3`), budget));
    await assertFails(setDoc(doc(as('fm'), `workspaces/${W}/budgets/b4`), { ...budget, amount: -1 }));
    await assertSucceeds(setDoc(doc(as('owner'), `workspaces/${W}/categories/c1`), { name: { en: 'Courier', ms: 'Kurier' }, kind: 'expense', accountingClass: 'operating_expense' }));
    await assertFails(deleteDoc(doc(as('owner'), `workspaces/${W}/categories/c1`)));
  });
  it('only the owner edits the company profile, and only allowed fields', async () => {
    await assertSucceeds(updateDoc(doc(as('owner'), `workspaces/${W}`), { name: 'Rules Co Sdn Bhd', retentionYears: 7 }));
    await assertFails(updateDoc(doc(as('owner'), `workspaces/${W}`), { ownerUid: 'fm' }));
    await assertFails(updateDoc(doc(as('fm'), `workspaces/${W}`), { name: 'Hacked' }));
  });
  it('users manage their own profile but not protected fields', async () => {
    await assertSucceeds(setDoc(doc(as('emp'), 'users/emp'), { locale: 'ms', biometricLock: true }));
    await assertFails(updateDoc(doc(as('emp'), 'users/emp'), { workspaceIds: ['other_ws'] }));
    await assertFails(getDoc(doc(as('emp'), 'users/owner')));
  });
});

describe('receipt storage', () => {
  const st = (uid: string) => env.authenticatedContext(uid).storage();
  const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  it('members upload receipts only to their own folder; receipts are immutable', async () => {
    await assertSucceeds(uploadBytes(ref(st('emp'), `receipts/${W}/emp/${RUN}.jpg`), img, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(st('emp'), `receipts/${W}/emp2/r1.jpg`), img, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(st('stranger'), `receipts/${W}/stranger/r1.jpg`), img, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(st('emp'), `receipts/${W}/emp/evil.html`), img, { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(st('aud'), `receipts/${W}/aud/r1.jpg`), img, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(st('emp'), `receipts/${W}/emp/${RUN}.jpg`), img, { contentType: 'image/jpeg' })); // overwrite
    await assertFails(deleteObject(ref(st('emp'), `receipts/${W}/emp/${RUN}.jpg`)));
  });
  it('finance roles and auditors can read receipts; other employees cannot', async () => {
    await assertSucceeds(getBytes(ref(st('aud'), `receipts/${W}/emp/${RUN}.jpg`)));
    await assertSucceeds(getBytes(ref(st('emp'), `receipts/${W}/emp/${RUN}.jpg`)));
    await assertFails(getBytes(ref(st('emp2'), `receipts/${W}/emp/${RUN}.jpg`)));
    await assertFails(getBytes(ref(st('stranger'), `receipts/${W}/emp/${RUN}.jpg`)));
  });
});
