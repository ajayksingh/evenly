/**
 * 01-auth.spec.js
 * Auth screen tests — Google OAuth button, demo access, login/logout.
 */

import { test, expect } from '@playwright/test';
import { APP_URL, loginAsDemo, logout } from './helpers/auth.js';

test.describe('Auth screen', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('text=Continue with Google', { timeout: 30000 });
  });

  // ─── Rendering ──────────────────────────────────────────────────────────────

  test('loads the auth screen with expected UI elements', async ({ page }) => {
    await expect(page.getByText('Evenly')).toBeVisible();
    await expect(page.getByText('Split expenses with friends, effortlessly')).toBeVisible();

    // Google sign-in button
    await expect(page.locator('[data-testid="auth-google-btn"]')).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();

    // Terms text
    await expect(page.getByText('Terms of Service')).toBeVisible();

    // Demo access card
    await expect(page.getByText('Quick Demo Access')).toBeVisible();
  });

  test('demo card shows Alice Demo and Bob Demo rows', async ({ page }) => {
    await expect(page.getByText('Alice Demo')).toBeVisible();
    await expect(page.getByText('Bob Demo')).toBeVisible();
  });

  test('Google sign-in button is clickable', async ({ page }) => {
    const googleBtn = page.locator('[data-testid="auth-google-btn"]');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();
  });

  // ─── Demo login ─────────────────────────────────────────────────────────────

  test('demo account login works (Alice Demo)', async ({ page }) => {
    await loginAsDemo(page);
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('demo account login works (Bob Demo)', async ({ page }) => {
    await page.getByText('Bob Demo').click();
    await page.waitForSelector('text=Total balance', { timeout: 30000 });
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  // ─── Full login / logout ────────────────────────────────────────────────────

  test('demo login reaches Home screen with expected elements', async ({ page }) => {
    await loginAsDemo(page);
    await expect(page.getByText('Total balance')).toBeVisible();
    await expect(page.getByText('Evenly', { exact: true })).toBeVisible();
  });

  test('logout navigates back to auth screen', async ({ page }) => {
    await loginAsDemo(page);
    await logout(page);
    await expect(page.getByText('Continue with Google')).toBeVisible();
  });

});
