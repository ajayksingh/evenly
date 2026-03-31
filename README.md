<div align="center">

# Evenly

**Split expenses fairly. Settle instantly. Stay friends.**

[![Web](https://img.shields.io/badge/Live%20Demo-ajayksingh.github.io%2Fevenly-00d4aa?style=for-the-badge&logo=github)](https://ajayksingh.github.io/evenly/)
[![Play Store](https://img.shields.io/badge/Google%20Play-Coming%20Soon-414141?style=for-the-badge&logo=googleplay)](https://play.google.com/store/apps/details?id=com.ajayksingh.evenly)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-00d4aa?style=for-the-badge)](https://expo.dev/@ajayksingh/evenly)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2055-000020?style=for-the-badge&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.83.2-61dafb?style=for-the-badge&logo=react)](https://reactnative.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Lighthouse](https://img.shields.io/badge/Lighthouse-100%2F100-0cce6b?style=for-the-badge&logo=lighthouse)](https://ajayksingh.github.io/evenly/)

<br/>

A production-grade, offline-first expense splitting and settlement app. Track shared costs with friends and groups, calculate fair splits four ways, and settle up with built-in WhatsApp sharing — all in real time across devices.

[**Try the live web demo →**](https://ajayksingh.github.io/evenly/)
*Demo accounts: `alice@demo.com` / `demo123`*

</div>

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Product Requirements (PRD)](docs/PRD.md) | Feature matrix, data model, monetization, roadmap |
| [Developer Onboarding](docs/DEV-ONBOARDING.md) | Local setup, navigation map, how to modify any screen/feature |
| [Command Reference](docs/COMMANDS.md) | Every build, deploy, debug, and maintenance command |
| [Test Documentation](docs/TESTING.md) | Playwright + Maestro + Jest guide with debugging |
| [CLAUDE.md](CLAUDE.md) | Compact project spec for AI-assisted development |

## Table of Contents

- [Features](#-features)
- [Performance](#-performance)
- [Security](#-security)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Data Flow](#-data-flow)
- [Database Schema](#-database-schema)
- [Navigation Structure](#-navigation-structure)
- [Services and Modules](#-services-and-modules)
- [State Management](#-state-management)
- [Monetisation](#-monetisation)
- [Testing](#-testing)
- [CI/CD](#-cicd)
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
| **1-tap settle** | Settle directly from activity nudges with pre-filled amount and recipient |
| **WhatsApp sharing** | Pre-formatted messages for expense notifications and payment reminders |
| **Demo mode** | Instant onboarding — no sign-up needed with demo accounts |
| **Friend requests** | Send/accept friend requests with real-time notifications |
| **Cross-platform** | Native iOS, Android, and Progressive Web App from a single codebase |
| **Deep linking** | `evenly://` URI scheme for native navigation + web invite links |
| **Monetisation** | Google AdMob banner (HomeScreen) + interstitial (post-settlement) on Android |
| **Scroll-fade headers** | Headers fade from transparent to opaque as the user scrolls — all screens |
| **Entrance animations** | Fade-in + slide-up on screen focus (native only; disabled on web) |
| **Unified Add People** | Single reusable modal with tabs: Search, Contacts, Friends, Suggested, Link |
| **Group QR code / invite link** | Generate QR code and shareable link — scan to auto-join |
| **Smart suggestions** | Ranked by co-group frequency — people you split with most appear first |
| **Batch operations** | Select multiple people across any tab and add/invite them all at once |
| **Contact sync** | Background matching of device contacts against registered users |
| **Expense calculator** | Inline math expressions in the amount field (e.g. `100+50*2`) |
| **Responsive layout** | All screens adapt to phone widths from 320dp to 430dp+ |

---

## Performance

Evenly is continuously optimized using an automated performance framework (autoperf).

| Metric | Score | Target |
|--------|-------|--------|
| **Lighthouse Performance** | 100/100 | > 60 |
| **Lighthouse Accessibility** | 100/100 | > 80 |
| **Web bundle size** | 2.41 MB | < 3 MB |
| **API calls per login** | 8 | ≤ 6 |
| **Settlement algorithm** | 1000/1000 correct | 100% |
| **Viewport overflow** | Zero at 320/375/430px | Zero |
| **Build time (web)** | ~7s | — |

### Optimization Highlights

- **Memoized context** — AppContext value wrapped in `useMemo` to prevent unnecessary re-renders across all 11 screens
- **Parallelized data loading** — Independent queries (`getFriends`, `getGroupInvites`, `getFriendRequests`) run alongside `getGroups` instead of waiting for it
- **Single-pass partitioning** — FriendsScreen categorizes friends in one pass instead of 7 separate filter iterations
- **Memoized aggregations** — GroupDetailScreen expense statistics computed once per data change, not every render
- **React.memo on BackgroundOrbs** — Prevents re-render of animated background on every parent state change
- **Code-split screens** — Non-tab screens lazy-loaded via `React.lazy()` for faster initial load

---

## Security

| Protection | Implementation |
|---|---|
| **Row-Level Security (RLS)** | Enabled on all 10 Supabase tables with per-table policies |
| **Auth-scoped data** | Users can only read/write their own data and groups they belong to |
| **Credentials in .env** | Supabase keys and AdMob IDs loaded from `EXPO_PUBLIC_*` env vars |
| **Safe math parser** | Expense calculator uses sanitized evaluation — no `eval()` or `Function()` |
| **Rate limiting** | Auth attempts limited to 20 per 60 seconds |
| **OAuth token cleanup** | URL hash fragments stripped after Supabase processes them (prevents reload loops) |
| **Production log gating** | OAuth debug logs gated behind `__DEV__` — no auth info leaks in production |
| **Demo isolation** | `demo-*` accounts are fully local — never touch Supabase |

### RLS Policy Summary

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| `users` | All authenticated | Own row only | Own row only | — |
| `groups` | Creator + members | Any authenticated | Creator + members | Creator only |
| `expenses` | Group members | Group members | — | Group members |
| `settlements` | Payer or receiver | Payer only | — | — |
| `friends` | Own relationships | Own user_id | — | Own relationships |
| `activity` | Own + group members | Any authenticated | — | — |
| `group_invites` | Sender or recipient | Sender only | Recipient only | — |
| `friend_requests` | Sender or receiver | Sender only | Receiver only | — |

---

## Tech Stack

### Core

| Layer | Technology | Version |
|---|---|---|
| Framework | React Native (Expo) | 0.83.2 |
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

### Backend and Data

| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | ^2.99.3 | PostgreSQL cloud backend |
| `@react-native-async-storage/async-storage` | ^2.2.0 | Local offline storage |
| `@react-native-community/netinfo` | 11.5.2 | Network state detection |

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
| `expo-notifications` | ~55.0.14 | Local push notifications |
| `expo-web-browser` | ^55.0.10 | In-app OAuth browser |
| `expo-auth-session` | ~55.0.10 | OAuth redirect handling |

### Testing

| Tool | Purpose |
|---|---|
| Playwright | Web E2E tests (15 spec files, ~565 test cases) |
| Maestro CLI | Android E2E tests (28+ flows) |
| Jest | Unit tests (split calculator, debt simplification) |
| Lighthouse CI | Performance and accessibility scoring |

---

## Architecture

Evenly follows an **offline-first, cloud-synced** architecture. Every user action writes to local storage immediately and syncs to Supabase asynchronously.

```
+---------------------------------------------------------------+
|                    UI Layer (React Native)                    |
|  +--------+ +---------+ +--------+ +-------+ +---------+    |
|  |  Home  | |Activity | | Groups | |Friends| | Profile |    |
|  +---+----+ +----+----+ +---+----+ +--+----+ +----+----+    |
|      +------------+----------+--------+-----------+          |
|                              |                               |
|  +---------------------------v-----------------------------+  |
|  |         AppContext (memoized React Context)             |  |
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
| Demo data     |<-| Offline Queue    |->| users (RLS)        |
| Sessions      |  | - enqueueUpsert  |  | groups (RLS)       |
| Currency      |  | - flushQueue     |  | expenses (RLS)     |
| Rate cache    |  | - 5-retry logic  |  | settlements (RLS)  |
|               |  | - camelCase ->   |  | friends (RLS)      |
|               |  |   snake_case     |  | activity (RLS)     |
+---------------+  +------------------+  | group_invites(RLS) |
                                         | friend_requests    |
                                         | pending_invites    |
                                         |                    |
                                         | Realtime Changes   |
                                         | (live multiuser)   |
                                         +--------------------+
```

### Design Principles

| Principle | Implementation |
|---|---|
| **Offline-first** | AsyncStorage writes are synchronous and immediate; Supabase sync is async |
| **Realtime multi-device** | Supabase Postgres Changes listener on 7 tables |
| **Polling fallback** | 30-second background interval when Realtime is unavailable |
| **Network awareness** | NetInfo (native) + `window.online/offline` (web) drive sync triggers |
| **Demo isolation** | Accounts with `demo-*` IDs never touch Supabase; fully local |
| **Eventual consistency** | Optimistic UI -> background sync -> reconciliation on next `loadData()` |
| **Denormalized reads** | Activity log written at event time to avoid expensive JOINs |
| **Platform-aware animations** | Entrance animations on native; skipped on web |
| **Memoized state** | Context value + expensive computations wrapped in `useMemo` |

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
  +-- Real user?  -> write to Supabase (RLS enforced)
                     enqueue to syncService (backup)
      |
      v
AppContext.notifyWrite('add_expense')
  +-- Offline? -> set syncStatus='offline', skip cloud
  +-- Online?  -> loadData() (parallel queries)
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
  +-- Yes -> Phase 1 (parallel):
             Promise.all([
               getGroups(userId, email),
               getFriends(userId),
               getGroupInvites(userId),
               getFriendRequests(userId),
             ])
             |
             v
             Phase 2 (needs groupIds):
             Promise.all([
               calculateBalances(userId, email, groupIds),
               getActivity(userId, groupIds),
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
AppContext.loadData() reconciles state
```

---

## Database Schema

Supabase PostgreSQL with 10 tables. All IDs are client-generated UUIDs enabling offline-safe record creation. JSONB columns store nested objects without additional tables. **Row-Level Security (RLS) is enabled on all tables.**

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
  type         TEXT DEFAULT 'other',
  description  TEXT DEFAULT '',
  emoji        TEXT DEFAULT '',
  currency     TEXT DEFAULT 'INR',
  created_by   TEXT,
  members      JSONB DEFAULT '[]',
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
  paid_by      JSONB NOT NULL,
  splits       JSONB DEFAULT '[]',
  category     TEXT DEFAULT 'general',
  notes        TEXT DEFAULT '',
  comments     JSONB DEFAULT '[]',
  receipt_url  TEXT,
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
  status       TEXT DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Bidirectional friend relationships
CREATE TABLE friends (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, friend_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

-- Group membership invitations
CREATE TABLE group_invites (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, group_name TEXT NOT NULL, invited_user_id TEXT NOT NULL, invited_by_user_id TEXT NOT NULL, invited_by_name TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now());

-- Pending email invites for non-registered users
CREATE TABLE pending_invites (id TEXT PRIMARY KEY, email TEXT NOT NULL, inviter_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

-- Denormalized activity / event feed
CREATE TABLE activity (id TEXT PRIMARY KEY, type TEXT NOT NULL, user_id TEXT, group_id TEXT, expense_id TEXT, description TEXT, amount NUMERIC, group_name TEXT, paid_by_name TEXT, category TEXT, paid_by_id TEXT, created_at TIMESTAMPTZ DEFAULT now());
```

### Schema Design Rationale

| Decision | Reason |
|---|---|
| **Client-generated TEXT IDs** | Offline record creation with no server round-trip |
| **JSONB for members/splits/paid_by** | Flexible nested data without schema migrations |
| **Denormalized `activity` table** | Single-query feed — no JOINs across 4 tables at read time |
| **Currency on every amount** | Future multi-currency groups without a schema migration |
| **`group_id` on settlements** | Group-scoped balance calculations; null = global/friend settlement |
| **RLS on all tables** | Anon key is safe to ship in client bundles |

---

## Navigation Structure

```
NavigationContainer (deep link scheme: evenly://)
  |
  +-- Onboarding Screen    -> 3-page carousel (first launch only)
  +-- Auth Screen           -> Google OAuth / Demo quick-access
  |
  +-- Main (Bottom Tabs)
       |
       +-- Home             -> Balance card, stats, activity feed + AdMob banner
       +-- Activity         -> Filterable timeline + smart nudges with 1-tap settle
       +-- [+] FAB          -> AddExpense modal (4 split modes)
       +-- Groups           -> Group list + FAB to create
       +-- Friends          -> Balance grid, unified add modal (search/contacts/QR)

  Modal / Stack Screens:
  +-- GroupDetail           -> Expenses / Balances / Members / Activity tabs
  +-- AddExpense            -> Add expense with inline calculator
  +-- SettleUp              -> Record a payment with confetti celebration
  +-- CreateGroup           -> Name, type, emoji, templates, member selection
  +-- Profile               -> Account settings, theme toggle, notifications
  +-- Currency              -> 10-currency picker with live rates
```

---

## Services and Modules

### `src/services/storage.js` — Data CRUD Layer

Primary interface between UI and data stores. Automatically routes to AsyncStorage (demo accounts) or Supabase (real accounts).

| Function | Description |
|---|---|
| `loginUser({ email, password })` | Authenticate demo accounts |
| `handleOAuthSession(session)` | Process Supabase OAuth callback, upsert user profile |
| `getCurrentUser()` | Restore session from AsyncStorage or Supabase auth |
| `createGroup(group)` | Create group with member list |
| `addExpense(expense)` | Write expense and create activity event |
| `recordSettlement(settlement)` | Record payment and create activity event |
| `calculateBalances(userId, email, groupIds)` | Compute net balances across all groups |
| `getActivity(userId, groupIds)` | Fetch activity with `.or()` filter (single query) |
| `sendFriendRequest(userId, email)` | Send friend request or direct add for demo |
| `respondToFriendRequest(id, accept, userId)` | Accept or reject a friend request |
| `searchUsers(query, userId)` | Search by name, email, or phone number |
| `getSuggestedMembersForGroup(userId, groupId)` | Smart suggestions ranked by co-group frequency |
| `matchContactsToUsers(contacts)` | Batch match device contacts against registered users |

### `src/services/supabase.js` — Supabase Client

Credentials loaded from environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

### `src/services/syncService.js` — Offline Sync Queue

Persistent queue of write operations. Automatically flushes when network is restored. Converts camelCase to snake_case. Retries up to 5 times.

### `src/services/currency.js` — Multi-Currency Engine

Live exchange rates from open.er-api.com (free, no key). 1-hour cache. Supports: **INR, USD, EUR, GBP, AUD, CAD, SGD, JPY, AED, MYR**.

### `src/services/analytics.js` — Event Tracking

Console logging in `__DEV__` mode only. No external services, no database writes (removed to conserve free-tier storage).

### `src/services/ads.js` — Google AdMob

Banner on HomeScreen + interstitial post-settlement. Test IDs in `__DEV__`, production IDs from `.env`. No-op on web.

---

## State Management

Evenly uses **memoized React Context** (`AppContext`) as its single source of truth. The context value is wrapped in `useMemo` to prevent unnecessary re-renders.

### Context Shape

```javascript
{
  user, loading,
  groups, friends, balances, activity,
  groupInvites, friendRequests, contactMatches,
  totalBalance,        // memoized, rounded to 2dp
  isOnline, syncStatus,
  currency, setCurrency,
  login, signInWithOAuth, logout,
  loadData, refresh, syncData,
  notifyWrite, triggerSync,
  respondToFriendRequest,
}
```

### Lifecycle

```
Mount
  +-- seedDemoData()              ensure demo accounts in AsyncStorage
  +-- loadSelectedCurrency()      restore currency preference
  +-- restore() getCurrentUser()  re-auth from AsyncStorage

  (user found)
  +-- loadData()
      Phase 1: getGroups + getFriends + getInvites + getRequests (parallel)
      Phase 2: calculateBalances + getActivity (parallel, needs groupIds)
  +-- NetInfo.addEventListener()  online -> trigger loadData
  +-- setInterval(30000)          polling fallback
  +-- supabase.channel()          Postgres Changes for live sync
                                  (7 tables, debounced 500ms)

Unmount
  +-- clearInterval(pollRef)
  +-- supabase.removeAllChannels()
```

---

## Monetisation

### Android — Google AdMob

| Placement | Type | Trigger |
|---|---|---|
| HomeScreen bottom | Anchored adaptive banner | Always visible while logged in |
| Post-settlement | Full-screen interstitial | Fires when user confirms a payment |

Ad Unit IDs loaded from `.env` (`EXPO_PUBLIC_ADMOB_BANNER_ID`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID`). In `__DEV__`, Google's test IDs are used automatically.

---

## Testing

### Web E2E — Playwright

15 spec files covering auth, home, groups, expenses, settlement, friends, profile, activity, currency, responsive layout, scroll behavior, and onboarding.

```bash
npm run test:web           # Run headless
npm run test:web:ui        # Interactive UI mode
npm run test:web:report    # View HTML report
```

### Android E2E — Maestro CLI

28+ flows covering all critical user journeys.

```bash
npm run test:android                    # Full suite
maestro test maestro/flows/02_*.yaml    # Single flow
```

### Unit Tests — Jest

Settlement algorithm correctness validated against 1000 random scenarios.

```bash
npx jest __tests__/mathLogic.test.js
```

### Performance — Autoperf

Automated quality gate runs before every deploy:

```bash
bash autoperf/benchmark.sh    # Build + Lighthouse + overflow + algorithm
bash autoperf/run.sh          # Full optimization cycle
```

---

## CI/CD

### GitHub Actions Workflows

| Workflow | Trigger | Checks |
|---|---|---|
| **Spec Guard** | Push to main, PRs | Web build integrity, Playwright E2E, Maestro YAML lint |
| **Keep Alive** | Every 5 days (cron) | Pings Supabase to prevent free-tier pause |

### Pre-Deploy Quality Gate

```
1. Settlement algorithm test (1000 scenarios) — blocks on failure
2. Web build (Expo export)
3. Lighthouse audit (performance + accessibility)
4. Viewport overflow detection (320px, 375px, 430px)
```

---

## Build and Deployment

### Web — GitHub Pages

```bash
npm run deploy              # Build + quality gate + deploy
```

Deploys to: **https://ajayksingh.github.io/evenly/**

### Android — EAS Build (Play Store AAB)

```bash
eas build --platform android --profile production    # AAB for Play Store
eas build --platform android --profile preview        # APK for testing
```

### Android — Local Release APK

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Android Studio + JDK 17 (for Android builds)
- Xcode 15+ (for iOS)

### Quick Start

```bash
git clone https://github.com/ajayksingh/evenly.git
cd evenly
cp .env.example .env        # Add your Supabase keys
npm install
npx expo start

# Press i (iOS)  a (Android)  w (Web)

# Demo accounts — no Supabase needed
# alice@demo.com / demo123
# bob@demo.com   / demo123
```

### Environment Variables

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-xxxx/xxxx
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-xxxx/xxxx
```

### Connect to Your Own Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Run `supabase_schema.sql` in SQL Editor
3. Run migrations `001` through `006` in order
4. Add your project URL and anon key to `.env`
5. Enable Google OAuth in Supabase Dashboard > Authentication > Providers

### Run Tests

```bash
npm run test:web            # Playwright web E2E
npm run test:android        # Maestro Android E2E
npm run test:all            # Full orchestrated suite
```

---

## Project Structure

```
evenly/
|
+-- src/
|   +-- screens/                  # 11 UI screens
|   |   +-- AuthScreen.js         # Google OAuth + demo quick-access
|   |   +-- OnboardingScreen.js   # 3-page welcome carousel
|   |   +-- HomeScreen.js         # Balance dashboard, activity feed, AdMob banner
|   |   +-- ActivityScreen.js     # Timeline + smart nudges with 1-tap settle
|   |   +-- GroupsScreen.js       # Group list with pin/archive
|   |   +-- GroupDetailScreen.js  # Expenses / Balances / Members / Activity tabs
|   |   +-- CreateGroupScreen.js  # Templates, emoji, member selection
|   |   +-- AddExpenseScreen.js   # 4 split modes + inline calculator
|   |   +-- SettleUpScreen.js     # Payment recording + confetti + AdMob
|   |   +-- FriendsScreen.js      # Categorized list, balance grid, QR code
|   |   +-- ProfileScreen.js      # Settings, theme toggle, notifications
|   |   +-- CurrencyScreen.js     # 10-currency picker with live rates
|   |
|   +-- services/                 # Business logic
|   |   +-- storage.js            # Data CRUD (AsyncStorage + Supabase)
|   |   +-- supabase.js           # Supabase client (credentials from .env)
|   |   +-- syncService.js        # Offline queue and flush logic
|   |   +-- analytics.js          # Dev-only console event tracking
|   |   +-- currency.js           # Multi-currency with live rates
|   |   +-- contacts.js           # Native address book + WhatsApp
|   |   +-- ads.js                # Google AdMob (banner + interstitial)
|   |   +-- notifications.js      # Local push notifications
|   |
|   +-- context/
|   |   +-- AppContext.js         # Memoized global state, auth, sync
|   |   +-- ThemeContext.js       # Light/dark theme with 20+ tokens
|   |
|   +-- navigation/
|   |   +-- AppNavigator.js       # Stack + Tab navigator, deep links, lazy loading
|   |
|   +-- components/               # Shared UI components
|   |   +-- Avatar.js             # User avatar with initials fallback
|   |   +-- AddPeopleModal.js     # Unified add friends/members (5 tabs)
|   |   +-- BackgroundOrbs.js     # Animated gradient background (React.memo)
|   |   +-- BalanceSummary.js     # Balance summary card
|   |   +-- FadeInView.js         # Staggered fade-in animation
|   |   +-- PressableScale.js     # Spring-animated pressable button
|   |   +-- ShakeView.js          # Shake feedback for validation errors
|   |   +-- Skeleton.js           # Loading shimmer placeholder
|   |   +-- SyncBanner.js         # Network / sync status indicator
|   |
|   +-- utils/
|   |   +-- splitCalculator.js    # 4 split algorithms + debt simplification
|   |   +-- haptics.js            # Haptic feedback wrappers
|   |   +-- alert.js              # Cross-platform alert helpers
|   |   +-- responsive.js         # Screen-width breakpoints and scaling
|   |   +-- share.js              # Cross-platform share/clipboard
|   |
|   +-- hooks/
|       +-- useScrollHeader.js    # Scroll-to-fade header animation hook
|
+-- autoperf/                     # Automated performance framework
|   +-- benchmark.sh              # Quality gate (build + Lighthouse + overflow + algorithm)
|   +-- run.sh                    # Nightly auto-optimizer
|   +-- goals.md                  # Performance targets and constraints
|   +-- test-scenarios.js         # 1000 random settlement scenarios
|   +-- baseline-metrics.json     # Current performance baseline
|
+-- e2e/                          # Playwright web E2E tests (15 specs)
+-- maestro/flows/                # Maestro Android E2E tests (28+ flows)
+-- scripts/
|   +-- deploy-web.sh             # Build + quality gate + gh-pages deploy
|   +-- run-tests.sh              # Maestro test runner
|   +-- orchestrate.sh            # Parallel test + doc orchestrator
|
+-- .github/workflows/
|   +-- spec-guard.yml            # CI: build + Playwright + Maestro lint
|   +-- keep-alive.yml            # Cron: ping Supabase every 5 days
|
+-- supabase_schema.sql           # Full PostgreSQL schema
+-- supabase_migration_001-006.sql # Incremental migrations (including RLS)
+-- .env.example                  # Environment variable template
+-- app.json                      # Expo + EAS + AdMob config
+-- eas.json                      # EAS Build profiles (AAB for Play Store)
+-- public/privacy.html           # Privacy policy page
```

---

## Configuration

### App Identity

| Key | Value |
|---|---|
| App Name | Evenly |
| Version | 1.0.2 |
| Bundle ID (iOS) | `com.ajayksingh.evenly` |
| Package (Android) | `com.ajayksingh.evenly` |
| Version Code | 3 |
| Deep Link Scheme | `evenly://` |
| EAS Project ID | `ac20106b-0447-4a6f-8bcd-5d09f0a5b103` |

### npm Scripts

| Script | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run in browser |
| `npm run build:web` | Export web bundle to dist/ |
| `npm run deploy` | Build + quality gate + deploy to GitHub Pages |
| `npm run test:web` | Run Playwright E2E tests |
| `npm run test:android` | Run Maestro Android E2E tests |
| `npm run test:all` | Run full orchestrated test suite |

---

## License

MIT (c) Ajay Singh — https://github.com/ajayksingh

---

Built with React Native, Expo, Supabase, and Google AdMob

**Live Demo: https://ajayksingh.github.io/evenly/**
**GitHub: https://github.com/ajayksingh/evenly**
**Privacy Policy: https://ajayksingh.github.io/evenly/privacy.html**
