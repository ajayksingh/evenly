/**
 * Category Engine — auto-categorize expenses by merchant name.
 *
 * Uses fuzzy matching (lowercase, trim, includes) to map merchant names
 * to Evenly categories. Supports user-level overrides stored in AsyncStorage.
 *
 * Existing category IDs from constants/colors.js:
 *   food, housing, transport, entertainment, shopping, utilities, health, travel, general
 *
 * New category IDs added here:
 *   groceries, insurance, education
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const OVERRIDE_PREFIX = 'evenly_cat_override_';

/**
 * Full mapping of merchants to categories.
 * Each key is a lowercase merchant fragment used for fuzzy matching.
 *
 * @type {Record<string, { category: string, emoji: string }>}
 */
export const MERCHANT_CATEGORIES = {
  // ── Food ───────────────────────────────────────────────────────────
  swiggy:           { category: 'food', emoji: '🍔' },
  zomato:           { category: 'food', emoji: '🍔' },
  dominos:          { category: 'food', emoji: '🍕' },
  "domino's":       { category: 'food', emoji: '🍕' },
  mcdonalds:        { category: 'food', emoji: '🍔' },
  "mcdonald's":     { category: 'food', emoji: '🍔' },
  kfc:              { category: 'food', emoji: '🍗' },
  pizzahut:         { category: 'food', emoji: '🍕' },
  'pizza hut':      { category: 'food', emoji: '🍕' },
  starbucks:        { category: 'food', emoji: '☕' },
  subway:           { category: 'food', emoji: '🥪' },
  'burger king':    { category: 'food', emoji: '🍔' },
  haldirams:        { category: 'food', emoji: '🍔' },
  "haldiram's":     { category: 'food', emoji: '🍔' },
  'barbeque nation': { category: 'food', emoji: '🍖' },

  // ── Transport ──────────────────────────────────────────────────────
  uber:             { category: 'transport', emoji: '🚗' },
  ola:              { category: 'transport', emoji: '🚗' },
  rapido:           { category: 'transport', emoji: '🛵' },
  metro:            { category: 'transport', emoji: '🚇' },
  irctc:            { category: 'travel', emoji: '🚆' },
  redbus:           { category: 'travel', emoji: '🚌' },
  makemytrip:       { category: 'travel', emoji: '✈️' },
  goibibo:          { category: 'travel', emoji: '✈️' },
  cleartrip:        { category: 'travel', emoji: '✈️' },

  // ── Shopping ───────────────────────────────────────────────────────
  amazon:           { category: 'shopping', emoji: '🛍️' },
  flipkart:         { category: 'shopping', emoji: '🛍️' },
  myntra:           { category: 'shopping', emoji: '👗' },
  ajio:             { category: 'shopping', emoji: '👗' },
  meesho:           { category: 'shopping', emoji: '🛍️' },
  nykaa:            { category: 'shopping', emoji: '💄' },
  'tata cliq':      { category: 'shopping', emoji: '🛍️' },
  'reliance digital': { category: 'shopping', emoji: '📱' },
  croma:            { category: 'shopping', emoji: '📱' },

  // ── Entertainment ──────────────────────────────────────────────────
  netflix:          { category: 'entertainment', emoji: '🎬' },
  hotstar:          { category: 'entertainment', emoji: '🎬' },
  spotify:          { category: 'entertainment', emoji: '🎵' },
  'prime video':    { category: 'entertainment', emoji: '🎬' },
  bookmyshow:       { category: 'entertainment', emoji: '🎟️' },
  zee5:             { category: 'entertainment', emoji: '🎬' },
  sonyliv:          { category: 'entertainment', emoji: '🎬' },
  jiocinema:        { category: 'entertainment', emoji: '🎬' },

  // ── Groceries ──────────────────────────────────────────────────────
  bigbasket:        { category: 'groceries', emoji: '🥦' },
  blinkit:          { category: 'groceries', emoji: '🥦' },
  zepto:            { category: 'groceries', emoji: '🥦' },
  dunzo:            { category: 'groceries', emoji: '🥦' },
  jiomart:          { category: 'groceries', emoji: '🛒' },
  dmart:            { category: 'groceries', emoji: '🛒' },
  'reliance fresh': { category: 'groceries', emoji: '🥦' },
  "nature's basket": { category: 'groceries', emoji: '🥦' },

  // ── Utilities ──────────────────────────────────────────────────────
  vodafone:         { category: 'utilities', emoji: '📱' },
  airtel:           { category: 'utilities', emoji: '📱' },
  jio:              { category: 'utilities', emoji: '📱' },
  tatasky:          { category: 'utilities', emoji: '📺' },
  'tata sky':       { category: 'utilities', emoji: '📺' },
  electricity:      { category: 'utilities', emoji: '💡' },
  gas:              { category: 'utilities', emoji: '🔥' },
  water:            { category: 'utilities', emoji: '💧' },
  broadband:        { category: 'utilities', emoji: '🌐' },
  wifi:             { category: 'utilities', emoji: '🌐' },

  // ── Health ─────────────────────────────────────────────────────────
  apollo:           { category: 'health', emoji: '💊' },
  pharmeasy:        { category: 'health', emoji: '💊' },
  practo:           { category: 'health', emoji: '🩺' },
  '1mg':            { category: 'health', emoji: '💊' },
  medplus:          { category: 'health', emoji: '💊' },
  netmeds:          { category: 'health', emoji: '💊' },
  'tata 1mg':       { category: 'health', emoji: '💊' },

  // ── Insurance ──────────────────────────────────────────────────────
  'hdfc life':      { category: 'insurance', emoji: '🛡️' },
  lic:              { category: 'insurance', emoji: '🛡️' },
  'sbi life':       { category: 'insurance', emoji: '🛡️' },
  'icici pru':      { category: 'insurance', emoji: '🛡️' },
  'max life':       { category: 'insurance', emoji: '🛡️' },
  'star health':    { category: 'insurance', emoji: '🛡️' },

  // ── Housing ────────────────────────────────────────────────────────
  rent:             { category: 'housing', emoji: '🏠' },
  society:          { category: 'housing', emoji: '🏠' },
  maintenance:      { category: 'housing', emoji: '🏠' },
  'housing.com':    { category: 'housing', emoji: '🏠' },

  // ── Education ──────────────────────────────────────────────────────
  udemy:            { category: 'education', emoji: '📚' },
  coursera:         { category: 'education', emoji: '📚' },
  unacademy:        { category: 'education', emoji: '📚' },
  byjus:            { category: 'education', emoji: '📚' },
  "byju's":         { category: 'education', emoji: '📚' },
  vedantu:          { category: 'education', emoji: '📚' },

  // ── UPI / Wallet (map to general — these are payment methods, not merchants) ─
  paytm:            { category: 'general', emoji: '💳' },
  phonepe:          { category: 'general', emoji: '💳' },
  googlepay:        { category: 'general', emoji: '💳' },
  'google pay':     { category: 'general', emoji: '💳' },
  cred:             { category: 'general', emoji: '💳' },
  amazonpay:        { category: 'general', emoji: '💳' },
  'amazon pay':     { category: 'general', emoji: '💳' },
};

