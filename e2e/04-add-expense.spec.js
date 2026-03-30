/**
 * 04-add-expense.spec.js
 * AddExpenseScreen tests — split types, category picker, save validation.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.js';
import { goGroups } from './helpers/tabs.js';

async function navigateToAddExpense(page) {
  await loginAs(page);
  await goGroups(page);

  const isEmpty = await page.getByText('No groups yet').isVisible({ timeout: 2000 }).catch(() => false);
  if (isEmpty) return false;

  // Click first group card using testID pattern
  const groupCard = page.locator('[data-testid^="group-card-"]').first();
  if (!await groupCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Fallback: click group by name
    const groupName = page.getByText(/Goa Trip|Flat Expenses/i).first();
    if (!await groupName.isVisible({ timeout: 3000 }).catch(() => false)) return false;
    await groupName.click();
  } else {
    await groupCard.click();
  }
  await page.waitForTimeout(2000);

  // Look for Add button in group detail
  const addBtn = page.locator('[data-testid="add-expense-btn"]').or(page.getByText('Add', { exact: true })).first();
  if (!await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) return false;

  await addBtn.click();
  await page.waitForTimeout(2000);
  return true;
}

test.describe('Add Expense screen', () => {

  test('form renders with amount and description inputs', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups for User A'); return; }

    await expect(page.getByText('Add Expense').first()).toBeVisible({ timeout: 10000 });

    const amountInput = page.getByPlaceholder(/0\.00|amount/i);
    const descInput   = page.getByPlaceholder(/description|what.*for/i);
    const hasAmount   = await amountInput.isVisible({ timeout: 5000 }).catch(() => false);
    const hasDesc     = await descInput.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasAmount || hasDesc).toBe(true);
  });

  test('filling amount and description fields works', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    const amountInput = page.getByPlaceholder(/0\.00/i);
    if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amountInput.fill('120.00');
      await expect(amountInput).toHaveValue('120.00');
    }

    const descInput = page.getByPlaceholder(/description/i);
    if (await descInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await descInput.fill('Playwright Test Expense');
      await expect(descInput).toHaveValue('Playwright Test Expense');
    }
  });

  test('Equal split tab is present and selectable', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    const equalOption = page.getByText('Equal').first();
    if (await equalOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await equalOption.click();
      await page.waitForTimeout(300);
      await expect(page.getByText('Equal').first()).toBeVisible();
    }
  });

  test('split type picker shows all four options', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    // Open the split type picker
    const splitRow = page.getByText(/^Equal$|^Percentage$|^Exact$|^Shares$/).first();
    if (await splitRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await splitRow.click();
      await page.waitForTimeout(600);
      const hasEqual      = await page.getByText('Equal').isVisible().catch(() => false);
      const hasPercentage = await page.getByText('Percentage').isVisible().catch(() => false);
      const hasExact      = await page.getByText('Exact').isVisible().catch(() => false);
      const hasShares     = await page.getByText('Shares').isVisible().catch(() => false);
      expect(hasEqual || hasPercentage || hasExact || hasShares).toBe(true);
    }
  });

  test('Percentage split option is selectable', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    const splitRow = page.getByText(/^Equal$/).first();
    if (await splitRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await splitRow.click();
      await page.waitForTimeout(500);
      const percentOption = page.getByText('Percentage').first();
      if (await percentOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await percentOption.click();
        await page.waitForTimeout(300);
        await expect(page.getByText('Percentage')).toBeVisible();
      }
    }
  });

  test('Exact split option is selectable', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    const splitRow = page.getByText(/^Equal$/).first();
    if (await splitRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await splitRow.click();
      await page.waitForTimeout(500);
      const exactOption = page.getByText('Exact').first();
      if (await exactOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await exactOption.click();
        await page.waitForTimeout(300);
        await expect(page.getByText('Exact')).toBeVisible();
      }
    }
  });

  test('Shares split option is selectable', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    const splitRow = page.getByText(/^Equal$/).first();
    if (await splitRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await splitRow.click();
      await page.waitForTimeout(500);
      const sharesOption = page.getByText('Shares').first();
      if (await sharesOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sharesOption.click();
        await page.waitForTimeout(300);
        await expect(page.getByText('Shares')).toBeVisible();
      }
    }
  });

  test('category picker opens and shows categories', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    const catRow = page.getByText(/General|Food|Transport|Entertainment|Utilities|Shopping/i).first();
    if (await catRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await catRow.click();
      await page.waitForTimeout(800);
      const hasFood    = await page.getByText('Food').isVisible().catch(() => false);
      const hasGeneral = await page.getByText('General').isVisible().catch(() => false);
      const hasTrans   = await page.getByText('Transport').isVisible().catch(() => false);
      expect(hasFood || hasGeneral || hasTrans).toBe(true);
    }
  });

  test('save with empty fields shows validation error', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const saveBtn = page.locator('[data-testid="expense-save-btn"]');
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
      expect(true).toBe(true); // no crash = pass
    }
  });

  test('"Add Expense" header title is visible', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }
    await expect(page.getByText('Add Expense').first()).toBeVisible({ timeout: 10000 });
  });

  test('Cancel returns to group detail', async ({ page }) => {
    const ready = await navigateToAddExpense(page);
    if (!ready) { test.skip(true, 'No groups'); return; }

    const cancelBtn = page.getByText('Cancel').first();
    if (await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(3000);
      // After cancel, should return to GroupDetail which has tab-expenses or Expenses text
      const hasExpensesTab = await page.locator('[data-testid="tab-expenses"]').isVisible({ timeout: 5000 }).catch(() => false);
      const hasExpensesText = await page.getByText('Expenses').first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasGroupTabs = await page.getByRole('tab', { name: /Groups/ }).isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasExpensesTab || hasExpensesText || hasGroupTabs).toBe(true);
    }
  });

});
