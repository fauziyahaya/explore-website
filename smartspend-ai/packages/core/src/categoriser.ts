import { fallbackCategoryId } from './categories';
import { normaliseName, tokens } from './text';
import type { Category, Transaction, WorkspaceType } from './types';

export interface CategorySuggestion {
  categoryId: string;
  confidence: number;
  /** Human-readable explanation of why this category was chosen. */
  reason: string;
  source: 'learned_merchant' | 'learned_item' | 'keyword' | 'fallback';
}

/**
 * Memory learned from approved, user-confirmed categorisations. It is a plain
 * serialisable object so it can be stored per workspace in Firestore.
 */
export interface CategoryMemory {
  merchants: Record<string, Record<string, number>>; // normalised merchant -> categoryId -> count
  items: Record<string, Record<string, number>>; // normalised item token -> categoryId -> count
}

export function emptyMemory(): CategoryMemory {
  return { merchants: {}, items: {} };
}

function bump(map: Record<string, Record<string, number>>, key: string, categoryId: string) {
  if (!key) return;
  const bucket = (map[key] ??= {});
  bucket[categoryId] = (bucket[categoryId] ?? 0) + 1;
}

/** Learn only from approved records (human-verified). */
export function learnFromTransaction(memory: CategoryMemory, tx: Transaction): CategoryMemory {
  if (tx.status !== 'approved') return memory;
  bump(memory.merchants, normaliseName(tx.merchant), tx.categoryId);
  for (const item of tx.lineItems) {
    if (!item.categoryId) continue;
    const key = itemKey(item.description);
    bump(memory.items, key, item.categoryId);
  }
  return memory;
}

export function buildMemory(transactions: Transaction[]): CategoryMemory {
  return transactions.reduce(learnFromTransaction, emptyMemory());
}

function itemKey(description: string): string {
  // First two meaningful tokens are a stable signature for repeat purchases ("beras faiza 5kg" -> "beras faiza").
  return tokens(description)
    .filter((t) => !/^\d/.test(t))
    .slice(0, 2)
    .join(' ');
}

function best(bucket: Record<string, number> | undefined, valid: Set<string>): [string, number, number] | null {
  if (!bucket) return null;
  let total = 0;
  let top: [string, number] | null = null;
  for (const [id, n] of Object.entries(bucket)) {
    if (!valid.has(id)) continue;
    total += n;
    if (!top || n > top[1]) top = [id, n];
  }
  return top ? [top[0], top[1], total] : null;
}

function keywordMatch(text: string, categories: Category[]): { category: Category; keyword: string } | null {
  const hay = ` ${normaliseName(text)} `;
  let found: { category: Category; keyword: string } | null = null;
  for (const c of categories) {
    for (const k of c.keywords) {
      const needle = normaliseName(k);
      if (!needle) continue;
      if (hay.includes(` ${needle} `) && (!found || needle.length > normaliseName(found.keyword).length)) {
        found = { category: c, keyword: k };
      }
    }
  }
  return found;
}

export function suggestCategory(
  input: { merchant?: string | null; description?: string | null; kind: 'expense' | 'income' },
  categories: Category[],
  workspaceType: WorkspaceType,
  memory: CategoryMemory = emptyMemory(),
): CategorySuggestion {
  const usable = categories.filter(
    (c) => !c.archived && (input.kind === 'income' ? c.kind === 'income' : c.kind !== 'income'),
  );
  const valid = new Set(usable.map((c) => c.id));

  if (input.merchant) {
    const learned = best(memory.merchants[normaliseName(input.merchant)], valid);
    if (learned) {
      const [id, n, total] = learned;
      const consistency = n / total;
      return {
        categoryId: id,
        confidence: Math.min(0.97, 0.6 + 0.1 * Math.min(n, 3) + 0.1 * consistency),
        reason: `You categorised ${n} of ${total} previous receipts from this merchant this way.`,
        source: 'learned_merchant',
      };
    }
  }
  if (input.description) {
    const learned = best(memory.items[itemKey(input.description)], valid);
    if (learned) {
      const [id, n, total] = learned;
      return {
        categoryId: id,
        confidence: Math.min(0.95, 0.55 + 0.1 * Math.min(n, 3) + 0.1 * (n / total)),
        reason: `Matches ${n} previously approved purchase(s) of this item.`,
        source: 'learned_item',
      };
    }
  }
  const kw =
    (input.description && keywordMatch(input.description, usable)) ||
    (input.merchant && keywordMatch(input.merchant, usable)) ||
    null;
  if (kw) {
    return {
      categoryId: kw.category.id,
      confidence: 0.7,
      reason: `Contains the keyword “${kw.keyword}”.`,
      source: 'keyword',
    };
  }
  return {
    categoryId: fallbackCategoryId(workspaceType, input.kind),
    confidence: 0.2,
    reason: 'No matching rule or history — please choose a category.',
    source: 'fallback',
  };
}

/**
 * Header category for a multi-category receipt: the category carrying the
 * largest share of the line-item value.
 */
export function dominantCategory(items: Array<{ categoryId?: string | null; total: number }>, fallback: string): string {
  const totals = new Map<string, number>();
  for (const i of items) if (i.categoryId) totals.set(i.categoryId, (totals.get(i.categoryId) ?? 0) + i.total);
  let top: [string, number] | null = null;
  for (const e of totals) if (!top || e[1] > top[1]) top = e;
  return top?.[0] ?? fallback;
}
