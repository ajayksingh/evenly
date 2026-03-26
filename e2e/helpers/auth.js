/**
 * Shared authentication helpers for Playwright E2E tests.
 *
 * The Evenly app is a React Native Web (Expo) SPA hosted at
 * https://ajayksingh.github.io/evenly/
 *
 * Elements are rendered as <div> / <input> nodes with testID props mapped
 * to data-testid attributes by Expo's web renderer.
 *
 * IMPORTANT: always use APP_URL (not '/') because the app lives at a
 * sub-path of the GitHub Pages domain. goto('/') would resolve to the
 * domain root which returns 404.
 */

export const APP_URL = '/evenly/';

/**
 * Wait for the login screen to be ready, fill credentials, and submit.
 * Resolves when the Home screen (containing "Total balance") is visible.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function loginAs(page, email, password) {
  await page.goto(APP_URL);

  // Wait for the "Welcome back" heading that signals the Auth screen is ready
  await page.waitForSelector('text=Welcome back', { timeout: 30000 });

  // Fill the email field — the component uses testID="auth-email-input"
  // which Expo Web maps to data-testid
  const emailInput = page.locator('[data-testid="auth-email-input"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);

  // Fill password
  const passwordInput = page.locator('[data-testid="auth-password-input"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(password);

  // Tap the Sign in button
  const submitBtn = page.locator('[data-testid="auth-submit-btn"]');
  await submitBtn.click();

  // Wait for the Home screen to finish loading
  await page.waitForSelector('text=Total balance', { timeout: 30000 });
}

/**
 * Login using the quick demo shortcut for alice@demo.com.
 * Taps the "Alice Demo" row in the Demo Access card.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDemo(page) {
  await page.goto(APP_URL);

  // Wait for auth screen — the demo card is only visible in login mode
  await page.waitForSelector('text=Welcome back', { timeout: 30000 });

  // The demo section header text — wait for it to confirm the section rendered
  await page.waitForSelector('text=Quick Demo Access', { timeout: 30000 });

  // Tap the "Alice Demo" demo row
  await page.getByText('Alice Demo').click();

  // Wait for Home screen
  await page.waitForSelector('text=Total balance', { timeout: 30000 });
}

/**
 * Logout the currently authenticated user via the profile screen.
 * Handles the confirmation dialog that appears on Sign Out.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  // Navigate to Profile via the header avatar button
  const avatarBtn = page.locator('[data-testid="header-avatar"]');
  await avatarBtn.waitFor({ state: 'visible', timeout: 10000 });
  await avatarBtn.click();

  // Wait for the Profile / My Account screen
  await page.waitForSelector('text=My Account', { timeout: 15000 });

  // Handle browser-level dialog triggered by Alert.alert
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  // Tap Sign Out menu row
  await page.getByText('Sign Out').click();

  // If the app uses a custom in-app confirmation modal, tap the confirm button
  try {
    const confirmBtn = page.getByRole('button', { name: /sign out/i });
    if (await confirmBtn.isVisible({ timeout: 3000 })) {
      await confirmBtn.click();
    }
  } catch {
    // dialog handler above already accepted, or logout happened automatically
  }

  // Wait to land back on the Auth screen
  await page.waitForSelector('text=Welcome back', { timeout: 20000 });
}
