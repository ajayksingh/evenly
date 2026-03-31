# Evenly — Test Documentation

Complete guide to running, writing, debugging, and maintaining tests across web and Android native.

---

## Test Suite Summary

| Platform | Framework | Tests | Pass Rate | Config |
|----------|-----------|-------|-----------|--------|
| Web (Android Chrome 412px) | Playwright | 238 | 100% | `playwright.fullsuite.config.js` |
| Web (Fold 5 folded 344px) | Playwright | 238 | 100% | `playwright.fullsuite.config.js` |
| Web (deployed site) | Playwright | 238 | — | `playwright.config.js` |
| Android native | Maestro | 24 flows | 6/6 core pass | YAML flows |
| Unit (algorithm) | Jest | 1000 scenarios | 100% | `__tests__/mathLogic.test.js` |
| Performance gate | Autoperf | 4 checks | All pass | `autoperf/benchmark.sh` |

**Total: 476 Playwright + 24 Maestro flows + 1000 algorithm scenarios**

---

## Part 1: Playwright (Web E2E)

### 1.1 Setup

```bash
# Install browsers (one-time)
npx playwright install chromium
npx playwright install webkit     # For iOS Safari tests (optional)

# Verify installation
npx playwright --version
```

### 1.2 Running Tests

```bash
# Full suite — Android Chrome + Fold 5 viewports (local server)
npx playwright test --config=playwright.fullsuite.config.js

# Full suite — deployed site only (GitHub Pages)
npx playwright test

# Single spec file
npx playwright test e2e/01-auth.spec.js

# Single test by name
npx playwright test -g "loads the auth screen"

# Single project (viewport)
npx playwright test --config=playwright.fullsuite.config.js --project=web-android-chrome
npx playwright test --config=playwright.fullsuite.config.js --project=web-android-fold5-folded

# No retries (faster for debugging)
npx playwright test e2e/01-auth.spec.js --retries=0

# Headed mode (see the browser)
npx playwright test e2e/01-auth.spec.js --headed

# Interactive UI mode
npm run test:web:ui

# View HTML report after run
npm run test:web:report
```

### 1.3 Test Configs

| Config | BaseURL | Viewports | Use |
|--------|---------|-----------|-----|
| `playwright.config.js` | `https://ajayksingh.github.io` | iPhone 14 Pro (390x844) | CI / deployed site |
| `playwright.fullsuite.config.js` | `http://127.0.0.1:8080` | Android Chrome (412x915), Fold 5 (344x882) | Local testing |

**To test locally**, you need a local server:
```bash
npm run build:web
rm -rf /tmp/evenly-local && mkdir -p /tmp/evenly-local/evenly
cp -r dist/* /tmp/evenly-local/evenly/

node -e "
const http = require('http'), fs = require('fs'), path = require('path');
const root = '/tmp/evenly-local';
const mimes = {'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.ttf':'font/ttf'};
http.createServer((req, res) => {
  let fp = path.join(root, decodeURIComponent(req.url));
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, 'index.html');
  if (!fs.existsSync(fp)) fp = path.join(root, 'evenly', 'index.html');
  const ext = path.extname(fp);
  res.writeHead(200, {'Content-Type': mimes[ext] || 'application/octet-stream'});
  fs.createReadStream(fp).pipe(res);
}).listen(8080, () => console.log('http://127.0.0.1:8080/evenly/'));
"
```
**Important:** Use `127.0.0.1` not `localhost` — Playwright webkit can't connect to `localhost` on macOS.

### 1.4 Spec Files — What Each Tests

| Spec | Tests | What it covers |
|------|-------|----------------|
| `01-auth.spec.js` | 7 | Auth screen rendering, Google button, demo login/logout |
| `02-home.spec.js` | 15 | Balance card, hero badge, activity feed, tabs, avatar→Profile |
| `03-groups.spec.js` | 13 | Groups list, FAB, create group, group types, group detail |
| `04-add-expense.spec.js` | 11 | Amount/description inputs, split types, category picker, save, cancel |
| `05-settle-up.spec.js` | 8 | Navigate to settle, payment methods, amount input, submit, back |
| `06-friends.spec.js` | 12 | Friends list, balance badges, add friend modal, WhatsApp row |
| `07-profile.spec.js` | 14 | Profile rendering, edit modal, currency nav, sign out, back |
| `08-activity.spec.js` | 12 | Timeline/person views, filter chips, nudge cards, view toggle |
| `09-currency.spec.js` | 10 | Currency list, selection, exchange rates, confirmation |
| `10-responsive.spec.js` | 18 | Mobile/tablet/desktop layouts, viewport bounds, font scaling |
| `11-scroll.spec.js` | 26 | Scroll behavior on all screens, no pinch-zoom, tab scrollability |
| `12-new-features.spec.js` | 33 | Greeting, group templates, emoji, expense calculator, QR code, settle buttons |
| `13-onboarding.spec.js` | 5 | Carousel, skip, get started, cold start |
| `14-ios-web.spec.js` | 26 | Navigation blank screen checks, AddPeopleModal (friend+group), QR, responsive, data ops |
| `15-android-web.spec.js` | 27 | Android-specific: 360px viewport, back button, modal tabs, browser history |

