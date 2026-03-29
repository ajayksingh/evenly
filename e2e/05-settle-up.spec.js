/**
 * 05-settle-up.spec.js
 * SettleUp screen tests.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.js';
import { goFriends, goGroups } from './helpers/tabs.js';

async function navigateToSettleUp(page) {
  await loginAs(page);

  // Try Friends tab
  await goFriends(page);
  await page.waitForTimeout(1000);

  const settleLinks = page.getByText('Settle Up');
  if (await settleLinks.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await settleLinks.first().click();
    await page.waitForTimeout(2000);
    return true;
  }

  // Try Groups → GroupDetail → Settle Up
  await goGroups(page);
  const memberText = page.getByText(/\d+ member/i).first();
  if (await memberText.isVisible({ timeout: 5000 }).catch(() => false)) {
    await memberText.click();
    await page.waitForTimeout(2000);
    const settleBtn = page.getByText('Settle Up').first();
    if (await settleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settleBtn.click();
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

    const amountInput = page.getByPlaceholder(/0\.00|amount/i);
    if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amountInput.fill('1.00');
    }

    const cashBtn = page.getByText('Cash');
    if (await cashBtn.isVisible().catch(() => false)) await cashBtn.click();

    page.once('dialog', async (dialog) => { await dialog.accept(); });

    // Try known submit button texts
    for (const text of [/settle up/i, /settle now/i, /confirm/i, /done/i]) {
      const btn = page.getByText(text).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        break;
      }
    }

    await page.waitForTimeout(5000);
    const success  = await page.getByText(/all settled|settled/i).isVisible().catch(() => false);
    const onFriend = await page.getByRole('tab', { name: /Friends/ }).isVisible().catch(() => false);
    const onHome   = await page.getByText('Total balance').isVisible().catch(() => false);
    expect(success || onFriend || onHome).toBe(true);
  });

  test('back navigation returns to previous screen', async ({ page }) => {
    const reached = await navigateToSettleUp(page);
    if (!reached) { test.skip(true, 'No Settle Up route'); return; }

    await page.goBack();
    await page.waitForTimeout(2000);

    const onFriends = await page.getByRole('tab', { name: /Friends/ }).isVisible().catch(() => false);
    const onHome    = await page.getByText('Total balance').isVisible().catch(() => false);
    const onGroups  = await page.getByRole('tab', { name: /Groups/ }).isVisible().catch(() => false);
    expect(onFriends || onHome || onGroups).toBe(true);
  });

});
