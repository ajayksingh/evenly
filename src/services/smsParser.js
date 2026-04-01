/**
 * SMS Transaction Parser Service
 * Parses Indian bank SMS messages and extracts structured transaction data.
 * Supports HDFC, ICICI, SBI, Axis, Kotak, BOB and UPI formats.
 */

/**
 * Whitelist of known Indian bank SMS sender IDs.
 * Banks use alphanumeric sender IDs (e.g., AD-HDFCBK, VM-ICICIB).
 * We match the suffix after the prefix (AD-, VM-, BZ-, etc.).
 */
export const BANK_SENDERS = [
  // HDFC
  'HDFCBK', 'HDFCBN', 'HDFCCC',
  // ICICI
  'ICICIB', 'ICICIC', 'ICICIS',
  // SBI
  'SBIBNK', 'SBIPSG', 'SBIINB', 'SBICRD',
  // Axis
  'AXISBK', 'AXISCR', 'AXISBN',
  // Kotak
  'KOTAKB', 'KOTKBK', 'KOTAKC',
  // Bank of Baroda
  'BOBBKN', 'BABORC', 'BOBSMS',
  // PNB
  'PNBSMS', 'PUNJNB',
  // Yes Bank
  'YESBKL', 'YESBK',
  // IndusInd
  'INDBNK', 'INDUBN',
  // IDFC
  'IDFCFB',
  // Federal Bank
  'FEDBNK',
  // Paytm Payments Bank
  'PYTMBK',
  // UPI apps
  'GPAY', 'PHONEPE', 'PAYTMB',
];

/**
 * Returns true if the sender string matches a known bank sender ID.
 * Sender IDs typically look like "AD-HDFCBK" or "VM-ICICIB".
 */
export function isBankSender(sender) {
  if (!sender || typeof sender !== 'string') return false;
  const normalized = sender.toUpperCase().trim();
  return BANK_SENDERS.some(
    (id) => normalized.includes(id)
  );
}

// ---- Amount extraction patterns ----

const AMOUNT_PATTERNS = [
  // Rs.1234.00 or Rs 1,234.00 or Rs.1234/- or INR 1234.00
  /(?:RS\.?|INR)\s?([\d,]+(?:\.\d{1,2})?)\/?-?/i,
  // Rupees 1234
  /(?:RUPEES)\s?([\d,]+(?:\.\d{1,2})?)/i,
];

// ---- Transaction type detection ----

const DEBIT_KEYWORDS = [
  'debited', 'debit', 'spent', 'withdrawn', 'purchased',
  'payment', 'paid', 'sent', 'transfer to', 'deducted',
];

const CREDIT_KEYWORDS = [
  'credited', 'credit', 'received', 'refund', 'deposited',
  'cashback', 'reversed', 'added', 'transfer from',
];

// ---- Card / Account extraction ----

const CARD_LAST4_PATTERNS = [
  // XX1234, **1234, ****1234, ending 1234, x1234
  /(?:XX|xx|\*{2,4}|ending\s|x{1,4})(\d{4})/i,
  // a/c no. XXXXXX1234 -> last 4
  /a\/c\s*(?:no\.?\s*)?[Xx]*(\d{4})/i,
  // Acct XX1234
  /acct?\s*[Xx]*(\d{4})/i,
  // A/c X1234
  /A\/c\s*X+(\d{4})/i,
];

// ---- UPI ID extraction ----

const UPI_PATTERNS = [
  // VPA: merchant@upi or VPA merchant@bank
  /VPA:?\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/i,
  // UPI/P2M/txnid/MERCHANT or UPI/P2P/txnid/name
  /UPI\/(?:P2[MP])\/\d+\/([A-Za-z0-9 ._-]+)/i,
  // UPI Ref No or similar followed by merchant
  /UPI[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/i,
];

// ---- Merchant extraction ----

const MERCHANT_PATTERNS = [
  // "to SWIGGY" or "to VPA merchant@upi"
  /\bto\s+(?:VPA\s+)?([A-Za-z0-9@._\s-]+?)(?:\s+(?:on|ref|upi|vpa|txn|w\.e\.f|avl|bal)|\.|$)/i,
  // "at NETFLIX"
  /\bat\s+([A-Za-z0-9@._\s-]+?)(?:\s+(?:on|ref|txn)|\.|$)/i,
  // "VPA: merchant@upi"
  /VPA:?\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/i,
  // "UPI/P2M/123456/SWIGGY"
  /UPI\/(?:P2[MP])\/\d+\/([A-Za-z0-9 ._-]+)/i,
  // "Info: MERCHANT" (common in some banks)
  /Info:\s*([A-Za-z0-9@._\s-]+?)(?:\.|$)/i,
];

// ---- Date extraction ----

const DATE_PATTERNS = [
  // 01-04-26 or 01-04-2026 or 01/04/26 or 01/04/2026
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  // 01-Apr-26 or 01-Apr-2026
  /(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})/,
];

const MONTH_MAP = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

// ---- OTP / promotional filter ----