/** Default result when no merchant matches. */
const UNKNOWN_RESULT = Object.freeze({
  category: 'general',
  emoji: '📝',
  confidence: 0,
});

/**
 * Auto-categorize an expense based on merchant name.
 *
 * Matching strategy (in priority order):
 *   1. Exact key match after normalization
 *   2. Input *contains* a known merchant key
 *   3. A known merchant key *contains* the input (for short inputs like "ola")
 *
 * @param {string} merchantName - Raw merchant / description string.
 * @returns {{ category: string, emoji: string, confidence: number }}
 */
export function categorizeByMerchant(merchantName) {
  if (!merchantName || typeof merchantName !== 'string') {
    return { ...UNKNOWN_RESULT };
  }

  const normalized = merchantName.toLowerCase().trim();

  if (normalized.length === 0) {
    return { ...UNKNOWN_RESULT };
  }

  // 1. Exact match
  if (MERCHANT_CATEGORIES[normalized]) {
    const { category, emoji } = MERCHANT_CATEGORIES[normalized];
    return { category, emoji, confidence: 1 };
  }

  // 2. Input contains a merchant key (prefer longest key match for accuracy)
  let bestMatch = null;
  let bestKeyLength = 0;

  const keys = Object.keys(MERCHANT_CATEGORIES);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (normalized.includes(key) && key.length > bestKeyLength) {
      bestMatch = MERCHANT_CATEGORIES[key];
      bestKeyLength = key.length;
    }
  }

  if (bestMatch) {
    // Confidence based on how much of the input the key covers
    const coverage = bestKeyLength / normalized.length;
    const confidence = Math.min(0.95, 0.7 + coverage * 0.25);
    return { category: bestMatch.category, emoji: bestMatch.emoji, confidence };
  }

  // 3. A merchant key contains the normalized input (handles short merchant names)
  if (normalized.length >= 3) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key.includes(normalized) && key.length <= normalized.length + 5) {
        const { category, emoji } = MERCHANT_CATEGORIES[key];
        return { category, emoji, confidence: 0.6 };
      }
    }
  }

  return { ...UNKNOWN_RESULT };
}

/**
 * Retrieve a user-level category override for a merchant from AsyncStorage.
 *
 * @param {string} userId  - The current user's ID.
 * @param {string} merchant - Merchant name (will be normalized).
 * @returns {Promise<string|null>} The overridden category ID, or null.
 */
export async function getUserCategoryOverride(userId, merchant) {
  if (!userId || !merchant) return null;
  try {
    const key = `${OVERRIDE_PREFIX}${userId}_${merchant.toLowerCase().trim()}`;
    const value = await AsyncStorage.getItem(key);
    return value ?? null;
  } catch {
    return null;
  }
}

/**
 * Save a user-level category override for a merchant to AsyncStorage.
 *
 * @param {string} userId   - The current user's ID.
 * @param {string} merchant - Merchant name (will be normalized).
 * @param {string} category - The category ID to assign.
 * @returns {Promise<void>}
 */
export async function setUserCategoryOverride(userId, merchant, category) {
  if (!userId || !merchant || !category) return;
  const key = `${OVERRIDE_PREFIX}${userId}_${merchant.toLowerCase().trim()}`;
  await AsyncStorage.setItem(key, category);
}
