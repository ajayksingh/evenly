# Evenly — Expense Tracker Module (ETM)

## Auto-track expenses from emails and SMS. Reconcile credit card statements. Never miss a rupee.

---

## 1. Problem Statement

Today, Evenly tracks only **manually entered** shared expenses. Users have no visibility into their **personal spending** — credit card transactions, UPI payments, online orders — unless they type each one in.

Meanwhile, every transaction already generates a trail:
- **SMS alerts** from banks (debit/credit notifications)
- **Email receipts** from merchants (Amazon, Swiggy, Zomato, Uber, etc.)
- **Credit card statements** emailed monthly as PDF attachments

The data exists. It's just scattered across inboxes and message threads.

**This module connects those dots** — with user consent, reads transaction data from email and SMS, deduplicates, categorizes, and reconciles against credit card statements.

---

## 2. Module Overview

```
┌─────────────────────────────────────────────────────────┐
│                   EXPENSE TRACKER MODULE                 │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Gmail    │  │  SMS     │  │  Manual Entry        │  │
│  │  Reader   │  │  Reader  │  │  (existing Evenly)   │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       │              │                    │              │
│       └──────┬───────┘                    │              │
│              ▼                            │              │
│  ┌───────────────────┐                    │              │
│  │  Transaction       │                    │              │
│  │  Parser + NLP      │                    │              │
│  │  (amount, merchant,│                    │              │
│  │   date, category)  │                    │              │
│  └─────────┬─────────┘                    │              │
│            ▼                              │              │
│  ┌───────────────────┐                    │              │
│  │  Deduplication     │                    │              │
│  │  Engine            │◄───────────────────┘              │
│  │  (SMS ∩ Email      │                                   │
│  │   → single entry)  │                                   │
│  └─────────┬─────────┘                                   │
│            ▼                                             │
│  ┌───────────────────┐    ┌─────────────────────────┐   │
│  │  Unified Expense   │───▶│  Statement Reconciler   │   │
│  │  Ledger            │    │  (tracked vs statement   │   │
│  │                    │    │   → matched/unmatched)   │   │
│  └───────────────────┘    └─────────────────────────┘   │
│            ▼                           ▼                 │
│  ┌───────────────────┐    ┌─────────────────────────┐   │
│  │  Category          │    │  Reconciliation          │   │
│  │  Dashboard         │    │  Report                  │   │
│  └───────────────────┘    └─────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. User Stories

### Epic 1: Email Integration (Gmail)

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| E1.1 | As a user, I want to connect my Gmail account so Evenly can read my transaction emails | OAuth consent screen, read-only scope, revoke anytime | P0 |
| E1.2 | As a user, I want Evenly to auto-detect transaction emails from banks and merchants | Parse sender (HDFC, ICICI, SBI, Axis, Amazon, Swiggy, Uber, Zomato, Flipkart), extract amount + date + merchant | P0 |
| E1.3 | As a user, I want Evenly to extract credit card statement PDFs from email attachments | Detect PDF attachments from bank senders, parse statement into line items | P1 |
| E1.4 | As a user, I want to see all email-sourced expenses in a unified list | Show source badge (email icon), merchant name, amount, date, category | P0 |
| E1.5 | As a user, I want to disconnect Gmail at any time and delete all imported data | One-tap revoke in Settings, deletes all email-sourced transactions | P0 |
| E1.6 | As a user, I want Evenly to only read transaction-related emails, not personal ones | Filter by known bank/merchant senders only, never read body of non-transaction emails | P0 |
| E1.7 | As a user, I want to support multiple email accounts | Add Gmail, Outlook, Yahoo — each with independent consent | P2 |

### Epic 2: SMS Integration

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| S2.1 | As a user, I want to grant SMS read permission so Evenly can detect bank transaction alerts | Android permission prompt, opt-in only | P0 |
| S2.2 | As a user, I want Evenly to parse bank SMS messages and extract transaction details | Parse: amount, account (last 4 digits), merchant/UPI ID, date, debit/credit | P0 |
| S2.3 | As a user, I want SMS parsing to work offline | Parse from local SMS inbox, no network needed | P1 |
| S2.4 | As a user, I want to see SMS-sourced expenses with a clear source badge | SMS icon badge, distinguish from email and manual entries | P0 |
| S2.5 | As a user, I want to revoke SMS permission and delete all SMS-sourced data | One-tap in Settings | P0 |
| S2.6 | As a user, I want Evenly to ignore OTPs, promotional SMS, and non-transaction messages | Whitelist known bank sender IDs (e.g., VM-HDFCBK, AD-ICICIB, JD-SBIINB) | P0 |

### Epic 3: Deduplication Engine

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| D3.1 | As a user, I don't want duplicate entries when the same transaction appears in both SMS and email | Match by: amount ± ₹1 + date ± 1 day + merchant similarity | P0 |
| D3.2 | As a user, I want to see which source(s) each expense came from | Badge: "SMS", "Email", "SMS + Email", "Manual" | P1 |
| D3.3 | As a user, I want to manually merge two entries if dedup missed them | Long-press → "Merge with..." → select other entry | P2 |
| D3.4 | As a user, I want to manually split an entry if dedup incorrectly merged them | Undo merge action | P2 |

### Epic 4: Auto-Categorization

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| C4.1 | As a user, I want expenses auto-categorized based on merchant name | Swiggy/Zomato → Food, Uber/Ola → Transport, Amazon/Flipkart → Shopping, Netflix → Entertainment, etc. | P0 |
| C4.2 | As a user, I want to override a category assignment | Tap category chip → picker → save. Future transactions from same merchant use new category. | P0 |
| C4.3 | As a user, I want to create custom categories beyond the default 9 | Add custom category with emoji + color | P2 |
| C4.4 | As a user, I want to see spending breakdown by category (pie chart + bar chart) | Monthly view, category totals, percentage breakdown | P1 |
| C4.5 | As a user, I want the system to learn from my overrides | If I always recategorize "BigBasket" from Shopping → Groceries, future ones should auto-categorize correctly | P2 |

### Epic 5: Credit Card Statement Reconciliation

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| R5.1 | As a user, I want to import my credit card statement PDF from email | Auto-detect bank statement PDFs, parse line items (date, description, amount) | P0 |
| R5.2 | As a user, I want to upload a statement PDF manually | Pick from files or camera scan | P1 |
| R5.3 | As a user, I want to see tracked expenses matched against statement line items | Side-by-side: tracked total vs statement total, matched/unmatched items | P0 |
| R5.4 | As a user, I want to see unmatched items highlighted | Statement items with no matching tracked expense shown in red | P0 |
| R5.5 | As a user, I want to manually match an unmatched statement item to a tracked expense | Tap unmatched → select from tracked list → confirm | P1 |
| R5.6 | As a user, I want a reconciliation summary: "You tracked ₹X, statement says ₹Y, difference is ₹Z" | Green if matched within ₹10, amber if ₹10-100 diff, red if >₹100 diff | P0 |
| R5.7 | As a user, I want to see which expenses are missing from my tracking | "These 5 statement items were not tracked — add them?" with one-tap import | P1 |

### Epic 6: Dashboard & Insights

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| I6.1 | As a user, I want a monthly spending summary across all sources | Total spent, by category, by payment method (UPI, credit card, debit card, cash) | P0 |
| I6.2 | As a user, I want to see spending trends (month over month) | Line chart: last 6 months | P2 |
| I6.3 | As a user, I want budget alerts per category | Set ₹5000/month for Food → alert when approaching limit | P2 |
| I6.4 | As a user, I want to export my expense data as CSV | Download all tracked expenses with category, source, date, amount | P1 |

---

## 4. Roadmap

### Phase 1: SMS Parsing (2-3 weeks)
**Goal:** Auto-detect bank transaction SMS, extract expenses, categorize.

| Week | Deliverable |
|------|-------------|
| 1 | SMS permission flow + read inbox + bank sender whitelist |
| 1 | Transaction parser (regex for HDFC, ICICI, SBI, Axis, Kotak, BOB formats) |
| 2 | Auto-categorization (merchant → category mapping, 50+ merchants) |
| 2 | Expense list screen with source badges + category chips |
| 3 | Settings: connect/disconnect SMS, delete data, category overrides |
| 3 | Feature flag: `sms_expense_tracking` (OFF by default) |

**Why SMS first:** No OAuth needed (just Android permission), works offline, covers 80% of Indian bank transactions.

### Phase 2: Gmail Integration (2-3 weeks)
**Goal:** Read transaction emails, extract receipts, detect credit card statements.

| Week | Deliverable |
|------|-------------|
| 4 | Gmail OAuth consent flow (read-only scope: `gmail.readonly`) |
| 4 | Email sender whitelist + transaction email detection |
| 5 | Email body parser (amount, merchant, date from HTML/text) |
| 5 | PDF attachment detector (credit card statements) |
| 6 | Deduplication engine (SMS ∩ Email merge) |
| 6 | Feature flag: `email_expense_tracking` (OFF by default) |

### Phase 3: Statement Reconciliation (2 weeks)
**Goal:** Parse credit card statement PDFs, match against tracked expenses.

| Week | Deliverable |
|------|-------------|
| 7 | PDF parser for HDFC, ICICI, SBI, Axis credit card statements |
| 7 | Statement line item extraction (date, description, amount) |
| 8 | Reconciliation engine (match tracked ↔ statement items) |
| 8 | Reconciliation report screen (matched/unmatched/total diff) |

### Phase 4: Dashboard & Insights (1-2 weeks)
**Goal:** Category breakdown, spending trends, CSV export.

| Week | Deliverable |
|------|-------------|
| 9 | Category breakdown screen (pie chart + list) |
| 9 | Monthly spending summary |
| 10 | CSV export + spending trends (if time) |

---

## 5. Technical Design

### 5.1 SMS Reader (Android Only)

```
Permission: android.permission.READ_SMS
API: expo-sms or react-native-get-sms-android
Flow: Read inbox → filter by sender whitelist → parse → store
```

**Bank SMS sender whitelist (India):**
```
HDFCBK, ICICIB, SBIINB, AXISBK, KOTAKB, BOBNEW, PNBSMS,
IABORB, UNIONB, CANBNK, YESBNK, INDBNK, FEDBKN, RBLBNK
```

**SMS parse regex example (HDFC):**
```
/(?:debited|credited).*?(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i
/(?:at|to|from)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+Ref)/i
```

### 5.2 Gmail Reader

```
Auth: Google OAuth 2.0 (scope: gmail.readonly)
API: Gmail REST API via fetch (no extra package needed)
Flow: Auth → list messages (query: "from:alerts@hdfcbank.net OR from:noreply@axisbank.com ...")
    → get message → parse body → extract transaction → store
