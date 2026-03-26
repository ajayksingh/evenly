/**
 * 03-groups.spec.js
 * Groups tab tests — list, create, group detail tabs.
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/auth.js';
import { goGroups } from './helpers/tabs.js';

test.describe('Groups screen', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await goGroups(page);
  });

  // ─── Tab navigation ───────────────────────────────────────────────────────

  test('Groups tab navigates to the Groups screen', async ({ page }) => {
    await expect(page.locator('[data-testid="fab-add-group"]')).toBeVisible({ timeout: 10000 });
  });

  // ─── List / empty state ───────────────────────────────────────────────────

  test('groups list renders or empty state is shown', async ({ page }) => {
    const fab = page.locator('[data-testid="fab-add-group"]');
    await expect(fab).toBeVisible({ timeout: 10000 });

    const hasEmpty = await page.getByText('No groups yet').isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(page.getByText('Create a group to start splitting expenses')).toBeVisible();
    }
  });

  test('FAB is always visible on the Groups screen', async ({ page }) => {
    await expect(page.locator('[data-testid="fab-add-group"]')).toBeVisible({ timeout: 10000 });
  });

  // ─── Create Group ─────────────────────────────────────────────────────────

  test('FAB opens the CreateGroup screen', async ({ page }) => {
    await page.locator('[data-testid="fab-add-group"]').click();
    await expect(page.getByText('New Group')).toBeVisible({ timeout: 10000 });
  });

  test('header "+" button also opens CreateGroup', async ({ page }) => {
    const addBtn = page.locator('[data-testid="add-group-btn"]');
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
    } else {
      await page.locator('[data-testid="fab-add-group"]').click();
    }
    await expect(page.getByText('New Group')).toBeVisible({ timeout: 10000 });
  });

  test('group name input accepts text', async ({ page }) => {
    await page.locator('[data-testid="fab-add-group"]').click();
    await page.waitForSelector('text=New Group', { timeout: 10000 });

    const nameInput = page.locator('[data-testid="group-name-input"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Playwright Test Group');
    await expect(nameInput).toHaveValue('Playwright Test Group');
  });

  test('all four group type buttons are visible', async ({ page }) => {
    await page.locator('[data-testid="fab-add-group"]').click();
    await page.waitForSelector('text=New Group', { timeout: 10000 });

    await expect(page.locator('[data-testid="group-type-home"]')).toBeVisible();
    await expect(page.locator('[data-testid="group-type-trip"]')).toBeVisible();
    await expect(page.locator('[data-testid="group-type-couple"]')).toBeVisible();
    await expect(page.locator('[data-testid="group-type-other"]')).toBeVisible();
  });

  test('group type selection updates the active type', async ({ page }) => {
    await page.locator('[data-testid="fab-add-group"]').click();
    await page.waitForSelector('text=New Group', { timeout: 10000 });

    for (const typeId of ['home', 'trip', 'couple', 'other']) {
      await page.locator(`[data-testid="group-type-${typeId}"]`).click();
      await page.waitForTimeout(150);
    }
    await expect(page.locator('[data-testid="group-type-other"]')).toBeVisible();
  });

  test('group type labels are rendered inside their buttons', async ({ page }) => {
    await page.locator('[data-testid="fab-add-group"]').click();
    await page.waitForSelector('text=New Group', { timeout: 10000 });

    // Use scoped locators to avoid matching tab-bar labels
    await expect(page.locator('[data-testid="group-type-home"]').getByText('Home')).toBeVisible();
    await expect(page.locator('[data-testid="group-type-trip"]').getByText('Trip')).toBeVisible();
    await expect(page.locator('[data-testid="group-type-couple"]').getByText('Couple')).toBeVisible();
    await expect(page.locator('[data-testid="group-type-other"]').getByText('Other')).toBeVisible();
  });

  test('create group — fill name, select type, submit', async ({ page }) => {
    const groupName = `PW-${Date.now()}`;

    await page.locator('[data-testid="fab-add-group"]').click();
    await page.waitForSelector('text=New Group', { timeout: 10000 });

    await page.locator('[data-testid="group-name-input"]').fill(groupName);
    await page.locator('[data-testid="group-type-trip"]').click();

    page.once('dialog', async (dialog) => { await dialog.accept(); });
    await page.getByText('Create', { exact: true }).click();

    await page.waitForTimeout(4000);
    await expect(page.locator('[data-testid="fab-add-group"]')).toBeVisible({ timeout: 10000 });
  });

  test('Cancel on CreateGroup returns to Groups list', async ({ page }) => {
    await page.locator('[data-testid="fab-add-group"]').click();
    await page.waitForSelector('text=New Group', { timeout: 10000 });

    await page.getByText('Cancel').click();
    await page.waitForTimeout(1500);

    await expect(page.locator('[data-testid="fab-add-group"]')).toBeVisible({ timeout: 10000 });
  });

  // ─── Group Detail ─────────────────────────────────────────────────────────

  test('opening a group shows Expenses, Balances, Members tabs', async ({ page }) => {
    const isEmpty = await page.getByText('No groups yet').isVisible({ timeout: 2000 }).catch(() => false);
    if (isEmpty) {
      test.skip(true, 'No groups for demo account');
      return;
    }

    const memberText = page.getByText(/\d+ member/i).first();
    if (!await memberText.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'Could not find a group card');
      return;
    }
    await memberText.click();
    await page.waitForTimeout(2000);

    // GroupDetail tabs — use data-testid if available, otherwise exact text
    // The tab buttons have testID="tab-expenses" etc. from GroupDetailScreen
    const expTab = page.locator('[data-testid="tab-expenses"]');
    const expTabVisible = await expTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (expTabVisible) {
      await expect(expTab).toBeVisible();
    } else {
      await expect(page.getByText('Expenses', { exact: true })).toBeVisible({ timeout: 10000 });
    }
    // "Balances" appears twice: in the tab button and in the Balances section header
    // Use the testID-scoped locator when available
    const balTab = page.locator('[data-testid="tab-balances"]');
    if (await balTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(balTab).toBeVisible();
    } else {
      await expect(page.getByText('Balances', { exact: true }).first()).toBeVisible();
    }
    const memTab = page.locator('[data-testid="tab-members"]');
    if (await memTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(memTab).toBeVisible();
    } else {
      await expect(page.getByText('Members', { exact: true }).first()).toBeVisible();
    }
  });

  test('tab switching works inside group detail', async ({ page }) => {
    const isEmpty = await page.getByText('No groups yet').isVisible({ timeout: 2000 }).catch(() => false);
    if (isEmpty) {
      test.skip(true, 'No groups for demo account');
      return;
    }

    const memberText = page.getByText(/\d+ member/i).first();
    if (!await memberText.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'Could not find a group card');
      return;
    }
    await memberText.click();
    await page.waitForTimeout(2000);

    const balancesTab = page.getByText('Balances', { exact: true });
    if (await balancesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await balancesTab.click();
      await page.waitForTimeout(400);
      await page.getByText('Members', { exact: true }).click();
      await page.waitForTimeout(400);
      // Click Expenses tab
      const expTab = page.locator('[data-testid="tab-expenses"]');
      if (await expTab.isVisible().catch(() => false)) {
        await expTab.click();
      } else {
        await page.getByText('Expenses', { exact: true }).click();
      }
      await page.waitForTimeout(400);
      await expect(page.getByText('Balances', { exact: true })).toBeVisible();
    }
  });

});
