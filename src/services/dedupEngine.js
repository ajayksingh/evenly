/**
 * Deduplication Engine — detect and merge duplicate transactions
 * from SMS and email sources.
 *
 * Uses amount proximity, date proximity, and fuzzy merchant matching
 * to identify duplicates. No external dependencies required.
 */

/** Maximum amount difference (in rupees) to consider a match. */
const AMOUNT_TOLERANCE = 1;

/** Maximum date difference (in milliseconds) to consider a match — 1 day. */
const DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** Minimum merchant similarity score to consider a match. */
const MERCHANT_MATCH_THRESHOLD = 0.7;

/**
 * Compute the bigram set of a string.
 * Used internally by fuzzyMerchantMatch for Dice coefficient calculation.
 *
 * @param {string} str
 * @returns {Map<string, number>} bigram -> count
 */
function bigrams(str) {
  const map = new Map();
  for (let i = 0; i < str.length - 1; i++) {
    const pair = str.substring(i, i + 2);
    map.set(pair, (map.get(pair) || 0) + 1);
  }
  return map;
}

/**
 * Compute fuzzy similarity between two merchant names.
 *
 * Uses the Dice coefficient over character bigrams, which gives good results
 * for short strings like merchant names without needing external libraries.
 *
 * @param {string} merchant1 - First merchant name.
 * @param {string} merchant2 - Second merchant name.
 * @returns {number} Similarity score between 0 and 1.
 */
export function fuzzyMerchantMatch(merchant1, merchant2) {
  if (!merchant1 || !merchant2) return 0;

  const a = merchant1.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const b = merchant2.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Containment check: if one fully contains the other, score highly.
  // The contained string is the "core" merchant name; extra chars are
  // noise like order IDs, suffixes, etc.
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    // Floor at 0.75 so containment always clears the 0.7 threshold
    return Math.max(0.75, shorter / longer);
  }

  // Dice coefficient on bigrams
  if (a.length < 2 || b.length < 2) {
    return a[0] === b[0] ? 0.5 : 0;
  }

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);

  let intersection = 0;
  for (const [pair, countA] of bigramsA) {
    const countB = bigramsB.get(pair) || 0;
    intersection += Math.min(countA, countB);
  }

  const totalBigrams = (a.length - 1) + (b.length - 1);
  return (2 * intersection) / totalBigrams;
}

/**
 * Parse a value to a Date, handling strings and Date objects.
 *
 * @param {string|number|Date} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Check whether two amounts are within tolerance.
 *
 * @param {number} a
 * @param {number} b
 * @returns {boolean}
 */