const NON_TRANSACTION_PATTERNS = [
  /\bOTP\b/i,
  /\bone.time.password\b/i,
  /\bverification\s*code\b/i,
  /\blogin\b/i,
  /\bDO NOT SHARE\b/i,
  /\bpromotion\b/i,
  /\boffer\b/i,
  /\bEMI\s*available\b/i,
  /\bpre.?approved\b/i,
  /\bapply now\b/i,
  /\bwin\b/i,
  /\bcongratulations\b/i,
  /\blink\s*expires\b/i,
  /\bclick here\b/i,
  /\bupgrade\b/i,
  /\bactivate\b/i,
  /\bdear customer,?\s*(?:your|get|avail)/i,
];

/**
 * Parse the date string from an SMS into a Date object.
 * Returns null if parsing fails.
 */
function parseTransactionDate(text) {
  if (!text) return null;

  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    let day, month, year;

    if (pattern === DATE_PATTERNS[1]) {
      // dd-Mon-yy format
      day = parseInt(match[1], 10);
      const monthStr = match[2].toUpperCase();
      month = MONTH_MAP[monthStr];
      if (month === undefined) continue;
      year = parseInt(match[3], 10);
    } else {
      // dd/mm/yy format
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1; // 0-indexed
      year = parseInt(match[3], 10);
    }

    // Handle 2-digit years
    if (year < 100) {
      year += 2000;
    }

    // Validate
    if (day < 1 || day > 31 || month < 0 || month > 11) continue;

    try {
      const date = new Date(year, month, day);
      if (isNaN(date.getTime())) continue;
      return date;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Extract the transaction amount from SMS text.
 * Returns the numeric amount or null.
 */
function extractAmount(text) {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const amount = parseFloat(raw);
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
  }
  return null;
}

/**
 * Determine if the transaction is a debit or credit.
 */
function extractType(text) {
  const lower = text.toLowerCase();

  for (const keyword of CREDIT_KEYWORDS) {
    if (lower.includes(keyword)) return 'credit';
  }

  for (const keyword of DEBIT_KEYWORDS) {
    if (lower.includes(keyword)) return 'debit';
  }

  // Default: if we found an amount but no clear keyword, assume debit
  // (most bank alerts are for spending)
  return 'debit';
}

/**
 * Extract card last 4 digits from SMS text.
 */
function extractCardLast4(text) {
  for (const pattern of CARD_LAST4_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract UPI ID from SMS text.
 */
function extractUpiId(text) {
  for (const pattern of UPI_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Extract merchant name from SMS text.
 * Cleans up the result by trimming whitespace and removing trailing noise.
 */
function extractMerchant(text) {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let merchant = match[1].trim();
      // Remove trailing reference numbers or noise
      merchant = merchant.replace(/\s+\d+$/, '').trim();
      // Remove trailing dots or dashes
      merchant = merchant.replace(/[.\-]+$/, '').trim();
      if (merchant.length > 0 && merchant.length < 100) {
        return merchant;
      }
    }
  }
  return null;
}

/**
 * Check if the SMS is a non-transaction message (OTP, promo, etc.)
 */
function isNonTransactionSMS(text) {
  if (!text || typeof text !== 'string') return true;

  for (const pattern of NON_TRANSACTION_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  return false;
}

/**
 * Parse a bank SMS body and extract structured transaction data.
 *
 * @param {string} smsBody - The SMS message body
 * @param {string} sender - The SMS sender ID (e.g., "AD-HDFCBK")
 * @returns {Object|null} Parsed transaction or null if not a transaction SMS
 *   - amount: number
 *   - merchant: string|null
 *   - date: Date|null
 *   - type: 'debit'|'credit'
 *   - cardLast4: string|null
 *   - upiId: string|null
 *   - rawText: string
 */
export function parseSMS(smsBody, sender) {
  if (!smsBody || typeof smsBody !== 'string') return null;

  const text = smsBody.trim();

  // Filter out OTPs, promotional, non-transaction messages
  if (isNonTransactionSMS(text)) return null;

  // Must contain an amount to be a transaction
  const amount = extractAmount(text);
  if (amount === null) return null;

  // Must come from a recognized bank sender (if sender provided)
  if (sender && !isBankSender(sender)) return null;

  const type = extractType(text);
  const cardLast4 = extractCardLast4(text);
  const upiId = extractUpiId(text);
  const merchant = extractMerchant(text);
  const date = parseTransactionDate(text);

  return {
    amount,
    merchant,
    date,
    type,
    cardLast4,
    upiId,
    rawText: text,
  };
}

/**
 * Batch parse multiple SMS messages.
 *
 * @param {Array<{body: string, sender: string}>} messages
 * @returns {Array<Object>} Array of parsed transactions (nulls filtered out)
 */
export function parseMultipleSMS(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((msg) => {
      const result = parseSMS(msg.body, msg.sender);
      if (result) {
        return {
          ...result,
          smsDate: msg.date || null,
        };
      }
      return null;
    })
    .filter(Boolean);
}
