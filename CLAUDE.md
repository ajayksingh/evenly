# Evenly — Project Spec for Claude Code

## Overview

Evenly is a production expense-splitting app (React Native + Expo SDK 55 + Supabase). Version 1.0.3, versionCode 4. Live on web (GitHub Pages) and Android (Play Store).

## Quick Reference

- **Entry:** `App.js` → `ThemeProvider` → `AppProvider` → `AppNavigator` + `ThemedAlert`
- **State:** Single memoized React Context (`src/context/AppContext.js`)
- **Backend:** Supabase free tier (PostgreSQL), 10 tables, RLS on all
- **Auth:** Google OAuth + demo accounts (`alice@demo.com` / `demo123`)
- **Env vars:** `.env` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_ADMOB_*`

## Architecture

```
UI (11 screens) → AppContext (memoized) → storage.js → Supabase / AsyncStorage
                                        → syncService.js (offline queue)
Realtime: Supabase Postgres Changes on 7 tables, debounced 500ms
Offline: AsyncStorage writes → sync queue → flush on reconnect
```

## Key Files

### Screens (src/screens/)
| File | Purpose |
|------|---------|
| HomeScreen.js | Dashboard, balance card, cross-group settlements, activity feed |
| ActivityScreen.js | Timeline + smart nudges with 1-tap settle |
| GroupsScreen.js | Group list with pin/archive |
| GroupDetailScreen.js | Expenses (FlatList), Balances, Members, Activity tabs |
| AddExpenseScreen.js | 4 split modes + inline calculator (safe parser, no eval) |
| SettleUpScreen.js | Payment recording + confetti + AdMob interstitial |
| FriendsScreen.js | Categorized balance list, QR code, unified add modal |
| CreateGroupScreen.js | Templates, emoji, member selection |
| ProfileScreen.js | Settings, theme toggle, notifications |
| CurrencyScreen.js | 10-currency picker with live rates |
| AuthScreen.js | Google OAuth + demo quick-access |
| OnboardingScreen.js | 3-page carousel |

### Services (src/services/)
| File | Purpose |
|------|---------|
| storage.js | All CRUD — routes demo→AsyncStorage, real→Supabase |
| supabase.js | Client init, credentials from .env |
| syncService.js | Offline queue, camelCase→snake_case, 5 retries |
| flags.js | Feature flags: local defaults + AsyncStorage + Supabase remote |
| ads.js | AdMob banner + interstitial, gated by feature flags |
| currency.js | 10 currencies, live rates, 1h cache |
| analytics.js | Console-only in __DEV__ (no DB writes) |
| contacts.js | Native contacts, WhatsApp sharing |
| notifications.js | Local push notifications (deferred 3s after login) |

### Components (src/components/)
| File | Purpose |
|------|---------|
| ThemedAlert.js | In-app modal replacing all Alert.alert — success/error/warning/info/confirm |
| AddPeopleModal.js | 5-tab modal: Search, Contacts, Friends, Suggested, Link |
| Avatar.js | Initials fallback + image |
| BackgroundOrbs.js | Animated gradient (React.memo, cleanup on unmount) |
| PressableScale.js | Spring press animation |
| FadeInView.js | Staggered entrance |
| ShakeView.js | Validation error shake |
| Skeleton.js | Loading shimmer |
| SyncBanner.js | Network sync status |

### Key Utils
| File | Purpose |
|------|---------|
| splitCalculator.js | 4 split algorithms + `getSimplifiedDebts()` (greedy two-pointer, 1000/1000 tested) |
| alert.js | `confirmAlert` + `infoAlert` — wrappers around ThemedAlert |
| responsive.js | `isNarrow()`, `rPadding()`, `rFontSize()` |
| haptics.js | Gated by `haptic_feedback` feature flag |

## Database (Supabase)

10 tables, all with RLS. Schema in `supabase_schema.sql`, migrations `001`-`007`.

Key RLS gap fixed: migration 007 added UPDATE policy for expenses (comments were silently failing).

`get_user_groups(p_user_id)` RPC — SECURITY DEFINER, bypasses RLS.

## Performance Decisions

- **Progressive loading:** Phase 1 (groups/friends/invites) renders first, Phase 2 (balances/activity) fills in
- **JWT-based auth:** Profile built from token metadata, no DB query on login
- **Skip INITIAL_SESSION:** Prevents duplicate loadData on app restart
- **Stale-time gate:** loadData skips if called within 5s (bypassed by force=true)
- **Memoized context value:** useMemo on the Provider value object
- **FlatList for expenses:** Virtualized with initialNumToRender=10, windowSize=5
- **Notification permission deferred 3s** after login

## Feature Flags (src/services/flags.js)

20 flags: `ads_enabled`, `interstitial_after_settle`, `interstitial_frequency`, `whatsapp_sharing`, `contact_sync`, `qr_invites`, `friend_requests_required`, `demo_mode`, `onboarding_flow`, `dark_mode`, `entrance_animations`, `haptic_feedback`, `offline_mode`, `realtime_sync`, `cross_group_simplification`, `receipt_scanning`, `recurring_expenses`, `spending_analytics`, `upi_deep_link`

Local defaults → AsyncStorage → optional Supabase `feature_flags` table override.

## Testing

- **Playwright:** 476 tests, 100% pass, config: `playwright.fullsuite.config.js` (Android Chrome 412px + Fold 5 344px)
- **Maestro:** 28 flows, 6 core flows verified on Fold 5
- **Autoperf:** `bash autoperf/benchmark.sh` — Lighthouse + overflow + algorithm gate
- **Settlement:** 1000 random scenarios in `autoperf/test-scenarios.js`

## Build & Deploy

```bash
# Web
npm run build:web && # deploy dist/ to gh-pages

# Android APK (debug signing)
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk

# Android AAB (Play Store, EAS signing configured in build.gradle)
cd android && ./gradlew bundleRelease
# AAB: android/app/build/outputs/bundle/release/app-release.aab

# EAS cloud build (when quota available)
eas build --platform android --profile production

# Install on Fold 5
adb -s RZCW71FAAHM install -r android/app/build/outputs/apk/release/app-release.apk
```

Signing keystore: `android/app/evenly-release.jks` (EAS keystore, credentials in build.gradle signingConfigs.release).

## CI/CD

- `spec-guard.yml` — build + Playwright + Maestro lint on push/PR
- `keep-alive.yml` — pings Supabase every 5 days (free tier pause prevention)

## Conventions

- All popups use `themedAlert()` / `themedConfirm()` — no `Alert.alert`
- All colors from `theme.*` tokens — no hardcoded hex in JSX
- Console logs gated behind `__DEV__`
- `keyboardShouldPersistTaps="handled"` on all scrollable forms
- Entrance animations use `animatedOnce` ref guard
- Optimistic updates for comments (revert on failure)
- Feature flags gate: ads, haptics, upcoming features

## Known Limitations

- API calls: 8 per login (6 target needs Supabase foreign keys)
- Webkit Playwright: can't connect to localhost on macOS (use deployed URL)
- EAS free tier: limited builds/month
- No error boundary component (should add)
- `seedDemoData` still runs for non-authenticated cold starts
