# Evenly — Command Reference

Everything you need to build, deploy, test, debug, and maintain Evenly without Claude.

---

## Quick Start

```bash
cd ~/Desktop/projects/evenly
npm install
npx expo start          # Dev server — press w/a/i for web/android/ios
```

---

## 1. Development

```bash
# Start dev server
npx expo start
npx expo start --web                  # Web only
npx expo start --android              # Android only
npx expo start --ios                  # iOS only
npx expo start --clear                # Clear Metro cache + start

# Run on specific platform
npm run web                           # Web browser
npm run android                       # Android device/emulator
npm run ios                           # iOS simulator
```

---

## 2. Build — Web

```bash
# Build web bundle
npm run build:web
# Output: dist/ folder

# Build + auto-patch (scroll fix, relative paths)
EXPO_PUBLIC_BUILDING_FOR_WEB=1 npx expo export --platform web
node scripts/patch-web-assets.js

# Check bundle size
ls -lh dist/_expo/static/js/web/index-*.js
```

---

## 3. Build — Android APK (Local, Debug Signing)

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## 4. Build — Android APK (Local, EAS/Production Signing)

```bash
# Ensure keystore is at android/app/evenly-release.jks
# Ensure signingConfigs.release is set in android/app/build.gradle
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk (signed with EAS keystore)
```

---

## 5. Build — Android AAB (Play Store)

```bash
# Local build
npx expo prebuild --platform android --clean
cd android && ./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab

# EAS cloud build (uses free tier quota — limited builds/month)
eas build --platform android --profile production --non-interactive
```

---

## 6. Build — iOS

```bash
# Local simulator build
npx expo prebuild --platform ios --clean
npx expo run:ios

# EAS cloud build
eas build --platform ios --profile production
```

---

## 7. Install on Device

```bash
# List connected devices
adb devices

# Install on specific device (Fold 5 example)
adb -s RZCW71FAAHM install -r android/app/build/outputs/apk/release/app-release.apk

# Clean install (remove old first)
adb -s RZCW71FAAHM uninstall com.ajayksingh.evenly
adb -s RZCW71FAAHM install android/app/build/outputs/apk/release/app-release.apk

# Install on emulator
adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk

# Install on whatever's connected (single device)
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## 8. Deploy — Web (GitHub Pages)

```bash
# Full deploy with quality gate
npm run deploy