### 1.5 Test Helpers

**`e2e/helpers/auth.js`**
```js
import { APP_URL, loginAsDemo, loginAsDemoB, logout, skipOnboardingIfPresent } from './helpers/auth.js';

// APP_URL = '/evenly/'
// loginAsDemo(page)   — logs in as Alice Demo, waits for home
// loginAsDemoB(page)  — logs in as Bob Demo
// logout(page)        — navigates to profile, clicks sign out
// skipOnboardingIfPresent(page) — handles fresh-install onboarding
```

**`e2e/helpers/tabs.js`**
```js
import { goHome, goActivity, goGroups, goFriends } from './helpers/tabs.js';

// goHome(page)     — clicks Home tab, waits for "Total balance"
// goActivity(page) — clicks Activity tab
// goGroups(page)   — clicks Groups tab
// goFriends(page)  — clicks Friends tab
```

### 1.6 Writing New Tests

```js
import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/auth.js';
import { goGroups } from './helpers/tabs.js';

test.describe('My Feature', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);  // Handles onboarding + auth + wait for home
  });

  test('my test', async ({ page }) => {
    await goGroups(page);

    // Use data-testid (preferred)
    const card = page.locator('[data-testid^="group-card-"]').first();
    await expect(card).toBeVisible();

    // Use text (add .first() to avoid strict mode)
    await expect(page.getByText('Groups').first()).toBeVisible();

    // Use role
    await expect(page.getByRole('tab', { name: /Home/ })).toBeVisible();
  });
});
```

**Selector priority:**
1. `[data-testid="..."]` — most reliable
2. `getByRole('tab', { name: /.../ })` — for navigation
3. `getByText('...', { exact: true }).first()` — always use `.first()` or `{ exact: true }`
4. `getByPlaceholder(...)` — for inputs

### 1.7 Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Strict mode violation | `getByText('Profile')` matches "Profile" and "Edit Profile" | Add `.first()` or `{ exact: true }` |
| Timeout on fresh server | Onboarding screen blocks auth | Add `skipOnboardingIfPresent(page)` |
| Can't navigate to SettleUp from Activity | Activity is standalone tab, no Stack | Use `navigation.navigate('Home', { screen: 'SettleUp' })` |
| React Navigation overlaps | Stack screens render underneath | Use `.last()` or `{ force: true }` on locators |
| `page.goBack()` shows blank | React Navigation web doesn't integrate with browser history | Use in-app back buttons instead |
| webkit tests fail locally | macOS webkit sandbox blocks localhost | Use `127.0.0.1` or test against deployed URL |

### 1.8 Debugging Failures

```bash
# 1. Check the screenshot
ls test-results/
open test-results/FOLDER_NAME/test-failed-1.png

# 2. Check the error context
cat test-results/FOLDER_NAME/error-context.md

# 3. Run single test headed (see browser)
npx playwright test e2e/01-auth.spec.js -g "my test" --headed --retries=0

# 4. Add debug pause in test
test('debug me', async ({ page }) => {
  await loginAsDemo(page);
  await page.pause();  // Opens Playwright inspector
});

# 5. Capture console errors
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  await page.goto('http://127.0.0.1:8080/evenly/');
  await page.waitForTimeout(30000);
  await browser.close();
})();
"
```

---

## Part 2: Maestro (Android Native E2E)

### 2.1 Setup

```bash
# Install Maestro
brew install maestro

# Verify
maestro --version

# Connect device
adb devices
# Ensure com.ajayksingh.evenly is installed on the device
```

### 2.2 Running Tests

```bash
# Single flow
maestro test maestro/flows/02_user_a_create_group_and_add_expense.yaml

# On specific device
maestro --device RZCW71FAAHM test maestro/flows/02_user_a_create_group_and_add_expense.yaml

# All flows (skip config file)
for f in maestro/flows/[0-9]*.yaml; do
  [[ "$f" == *00_config* ]] && continue
  echo "--- $(basename $f) ---"
  maestro test "$f" 2>&1 | tail -5
  echo ""
done

# Core flows only (gate for deploy)
for f in 02 03 04 05 18 19; do
  maestro test maestro/flows/${f}_*.yaml
done
```

