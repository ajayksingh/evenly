# Evenly — Product Requirements Document (PRD)

**Version:** 1.0.3 | **Last Updated:** March 2026 | **Author:** Ajay Singh

---

## 1. Product Overview

Evenly is a cross-platform expense splitting and settlement app. Users create groups, add shared expenses, and settle debts — with real-time sync across devices, offline support, and WhatsApp integration.

**Platforms:** Android (Play Store), iOS (planned), Web (GitHub Pages)
**Backend:** Supabase (PostgreSQL) on free tier
**Monetization:** Google AdMob (banner + interstitial)

---

## 2. Target Users

| Persona | Use Case |
|---------|----------|
| **Roommates** | Split rent, groceries, utilities monthly |
| **Travel groups** | Track trip expenses across multiple currencies |
| **Couples** | Share household costs, dining |
| **Office colleagues** | Split lunch orders, team outings |
| **Students** | Share hostel/mess expenses with friends |

**Primary market:** India (INR default, WhatsApp-native sharing, UPI payment methods)
**Secondary:** Global (10 currencies supported)

---

## 3. Core Features

### 3.1 Expense Splitting
| Feature | Status | Flag |
|---------|--------|------|
| Equal split | Shipped | — |
| Exact amounts | Shipped | — |
| Percentage split | Shipped | — |
| Shares-based split | Shipped | — |
| Inline calculator (e.g. `500+200*3`) | Shipped | — |
| 9 expense categories with auto-detect | Shipped | — |
| Expense comments/notes | Shipped | — |
| Receipt image upload | Stub | `receipt_scanning` |
| Multiple payers | Stub (state exists, no UI) | — |
| Recurring expenses | Not started | `recurring_expenses` |

### 3.2 Groups
| Feature | Status |
|---------|--------|
| 4 group types (Home, Trip, Couple, Other) | Shipped |
| Group emoji + templates | Shipped |
| QR code invite link | Shipped |
| Pin/archive groups | Shipped |
| Group-level currency | Shipped |
| Add members from contacts (batch) | Shipped |
| Share group summary via WhatsApp | Shipped |

### 3.3 Settlements
| Feature | Status |
|---------|--------|
| Per-group debt simplification | Shipped |
| Cross-group debt simplification | Shipped |
| 1-tap settle from nudges | Shipped |
| Settle All (batch within group) | Shipped |
| 3 payment methods (UPI, Cash, Bank) | Shipped |
| WhatsApp payment confirmation | Shipped |
| UPI deep link payment | Not started (`upi_deep_link`) |

### 3.4 Social
| Feature | Status | Flag |
|---------|--------|------|
| Friend request approval flow | Shipped | `friend_requests_required` |
| Device contact sync + matching | Shipped | `contact_sync` |
| Smart suggestions (co-group frequency) | Shipped | — |
| WhatsApp sharing (expenses, invites) | Shipped | `whatsapp_sharing` |
| QR code group invites | Shipped | `qr_invites` |
| Deep link auto-join after signup | Shipped | — |

### 3.5 UX
| Feature | Status | Flag |
|---------|--------|------|
| Dark + Light theme | Shipped | `dark_mode` |
| Onboarding carousel (3 pages) | Shipped | `onboarding_flow` |
| Demo mode (no signup needed) | Shipped | `demo_mode` |
| Entrance animations (native) | Shipped | `entrance_animations` |
| Haptic feedback | Shipped | `haptic_feedback` |
| Themed in-app alerts (not system) | Shipped | — |
| Scroll-fade headers | Shipped | — |
| Skeleton loading states | Shipped | — |
| Spending analytics/charts | Not started | `spending_analytics` |

### 3.6 Infrastructure
| Feature | Status | Flag |
|---------|--------|------|
| Offline-first (AsyncStorage + sync) | Shipped | `offline_mode` |
| Real-time multi-device sync | Shipped | `realtime_sync` |
| Row-Level Security on all tables | Shipped | — |
| AdMob banner + interstitial | Shipped | `ads_enabled` |
| Feature flag system (local + remote) | Shipped | — |
| Keep-alive cron (prevent DB pause) | Shipped | — |

---

## 4. Non-Functional Requirements

| Requirement | Target | Actual |
|-------------|--------|--------|
| Lighthouse Performance | > 60 | 100 |
| Lighthouse Accessibility | > 80 | 100 |
| Web bundle size | < 3 MB | 2.42 MB |
| API calls per login | <= 6 | 8 |
| Cold start to home screen | < 5s | ~3s |
| Settlement algorithm correctness | 100% | 1000/1000 |
| Viewport overflow (320-430px) | Zero | Zero |
| Playwright test pass rate | 100% | 476/476 |

---

## 5. Data Model

### Tables (10 total, all RLS-protected)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User profiles | id, name, email, avatar, phone, provider |
| `groups` | Expense groups | id, name, type, emoji, members (JSONB), created_by |
| `expenses` | Expense records | id, group_id, amount, paid_by (JSONB), splits (JSONB), category |
| `settlements` | Payment records | id, paid_by, paid_to, amount, group_id |
| `friends` | Friend pairs | id, user_id, friend_id |
| `friend_requests` | Approval queue | id, sender_id, receiver_id, status |
| `group_invites` | Group join requests | id, group_id, invited_user_id, status |
| `pending_invites` | Email invites (not on app) | id, email, inviter_id |
| `activity` | Event feed | id, type, user_id, group_id, description, amount |
| `analytics` | Event tracking | id, event, user_id, params (JSONB) |

---

## 6. Supported Currencies

INR, USD, EUR, GBP, AUD, CAD, SGD, JPY, AED, MYR

Live exchange rates from open.er-api.com (1-hour cache).

---

## 7. Monetization

| Placement | Type | Trigger | Flag |
|-----------|------|---------|------|
| HomeScreen bottom | Banner ad | Always visible (Android native only) | `ads_enabled` |
| Post-settlement | Interstitial | After recording a payment | `interstitial_after_settle` |

Frequency controlled by `interstitial_frequency` flag (default: every time).

---

## 8. Roadmap (Feature Flags Ready)

| Feature | Flag | Priority |
|---------|------|----------|
| Receipt OCR scanning | `receipt_scanning` | High |
| Recurring expenses | `recurring_expenses` | High |
| Spending analytics/charts | `spending_analytics` | Medium |
| UPI deep link payments | `upi_deep_link` | Medium |
| Multiple payers UI | — | Low |
| iOS App Store submission | — | Medium |