```

**No new dependency needed** — Supabase auth already has Google OAuth. Extend the scope to include `gmail.readonly`.

### 5.3 Deduplication Logic

```
For each new transaction (from SMS or email):
  1. Find candidates: same amount (±₹1) within ±1 day
  2. Score merchant similarity (fuzzy match on name)
  3. If score > 0.8 → merge (keep richer record, add source badge)
  4. If score 0.5-0.8 → flag for user review
  5. If score < 0.5 → treat as separate transactions
```

### 5.4 Statement PDF Parser

```
Library: pdf-parse (npm, works in RN via polyfill) or server-side via Supabase Edge Function
Flow: Detect PDF attachment → download → extract text → parse table rows → line items
```

**Statement formats vary by bank.** Start with HDFC and ICICI (largest market share), add others incrementally.

### 5.5 Data Model (New Tables)

```sql
-- Personal expenses (from SMS, email, manual — NOT shared group expenses)
CREATE TABLE personal_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  merchant TEXT,
  category TEXT DEFAULT 'general',
  date TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,          -- 'sms' | 'email' | 'manual' | 'statement'
  source_ref TEXT,               -- SMS id or email message id (for dedup)
  card_last4 TEXT,               -- Last 4 digits of card (for reconciliation)
  is_credit BOOLEAN DEFAULT false, -- true = money received, false = money spent
  raw_text TEXT,                 -- Original SMS/email text (for debugging)
  matched_statement_id TEXT,     -- FK to statement_items (if reconciled)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credit card statement imports
