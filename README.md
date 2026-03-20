# Splitwise — Expense Splitting App

A React Native app for managing shared expenses with friends and groups. Works on **iOS**, **Android**, and **Web**.

**Web app:** https://ajayksingh.github.io/splitwise/
**Latest Android build:** https://expo.dev/accounts/ajayksingh/projects/splitwise/builds/716bc410-14ed-4e29-8025-ca629340a4b4

---

## Features

- **Expenses** — Add, split, and track shared expenses across groups
- **Groups** — Create groups (trips, home, couple) and manage members
- **Friends** — Add friends by email, view balances
- **Settlements** — Record payments and settle up debts
- **Activity feed** — See all recent actions across your groups
- **Cross-device sync** — Real-time sync via Supabase backend
- **Offline-first** — Works offline, syncs when back online
- **Web support** — Full browser experience at the link above

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo SDK 55, bare workflow) |
| Navigation | React Navigation v6 (stack + bottom tabs) |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Local storage | AsyncStorage (offline-first) |
| Sync queue | Custom offline sync service |
| Web | react-native-web + Expo web export |
| Build | EAS Build (Expo Application Services) |
| Deploy (web) | GitHub Pages |

---

## Getting Started

### Prerequisites
- Node.js 18+
- EAS CLI: `npm install -g eas-cli`

### Install
```bash
git clone https://github.com/ajayksingh/splitwise.git
cd splitwise
npm install
```

### Run locally
```bash
# iOS / Android
npx expo start

# Web
npx expo start --web
```

### Build Android APK (team testing)
```bash
eas login
eas build --platform android --profile preview
```

### Build production APK
```bash
eas build --platform android --profile production
```

### Deploy web
```bash
npx expo export -p web --output-dir dist
npx gh-pages -d dist --dotfiles
```

---

## Project Structure

```
src/
  screens/       # All app screens (Home, Groups, Friends, Activity, etc.)
  components/    # Reusable components (Avatar, SyncBanner, BalanceSummary)
  context/       # AppContext — global state, auth, sync
  services/      # storage.js, supabase.js, syncService.js, analytics.js
  navigation/    # AppNavigator (stack + tabs)
  constants/     # colors.js, categories
  utils/         # splitCalculator, alert helpers
```

---

## Supabase Setup

1. Create a project at https://supabase.com
2. Copy your project URL and anon key into `src/services/supabase.js`
3. Create tables: `users`, `groups`, `expenses`, `settlements`, `friends`, `activity`
4. Enable Row Level Security with appropriate policies

---

## Demo Accounts

| Email | Password |
|---|---|
| alice@demo.com | demo123 |
| bob@demo.com | demo123 |
| carol@demo.com | demo123 |

Demo accounts work offline — no Supabase required.

---

## Architecture

The app uses an **offline-first** architecture:

1. All writes go to AsyncStorage first (instant, works offline)
2. A sync queue (`syncService.js`) batches writes to Supabase
3. On login, `syncFromSupabase()` pulls all remote data down
4. Direct Supabase writes run fire-and-forget for real-time cross-device sync

The app works fully offline and syncs automatically when connectivity is restored.
