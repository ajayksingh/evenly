/**
 * 10-responsive.spec.js
 * Responsive / web-specific rendering tests.
 *
 * AppNavigator behaviour:
 *   • width ≤ 768 → full-width layout (mobile / narrow tablet)
 *   • width > 768 → centred 430 px phone-frame (wide tablet / desktop)
 */

import { test, expect } from '@playwright/test';
import { APP_URL, loginAsDemo, skipOnboardingIfPresent } from './helpers/auth.js';

const VIEWPORTS = {
  mobile:  { width: 390,  height: 844  },
  tablet:  { width: 768,  height: 1024 },
  desktop: { width: 1440, height: 900  },
};

async function quickLogin(page) {
  await loginAsDemo(page);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile  390 × 844
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Mobile viewport (390×844)', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('app renders correctly', async ({ page }) => {
    await quickLogin(page);
    await expect(page.getByText('Total balance')).toBeVisible();
    await expect(page.getByText('Evenly', { exact: true })).toBeVisible();
  });

  test('auth screen renders at mobile size', async ({ page }) => {
    await page.goto(APP_URL);
    await skipOnboardingIfPresent(page);
    await page.waitForSelector('text=Continue with Google', { timeout: 30000 });
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.locator('[data-testid="auth-google-btn"]')).toBeVisible();
  });

  test('all four bottom tabs have role="tab" at mobile size', async ({ page }) => {
    await quickLogin(page);
    await expect(page.getByRole('tab', { name: /Home/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Groups/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  test('no horizontal overflow at mobile size', async ({ page }) => {
    await quickLogin(page);
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });

  test('balance card is within viewport width at mobile', async ({ page }) => {
    await quickLogin(page);
    const heroLabel = page.getByText('Total balance');
    await expect(heroLabel).toBeVisible();
    const box = await heroLabel.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 10);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Tablet  768 × 1024
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Tablet viewport (768×1024)', () => {
  test.use({ viewport: VIEWPORTS.tablet });

  test('app renders correctly at tablet size', async ({ page }) => {
    await quickLogin(page);
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('auth screen renders at tablet size', async ({ page }) => {
    await page.goto(APP_URL);
    await skipOnboardingIfPresent(page);
    await page.waitForSelector('text=Continue with Google', { timeout: 30000 });
    await expect(page.getByText('Continue with Google')).toBeVisible();
  });

  test('all four tabs present at tablet size (role="tab")', async ({ page }) => {
    await quickLogin(page);
    await expect(page.getByRole('tab', { name: /Home/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Groups/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  test('no horizontal overflow at tablet size', async ({ page }) => {
    await quickLogin(page);
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });

  test('content is within viewport at 768px', async ({ page }) => {
    await quickLogin(page);
    const heroLabel = page.getByText('Total balance');
    await expect(heroLabel).toBeVisible();
    const box = await heroLabel.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThan(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Desktop  1440 × 900
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Desktop viewport (1440×900)', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('app renders correctly at desktop size', async ({ page }) => {
    await quickLogin(page);
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('auth screen is centred at desktop size', async ({ page }) => {
    await page.goto(APP_URL);
    await skipOnboardingIfPresent(page);
    await page.waitForSelector('text=Continue with Google', { timeout: 30000 });
    await expect(page.getByText('Continue with Google')).toBeVisible();
    const heading = page.getByText('Evenly');
    const box = await heading.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThan(300); // not flush-left
  });

  test('all four tabs present at desktop size (role="tab")', async ({ page }) => {
    await quickLogin(page);
    await expect(page.getByRole('tab', { name: /Home/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Groups/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  test('no horizontal overflow at desktop size', async ({ page }) => {
    await quickLogin(page);
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });

  test('app renders in centred phone frame at desktop', async ({ page }) => {
    await quickLogin(page);
    const heroLabel = page.getByText('Total balance');
    await expect(heroLabel).toBeVisible();
    const box = await heroLabel.boundingBox();
    expect(box).not.toBeNull();
    // Frame is centred: x ≈ (1440 - 430) / 2 ≈ 505 ± padding
    expect(box.x).toBeGreaterThan(400);
    expect(box.x + box.width).toBeLessThan(1050);
  });

  test('dark background visible outside phone frame', async ({ page }) => {
    await quickLogin(page);
    const bgColor = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  test('all tabs are clickable at desktop size', async ({ page }) => {
    await quickLogin(page);

    await page.getByRole('tab', { name: /Activity/ }).click();
    await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: /Groups/ }).click();
    await page.locator('[data-testid="fab-add-group"]').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByRole('tab', { name: /Friends/ }).click();
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: /Home/ }).click();
    await expect(page.getByText('Total balance')).toBeVisible({ timeout: 10000 });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-viewport smoke
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cross-viewport smoke', () => {

  for (const [sizeName, viewport] of Object.entries(VIEWPORTS)) {

    test(`login → home → groups → home at ${sizeName} (${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await quickLogin(page);
      await expect(page.getByText('Total balance')).toBeVisible();

      await page.getByRole('tab', { name: /Groups/ }).click();
      await page.locator('[data-testid="fab-add-group"]').waitFor({ state: 'visible', timeout: 10000 });

      await page.getByRole('tab', { name: /Home/ }).click();
      await expect(page.getByText('Total balance')).toBeVisible({ timeout: 10000 });
    });

  }

});
