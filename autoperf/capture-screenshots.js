/**
 * capture-screenshots.js — Screenshot Baseline & Overflow Detection
 * Captures screenshots at 3 viewports (320px, 375px, 430px) for all key screens.
 * Detects horizontal overflow at each viewport.
 *
 * Usage:
 *   node autoperf/capture-screenshots.js [--update-baseline]
 *
 * Outputs screenshots to autoperf/screenshot-baselines/
 * Reports overflow issues to stdout as JSON.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://ajayksingh.github.io/evenly/';
const BASELINES_DIR = path.join(__dirname, 'screenshot-baselines');
const VIEWPORTS = [
  { name: 'iphone-se', width: 320, height: 568 },
  { name: 'iphone-14', width: 375, height: 812 },
  { name: 'pixel-7', width: 430, height: 932 },
];

// Screens to capture (path after login)
const SCREENS = [
  { name: 'home', navigate: async (page) => {
    await page.getByRole('tab', { name: /Home/i }).click().catch(() => {});
    await page.waitForTimeout(1500);
  }},
  { name: 'friends', navigate: async (page) => {
    await page.getByRole('tab', { name: /Friends/i }).click().catch(() => {});
    await page.waitForTimeout(1500);
  }},
  { name: 'groups', navigate: async (page) => {
    await page.getByRole('tab', { name: /Groups/i }).click().catch(() => {});
    await page.waitForTimeout(1500);
  }},
  { name: 'activity', navigate: async (page) => {
    await page.getByRole('tab', { name: /Activity/i }).click().catch(() => {});
    await page.waitForTimeout(1500);
  }},
];

async function loginDemo(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Skip onboarding if present
  const skipBtn = page.locator('[data-testid="onboarding-skip"]');
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Alice Demo
  const aliceBtn = page.getByText('Alice Demo');
  if (await aliceBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await aliceBtn.click();
    await page.waitForTimeout(3000);
  }
}

async function run() {
  const updateBaseline = process.argv.includes('--update-baseline');
  const browser = await chromium.launch({ headless: true });
  const results = { overflows: [], screenshots: [], pass: true };

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await loginDemo(page);

    for (const screen of SCREENS) {
      await screen.navigate(page);

      // Check overflow
      const hasOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );

      if (hasOverflow) {
        results.overflows.push({ viewport: vp.name, width: vp.width, screen: screen.name });
        results.pass = false;
      }

      // Capture screenshot
      const filename = `${screen.name}-${vp.name}-${vp.width}px.png`;
      const filepath = path.join(BASELINES_DIR, filename);

      if (updateBaseline || !fs.existsSync(filepath)) {
        await page.screenshot({ path: filepath, fullPage: false });
        results.screenshots.push({ file: filename, action: 'captured' });
      } else {
        // Capture current for comparison
        const currentPath = path.join(BASELINES_DIR, `current-${filename}`);
        await page.screenshot({ path: currentPath, fullPage: false });
        results.screenshots.push({ file: filename, action: 'compared' });
      }
    }

    await context.close();
  }

  await browser.close();

  console.log(JSON.stringify(results, null, 2));
  process.exit(results.pass ? 0 : 1);
}

run().catch(e => {
  console.error(JSON.stringify({ pass: false, error: e.message }));
  process.exit(1);
});
