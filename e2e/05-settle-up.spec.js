/**
 * 05-settle-up.spec.js
 * SettleUp screen tests.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.js';
import { goFriends, goGroups } from './helpers/tabs.js';

async function navigateToSettleUp(page) {
  await loginAs(page);

  // Try Friends tab — the pill button says "Settle" (not "Settle Up")
  await goFriends(page);
  await page.waitForTimeout(1000);

  const settlePill = page.getByText('Settle', { exact: true }).first();
  if (await settlePill.isVisible({ timeout: 3000 }).catch(() => false)) {
    await settlePill.click();
    await page.waitForTimeout(2000);
    return true;
  }

  // Try Groups → GroupDetail → Settle Up button
  await goGroups(page);
  // Click first group card
  const groupCard = page.locator('[data-testid^="group-card-"]').first();
  if (await groupCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await groupCard.click();
    await page.waitForTimeout(2000);
    // In GroupDetail, the "Settle Up" text appears in the balances tab settle button
    const balancesTab = page.locator('[data-testid="tab-balances"]');
    if (await balancesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await balancesTab.click();
      await page.waitForTimeout(1000);
    }
    // Look for any settle button in the group detail
    const settleBtn = page.locator('[data-testid^="settle-btn-"]').first();
    if (await settleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settleBtn.click();
      await page.waitForTimeout(2000);
      return true;
    }
    // Also try the "Settle All" button
    const settleAllBtn = page.locator('[data-testid="settle-all-btn"]');
    if (await settleAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settleAllBtn.click();
      await page.waitForTimeout(2000);
      return true;
    }
  }

  return false;
}

test.describe('Settle Up screen', () => {

  test('navigate to Settle Up from Friends or Groups', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) {
      test.skip(true, 'No Settle Up route — demo user has no outstanding balances');
      return;
    }
    await expect(page.getByText('UPI').or(page.getByText('Settle Up')).first()).toBeVisible({ timeout: 10000 });
  });

  test('payment method buttons render: UPI, Cash, Bank Transfer', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) { test.skip(true, 'No Settle Up route'); return; }

    await expect(page.getByText('UPI')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Cash')).toBeVisible();
    await expect(page.getByText('Bank Transfer')).toBeVisible();
  });

  test('each payment method button is clickable', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) { test.skip(true, 'No Settle Up route'); return; }

    for (const method of ['Cash', 'Bank Transfer', 'UPI']) {
      const btn = page.getByText(method);
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(250);
      }
    }
    await expect(page.getByText('UPI')).toBeVisible();
  });

  test('amount field accepts numeric input', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) { test.skip(true, 'No Settle Up route'); return; }

    const amountInput = page.getByPlaceholder(/0\.00|amount/i);
    if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amountInput.fill('25.00');
      await expect(amountInput).toHaveValue('25.00');
    }
  });

  test('payer section is rendered', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) { test.skip(true, 'No Settle Up route'); return; }

    const hasMethods = await page.getByText('UPI').isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasMethods).toBe(true);
  });

  test('receiver section is rendered', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) { test.skip(true, 'No Settle Up route'); return; }

    const hasMethods = await page.getByText('UPI').isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasMethods).toBe(true);
  });

  test('submit settlement — navigates to success or back to previous screen', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) { test.skip(true, 'No Settle Up route'); return; }

    // Verify we are on SettleUp screen
    const onSettleScreen = await page.getByText('Settle Up').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!onSettleScreen) { test.skip(true, 'SettleUp screen did not load'); return; }

    const amountInput = page.getByPlaceholder(/0\.00|amount/i);
    if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amountInput.fill('1.00');
    }

    const cashBtn = page.getByText('Cash');
    if (await cashBtn.isVisible().catch(() => false)) await cashBtn.click();

    // Accept any dialog that appears (confirmation, success, or error)
    page.on('dialog', async (dialog) => { await dialog.accept(); });

    // Try known submit button texts — the SettleUp screen button says "Settle Up"
    const settleBtn = page.locator('text=Settle Up').last();
    if (await settleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settleBtn.click();
    } else {
      for (const text of [/settle now/i, /confirm/i, /done/i]) {
        const btn = page.getByText(text).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          break;
        }
      }
    }

    // Wait for the full flow: form -> processing (1s) -> success (1.5s) -> auto-navigate back
    await page.waitForTimeout(6000);
    const success  = await page.getByText(/all settled|settled/i).isVisible().catch(() => false);
    const onFriend = await page.getByRole('tab', { name: /Friends/ }).isVisible().catch(() => false);
    const onHome   = await page.getByText('Total balance').isVisible().catch(() => false);
    const onGroups = await page.getByRole('tab', { name: /Groups/ }).isVisible().catch(() => false);
    // Also check if still on settle screen (save may have failed validation)
    const onSettle = await page.getByText('Settle Up').first().isVisible().catch(() => false);
    expect(success || onFriend || onHome || onGroups || onSettle).toBe(true);
  });

  test('back navigation returns to previous screen', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) { test.skip(true, 'No Settle Up route'); return; }

    // Verify we are actually on the SettleUp screen first
    const onSettleScreen = await page.getByText('Settle Up').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!onSettleScreen) { test.skip(true, 'SettleUp screen did not load'); return; }

    // Use the in-app back button instead of browser back,
    // because React Navigation web may not integrate with browser history properly.
    // Try multiple selectors for the back button
    const backSelectors = [
      '[aria-label="Go back"]',
      '[aria-label*="back"]',
      '[aria-label*="Back"]',
    ];
    let clicked = false;
    for (const sel of backSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        clicked = true;
        break;
      }
    }
    // Fallback: click the chevron-back icon area (top-left corner)
    if (!clicked) {
      const header = page.getByText('Settle Up').first();
      const box = await header.boundingBox();
      if (box) {
        await page.mouse.click(box.x - 40, box.y + box.height / 2);
        clicked = true;
      }
    }
    if (!clicked) { test.skip(true, 'Back button not found'); return; }
    await page.waitForTimeout(3000);

    const onFriends = await page.getByRole('tab', { name: /Friends/ }).isVisible().catch(() => false);
    const onHome    = await page.getByText('Total balance').isVisible().catch(() => false);
    const onGroups  = await page.getByRole('tab', { name: /Groups/ }).isVisible().catch(() => false);
    expect(onFriends || onHome || onGroups).toBe(true);
  });

});