### 2.3 Flow Files — What Each Tests

| Flow | What it tests |
|------|---------------|
| `00_config.yaml` | Shared variables (skip — not a test) |
| `00_setup_user_b.yaml` | Register second test user |
| `01_login.yaml` | Demo login flow |
| `02_user_a_create_group_and_add_expense.yaml` | **CORE** — Group creation + expense |
| `03_add_member_and_second_expense.yaml` | **CORE** — Add member + second expense |
| `04_settle_payment.yaml` | **CORE** — Record settlement |
| `05_user_a_verify_settlement.yaml` | **CORE** — Verify in balances |
| `06_auth_validation.yaml` | Auth error handling |
| `06_full_e2e_with_friends.yaml` | Multi-user friend flow |
| `07_expense_split_types.yaml` | All 4 split modes |
| `08_expense_categories.yaml` | Category picker |
| `09_currency_selection.yaml` | Currency screen |
| `10_profile_edit.yaml` | Profile editing |
| `11_group_management.yaml` | Group settings |
| `12_settle_up_validation.yaml` | Settle validation |
| `13_activity_screen.yaml` | Activity feed |
| `14_friends_flow.yaml` | Friends management |
| `15_offline_graceful.yaml` | Offline behavior |
| `16_scroll_experience.yaml` | Scroll testing |
| `17_new_features.yaml` | New features |
| `18_add_people_modal.yaml` | **CORE** — Add people modal |
| `19_navigation_no_blank.yaml` | **CORE** — No blank screens |

**Core flows (02, 03, 04, 05, 18, 19)** must pass before every deploy.

### 2.4 Writing New Flows

```yaml
appId: com.ajayksingh.evenly
---
- launchApp:
    clearState: true              # Fresh start (optional)
- waitForAnimationToEnd

# Skip onboarding
- extendedWaitUntil:
    visible: "Skip"
    timeout: 15000
- tapOn: "Skip"
- waitForAnimationToEnd

# Login as demo
- extendedWaitUntil:
    visible: "Alice Demo"
    timeout: 15000
- tapOn: "Alice Demo"
- extendedWaitUntil:
    visible: "Total balance"
    timeout: 15000

# Tap by testID (preferred)
- tapOn:
    id: "quick-add-expense"

# Tap by text
- tapOn: "Add Expense"

# Input text
- tapOn:
    id: "expense-amount-input"
- inputText: "500"

# Assert visible
- assertVisible: "Add Expense"

# Optional step (won't fail if not found)
- tapOn:
    text: "Cancel"
    optional: true

# Back button (correct YAML syntax)
- pressKey:
    key: Back
    optional: true

# Wait for network
- extendedWaitUntil:
    visible: "Group Balances"
    timeout: 10000
```

**YAML gotchas:**
- `pressKey: Back` with `optional: true` must use nested syntax:
  ```yaml
  - pressKey:
      key: Back
      optional: true
  ```
  NOT `- pressKey: Back\n    optional: true` (parse error)

### 2.5 Common testIDs

| Screen | testID | Element |
|--------|--------|---------|
| Home | `header-avatar` | Profile avatar button |
| Home | `quick-add-expense` | Quick action: Add Expense |
| Home | `quick-settle-up` | Quick action: Settle Up |
| Home | `debt-owed-to-me` | Balance owed card |
| Groups | `group-card-{id}` | Group card |
| Groups | `fab-add-group` | Floating action button |
| GroupDetail | `tab-expenses` | Expenses tab |
| GroupDetail | `tab-balances` | Balances tab |
| GroupDetail | `tab-members` | Members tab |
| GroupDetail | `tab-activity` | Activity tab |
| GroupDetail | `settle-all-btn` | Settle All button |
| GroupDetail | `expense-item-{id}` | Expense card |
| AddExpense | `expense-amount-input` | Amount field |
| AddExpense | `expense-description-input` | Description field |
| AddExpense | `expense-save-btn` | Save button |
| SettleUp | `settle-record-btn` | Settle Up button |
| Friends | `friend-card` | Friend row |
| Friends | `qr-code-btn` | QR code button |
| Activity | `nudge-card` | Action needed card |
| Activity | `view-timeline` | Timeline toggle |
| Activity | `view-person` | Person view toggle |
| CreateGroup | `group-name-input` | Group name field |
| AddPeopleModal | `member-search-input` | Search input |
| Profile | `profile-sign-out` | Sign Out button |

