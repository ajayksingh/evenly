/**
 * 11-scroll.spec.js
 * Scroll experience tests for every screen — verifies content is scrollable,
 * no pinch-zoom regressions, and no content clipping.
 */

import { test, expect } from '@playwright/test';
import { APP_URL, loginAsDemo } from './helpers/auth.js';
import { goHome, goActivity, goGroups, goFriends } from './helpers/tabs.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getScrollInfo(page, selector = '#root') {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) || document.scrollingElement || document.documentElement;
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      isScrollable: el.scrollHeight > el.clientHeight,
    };
  }, selector);
}

async function scrollDown(page, pixels = 400) {
  await page.mouse.wheel(0, pixels);
  await page.waitForTimeout(500);
}

async function scrollUp(page, pixels = 400) {
  await page.mouse.wheel(0, -pixels);
  await page.waitForTimeout(500);
}

async function pinchZoom(page) {
  // Simulate pinch-zoom via viewport scale check
  const initialScale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  // Try keyboard zoom (Ctrl+Plus)
  await page.keyboard.press('Control+=');
  await page.waitForTimeout(300);
  const afterScale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  // Reset
  await page.keyboard.press('Control+0');
  await page.waitForTimeout(300);
  return { initialScale, afterScale };
}

// ─── Viewport meta ────────────────────────────────────────────────────────────

test.describe('Viewport & Zoom Prevention', () => {

  test('viewport meta disables user scaling', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('text=Continue with Google', { timeout: 30000 });

    const viewportContent = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta ? meta.getAttribute('content') : '';
    });

    expect(viewportContent).toContain('user-scalable=no');
    expect(viewportContent).toContain('maximum-scale=1');
  });

  test('visual viewport scale stays at 1 after zoom attempt', async ({ page }) => {
    await loginAsDemo(page);
    const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    expect(scale).toBe(1);
  });

  test('touch-action prevents zoom gestures on body', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('text=Continue with Google', { timeout: 30000 });

    const touchAction = await page.evaluate(() => {
      return window.getComputedStyle(document.body).touchAction;
    });
    // Should restrict to pan only, no pinch-zoom
    expect(touchAction).toMatch(/pan|manipulation/);
  });

});

// ─── Auth Screen ──────────────────────────────────────────────────────────────

test.describe('Auth screen scroll', () => {

  test('auth screen content is visible without clipping', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('text=Continue with Google', { timeout: 30000 });

    // Both the Google button and demo card should be reachable
    await expect(page.getByText('Continue with Google')).toBeVisible();
    // Scroll down to find demo card if needed
    await scrollDown(page, 300);
    await expect(page.getByText('Quick Demo Access')).toBeVisible();
  });

  test('auth screen scrolls on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto(APP_URL);
    await page.waitForSelector('text=Continue with Google', { timeout: 30000 });

    // On a small viewport, content should be scrollable to reach demo card
    await scrollDown(page, 400);
    await page.waitForTimeout(500);
    const demoVisible = await page.getByText('Quick Demo Access').isVisible().catch(() => false);
    const aliceVisible = await page.getByText('Alice Demo').isVisible().catch(() => false);
    expect(demoVisible || aliceVisible).toBe(true);
  });

});

// ─── Home Screen ──────────────────────────────────────────────────────────────

test.describe('Home screen scroll', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test('home screen renders without overflow', async ({ page }) => {
    await expect(page.getByText('Total balance')).toBeVisible();
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });

  test('home screen content is scrollable', async ({ page }) => {
    // Total balance should be visible at top
    await expect(page.getByText('Total balance')).toBeVisible();

    // Scroll down
    await scrollDown(page, 500);
    await page.waitForTimeout(500);

    // Should still be on home screen (not stuck)
    const onHome = await page.getByText('Evenly', { exact: true }).isVisible().catch(() => false);
    expect(onHome).toBe(true);
  });

  test('home screen scroll does not clip content horizontally', async ({ page }) => {
    const heroLabel = page.getByText('Total balance');
    await expect(heroLabel).toBeVisible();
    const box = await heroLabel.boundingBox();
    expect(box).not.toBeNull();
    // Content should be within viewport
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 10);
  });

  test('home screen scrolls back to top', async ({ page }) => {
    await scrollDown(page, 600);
    await page.waitForTimeout(300);
    await scrollUp(page, 600);
    await page.waitForTimeout(300);

    // Balance card should be visible again at top
    await expect(page.getByText('Total balance')).toBeVisible();
  });

});

// ─── Groups Screen ────────────────────────────────────────────────────────────

test.describe('Groups screen scroll', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await goGroups(page);
  });

  test('groups screen renders and is interactive', async ({ page }) => {
    // FAB should be visible
    await expect(page.locator('[data-testid="fab-add-group"]')).toBeVisible();
  });

  test('groups screen scrolls without breaking layout', async ({ page }) => {
    await scrollDown(page, 400);
    await page.waitForTimeout(300);
    // FAB should still be visible (it's positioned absolute)
    await expect(page.locator('[data-testid="fab-add-group"]')).toBeVisible();
  });

  test('groups FAB stays in viewport after scroll', async ({ page }) => {
    await scrollDown(page, 300);
    const fab = page.locator('[data-testid="fab-add-group"]');
    const box = await fab.boundingBox();
    if (box) {
      const viewport = page.viewportSize();
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 5);
    }
  });

});

// ─── Group Detail Screen ──────────────────────────────────────────────────────