function amountsMatch(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

/**
 * Check whether two dates are within tolerance (1 day).
 *
 * @param {string|number|Date} a
 * @param {string|number|Date} b
 * @returns {boolean}
 */
function datesMatch(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return Math.abs(da.getTime() - db.getTime()) <= DATE_TOLERANCE_MS;
}

/**
 * Compute an overall confidence score for a potential duplicate pair.
 * Weights: amount (0.35), date (0.30), merchant (0.35).
 *
 * @param {{ amount: number, date: *, merchant: string }} txA
 * @param {{ amount: number, date: *, merchant: string }} txB
 * @returns {number} Confidence between 0 and 1.
 */
function computeConfidence(txA, txB) {
  let score = 0;

  // Amount component (0.35)
  if (amountsMatch(txA.amount, txB.amount)) {
    const diff = Math.abs(txA.amount - txB.amount);
    score += 0.35 * (1 - diff / (AMOUNT_TOLERANCE + 1));
  }

  // Date component (0.30)
  const da = toDate(txA.date);
  const db = toDate(txB.date);
  if (da && db) {
    const diffMs = Math.abs(da.getTime() - db.getTime());
    if (diffMs <= DATE_TOLERANCE_MS) {
      score += 0.30 * (1 - diffMs / (DATE_TOLERANCE_MS + 1));
    }
  }

  // Merchant component (0.35)
  const merchantScore = fuzzyMerchantMatch(
    txA.merchant || txA.description || '',
    txB.merchant || txB.description || '',
  );
  if (merchantScore >= MERCHANT_MATCH_THRESHOLD) {
    score += 0.35 * merchantScore;
  }

  return Math.round(score * 1000) / 1000;
}

/**
 * Check whether a new transaction is a duplicate of any existing transaction.
 *
 * @param {{ amount: number, date: string|Date, merchant?: string, description?: string }} newTransaction
 *   The incoming transaction to test.
 * @param {Array<{ id: string, amount: number, date: string|Date, merchant?: string, description?: string }>} existingTransactions
 *   The set of already-known transactions.
 * @returns {{ isDuplicate: boolean, matchedId: string|null, confidence: number }}
 *   - isDuplicate: true when confidence >= 0.7
 *   - matchedId:   the id of the best-matching existing transaction, or null
 *   - confidence:   overall match confidence (0-1)
 */
export function deduplicateTransactions(newTransaction, existingTransactions) {
  if (!newTransaction || !Array.isArray(existingTransactions) || existingTransactions.length === 0) {
    return { isDuplicate: false, matchedId: null, confidence: 0 };
  }

  let bestMatch = { isDuplicate: false, matchedId: null, confidence: 0 };

  for (let i = 0; i < existingTransactions.length; i++) {
    const existing = existingTransactions[i];

    // Quick rejection: skip if amounts are way off
    if (typeof newTransaction.amount === 'number' && typeof existing.amount === 'number') {
      if (Math.abs(newTransaction.amount - existing.amount) > AMOUNT_TOLERANCE) {
        continue;
      }
    }

    const confidence = computeConfidence(newTransaction, existing);

    if (confidence > bestMatch.confidence) {
      bestMatch = {
        isDuplicate: confidence >= MERCHANT_MATCH_THRESHOLD,
        matchedId: existing.id || null,
        confidence,
      };
    }
  }

  return bestMatch;
}

/**
 * Merge two transactions, keeping the richer record and combining source badges.
 *
 * The "richer" record is determined by counting non-null fields. Metadata from
 * both records is preserved. A `sources` array is produced to track provenance
 * (e.g. ["sms", "email"]).
 *
 * Confidence-based behaviour:
 *   - > 0.9:   auto-merge, single source badge
 *   - 0.7-0.9: merge with combined "SMS + Email" badge
 *   - < 0.7:   returns the existing record unchanged (caller should treat as separate)
 *
 * @param {{ id: string, [key: string]: * }} existing  - The already-stored transaction.
 * @param {{ [key: string]: * }}              newTx     - The incoming transaction.
 * @returns {{ merged: object, action: 'auto-merge'|'merge-with-badge'|'skip' }}
 */
export function mergeTransactions(existing, newTx) {
  if (!existing || !newTx) {
    return { merged: existing || newTx || null, action: 'skip' };
  }

  const confidence = computeConfidence(existing, newTx);

  if (confidence < MERCHANT_MATCH_THRESHOLD) {
    return { merged: existing, action: 'skip' };
  }

  // Determine which record has more data
  const fieldsOf = (obj) =>
    Object.keys(obj).filter((k) => obj[k] !== null && obj[k] !== undefined && obj[k] !== '').length;

  const base = fieldsOf(existing) >= fieldsOf(newTx) ? existing : newTx;
  const supplement = base === existing ? newTx : existing;

  // Build merged record: start from base, fill gaps from supplement
  const merged = { ...base };
  for (const key of Object.keys(supplement)) {
    if (
      (merged[key] === null || merged[key] === undefined || merged[key] === '') &&
      supplement[key] !== null &&
      supplement[key] !== undefined &&
      supplement[key] !== ''
    ) {
      merged[key] = supplement[key];
    }
  }

  // Always keep the existing record's id
  merged.id = existing.id;

  // Combine sources
  const existingSources = Array.isArray(existing.sources) ? existing.sources : (existing.source ? [existing.source] : ['unknown']);
  const newSources = Array.isArray(newTx.sources) ? newTx.sources : (newTx.source ? [newTx.source] : ['unknown']);
  merged.sources = [...new Set([...existingSources, ...newSources])];

  if (confidence > 0.9) {
    merged.sourceLabel = merged.sources.join(' + ');
    return { merged, action: 'auto-merge' };
  }

  // 0.7 - 0.9: merge with badge
  merged.sourceLabel = merged.sources.map((s) => s.toUpperCase()).join(' + ');
  return { merged, action: 'merge-with-badge' };
}