# Manual deploy (skip quality gate)
npm run build:web
TMPDIR=$(mktemp -d) && cp -r dist/* "$TMPDIR/" && touch "$TMPDIR/.nojekyll"
cd "$TMPDIR" && git init && git checkout -b gh-pages && git add -A
git commit -m "Deploy" && git remote add origin https://github.com/ajayksingh/evenly.git
git push -f origin gh-pages

# Verify deployment
curl -s -o /dev/null -w "%{http_code}" https://ajayksingh.github.io/evenly/
```

---

## 9. Deploy — Play Store

```bash
# Build AAB
cd android && ./gradlew bundleRelease

# Upload via EAS (if service account configured)
eas submit --platform android --profile production

# Manual: upload AAB at Play Console → Release → Production → Create new release
# AAB path: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 10. Testing — Playwright (Web E2E)

```bash
# Run full suite (Android Chrome + Fold 5 viewports)
npx playwright test --config=playwright.fullsuite.config.js

# Run against deployed site (default config)
npx playwright test

# Run specific spec
npx playwright test e2e/01-auth.spec.js

# Run specific test by name
npx playwright test -g "loads the auth screen"

# Run single project only
npx playwright test --config=playwright.fullsuite.config.js --project=web-android-chrome

# Interactive UI mode
npm run test:web:ui

# View HTML report
npm run test:web:report

# Install browsers
npx playwright install chromium
npx playwright install webkit
```

---

## 11. Testing — Maestro (Android Native E2E)

```bash
# Run single flow
maestro test maestro/flows/02_user_a_create_group_and_add_expense.yaml

# Run on specific device
maestro --device RZCW71FAAHM test maestro/flows/02_user_a_create_group_and_add_expense.yaml

# Run all flows (skip config file)
for f in maestro/flows/[0-9]*.yaml; do
  [[ "$f" == *00_config* ]] && continue
  echo "--- $f ---" && maestro test "$f"
done

# Validate all YAML files
pip3 install pyyaml -q && python3 -c "
import yaml, os, sys
for root, _, files in os.walk('maestro/flows'):
    for f in files:
        if f.endswith('.yaml'):
            path = os.path.join(root, f)
            try:
                with open(path) as fh: list(yaml.safe_load_all(fh.read()))
            except yaml.YAMLError as e:
                print(f'ERROR: {path}: {e}'); sys.exit(1)
print('All flows valid')
"
```

---

## 12. Testing — Unit Tests

```bash
npx jest __tests__/mathLogic.test.js          # Settlement algorithm
node autoperf/test-scenarios.js                # 1000 random scenarios
```

---

## 13. Performance — Autoperf

```bash
# Full quality gate (build + Lighthouse + overflow + algorithm)
bash autoperf/benchmark.sh

# Just the settlement algorithm test
node autoperf/test-scenarios.js

# Full optimization cycle (reads goals, runs benchmark, shows instructions)
bash autoperf/run.sh

# Install Lighthouse CLI (if not installed)
npm i -g lighthouse

# Manual Lighthouse audit
npx serve dist -l 3939 -s &
lighthouse http://localhost:3939/evenly/ --chrome-flags="--headless" --output=json
```

---

## 14. Debugging — React Native Logs

```bash
# Android logcat (React Native JS logs only)
adb logcat ReactNativeJS:V '*:S'

# Fold 5 specifically
adb -s RZCW71FAAHM logcat ReactNativeJS:V '*:S'

# Save to file
adb -s RZCW71FAAHM logcat ReactNativeJS:V '*:S' | tee /tmp/evenly-logs.txt

# Clear log buffer first
adb -s RZCW71FAAHM logcat -c

# All logs (verbose — very noisy)
adb -s RZCW71FAAHM logcat

# Filter for crashes
adb -s RZCW71FAAHM logcat '*:E' | grep -i "evenly\|ReactNative\|fatal\|crash"

# Metro bundler logs (in dev)
npx expo start --android 2>&1 | tee /tmp/metro-logs.txt
```

---

## 15. Debugging — Web Console

```bash
# Capture browser console errors programmatically
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:8080/evenly/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(10000);
  await browser.close();
})();
"
```

---

## 16. Debugging — Supabase

```bash
# Check if Supabase is responding
curl -s -o /dev/null -w "%{http_code}" \
  "https://eexxrssfgrybcquoocne.supabase.co/rest/v1/users?select=id&limit=1" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Query a table directly
curl -s "https://eexxrssfgrybcquoocne.supabase.co/rest/v1/users?select=id,name,email&limit=5" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | python3 -m json.tool

# Check RLS policies
# Go to Supabase Dashboard → Authentication → Policies

# Run migration
# Paste SQL into: Supabase Dashboard → SQL Editor → New Query → Run
```

---

## 17. Debugging — Network & Sync

```bash
# Check device network
adb -s RZCW71FAAHM shell ping -c 3 google.com

# Simulate offline (disable WiFi on device)
adb -s RZCW71FAAHM shell svc wifi disable

# Re-enable WiFi
adb -s RZCW71FAAHM shell svc wifi enable

# Check AsyncStorage (requires debug build)
# In React Native debugger console:
# AsyncStorage.getAllKeys().then(keys => console.log(keys))
# AsyncStorage.getItem('sw_current_user').then(v => console.log(JSON.parse(v)))
```

---

## 18. Version Management

```bash
# Bump version (update BOTH files)
# app.json: "version": "X.Y.Z" and "versionCode": N
# package.json: "version": "X.Y.Z"

# Check current version
cat app.json | grep -E "version|versionCode"
cat package.json | grep '"version"'

# After version bump, regenerate native project
npx expo prebuild --platform android --clean
```

---

## 19. EAS & Credentials

```bash
# Check EAS build history
eas build:list --platform android --limit 5

# Check build status
eas build:list --platform android --limit 1

# Download latest AAB/APK
# URL shown in: eas build:list output → "Application Archive URL"

# Manage signing credentials (interactive)
# Run: ! eas credentials --platform android

# Check Expo config
npx expo config --json | python3 -m json.tool
```

---

## 20. Git & CI

```bash
# Check CI status
gh run list --limit 5

# View specific CI run
gh run view RUN_ID

# Trigger CI manually
git commit --allow-empty -m "Trigger CI" && git push

# Check what would be tested
git diff main --name-only | grep -E "src/|e2e/|maestro/"
```

---

## 21. Feature Flags

```bash
# Check current flags (in React Native debugger or add temp log)
# In any screen: console.log(await getAllFlags())

# Override a flag via Supabase (remote kill switch)
# Run in Supabase SQL Editor:
# INSERT INTO feature_flags (key, enabled) VALUES ('ads_enabled', false);

# Create feature_flags table (first time only)
# CREATE TABLE feature_flags (key TEXT PRIMARY KEY, value JSONB, enabled BOOLEAN DEFAULT true);

# Reset all local flags (clear AsyncStorage key)
# AsyncStorage.removeItem('@evenly_feature_flags')
```

---

## 22. Maintenance

```bash
# Update dependencies
npm update
npm audit fix

# Clear all caches
npx expo start --clear
rm -rf node_modules/.cache
rm -rf android/app/build
rm -rf dist/

# Full clean rebuild
rm -rf node_modules android ios dist
npm install
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease

# Check for unused dependencies
npx depcheck

# Check bundle size breakdown
npx expo export --platform web --dump-sourcemap
```

---

## 23. Emergency Procedures

### App crashes on launch
```bash
# Check crash logs
adb -s DEVICE_ID logcat '*:E' | grep -i "fatal\|crash\|evenly"

# Clear app data (keeps app installed)
adb -s DEVICE_ID shell pm clear com.ajayksingh.evenly

# Reinstall
adb -s DEVICE_ID uninstall com.ajayksingh.evenly
adb -s DEVICE_ID install android/app/build/outputs/apk/release/app-release.apk
```

### Supabase paused (free tier)
```bash
# Go to supabase.com dashboard → project → click "Restore"
# Or trigger keep-alive manually:
curl "https://eexxrssfgrybcquoocne.supabase.co/rest/v1/users?select=id&limit=1" \
  -H "apikey: YOUR_ANON_KEY"
```

### Web deploy broken
```bash
# Check if site responds
curl -s -o /dev/null -w "%{http_code}" https://ajayksingh.github.io/evenly/

# Redeploy
npm run build:web
# Then push to gh-pages (see section 8)
```

### Build fails
```bash
# Clean everything and retry
rm -rf android
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease

# If Metro cache issues
npx expo start --clear
```

### Tests failing after code change
```bash
# Run just the failing spec
npx playwright test e2e/FAILING_SPEC.spec.js --reporter=list

# Check screenshot on failure
ls test-results/

# View failure screenshot
open test-results/FOLDER_NAME/test-failed-1.png
```

---

## 24. Useful One-Liners

```bash
# Count lines of code
find src -name "*.js" | xargs wc -l | tail -1

# Count test cases
grep -c "test(" e2e/*.spec.js | awk -F: '{s+=$2} END {print s " tests"}'

# Find all testIDs in source
grep -rn 'testID=' src/ | wc -l

# Find all TODO/FIXME/HACK
grep -rn 'TODO\|FIXME\|HACK\|BUG-' src/

# Check APK size
du -h android/app/build/outputs/apk/release/app-release.apk

# Check AAB size
du -h android/app/build/outputs/bundle/release/app-release.aab

# List all screens
ls src/screens/*.js | xargs -I{} basename {} .js

# List all services
ls src/services/*.js | xargs -I{} basename {} .js

# Check which device is connected
adb devices -l

# Take screenshot from device
adb -s RZCW71FAAHM exec-out screencap -p > /tmp/screenshot.png && open /tmp/screenshot.png
```
