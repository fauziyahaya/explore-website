import type { Member, Role, Transaction, Workspace } from '@smartspend/core';
import { transactionFingerprint } from '@smartspend/core';
import type { MemberContext } from '../src/lib/authz';
import { db, paths } from '../src/lib/firebase';

export async function clearFirestore() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

export async function seedWorkspace(id: string, type: 'personal' | 'business', members: Array<[string, Role]>, extra: Partial<Workspace> = {}): Promise<Record<string, MemberContext>> {
  const ws: Workspace = {
    id, type, name: type === 'business' ? 'Ujian Trading Sdn. Bhd.' : 'My Household', registrationNumber: type === 'business' ? '202601099999 (TEST)' : undefined,
    baseCurrency: 'MYR', ownerUid: members[0]![0], retentionYears: 7, isSample: false, accountingBasis: 'cash', createdAt: '2026-01-01T00:00:00.000Z',
    approvalRequired: type === 'business', ...extra,
  } as Workspace;
  await db.doc(paths.workspace(id)).set(JSON.parse(JSON.stringify(ws)));
  const out: Record<string, MemberContext> = {};
  for (const [uid, role] of members) {
    const m: Member = { uid, workspaceId: id, role, displayName: `${role} ${uid}`, email: `${uid}@example.com`, joinedAt: '2026-01-01T00:00:00.000Z', active: true };
    await db.doc(paths.member(id, uid)).set(m);
    out[uid] = { uid, role, member: m, workspace: ws };
  }
  return out;
}

let n = 0;
export function input(overrides: Partial<Transaction> = {}) {
  n++;
  return {
    id: `tx_test_${Date.now().toString(36)}_${n}`,
    kind: 'expense' as const,
    date: '2026-10-14',
    merchant: "Lotus's Mutiara Damansara",
    receiptNumber: `R-${n}`,
    currency: 'MYR',
    total: 7308,
    subtotal: 7308,
    tax: 0,
    discount: null,
    rounding: null,
    paymentMethod: 'credit_card' as const,
    classification: 'business' as const,
    categoryId: 'b_office_supplies',
    lineItems: [
      { id: `li_${n}_a`, description: 'A4 PAPER 500S', brand: 'Double A', productCategory: 'a4 paper', quantity: 2, unit: 'ream', packageSize: '500PCS', unitPrice: 1590, discount: 0, tax: 0, total: 3180, categoryId: 'b_office_supplies' },
      { id: `li_${n}_b`, description: 'HP 680 INK', brand: 'HP', productCategory: 'printer ink', quantity: 1, unit: 'pcs', packageSize: null, unitPrice: 4128, discount: 0, tax: 0, total: 4128, categoryId: 'b_office_supplies' },
    ],
    businessPurpose: 'Office supplies',
    source: 'camera' as const,
    ...overrides,
  };
}

export function fp(t: Transaction) {
  return transactionFingerprint(t);
}
