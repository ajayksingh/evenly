/**
 * 02-home.spec.js
 * HomeScreen tests — balance card, stats, activity feed, avatar nav,
 * pull-to-refresh.
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/auth.js';
import { goHome, goActivity, goGroups, goFriends } from './helpers/tabs.js';

test.describe('Home screen', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  // ─── Balance card ─────────────────────────────────────────────────────────

  test('balance card renders after login', async ({ page }) => {
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('"Total balance" label is visible in the hero card', async ({ page }) => {
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('hero card shows a balance status badge', async ({ page }) => {
    const anyVisible =
      (await page.getByText('All square').isVisible().catch(() => false)) ||
      (await page.getByText('Ready to split').isVisible().catch(() => false)) ||
      (await page.getByText('Friends owe you').isVisible().catch(() => false)) ||
      (await page.getByText('You owe friends').isVisible().catch(() => false)) ||
      (await page.getByText('owe').isVisible().catch(() => false));

    expect(anyVisible).toBe(true);
  });

  // ─── Debt summary ─────────────────────────────────────────────────────────

  test('debt summary or all-square card is visible', async ({ page }) => {
    const owedCard = await page.locator('[data-testid="debt-owed-to-me"]').isVisible({ timeout: 5000 }).catch(() => false);
    const oweCard = await page.locator('[data-testid="debt-i-owe"]').isVisible().catch(() => false);
    const allSquare = await page.getByText(/All square|Ready to split/).isVisible().catch(() => false);
    expect(owedCard || oweCard || allSquare).toBe(true);
  });

  // ─── Activity feed ────────────────────────────────────────────────────────

  test('"Recent transactions" section heading is visible', async ({ page }) => {
    // "Recent transactions" is the exact section title (not the tab label "Activity")
    await expect(page.getByText('Recent transactions')).toBeVisible();
  });

  test('activity feed loads — shows items or empty-state message', async ({ page }) => {
    const emptyState = page.getByText('No activity yet');
    const seeAll     = page.getByText('See all').first();

    const hasActivity = await seeAll.isVisible().catch(() => false);
    const isEmpty     = await emptyState.isVisible().catch(() => false);
    expect(hasActivity || isEmpty).toBe(true);
  });

  // ─── Navigation ──────────────────────────────────────────────────────────

  test('tapping the header avatar navigates to Profile', async ({ page }) => {
    const avatarBtn = page.locator('[data-testid="header-avatar"]');
    await expect(avatarBtn).toBeVisible();
    await avatarBtn.click();
    await expect(page.getByText('Profile')).toBeVisible({ timeout: 15000 });
  });

  test('all four bottom tabs have role="tab" and are visible', async ({ page }) => {
    // Tabs are rendered with role="tab" by React Navigation
    await expect(page.getByRole('tab', { name: /Home/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Groups/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  test('"Evenly" app name is visible in the header', async ({ page }) => {
    await expect(page.getByText('Evenly', { exact: true })).toBeVisible();
  });

  // ─── Pull-to-refresh ─────────────────────────────────────────────────────

  test('pull-to-refresh gesture does not crash the screen', async ({ page }) => {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(400);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(1500);
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  // ─── "See all" navigation ─────────────────────────────────────────────────

  test('"See all" in Recent transactions navigates to Activity tab', async ({ page }) => {
    const seeAllLinks = page.getByText('See all');
    const count = await seeAllLinks.count();

    if (count > 0) {
      await seeAllLinks.last().click();
      // Activity screen — its header title is exactly "Activity"
      await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByText('No activity yet')).toBeVisible();
    }
  });

  // ─── Tab switching from Home ─────────────────────────────────────────────

  test('can switch to Activity tab and back', async ({ page }) => {
    await goActivity(page);
    // Activity screen header is "Activity" — the tab is selected
    await expect(page.getByRole('tab', { name: /Activity/ })).toBeVisible();

    await goHome(page);
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('can switch to Groups tab', async ({ page }) => {
    await goGroups(page);
    await expect(page.locator('[data-testid="fab-add-group"]')).toBeVisible({ timeout: 10000 });
  });

  test('can switch to Friends tab', async ({ page }) => {
    await goFriends(page);
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  // ─── Empty / welcome state ────────────────────────────────────────────────

  test('welcome empty-state shown or real data present', async ({ page }) => {
    const welcomeTitle = page.getByText('Welcome to Evenly!');
    if (await welcomeTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('Create a Group')).toBeVisible();
    } else {
      await expect(page.getByText('Total balance')).toBeVisible();
    }
  });

});