CREATE TABLE cc_statements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bank TEXT NOT NULL,             -- 'HDFC' | 'ICICI' | 'SBI' | etc.
  card_last4 TEXT,
  statement_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL,
  source TEXT NOT NULL,           -- 'email_pdf' | 'manual_upload'
  source_ref TEXT,                -- Email message id
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual line items from credit card statements
CREATE TABLE statement_items (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL,     -- FK to cc_statements
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  matched_expense_id TEXT,        -- FK to personal_expenses (if reconciled)
  status TEXT DEFAULT 'unmatched' -- 'matched' | 'unmatched' | 'ignored'
);

-- User's category overrides (learning system)
CREATE TABLE category_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  merchant_pattern TEXT NOT NULL,  -- e.g. 'swiggy' | 'bigbasket'
  category TEXT NOT NULL,          -- user's preferred category
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Connected accounts (consent tracking)
CREATE TABLE connected_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'gmail' | 'sms' | 'outlook'
  email TEXT,                      -- For email accounts
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active'     -- 'active' | 'revoked'
);
```

### 5.6 Feature Flags

```js
// Add to src/services/flags.js DEFAULTS:
sms_expense_tracking: false,      // Phase 1
email_expense_tracking: false,    // Phase 2
statement_reconciliation: false,  // Phase 3
spending_dashboard: false,        // Phase 4
```

### 5.7 Privacy & Consent

| Requirement | Implementation |
|-------------|----------------|
| SMS permission opt-in | Android runtime permission, never auto-granted |
| Gmail OAuth scope | `gmail.readonly` — read only, no send/delete |
| Data deletion | One-tap disconnect → deletes all imported data |
| Raw text storage | Store raw SMS/email text for debugging but encrypt at rest |
| No server-side email reading | All parsing happens on-device (no backend reads your email) |
| Play Store Data Safety | Declare SMS and email access with purpose |
| Consent audit trail | `connected_accounts` table logs when connected/revoked |

---

## 6. Merchant → Category Mapping (Starter Set)

| Merchant Pattern | Category | Emoji |
|-----------------|----------|-------|
| swiggy, zomato, dominos, mcdonalds, kfc, pizzahut | Food | 🍕 |
| uber, ola, rapido, metro, irctc, redbus, makemytrip | Transport | 🚕 |
| amazon, flipkart, myntra, ajio, meesho, nykaa | Shopping | 🛍️ |
| netflix, hotstar, spotify, prime video, bookmyshow | Entertainment | 🎬 |
| bigbasket, blinkit, zepto, dunzo, jiomart | Groceries | 🛒 |
| vodafone, airtel, jio, tatasky, electricity, gas, water | Utilities | 💡 |
| apollo, pharmeasy, practo, 1mg, medplus | Health | 🏥 |
| hdfc life, lic, sbi life, icici pru, max life | Insurance | 🛡️ |
| rent, society, maintenance, housing | Housing | 🏠 |
| paytm, phonepe, googlepay, cred | UPI/Wallet | 💳 |

**50+ merchants mapped at launch. User overrides feed the learning system.**

---

## 7. Screen Mockups (Text)

### 7.1 Expense Tracker Tab (New bottom tab or sub-tab in Home)

```
┌─────────────────────────────────┐
│  My Expenses         March 2026 │
│                                 │
│  ₹47,320 total    ▼ -12% vs Feb│
│                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐      │
│  │Food │ │Shop │ │Trans│ ...   │
│  │₹12K │ │₹9K  │ │₹6K │       │
│  │ 🍕  │ │ 🛍️  │ │ 🚕  │       │
│  └─────┘ └─────┘ └─────┘      │
│                                 │
│  Today                          │
│  📱 Swiggy          -₹385  Food│
│  📱 Uber            -₹210 Trans│
│  📧 Amazon          -₹1,299Shop│
│                                 │
│  Yesterday                      │
│  📱 HDFC CC Payment -₹15,000   │
│  📧 Zomato          -₹542  Food│
│  ✋ Manual: Groceries -₹800 Food│
│                                 │
│  📱 = SMS  📧 = Email  ✋ = Manual│
└─────────────────────────────────┘
```

### 7.2 Reconciliation Screen

```
┌─────────────────────────────────┐
│  ← CC Statement Reconciliation  │
│                                 │
│  HDFC Credit Card ****4532      │
│  Statement: March 2026          │
│                                 │
│  Tracked:    ₹23,450            │
│  Statement:  ₹24,100            │
│  Difference: ₹650    🔴         │
│                                 │
│  ── Matched (18 items) ──       │
│  ✅ Swiggy     Mar 2    ₹385   │
│  ✅ Amazon     Mar 3  ₹1,299   │
│  ✅ Uber       Mar 5    ₹210   │
│  ...                            │
│                                 │
│  ── Unmatched (2 items) ──      │
│  ❌ IRCTC      Mar 8    ₹450   │
│  ❌ Some Store  Mar 15   ₹200   │
│                                 │
│  [Add Missing to Tracked]       │
└─────────────────────────────────┘
```

### 7.3 Settings — Connected Accounts

```
┌─────────────────────────────────┐
│  ← Expense Sources              │
│                                 │
│  CONNECTED                      │
│  ┌─────────────────────────┐   │
│  │ 📱 SMS (Bank Alerts)     │   │
│  │ Active · 142 transactions│   │
│  │ Last sync: 2 min ago     │   │
│  │            [Disconnect]  │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ 📧 Gmail                 │   │
│  │ ajay@gmail.com           │   │
│  │ Active · 89 transactions │   │
│  │            [Disconnect]  │   │
│  └─────────────────────────┘   │
│                                 │
│  AVAILABLE                      │
│  ┌─────────────────────────┐   │
│  │ 📧 Outlook    [Connect]  │   │
│  │ 📧 Yahoo      [Connect]  │   │
│  └─────────────────────────┘   │
│                                 │
│  ⓘ Evenly reads transactions   │
│  only. We never read personal  │
│  emails or send messages.      │
└─────────────────────────────────┘
```

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SMS format varies across 20+ banks | Parser breaks | Start with top 6 banks (80% market), add regex per bank incrementally |
| Gmail OAuth review by Google | Blocks launch | Apply for verified app status early, use restricted scopes |
| PDF statement formats change | Parser breaks | Version parsers per bank, fallback to manual upload |
| User privacy concerns | Low adoption | On-device parsing only, clear consent UX, one-tap delete |
| Supabase free tier storage | 500 MB limit | Store only parsed data (not raw emails), compress, purge old raw_text |
| Play Store policy (SMS permission) | App rejection | Declare SMS use case clearly, comply with SMS policy requirements |
| Dedup false positives | Merged wrong transactions | Allow manual split/undo, show confidence score |

---

## 9. Success Metrics

| Metric | Target (3 months post-launch) |
|--------|-------------------------------|
| SMS connected users | 30% of active users |
| Gmail connected users | 15% of active users |
| Auto-categorization accuracy | > 85% |
| Dedup accuracy | > 95% (false merge < 5%) |
| Statement reconciliation match rate | > 90% |
| Monthly active users on tracker tab | > 40% of total MAU |

---

## 10. Dependencies on Existing Evenly

| What ETM needs | Where it exists today |
|----------------|----------------------|
| User auth (Google OAuth) | AppContext + Supabase Auth — extend scope for Gmail |
| Category system | `CATEGORIES` in `constants/colors.js` — extend with new categories |
| Theme system | ThemeContext — reuse for all new screens |
| Feature flags | `flags.js` — add 4 new flags |
| ThemedAlert | `ThemedAlert.js` — reuse for all popups |
| Navigation | `AppNavigator.js` — add new tab or stack screens |
| Supabase tables | New tables (5), new RLS policies, no changes to existing tables |

**Zero breaking changes to existing Evenly features.**
