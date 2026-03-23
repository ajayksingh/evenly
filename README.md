<div align="center">

# Evenly

**Split expenses fairly. Settle instantly. Stay friends.**

[![Web](https://img.shields.io/badge/Live%20Demo-ajayksingh.github.io%2Fevenly-00d4aa?style=for-the-badge&logo=github)](https://ajayksingh.github.io/evenly/)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-00d4aa?style=for-the-badge)](https://expo.dev/@ajayksingh/evenly)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2055-000020?style=for-the-badge&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.83.2-61dafb?style=for-the-badge&logo=react)](https://reactnative.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com)

<br/>

A production-grade, offline-first expense splitting and settlement app. Track shared costs with friends and groups, calculate fair splits four ways, and settle up with built-in WhatsApp sharing — all in real time across devices.

[**Try the live web demo →**](https://ajayksingh.github.io/evenly/)  
*Demo accounts: `alice@demo.com` / `demo123`*

</div>

---

## Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Data Flow](#-data-flow)
- [Database Schema](#-database-schema)
- [Navigation Structure](#-navigation-structure)
- [Services and Modules](#-services-and-modules)
- [State Management](#-state-management)
- [Observability and Analytics](#-observability-and-analytics)
- [Testing](#-testing)
- [Build and Deployment](#-build-and-deployment)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)

---

## Features

| Feature | Description |
|---|---|
| **Offline-first** | All writes persist locally — syncs to cloud when back online |
| **Real-time sync** | Multi-device updates via Supabase Postgres Changes |
| **4 split modes** | Equal, Exact, Percentage, and Shares-based splitting |
| **9 expense categories** | Food, Housing, Transport, Entertainment, Shopping, Utilities, Health, Travel, General |
| **Multi-currency** | 10 currencies with live exchange rates (INR, USD, EUR, GBP, AUD, CAD, SGD, JPY, AED, MYR) |
| **Group management** | 4 group types (Home, Trip, Couple, Other) with member management |
| **Debt simplification** | Minimum transactions algorithm to reduce settlement complexity |
| **WhatsApp sharing** | Pre-formatted messages for expense notifications and payment reminders |
| **Demo mode** | Instant onboarding — no sign-up needed with demo accounts |
| **Cross-platform** | Native iOS, Android, and Progressive Web App from a single codebase |
| **Analytics** | Built-in event tracking with zero external services |
| **Deep linking** | `evenly://` URI scheme for native navigation |

---

## Tech Stack

### Core

| Layer | Technology | Version |
|---|---|---|
| Framework | React Native (Expo bare workflow) | 0.83.2 |
| Runtime | Expo SDK | ~55.0.8 |
| Language | JavaScript (ES2024) | — |
| Web | React Native Web | ^0.21.0 |

### Navigation and UI

| Package | Version | Purpose |
|---|---|---|
| `@react-navigation/native` | ^7.1.33 | Navigation container |
| `@react-navigation/bottom-tabs` | ^7.15.5 | Tab bar |
| `@react-navigation/stack` | ^7.8.6 | Stack screens and modals |
| `react-native-reanimated` | ^4.2.2 | 60fps animations |
| `react-native-gesture-handler` | ^2.30.0 | Touch interactions |
| `expo-linear-gradient` | ^55.0.9 | Gradient UI elements |
| `expo-haptics` | ~55.0.9 | Tactile feedback |
| `@expo/vector-icons` | ^15.1.1 | Ionicons icon set |
| `react-native-paper` | ^5.15.0 | Material Design components |

### Backend and Data

| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | ^2.99.3 | PostgreSQL cloud backend |
| `@react-native-async-storage/async-storage` | ^2.2.0 | Local offline storage |
| `@react-native-community/netinfo` | 11.5.2 | Network state detection |
| `expo-secure-store` | ^55.0.9 | Secure credential storage |
| `uuid` | ^13.0.0 | Unique ID generation |

### Device APIs

| Package | Version | Purpose |
|---|---|---|
| `expo-contacts` | ^55.0.9 | Native address book access |
| `expo-image-picker` | ^55.0.13 | Avatar photo selection |
| `expo-linking` | ^55.0.8 | Deep link handling |
| `expo-web-browser` | ^55.0.10 | In-app browser |
| `firebase` | ^12.11.0 | Analytics (configured) |

### Tooling

| Tool | Purpose |
|---|---|
| Maestro CLI | E2E test automation |
| EAS Build | Cloud native builds |
| Metro Bundler | JS bundling (web + native) |
| GitHub Pages | Web hosting |

---

## Architecture

Evenly follows an **offline-first, cloud-synced** architecture. Every user action writes to local storage immediately and syncs to Supabase asynchronously, ensuring a fast and reliable experience regardless of network conditions.

```
+---------------------------------------------------------------+
|                    UI Layer (React Native)                    |
|  +--------+ +---------+ +--------+ +-------+ +---------+    |
|  |  Home  | |Activity | | Groups | |Friends| | Profile |    |
|  +---+----+ +----+----+ +---+----+ +--+----+ +----+----+    |
|      +------------+----------+--------+-----------+          |
|                              |                               |
|  +---------------------------v-----------------------------+  |
|  |            AppContext (React Context API)               |  |
|  |  user · groups · friends · balances · activity         |  |
|  |  isOnline · syncStatus · currency · loadData()         |  |
|  +---------------------------+-----------------------------+  |
+------------------------------|---------------------------------+
                               |
        +----------------------+---------------------+
        v                      v                     v
+---------------+  +------------------+  +--------------------+
| AsyncStorage  |  |  syncService.js  |  | Supabase (Cloud)   |
|               |  |                  |  |                    |
| Demo data     |<-| Offline Queue    |->| users              |
| Sessions      |  | - enqueueUpsert  |  | groups             |
| Currency      |  | - flushQueue     |  | expenses           |
| Rate cache    |  | - 5-retry logic  |  | settlements        |
| Sync queue    |  | - camelCase ->   |  | friends            |
|               |  |   snake_case     |  | activity           |
+---------------+  +------------------+  | analytics          |
                                         |                    |
                                         | Realtime Changes   |
                                         | (live multiuser)   |
                                         +--------------------+
```

### Design Principles

| Principle | Implementation |
|---|---|
| **Offline-first** | AsyncStorage writes are synchronous and immediate; Supabase sync is async |
| **Realtime multi-device** | Supabase Postgres Changes listener on groups, expenses, settlements, friends |
| **Polling fallback** | 30-second background interval when Realtime is unavailable |
| **Network awareness** | NetInfo (native) + `window.online/offline` (web) drive sync triggers |
| **Demo isolation** | Accounts with `demo-*` IDs never touch Supabase; fully local |
| **Eventual consistency** | Optimistic UI -> background sync -> reconciliation on next `loadData()` |
| **Denormalized reads** | Activity log written at event time to avoid expensive JOINs on read |

---

## Data Flow

### Write Path (Add Expense)

```
User taps Save
      |
      v
AddExpenseScreen validates form, calculates splits
      |
      v
storage.addExpense()
  +-- Demo user?  -> write to AsyncStorage only
  +-- Real user?  -> write to Supabase
                     enqueue to syncService (backup)
                     log to analytics
      |
      v
AppContext.notifyWrite('add_expense')
  +-- Offline? -> set syncStatus='offline', skip cloud
  +-- Online?  -> loadData() (4 parallel queries)
                 update groups, balances, activity
                 set syncStatus='synced' (clears after 1.5s)
      |
      v
UI re-renders instantly with new data
      |
      v  (background)
Supabase Realtime broadcasts change to other connected devices
```

### Read Path (App Launch)

```
App launches
      |
      v
AppContext.restore() -> getCurrentUser() from AsyncStorage
      |
      v
User found?
  +-- No  -> Show AuthScreen
  +-- Yes -> Promise.all([
               getGroups(userId, userEmail),
               getFriends(userId),
               calculateBalances(userId),
               getActivity(userId),
             ])
             |
             v
             Set state -> render MainTabs
```

### Offline Sync Queue

```
Action taken while offline -> queued to AsyncStorage
      |
      v  (network restored)
syncService.flushQueue()
  for each queued item:
    +-- op=upsert -> supabase.upsert(table, record)
    +-- op=delete -> supabase.delete(table, id)
    +-- success   -> remove from queue
    +-- failure   -> increment retries (abandon after 5)
      |
      v
Analytics.syncCompleted(count)
AppContext.loadData() reconciles state
```

---

## Database Schema

Supabase PostgreSQL with 7 tables. All IDs are client-generated UUIDs enabling offline-safe record creation. JSONB columns store nested objects without additional tables.

```sql
-- Auth-linked user profiles
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  avatar       TEXT,
  phone        TEXT DEFAULT '',
  provider     TEXT DEFAULT 'email',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Expense groups with denormalized membership
CREATE TABLE groups (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  created_by   TEXT,
  members      JSONB DEFAULT '[]',  -- [{ id, name, email, avatar, phone }]
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Expense ledger with flexible split storage
CREATE TABLE expenses (
  id           TEXT PRIMARY KEY,
  group_id     TEXT,
  description  TEXT NOT NULL,
  amount       NUMERIC NOT NULL,
  currency     TEXT DEFAULT 'INR',
  paid_by      JSONB NOT NULL,      -- { id, name }
  splits       JSONB DEFAULT '[]',  -- [{ userId, name, amount }]
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Settlement / payment records
CREATE TABLE settlements (
  id           TEXT PRIMARY KEY,
  paid_by      TEXT NOT NULL,
  paid_to      TEXT NOT NULL,
  amount       NUMERIC NOT NULL,
  currency     TEXT DEFAULT 'INR',
  group_id     TEXT,
  note         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Bidirectional friend relationships
CREATE TABLE friends (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  friend_id    TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Denormalized activity / event feed
CREATE TABLE activity (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,  -- 'expense_added' | 'settlement' | 'group_created'
  user_id      TEXT,
  group_id     TEXT,
  expense_id   TEXT,
  description  TEXT,
  amount       NUMERIC,
  group_name   TEXT,
  paid_by_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- First-party analytics (zero external services)
CREATE TABLE analytics (
  id           TEXT PRIMARY KEY,
  event        TEXT NOT NULL,
  user_id      TEXT,
  params       JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### Schema Design Rationale

| Decision | Reason |
|---|---|
| **Client-generated TEXT IDs** | Offline record creation with no server round-trip |
| **JSONB for members/splits/paid_by** | Flexible nested data without schema migrations |
| **Denormalized `activity` table** | Single-query feed — no JOINs across 4 tables at read time |
| **`analytics` in-database** | Zero-cost event tracking on existing free tier |
| **Currency on every amount** | Future multi-currency groups without a schema migration |

---

## Navigation Structure

```
NavigationContainer (deep link scheme: evenly://)
  |
  +-- Auth Screen          -> Login / Register / Demo quick-access
  |
  +-- Main (Bottom Tabs)
       |
       +-- Home            -> Balance card, stats, activity feed
       +-- Activity        -> Filterable transaction log
       +-- [+] FAB         -> AddExpense modal (4 split modes)
       +-- Groups          -> Group list + FAB to create
       +-- Friends         -> Balance grid, add by email

  Modal / Stack Screens:
  +-- GroupDetail          -> Expenses / Balances / Members tabs
  +-- AddExpense           -> Add expense to specific group
  +-- SettleUp             -> Record a payment
  +-- CreateGroup          -> Name, type, description
  +-- Profile              -> Account settings, currency selection
  +-- Currency             -> 10-currency picker with live rates

Deep Link Routes:
  evenly://home          evenly://groups        evenly://friends
  evenly://activity      evenly://profile       evenly://login
  evenly://group/:id     evenly://create-group
```

---

## Services and Modules

### `src/services/storage.js` — Data CRUD Layer (692 lines)

Primary interface between UI and data stores. Automatically routes to AsyncStorage (demo accounts) or Supabase (real accounts).

| Function | Description |
|---|---|
| `loginUser({ email, password })` | Authenticate and persist session |
| `registerUser({ name, email, password })` | Create account and seed initial data |
| `getCurrentUser()` | Restore session from AsyncStorage |
| `seedDemoData()` | Populate demo account with sample groups and expenses |
| `createGroup(group)` | Create group with member list |
| `addMemberToGroup(groupId, user)` | Append member to JSONB array |
| `addExpense(expense)` | Write expense and create activity event |
| `settleUp(settlement)` | Record payment and create activity event |
| `calculateBalances(userId)` | Compute net balances across all groups |
| `getActivity(userId)` | Fetch filtered, sorted activity feed |

---

### `src/services/syncService.js` — Offline Sync Queue (185 lines)

Manages a persistent queue of write operations for offline-to-online synchronisation.

```
Queue item:
{
  op:       'upsert' | 'delete',
  table:    'groups' | 'expenses' | 'settlements' | 'friends' | 'activity',
  record:   { ...snake_case fields },
  id:       string,
  queuedAt: ISO timestamp,
  retries:  number  // abandoned after 5
}
```

Field mapping (JS camelCase to Postgres snake_case):

| JS | Supabase |
|---|---|
| `groupId` | `group_id` |
| `paidBy` | `paid_by` |
| `paidTo` | `paid_to` |
| `createdBy` | `created_by` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

---

### `src/services/currency.js` — Multi-Currency Engine (118 lines)

| Function | Description |
|---|---|
| `detectDefaultCurrency()` | Read device locale, map to currency code |
| `fetchExchangeRates(base)` | Live rates from open.er-api.com (free, no key), 1-hour cache |
| `convertCurrency(amount, from, to)` | Convert via USD as intermediate |
| `getCurrencySymbol(code)` | Single canonical source for all symbol rendering |
| `formatAmount(amount, code)` | Locale-formatted: `1,234.56` |

Supported: **INR INR · USD $ · EUR EUR · GBP GBP · AUD A$ · CAD C$ · SGD S$ · JPY JPY · AED AED · MYR RM**

---

### `src/services/analytics.js` — Built-in Event Tracking (49 lines)

Zero external dependencies. Events stored in the `analytics` Supabase table. Non-blocking — errors silently suppressed.

```
Auth:     login · register · logout
Expenses: add_expense · delete_expense
Social:   settle_up · create_group · add_friend
Profile:  update_profile · change_currency
Sync:     sync_completed · offline_save · sync_error
UX:       screen_view · whatsapp_notify
```

---

### `src/services/contacts.js` — Native Address Book (97 lines)

| Function | Description |
|---|---|
| `requestContactsPermission()` | Native permission prompt |
| `getContacts()` | Read device contacts (max 200), normalise data |
| `searchContacts(query)` | Filter by name, email, or phone |
| `sendWhatsAppMessage(phone, msg)` | Open WhatsApp; fallback to wa.me URL |
| `buildExpenseWhatsAppMessage(...)` | Pre-formatted expense notification |
| `buildSettlementWhatsAppMessage(...)` | Pre-formatted payment confirmation |

---

### `src/utils/splitCalculator.js` — Split Algorithms (115 lines)

```
EQUAL      -> amount / N  (remainder to first member)
EXACT      -> user-specified per-person amounts (validated: sum ~= total +/-0.01)
PERCENTAGE -> user-specified percentages (must total 100%)
SHARES     -> proportional units (2:1:1 splits 400 as 200/100/100)
```

Also provides:
- `getSimplifiedDebts(balances)` — minimum-transactions debt simplification
- `formatDate(dateString)` — relative timestamps (just now, 2h ago, Yesterday)
- `generateAvatarColor(name)` — deterministic hex colour from name

---

## State Management

Evenly uses **React Context** (`AppContext`) as its single source of truth. No Redux or Zustand needed at this scale.

### Context Shape

```javascript
{
  user:         { id, name, email, avatar, phone, createdAt },
  loading:      boolean,

  groups:       Group[],
  friends:      User[],
  balances:     { userId, name, amount }[],  // positive = owed to you
  totalBalance: number,
  activity:     ActivityItem[],

  isOnline:     boolean,
  syncStatus:   null | 'offline' | 'syncing' | 'synced' | 'error',
  pendingCount: number,

  currency:     'INR' | 'USD' | 'EUR' | ...,

  login(email, password):           Promise<void>,
  register(name, email, password):  Promise<void>,
  logout():                         Promise<void>,
  resetPassword(email):             Promise<void>,
  loadData():                       Promise<void>,
  notifyWrite(action):              Promise<void>,
  triggerSync():                    Promise<void>,
  setCurrency(code):                void,
}
```

### Lifecycle

```
Mount
  +-- seedDemoData()              ensure demo accounts in AsyncStorage
  +-- loadSelectedCurrency()      restore currency preference
  +-- restore() getCurrentUser()  re-auth from AsyncStorage

  (user found)
  +-- loadData()                  fetch all data in parallel
  +-- NetInfo.addEventListener()  online -> trigger loadData
  +-- setInterval(30000)          polling fallback
  +-- supabase.channel()          Postgres Changes for live sync

Unmount
  +-- clearInterval(pollRef)
  +-- supabase.removeAllChannels()
```

---

## Observability and Analytics

### In-App Analytics

All events write to the `analytics` Supabase table. No external service, no API keys, no cost beyond the free tier.

```
analytics table:
  id          TEXT  (UUID)
  event       TEXT  (event name)
  user_id     TEXT  (nullable)
  params      JSONB (event metadata)
  created_at  TIMESTAMPTZ
```

### Event Catalogue

| Category | Events | Key Params |
|---|---|---|
| **Auth** | `login`, `register`, `logout` | `method: 'email'` |
| **Expenses** | `add_expense`, `delete_expense` | `amount`, `currency`, `group_id` |
| **Social** | `settle_up`, `create_group`, `add_friend` | `amount`, `member_count` |
| **Profile** | `update_profile`, `change_currency` | `currency_code` |
| **Sync** | `sync_completed`, `offline_save`, `sync_error` | `count`, `action`, `error` |
| **UX** | `screen_view`, `whatsapp_notify` | `screen`, `type` |

### Sync Health

The `SyncBanner` component surfaces real-time sync state:

| Status | Indicator | Trigger |
|---|---|---|
| `syncing` | Pulsing teal banner | Active Supabase write |
| `synced` | Green checkmark (auto-hides 1.5s) | Write completed |
| `offline` | Amber pill | NetInfo reports no connection |
| `error` | Red pill | Supabase operation failed |
| `null` | Hidden | Stable connected state |

### Error Strategy

- All async operations wrapped in try/catch
- User-visible errors via `Alert.alert()` (native) or `window.alert()` (web)
- Non-critical failures (analytics, sync) suppressed silently
- `__DEV__` mode: verbose console.log on all service calls

---

## Testing

### E2E Test Suite — Maestro CLI

23 automated flows covering all critical user journeys against the installed APK (`com.ajayksingh.evenly`).

```bash
# Run full suite
maestro --device emulator-5554 test .maestro/flows/

# Run single flow
maestro test .maestro/flows/01_auth_login.yaml
```

### Flow Coverage

| Flow | What it tests |
|---|---|
| `01_auth_login.yaml` | Email/password login and logout cycle |
| `02_auth_demo.yaml` | Demo account quick-access login |
| `03_home_dashboard.yaml` | Balance card, stats, and activity feed |
| `04_groups_list.yaml` | Groups tab navigation and list display |
| `05_create_group.yaml` | Group name input, type picker, creation |
| `06_add_expense.yaml` | Create group, add expense, verify in list |
| `07_activity_filter.yaml` | All/Expense/Settlement filter chips |
| `08_friends_add.yaml` | Search and add friend by email |
| `09_settle_up.yaml` | Navigate to settle, record payment |
| `10_profile.yaml` | Profile screen, user email, account settings |
| `11_group_detail_expense.yaml` | Expenses/Balances/Members tabs, add expense |
| `12_smoke_suite.yaml` | Full critical path: login to group to expense to settle |
| `13_friends_tab.yaml` | Friends tab balance display and interactions |
| `14_add_friend_to_group.yaml` | Member search and add to group |

### Testing Patterns

- **State isolation**: Every flow uses `clearState: true` — independent of others
- **Self-contained**: Flows that need a group create one within the flow
- **Screenshot capture**: Key states saved to `~/.maestro/tests/`
- **Optional steps**: Keyboard dismiss and prompts use `optional: true`
- **Extended waits**: Network assertions use `extendedWaitUntil` (8-15s timeout)

### Latest Results

```
  AUTH-01: Login and logout cycle           48s  PASS
  AUTH-02: Real account quick login         24s  PASS
  HOME-01: Dashboard renders                46s  PASS
  GROUPS-01: Groups tab                     32s  PASS
  GROUPS-02: Create a new group             46s  PASS
  EXPENSE-01: Add an expense              1m13s  PASS
  ACTIVITY-01: Activity filter chips        40s  PASS
  SETTLE-01: Settle up flow                 29s  PASS
  PROFILE-01: Profile screen                31s  PASS
  GROUPS-03: Group detail + expense       1m13s  PASS

  10 / 10 Passed
```

---

## Build and Deployment

### Web — GitHub Pages

```bash
npm run build:web   # Export + patch asset paths for /evenly/ subdirectory
npm run deploy      # Build and push to gh-pages branch
```

Pipeline:

```
expo export --platform web
  |
  v  postbuild:web (scripts/patch-web-assets.js)
  +-- Patch JS bundle: "/assets/" -> "/evenly/assets/"
  +-- Create .nojekyll (exposes _expo/ on GitHub Pages)
  +-- Make index.html script src relative
  |
  v  scripts/deploy-gh-pages.js
  +-- Copy public/404.html -> dist/ (SPA fallback routing)
  +-- git init in dist/
  +-- git checkout -b gh-pages
  +-- git push --force origin gh-pages
          |
          v
  https://ajayksingh.github.io/evenly/  (~1 min propagation)
```

### Android — Local Debug APK

```bash
# Bundle JS (no Metro server needed at runtime)
npx expo export --platform android --output-dir /tmp/expo-export
cp /tmp/expo-export/_expo/static/js/android/index-*.hbc \
   android/app/src/main/assets/index.android.bundle

# Build
cd android && ./gradlew assembleDebug

# Install
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Native — EAS Cloud Build

```bash
eas build --platform android --profile preview     # APK for testing
eas build --platform android --profile production  # Production APK
eas build --platform ios     --profile preview     # iOS IPA
```

EAS Project: `expo.dev/@ajayksingh/evenly` (ID: `ac20106b-0447-4a6f-8bcd-5d09f0a5b103`)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio (for Android) / Xcode 15+ (for iOS)
- Maestro CLI (for E2E tests): `brew install maestro`

### Quick Start

```bash
git clone https://github.com/ajayksingh/evenly.git
cd evenly
npm install
npx expo start

# Press i (iOS)  a (Android)  w (Web)

# Demo accounts — no Supabase needed
# alice@demo.com / demo123
# bob@demo.com   / demo123
```

### Connect to Your Own Supabase

```bash
# 1. Create project at supabase.com
# 2. Run supabase_schema.sql in SQL Editor
# 3. Update src/services/supabase.js:
export const SUPABASE_URL      = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-key';
# 4. Optional: disable email confirmation for dev
#    Dashboard -> Authentication -> Email -> Confirm email -> OFF
```

### Run E2E Tests

```bash
brew install maestro
maestro --device emulator-5554 test .maestro/flows/
```

---

## Project Structure

```
evenly/
|
+-- src/
|   +-- screens/                  # 11 UI screens (~3,600 LOC)
|   |   +-- AuthScreen.js         # Login, register, demo quick-access
|   |   +-- HomeScreen.js         # Balance dashboard, activity feed
|   |   +-- ActivityScreen.js     # Filterable transaction log
|   |   +-- GroupsScreen.js       # Group list with FAB
|   |   +-- GroupDetailScreen.js  # Expenses / Balances / Members tabs
|   |   +-- CreateGroupScreen.js  # Group creation form
|   |   +-- AddExpenseScreen.js   # Expense form, 4 split modes
|   |   +-- SettleUpScreen.js     # Payment recording
|   |   +-- FriendsScreen.js      # Friend list, balance grid
|   |   +-- ProfileScreen.js      # Account settings
|   |   +-- CurrencyScreen.js     # Multi-currency selector
|   |
|   +-- services/                 # Business logic (~1,300 LOC)
|   |   +-- storage.js            # Data CRUD (AsyncStorage + Supabase)
|   |   +-- supabase.js           # Supabase client + low-level API
|   |   +-- syncService.js        # Offline queue and flush logic
|   |   +-- analytics.js          # Event tracking
|   |   +-- currency.js           # Multi-currency with live rates
|   |   +-- contacts.js           # Native address book + WhatsApp
|   |   +-- firebase.js           # Firebase config (analytics)
|   |
|   +-- context/
|   |   +-- AppContext.js         # Global state, auth, network, sync
|   |
|   +-- navigation/
|   |   +-- AppNavigator.js       # Stack + Tab navigator, deep links
|   |
|   +-- components/               # Shared UI components
|   |   +-- Avatar.js             # User avatar with initials fallback
|   |   +-- BackgroundOrbs.js     # Animated gradient background
|   |   +-- BalanceSummary.js     # Balance summary card
|   |   +-- SyncBanner.js         # Network / sync status indicator
|   |
|   +-- constants/
|   |   +-- colors.js             # Color palette and gradients
|   |   +-- categories.js         # 9 expense categories
|   |   +-- groupTypes.js         # 4 group types
|   |
|   +-- utils/
|       +-- splitCalculator.js    # 4 split algorithms + debt simplification
|       +-- haptics.js            # Haptic feedback wrappers
|       +-- alert.js              # Cross-platform alert helpers
|
+-- .maestro/flows/               # Primary Maestro E2E suite (14 flows)
+-- maestro/flows/                # Extended E2E suite (9 flows + helpers)
|
+-- scripts/
|   +-- deploy-gh-pages.js        # GitHub Pages deployment
|   +-- patch-web-assets.js       # Post-build asset path patching
|
+-- public/
|   +-- 404.html                  # SPA deep-link fallback
|
+-- app.json                      # Expo + EAS configuration
+-- eas.json                      # EAS Build profiles
+-- metro.config.js               # Metro bundler config
+-- babel.config.js               # Babel config
+-- supabase_schema.sql           # Full PostgreSQL schema
+-- package.json                  # Dependencies and scripts
```

---

## Configuration

### App Identity

| Key | Value |
|---|---|
| App Name | Evenly |
| Bundle ID (iOS) | `com.ajayksingh.evenly` |
| Package (Android) | `com.ajayksingh.evenly` |
| Deep Link Scheme | `evenly://` |
| Expo Slug | `evenly` |
| EAS Project ID | `ac20106b-0447-4a6f-8bcd-5d09f0a5b103` |
| Web Base URL | `/evenly` |

### npm Scripts

| Script | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run in browser |
| `npm run build:web` | Export web bundle to `dist/` |
| `npm run deploy` | Build and deploy to GitHub Pages |

---

## License

MIT (c) Ajay Singh — https://github.com/ajayksingh

---

Built with React Native · Expo · Supabase

**Live Demo: https://ajayksingh.github.io/evenly/**
**GitHub: https://github.com/ajayksingh/evenly**
**Expo: https://expo.dev/@ajayksingh/evenly**