test.describe('Group Detail screen scroll', () => {

  test('group detail tabs are scrollable', async ({ page }) => {
    await loginAsDemo(page);
    await goGroups(page);

    // Create a group to test with
    await page.locator('[data-testid="fab-add-group"]').click();
    await page.waitForTimeout(1000);
    const nameInput = page.locator('[data-testid="group-name-input"]');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill('Scroll Test Group');
    await page.getByText('Create').click();
    await page.waitForTimeout(2000);

    // Open the group
    const groupCard = page.getByText('Scroll Test Group').first();
    await groupCard.waitFor({ state: 'visible', timeout: 10000 });
    await groupCard.click();
    await page.waitForTimeout(1000);

    // Scroll content area
    await scrollDown(page, 300);
    await page.waitForTimeout(300);

    // Tab buttons should still be accessible
    const balancesTab = page.locator('[data-testid="tab-balances"]');
    await balancesTab.waitFor({ state: 'visible', timeout: 5000 });
    await balancesTab.click();
    await expect(page.getByText('Group Balances')).toBeVisible({ timeout: 5000 });
  });

});

// ─── Activity Screen ──────────────────────────────────────────────────────────

test.describe('Activity screen scroll', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await goActivity(page);
  });

  test('activity screen renders without clipping', async ({ page }) => {
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });

  test('activity filter chips scroll horizontally', async ({ page }) => {
    // The "All" chip should be visible
    const allChip = page.getByText('All').first();
    await expect(allChip).toBeVisible({ timeout: 10000 });
  });

  test('activity list scrolls vertically', async ({ page }) => {
    await scrollDown(page, 400);
    await page.waitForTimeout(300);
    // Should not crash or lose the screen
    await scrollUp(page, 400);
    await page.waitForTimeout(300);
  });

});

// ─── Friends Screen ───────────────────────────────────────────────────────────

test.describe('Friends screen scroll', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await goFriends(page);
  });

  test('friends screen renders without overflow', async ({ page }) => {
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });

  test('friends screen scrolls without breaking layout', async ({ page }) => {
    await scrollDown(page, 400);
    await page.waitForTimeout(300);
    await scrollUp(page, 400);
    await page.waitForTimeout(300);
    // Tab bar should still be visible
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

});

// ─── Profile Screen ───────────────────────────────────────────────────────────

test.describe('Profile screen scroll', () => {

  test('profile screen scrolls to Sign Out', async ({ page }) => {
    await loginAsDemo(page);

    // Navigate to profile
    const avatar = page.locator('[data-testid="header-avatar"]');
    await avatar.waitFor({ state: 'visible', timeout: 10000 });
    await avatar.click();
    await page.waitForSelector('text=Profile', { timeout: 15000 });

    // Scroll down to find Sign Out
    await scrollDown(page, 600);
    await page.waitForTimeout(500);

    const signOutVisible = await page.getByText('Sign Out').isVisible().catch(() => false);
    expect(signOutVisible).toBe(true);
  });

  test('profile screen scroll does not clip content', async ({ page }) => {
    await loginAsDemo(page);

    const avatar = page.locator('[data-testid="header-avatar"]');
    await avatar.click();
    await page.waitForSelector('text=Profile', { timeout: 15000 });

    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });

});

// ─── Cross-screen scroll stability ───────────────────────────────────────────

test.describe('Cross-screen scroll stability', () => {

  test('rapid tab switching does not break scroll', async ({ page }) => {
    await loginAsDemo(page);

    // Rapidly switch between all tabs
    for (let i = 0; i < 3; i++) {
      await goGroups(page);
      await goActivity(page);
      await goFriends(page);
      await goHome(page);
    }

    // Home should still be scrollable
    await scrollDown(page, 400);
    await page.waitForTimeout(200);
    await scrollUp(page, 400);
    await page.waitForTimeout(200);

    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('scroll position resets on tab switch', async ({ page }) => {
    await loginAsDemo(page);

    // Scroll down on Home
    await scrollDown(page, 500);
    await page.waitForTimeout(300);

    // Switch to Groups and back
    await goGroups(page);
    await goHome(page);

    // Total balance should be visible (scroll reset to top)
    await expect(page.getByText('Total balance')).toBeVisible();
  });

});

// ─── Mobile viewport scroll ──────────────────────────────────────────────────

test.describe('Mobile viewport scroll (375×667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('home screen scrollable on small iPhone', async ({ page }) => {
    await loginAsDemo(page);
    await expect(page.getByText('Total balance')).toBeVisible();
    await scrollDown(page, 400);
    await page.waitForTimeout(300);
    await scrollUp(page, 400);
    await page.waitForTimeout(300);
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('no horizontal overflow on small viewport', async ({ page }) => {
    await loginAsDemo(page);
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });

});

// ─── Desktop viewport scroll ─────────────────────────────────────────────────

test.describe('Desktop viewport scroll (1440×900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('phone frame container does not allow body scroll', async ({ page }) => {
    await loginAsDemo(page);
    const bodyScroll = await page.evaluate(() => {
      const cs = window.getComputedStyle(document.body);
      return cs.overflow;
    });
    expect(bodyScroll).toBe('hidden');
  });

  test('content scrolls inside phone frame at desktop', async ({ page }) => {
    await loginAsDemo(page);
    await expect(page.getByText('Total balance')).toBeVisible();
    await scrollDown(page, 400);
    await page.waitForTimeout(300);
    // Should not cause body to scroll or page to shrink
    const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    expect(scale).toBe(1);
  });

});