### 2.6 Debugging Failures

```bash
# 1. Check debug screenshots
ls ~/.maestro/tests/
# Open latest folder — contains screenshots at failure point
open ~/.maestro/tests/LATEST_FOLDER/

# 2. Run with verbose output
maestro test maestro/flows/02_*.yaml 2>&1 | tee /tmp/maestro-debug.txt

# 3. Check for YAML parse errors
python3 -c "
import yaml
with open('maestro/flows/FLOW_NAME.yaml') as f:
    list(yaml.safe_load_all(f.read()))
print('Valid')
"

# 4. Validate all flows at once
pip3 install pyyaml -q && python3 -c "
import yaml, os
for root, _, files in os.walk('maestro/flows'):
    for f in files:
        if f.endswith('.yaml'):
            path = os.path.join(root, f)
            try:
                with open(path) as fh: list(yaml.safe_load_all(fh.read()))
            except yaml.YAMLError as e:
                print(f'ERROR: {path}: {e}')
print('Done')
"

# 5. Check device state
adb -s DEVICE_ID shell pm list packages | grep evenly
adb -s DEVICE_ID shell dumpsys activity top | head -5

# 6. Clear app state manually
adb -s DEVICE_ID shell pm clear com.ajayksingh.evenly
```

---

## Part 3: Unit Tests (Jest)

### 3.1 Settlement Algorithm

```bash
# Run Jest tests
npx jest __tests__/mathLogic.test.js

# Run 1000 random scenarios
node autoperf/test-scenarios.js
# Output: { pass: true, total: 1000, correct: 1000, avgTransactions: 2.7 }
```

### 3.2 What's tested
- Equal split calculation
- Percentage split (must total 100%)
- Shares-based split (proportional)
- Debt simplification (minimum transactions)
- Floating-point rounding (no accumulated drift)
- Edge cases: single person, zero amounts, large groups

---

## Part 4: Performance Gate (Autoperf)

### 4.1 Run Quality Gate

```bash
bash autoperf/benchmark.sh
```

### 4.2 What it checks

| Check | Target | Blocks deploy on fail |
|-------|--------|-----------------------|
| Web build succeeds | — | Yes |
| Lighthouse Performance | > 60 | Yes |
| Lighthouse Accessibility | > 80 | Yes |
| Viewport overflow (320/375/430px) | Zero | Yes |
| Settlement algorithm (1000 scenarios) | 100% correct | Yes |

### 4.3 Current Baseline (`autoperf/baseline-metrics.json`)

```json
{
  "buildTime": 6,
  "bundleSizeMB": 2.42,
  "lighthouse": { "performance": 100, "accessibility": 100 },
  "overflow": { "pass": true },
  "algorithm": { "correct": 1000, "total": 1000 }
}
```

---

## Part 5: CI/CD (GitHub Actions)

### 5.1 Spec Guard (`spec-guard.yml`)

**Triggers:** Push to main, PRs to main (when src/, e2e/, maestro/ files change)

**Jobs:**
1. **Build Integrity** — Builds web bundle, verifies JS output exists
2. **Web E2E** — Runs Playwright against deployed GitHub Pages
3. **Maestro Lint** — Validates all YAML syntax + checks appId present
4. **Gate** — All 3 must pass to merge

### 5.2 Keep Alive (`keep-alive.yml`)

**Triggers:** Every 5 days at 8 AM UTC (cron)

**Action:** Pings Supabase with a simple GET to prevent free-tier project pause.

**Requires GitHub Secrets:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## Part 6: Adding Tests for New Features

### Checklist for any new feature:

1. **Add testIDs** to new interactive elements in source code:
   ```jsx
   <TouchableOpacity testID="my-new-button" ...>
   ```

2. **Add Playwright test** in existing spec or new spec:
   ```js
   test('my new feature works', async ({ page }) => {
     await loginAsDemo(page);
     await page.locator('[data-testid="my-new-button"]').click();
     await expect(page.getByText('Expected Result')).toBeVisible();
   });
   ```

3. **Add Maestro flow** (if native-specific):
   ```yaml
   appId: com.ajayksingh.evenly
   ---
   - launchApp
   - waitForAnimationToEnd
   - tapOn:
       id: "my-new-button"
   - assertVisible: "Expected Result"
   ```

4. **Run full suite** to check for regressions:
   ```bash
   npx playwright test --config=playwright.fullsuite.config.js
   maestro test maestro/flows/02_*.yaml   # Core flows
   bash autoperf/benchmark.sh              # Performance gate
   ```

5. **Commit** — CI will run spec-guard automatically on push.
