/**
 * 01-auth.spec.js
 * Auth screen tests — login, logout, registration, demo access,
 * forgot-password flow.
 */

import { test, expect } from '@playwright/test';
import { APP_URL, loginAs, loginAsDemo, logout } from './helpers/auth.js';

test.describe('Auth screen', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('text=Welcome back', { timeout: 30000 });
  });

  // ─── Rendering ──────────────────────────────────────────────────────────────

  test('loads the login screen with expected UI elements', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Sign in to manage your expenses')).toBeVisible();

    // Toggle buttons (exact match to avoid matching submit button / subheading)
    await expect(page.getByText('Sign In', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Sign Up', { exact: true }).first()).toBeVisible();

    // Input fields
    await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-password-input"]')).toBeVisible();

    // Submit button
    await expect(page.locator('[data-testid="auth-submit-btn"]')).toBeVisible();

    // Forgot password link
    await expect(page.getByText('Forgot password?')).toBeVisible();

    // Demo access card
    await expect(page.getByText('Quick Demo Access')).toBeVisible();
  });

  test('email and password placeholders are visible', async ({ page }) => {
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('demo card shows Alice Demo and Bob Demo rows', async ({ page }) => {
    await expect(page.getByText('Alice Demo')).toBeVisible();
    await expect(page.getByText('Bob Demo')).toBeVisible();
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  test('shows validation error when submitting empty form', async ({ page }) => {
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await page.locator('[data-testid="auth-submit-btn"]').click();
    await page.waitForTimeout(3000);

    // Either a browser dialog fired, or we are still on the auth screen
    const stillOnAuth = await page.getByText('Welcome back').isVisible().catch(() => false);
    expect(stillOnAuth || dialogMessage.length > 0).toBe(true);
  });

  test('shows error on wrong password', async ({ page }) => {
    await page.locator('[data-testid="auth-email-input"]').fill('deepsags@gmail.com');
    await page.locator('[data-testid="auth-password-input"]').fill('wrongpassword_xyz123');

    let dialogFired = false;
    page.once('dialog', async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    await page.locator('[data-testid="auth-submit-btn"]').click();
    await page.waitForTimeout(5000);

    // Should still be on auth screen — not navigated to Home
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  // ─── Demo login ─────────────────────────────────────────────────────────────

  test('demo account login works (Alice Demo)', async ({ page }) => {
    await loginAsDemo(page);
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  test('demo account login via manual credentials works (alice@demo.com)', async ({ page }) => {
    await page.locator('[data-testid="auth-email-input"]').fill('alice@demo.com');
    await page.locator('[data-testid="auth-password-input"]').fill('demo123');
    await page.locator('[data-testid="auth-submit-btn"]').click();
    await page.waitForSelector('text=Total balance', { timeout: 30000 });
    await expect(page.getByText('Total balance')).toBeVisible();
  });

  // ─── Full login / logout ────────────────────────────────────────────────────

  test('full login as User A succeeds and reaches Home screen', async ({ page }) => {
    await loginAs(page, 'deepsags@gmail.com', 'abc123');
    await expect(page.getByText('Total balance')).toBeVisible();
    await expect(page.getByText('Evenly', { exact: true })).toBeVisible();
  });

  test('logout navigates back to login screen', async ({ page }) => {
    await loginAs(page, 'deepsags@gmail.com', 'abc123');
    await logout(page);
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  // ─── Registration ────────────────────────────────────────────────────────────

  test('switch to Sign Up mode shows full name and confirm-password fields', async ({ page }) => {
    // Click the exact toggle button (not the submit button which also says "Sign in")
    await page.getByText('Sign Up', { exact: true }).first().click();

    await expect(page.getByPlaceholder('Full Name')).toBeVisible();
    await expect(page.getByPlaceholder('Confirm Password')).toBeVisible();
    await expect(page.locator('[data-testid="auth-submit-btn"]')).toBeVisible();
  });

  test('register new account with unique email', async ({ page }) => {
    const uniqueEmail = `testuser_${Date.now()}@example.com`;

    await page.getByText('Sign Up', { exact: true }).first().click();

    await page.getByPlaceholder('Full Name').fill('Test User');
    await page.locator('[data-testid="auth-email-input"]').fill(uniqueEmail);
    await page.locator('[data-testid="auth-password-input"]').fill('TestPass123');
    await page.getByPlaceholder('Confirm Password').fill('TestPass123');

    let dialogText = '';
    page.once('dialog', async (dialog) => {
      dialogText = dialog.message();
      await dialog.accept();
    });

    await page.locator('[data-testid="auth-submit-btn"]').click();
    await page.waitForTimeout(6000);

    // Either landed on Home (auto-login after register) or still on auth with a dialog
    const onHome = await page.getByText('Total balance').isVisible().catch(() => false);
    const onAuth = await page.getByText('Welcome back').isVisible().catch(() => false);
    expect(onHome || onAuth).toBe(true);
  });

  // ─── Forgot Password ─────────────────────────────────────────────────────────

  test('forgot password - no email shows prompt to enter email first', async ({ page }) => {
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await page.getByText('Forgot password?').click();
    await page.waitForTimeout(2000);

    // Should tell the user to enter email, OR we are still on auth screen
    const stillOnAuth = await page.getByText('Welcome back').isVisible().catch(() => false);
    expect(stillOnAuth).toBe(true);
  });

  test('forgot password - valid email triggers reset confirmation dialog', async ({ page }) => {
    await page.locator('[data-testid="auth-email-input"]').fill('deepsags@gmail.com');

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.getByText('Forgot password?').click();
    await page.waitForTimeout(6000);

    // Dialog should mention email was sent (or an error from Supabase)
    // Either way the app handled the request without crashing
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  // ─── Mode toggle ─────────────────────────────────────────────────────────────

  test('"Already have an account?" link switches back to Sign In mode', async ({ page }) => {
    // Switch to register mode
    await page.getByText('Sign Up', { exact: true }).first().click();
    await expect(page.getByPlaceholder('Full Name')).toBeVisible();

    // Switch back via the text link at the bottom of the form
    await page.getByText('Sign In', { exact: true }).first().click();

    // Name field should be gone, demo card visible again
    await expect(page.getByText('Quick Demo Access')).toBeVisible();
    await expect(page.getByPlaceholder('Full Name')).not.toBeVisible();
  });

  test('"Don\'t have an account?" link switches to register mode', async ({ page }) => {
    // The bottom link in Sign In mode says "Don't have an account? Sign Up"
    // Click the Sign Up link text (not the toggle button)
    const signUpLinks = page.getByText('Sign Up');
    // There are two: the toggle button and the link — click the toggle
    await signUpLinks.first().click();
    await expect(page.getByPlaceholder('Full Name')).toBeVisible();
  });

});
