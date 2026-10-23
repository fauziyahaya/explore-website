import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { normaliseName, similarity } from './text';
import type { Transaction } from './types';

/**
 * Deterministic fingerprint used for duplicate prevention and as the
 * idempotency key. Same merchant + date + total + receipt number => same hash.
 */
export function transactionFingerprint(tx: Pick<Transaction, 'workspaceId' | 'kind' | 'merchant' | 'date' | 'total' | 'currency' | 'receiptNumber'>): string {
  const parts = [
    tx.workspaceId,
    tx.kind,
    normaliseName(tx.merchant),
    tx.date,
    tx.currency,
    String(tx.total),
    (tx.receiptNumber ?? '').replace(/\s/g, '').toUpperCase(),
  ];
  return bytesToHex(sha256(utf8ToBytes(parts.join('|')))).slice(0, 32);
}

export function sha256Hex(data: Uint8Array | string): string {
  return bytesToHex(sha256(typeof data === 'string' ? utf8ToBytes(data) : data));
}

export interface DuplicateMatch {
  transactionId: string;
  score: number; // 0..1
  reasons: string[];
}

/**
 * Find likely duplicates of a candidate among existing records. Exact
 * fingerprint or identical receipt image => certain duplicate; otherwise a
 * fuzzy score on merchant similarity, amount and date proximity.
 */
export function findDuplicates(
  candidate: Pick<Transaction, 'id' | 'workspaceId' | 'kind' | 'merchant' | 'date' | 'total' | 'currency' | 'receiptNumber' | 'fingerprint'> & {
    receipt?: { sha256: string } | null;
  },
  existing: Transaction[],
  threshold = 0.75,
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const cDate = Date.parse(candidate.date);
  for (const tx of existing) {
    if (tx.id === candidate.id || tx.status === 'superseded' || tx.status === 'rejected' || tx.kind !== candidate.kind) continue;
    const reasons: string[] = [];
    let score = 0;
    if (tx.fingerprint === candidate.fingerprint) {
      score = 1;
      reasons.push('Same merchant, date, amount and receipt number');
    }
    if (candidate.receipt?.sha256 && tx.receipt?.sha256 === candidate.receipt.sha256) {
      score = 1;
      reasons.push('Identical receipt image already uploaded');
    }
    if (
      candidate.receiptNumber &&
      tx.receiptNumber &&
      candidate.receiptNumber.replace(/\s/g, '').toUpperCase() === tx.receiptNumber.replace(/\s/g, '').toUpperCase() &&
      similarity(candidate.merchant ?? '', tx.merchant ?? '') > 0.7
    ) {
      score = Math.max(score, 0.95);
      reasons.push('Same receipt number from the same merchant');
    }
    if (score < 1) {
      const sameAmount = tx.total === candidate.total && tx.currency === candidate.currency;
      const days = Math.abs(Date.parse(tx.date) - cDate) / 86_400_000;
      const sim = similarity(candidate.merchant ?? '', tx.merchant ?? '');
      if (sameAmount && days <= 1 && sim >= 0.6) {
        const fuzzy = 0.55 + 0.3 * sim + (days === 0 ? 0.1 : 0);
        if (fuzzy > score) {
          score = fuzzy;
          reasons.push(`Same amount at a similar merchant ${days === 0 ? 'on the same day' : 'within a day'}`);
        }
      }
    }
    if (score >= threshold) matches.push({ transactionId: tx.id, score: Math.round(score * 100) / 100, reasons });
  }
  return matches.sort((a, b) => b.score - a.score);
}
