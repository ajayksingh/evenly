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
- [Monetisation](#-monetisation)
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
| **Friend requests** | Send/accept friend requests with real-time notifications — friends must approve before sharing expenses |
| **Cross-platform** | Native iOS, Android, and Progressive Web App from a single codebase |
| **Analytics** | Built-in event tracking with zero external services |
| **Deep linking** | `evenly://` URI scheme for native navigation |
| **Monetisation** | Google AdMob banner (HomeScreen) + interstitial (post-settlement) on Android |
| **Scroll-fade headers** | Headers fade from transparent to opaque as the user scrolls — all screens |
| **Entrance animations** | Fade-in + slide-up on screen focus (native only; disabled on web to prevent flicker) |

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
| `react-native-reanimated` | ^4.2.2 | 60fps entrance animations |
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

### Monetisation

| Package | Version | Purpose |
|---|---|---|
| `react-native-google-mobile-ads` | ^16.3.1 | AdMob banner + interstitial ads (Android) |

### Device APIs

| Package | Version | Purpose |
|---|---|---|
| `expo-contacts` | ^55.0.9 | Native address book access |
| `expo-image-picker` | ^55.0.13 | Avatar photo selection |
| `expo-linking` | ^55.0.8 | Deep link handling |
| `expo-web-browser` | ^55.0.10 | In-app browser |
| `expo-system-ui` | ~55.0.10 | System UI / dark mode support |
| `firebase` | ^12.11.0 | Analytics (configured) |

### Tooling

| Tool | Purpose |
|---|---|
| Maestro CLI | E2E test automation |
| Metro Bundler | JS bundling (web + native) |
| GitHub Pages | Web hosting |
| Gradle (local) | Android release APK builds |

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
| **Platform-aware animations** | Entrance animations run on native; skipped on web to prevent reanimated flicker |

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
  +-- Yes -> getGroups(userId, userEmail)  [fetch first for groupIds]
             Promise.all([
               getFriends(userId),
               calculateBalances(userId, userEmail, groupIds),
               getActivity(userId, groupIds),
               getGroupInvites(userId),
               getFriendRequests(userId),
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

Supabase PostgreSQL with 8 tables. All IDs are client-generated UUIDs enabling offline-safe record creation. JSONB columns store nested objects without additional tables.

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
  type         TEXT DEFAULT 'other',   -- 'home' | 'trip' | 'couple' | 'other'
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
  category     TEXT DEFAULT 'general',
  date         TIMESTAMPTZ DEFAULT now(),
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

-- Friend request approval flow
CREATE TABLE friend_requests (
  id           TEXT PRIMARY KEY,
  sender_id    TEXT NOT NULL,
  sender_name  TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  receiver_id  TEXT NOT NULL,
  status       TEXT DEFAULT 'pending',  -- 'pending' | 'accepted' | 'rejected'
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
| **`group_id` on settlements** | Group-scoped balance calculations; null = global/friend settlement |

---

## Navigation Structure

```
NavigationContainer (deep link scheme: evenly://)
  |
  +-- Auth Screen          -> Login / Register / Demo quick-access
  |
  +-- Main (Bottom Tabs)
       |
       +-- Home            -> Balance card, stats, activity feed + AdMob banner
       +-- Activity        -> Filterable transaction log
       +-- [+] FAB         -> AddExpense modal (4 split modes)
       +-- Groups          -> Group list + FAB to create
       +-- Friends         -> Balance grid, add by email

  Modal / Stack Screens:
  +-- GroupDetail          -> Expenses / Balances / Members tabs
  +-- AddExpense           -> Add expense to specific group
  +-- SettleUp             -> Record a payment (triggers AdMob interstitial on success)
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

### `src/services/storage.js` — Data CRUD Layer

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
| `recordSettlement(settlement)` | Record payment and create activity event |
| `calculateBalances(userId, email, groupIds)` | Compute net balances across all groups; rounds to 2dp |
| `calculateGroupBalances(groupId, members)` | Per-member balances within a single group; group-scoped settlements only |
| `getActivity(userId, groupIds)` | Fetch filtered, sorted activity feed |
| `sendFriendRequest(userId, email)` | Send a friend request (Supabase users); direct add for demo |
| `getFriendRequests(userId)` | Fetch pending incoming friend requests |
| `respondToFriendRequest(id, accept, userId)` | Accept or reject a friend request |

**Balance calculation fixes (v1.0.2):**
- All returned balance amounts rounded with `parseFloat(x.toFixed(2))` to eliminate float accumulation
- `calculateGroupBalances` narrowed to group-scoped settlements only (no null-group bleed)
- Empty members guard added to `calculateGroupBalances`

---

### `src/services/ads.js` — AdMob Integration

Google AdMob integration for Android. No-ops silently on web.

```javascript
// Initialise at app start (App.js)
initAds()

// Show interstitial after settlement success (SettleUpScreen.js)
showInterstitial()

// Banner rendered in HomeScreen JSX (native only)
<BannerAd unitId={AD_UNIT_IDS.banner} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
```

| Export | Description |
|---|---|
| `initAds()` | Initialize AdMob SDK once at app launch |
| `showInterstitial()` | Load and show interstitial; auto-shows when loaded |
| `AD_UNIT_IDS.banner` | Test ID in `__DEV__`, live `ca-app-pub-9004418283363709/7297137403` in production |
| `AD_UNIT_IDS.interstitial` | Test ID in `__DEV__`, live `ca-app-pub-9004418283363709/4684384107` in production |
| `BannerAd`, `BannerAdSize` | Re-exported from `react-native-google-mobile-ads` for use in screens |

---

### `src/hooks/useScrollHeader.js` — Scroll-Fade Header Hook

Returns animated values for the scroll-to-fade header effect used on all screens.

```javascript
const { onScroll, scrollEventThrottle, bgOpacity, borderOpacity } = useScrollHeader();

// In JSX:
<Animated.View style={[styles.header, {
  backgroundColor: bgOpacity.interpolate({...}),
  borderBottomColor: borderOpacity.interpolate({...}),
}]} />
<Animated.ScrollView onScroll={onScroll} scrollEventThrottle={scrollEventThrottle} />
```

| Return | Description |
|---|---|
| `onScroll` | `Animated.event` handler to attach to ScrollView |
| `scrollEventThrottle` | Fixed at `16` (60fps) |
| `bgOpacity` | Interpolated 0→1 value for header background opacity |
| `borderOpacity` | Interpolated 0→1 value for header border opacity |

---

### `src/services/syncService.js` — Offline Sync Queue

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

### `src/services/currency.js` — Multi-Currency Engine

| Function | Description |
|---|---|
| `detectDefaultCurrency()` | Read device locale, map to currency code |
| `fetchExchangeRates(base)` | Live rates from open.er-api.com (free, no key), 1-hour cache |
| `convertCurrency(amount, from, to)` | Convert via USD as intermediate |
| `getCurrencySymbol(code)` | Single canonical source for all symbol rendering |
| `formatAmount(amount, code)` | Locale-formatted: `1,234.56` |

Supported: **INR ₹ · USD $ · EUR € · GBP £ · AUD A$ · CAD C$ · SGD S$ · JPY ¥ · AED AED · MYR RM**

---

### `src/services/analytics.js` — Built-in Event Tracking

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

### `src/services/contacts.js` — Native Address Book

| Function | Description |
|---|---|
| `requestContactsPermission()` | Native permission prompt |
| `getContacts()` | Read device contacts (max 200), normalise data |
| `searchContacts(query)` | Filter by name, email, or phone |
| `sendWhatsAppMessage(phone, msg)` | Open WhatsApp; fallback to wa.me URL |
| `buildExpenseWhatsAppMessage(...)` | Pre-formatted expense notification |
| `buildSettlementWhatsAppMessage(...)` | Pre-formatted payment confirmation |

---

### `src/utils/splitCalculator.js` — Split Algorithms

```
EQUAL      -> amount / N  (remainder to first member)
EXACT      -> user-specified per-person amounts (validated: sum ~= total +/-0.01)
PERCENTAGE -> user-specified percentages (must total 100%)
SHARES     -> proportional units (2:1:1 splits 400 as 200/100/100)
```

Also provides:
- `getSimplifiedDebts(balances)` — minimum-transactions debt simplification (expects positive = creditor)
- `formatDate(dateString)` — relative timestamps (just now, 2h ago, Yesterday)
- `formatCurrency(amount, currency)` — always requires `currency` argument to avoid INR default
- `generateAvatarColor(name)` — deterministic hex colour from name

---

## State Management

Evenly uses **React Context** (`AppContext`) as its single source of truth. No Redux or Zustand needed at this scale.

### Context Shape

```javascript
{
  user:         { id, name, email, avatar, phone, createdAt },
  loading:      boolean,

  groups:         Group[],
  friends:        User[],
  balances:       { userId, name, amount }[],  // positive = owed to you
  totalBalance:   number,   // rounded to 2dp
  activity:       ActivityItem[],
  friendRequests: FriendRequest[],
  groupInvites:   GroupInvite[],

  isOnline:     boolean,
  syncStatus:   null | 'offline' | 'syncing' | 'synced' | 'error',

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
  +-- loadData()                  fetch groups first, then 5 parallel queries
  +-- NetInfo.addEventListener()  online -> trigger loadData
  +-- setInterval(30000)          polling fallback
  +-- supabase.channel()          Postgres Changes for live sync
                                  (groups, expenses, settlements, friends,
                                   activity, group_invites, friend_requests)

Unmount
  +-- clearInterval(pollRef)
  +-- supabase.removeAllChannels()
```

**`loadData` optimisation:** groups are fetched first so their IDs can be passed to `calculateBalances` and `getActivity`, avoiding two extra `getGroups` calls.

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

## Monetisation

### Android — Google AdMob

AdMob is integrated via `react-native-google-mobile-ads`. It is a no-op on web and in Expo Go — requires a native build.

| Placement | Type | Trigger |
|---|---|---|
| HomeScreen bottom | Anchored adaptive banner | Always visible while logged in |
| Post-settlement | Full-screen interstitial | Fires when user confirms a payment |

**Ad Unit IDs (production):**

| Unit | ID |
|---|---|
| Banner | `ca-app-pub-9004418283363709/7297137403` |
| Interstitial | `ca-app-pub-9004418283363709/4684384107` |

In `__DEV__` builds, Google's test IDs are substituted automatically — no real ad impressions during development.

**`app.json` plugin config:**
```json
["react-native-google-mobile-ads", {
  "androidAppId": "ca-app-pub-9004418283363709~4207939635",
  "iosAppId":     "ca-app-pub-9004418283363709~4207939635"
}]
```

---

## Testing

### E2E Test Suite — Maestro CLI

Automated flows covering all critical user journeys against the installed APK (`com.ajayksingh.evenly`).

```bash
# Run full suite
maestro --device emulator-5554 test maestro/flows/

# Run single flow
maestro test maestro/flows/02_user_a_create_group_and_add_expense.yaml
```

### Flow Coverage

| Flow | What it tests |
|---|---|
| `00_setup_user_b.yaml` | Register second test account for multi-user flows |
| `02_user_a_create_group_and_add_expense.yaml` | Group creation + expense addition |
| `03_add_member_and_second_expense.yaml` | Add member to group, add second expense |
| `04_settle_payment.yaml` | Record a settlement payment |
| `05_user_a_verify_settlement.yaml` | Verify settlement appears in activity and balances |

### Testing Patterns

- **State isolation**: Every flow uses `clearState: true` — independent of others
- **Self-contained**: Flows that need a group create one within the flow
- **Screenshot capture**: Key states saved to `~/.maestro/tests/`
- **Optional steps**: Keyboard dismiss and prompts use `optional: true`
- **Extended waits**: Network assertions use `extendedWaitUntil` (8-15s timeout)

---

## Build and Deployment

### Web — GitHub Pages

```bash
bash scripts/deploy-web.sh
```

This script builds and deploys in one step:

```
npx expo export --platform web --output-dir dist
  |
  v
touch dist/.nojekyll        <- exposes _expo/ dir (Jekyll ignores _ prefixes)
  |
  v
git init dist/
git push -f origin HEAD:gh-pages
  |
  v
https://ajayksingh.github.io/evenly/  (~1 min propagation)
```

### Android — Local Release APK

Builds a signed, production APK locally using Gradle. No EAS cloud build required.

```bash
# Apply plugin changes to native files (run after app.json plugin changes)
npx expo prebuild --platform android

# Build signed release APK
cd android && ./gradlew assembleRelease

# Output
android/app/build/outputs/apk/release/app-release.apk
```

Signing config is in `android/app/build.gradle` under `signingConfigs.release`, pointing to `@ajayksingh__evenly.jks` in the project root.

**Build time:** ~2–3 minutes on first build; ~45 seconds on subsequent builds (incremental).

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio + JDK 17 (for Android builds)
- Xcode 15+ (for iOS)
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
maestro --device emulator-5554 test maestro/flows/
```

---

## Project Structure

```
evenly/
|
+-- src/
|   +-- screens/                  # 11 UI screens
|   |   +-- AuthScreen.js         # Login, register, demo quick-access
|   |   +-- HomeScreen.js         # Balance dashboard, activity feed, AdMob banner
|   |   +-- ActivityScreen.js     # Filterable transaction log
|   |   +-- GroupsScreen.js       # Group list with FAB
|   |   +-- GroupDetailScreen.js  # Expenses / Balances / Members tabs
|   |   +-- CreateGroupScreen.js  # Group creation form
|   |   +-- AddExpenseScreen.js   # Expense form, 4 split modes
|   |   +-- SettleUpScreen.js     # Payment recording + AdMob interstitial
|   |   +-- FriendsScreen.js      # Friend list, balance grid
|   |   +-- ProfileScreen.js      # Account settings (in-flow header, no position:absolute)
|   |   +-- CurrencyScreen.js     # Multi-currency selector
|   |
|   +-- services/                 # Business logic
|   |   +-- storage.js            # Data CRUD (AsyncStorage + Supabase)
|   |   +-- supabase.js           # Supabase client + low-level API
|   |   +-- syncService.js        # Offline queue and flush logic
|   |   +-- analytics.js          # Event tracking
|   |   +-- currency.js           # Multi-currency with live rates
|   |   +-- contacts.js           # Native address book + WhatsApp
|   |   +-- ads.js                # Google AdMob (banner + interstitial)
|   |   +-- firebase.js           # Firebase config (analytics)
|   |
|   +-- hooks/
|   |   +-- useScrollHeader.js    # Scroll-to-fade header animation hook
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
|   |
|   +-- utils/
|       +-- splitCalculator.js    # 4 split algorithms + debt simplification
|       +-- haptics.js            # Haptic feedback wrappers
|       +-- alert.js              # Cross-platform alert helpers
|
+-- maestro/flows/                # E2E test suite (5 flows + helpers)
|   +-- helpers/
|       +-- do_login.yaml
|       +-- do_logout.yaml
|
+-- scripts/
|   +-- deploy-web.sh             # Web build + gh-pages deploy (one command)
|
+-- android/                      # Native Android project (bare workflow)
+-- app.json                      # Expo + EAS + AdMob configuration
+-- eas.json                      # EAS Build profiles
+-- metro.config.js               # Metro bundler config
+-- babel.config.js               # Babel config
+-- supabase_schema.sql           # Full PostgreSQL schema
+-- supabase_migration_003.sql    # Group invites flow
+-- supabase_migration_004.sql    # Friend requests + expense columns fix
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
| AdMob App ID | `ca-app-pub-9004418283363709~4207939635` |

### npm Scripts

| Script | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run in browser |

### Build Commands

| Command | Output |
|---|---|
| `bash scripts/deploy-web.sh` | Build web + deploy to GitHub Pages |
| `cd android && ./gradlew assembleRelease` | Signed release APK |
| `npx expo prebuild --platform android` | Regenerate native Android files from app.json |

---

## License

MIT (c) Ajay Singh — https://github.com/ajayksingh

---

Built with React Native · Expo · Supabase · Google AdMob

**Live Demo: https://ajayksingh.github.io/evenly/**
**GitHub: https://github.com/ajayksingh/evenly**
**Expo: https://expo.dev/@ajayksingh/evenly**
