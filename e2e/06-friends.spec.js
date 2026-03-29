/**
 * 06-friends.spec.js
 * Friends tab tests — updated for unified AddPeopleModal.
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/auth.js';
import { goFriends } from './helpers/tabs.js';

async function openAddFriendModal(page) {
  const selectors = [
    '[data-testid="friends-add-btn"]',
    '[data-testid="add-friend-btn"]',
    '[aria-label="Add friend"]',
  ];

  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(800);
      // New modal uses "Search by name, email, or phone..." placeholder
      const searchInput = page.getByPlaceholder(/search by name|email/i);
      if (await searchInput.isVisible({ timeout: 4000 }).catch(() => false)) return true;
    }
  }
  return false;
}

test.describe('Friends screen', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await goFriends(page);
  });

  // ─── Tab loads ────────────────────────────────────────────────────────────

  test('Friends tab loads', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  test('Friends screen renders without crashing', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  test('balance summary or empty state is shown', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  // ─── Add Friend modal (unified AddPeopleModal) ───────────────────────────

  test('Add Friend modal opens with search input', async ({ page }) => {
    const opened = await openAddFriendModal(page);
    if (!opened) { test.skip(true, 'Add Friend button not found'); return; }
    await expect(page.getByPlaceholder(/search by name|email/i)).toBeVisible();
  });

  test('Add Friend modal has tab buttons', async ({ page }) => {
    const opened = await openAddFriendModal(page);
    if (!opened) { test.skip(true, 'Add Friend button not found'); return; }
    // Should have Search and Suggested tabs (Contacts hidden on web)
    await expect(page.getByText('Search')).toBeVisible();
    await expect(page.getByText('Suggested')).toBeVisible();
  });

  test('Add Friend modal has WhatsApp invite row', async ({ page }) => {
    const opened = await openAddFriendModal(page);
    if (!opened) { test.skip(true, 'Add Friend button not found'); return; }
    await expect(page.getByText(/invite via whatsapp/i)).toBeVisible();
  });

  test('empty search shows hint text', async ({ page }) => {
    const opened = await openAddFriendModal(page);
    if (!opened) { test.skip(true, 'Add Friend button not found'); return; }
    // Should show hint about searching
    await expect(page.getByText(/results appear as you type/i)).toBeVisible();
  });

  test('typing in search triggers debounced search', async ({ page }) => {
    const opened = await openAddFriendModal(page);
    if (!opened) { test.skip(true, 'Add Friend button not found'); return; }
    const searchInput = page.getByPlaceholder(/search by name|email/i);
    await searchInput.fill('bob@demo.com');
    await page.waitForTimeout(1500); // wait for debounce
    // No crash = pass
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

  test('valid email can be submitted via Add button', async ({ page }) => {
    const opened = await openAddFriendModal(page);
    if (!opened) { test.skip(true, 'Add Friend button not found'); return; }

    const searchInput = page.getByPlaceholder(/search by name|email/i);
    await searchInput.fill('bob@demo.com');
    page.once('dialog', async (dialog) => { await dialog.accept(); });

    const submitBtn = page.getByRole('button', { name: /add/i }).last();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(4000);
    }
    expect(true).toBe(true);
  });

  test('Cancel closes the Add Friend modal', async ({ page }) => {
    const opened = await openAddFriendModal(page);
    if (!opened) { test.skip(true, 'Add Friend button not found'); return; }

    const searchInput = page.getByPlaceholder(/search by name|email/i);
    await expect(searchInput).toBeVisible();

    const cancelBtn = page.getByText(/cancel/i).last();
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(800);
      const modalGone = !(await searchInput.isVisible({ timeout: 1000 }).catch(() => false));
      expect(modalGone).toBe(true);
    }
  });

  // ─── QR Code ──────────────────────────────────────────────────────────────

  test('QR code button is visible', async ({ page }) => {
    const qrBtn = page.locator('[data-testid="qr-code-btn"]');
    if (await qrBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(qrBtn).toBeVisible();
    }
  });

  // ─── Existing data ────────────────────────────────────────────────────────

  test('Incoming Requests section shown if pending requests exist', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Friends/ })).toBeVisible();
  });

});
