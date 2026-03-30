/**
 * Shared authentication helpers for Playwright E2E tests.
 *
 * The Evenly app uses Google OAuth for real auth and demo accounts for testing.
 * Elements use testID props mapped to data-testid by Expo's web renderer.
 */

export const APP_URL = '/evenly/';

/**
 * Skip onboarding if it appears (first-time visit with no localStorage).
 */
export async function skipOnboardingIfPresent(page) {
  // Wait for the page to render something meaningful
  await Promise.race([
    page.waitForSelector('text=Skip', { timeout: 10000 }),
    page.waitForSelector('text=Continue with Google', { timeout: 10000 }),
    page.waitForSelector('text=Get Started', { timeout: 10000 }),
  ]).catch(() => {});
  // If onboarding "Skip" button is visible, click it
  const skipBtn = page.getByText('Skip');
  if (await skipBtn.isVisible().catch(() => false)) {
    await skipBtn.click();
    // Wait for auth screen to appear
    await page.waitForSelector('text=Continue with Google', { timeout: 15000 }).catch(() => {});
    return;
  }
  // If on last onboarding page, click Get Started
  const getStartedBtn = page.getByText('Get Started');
  if (await getStartedBtn.isVisible().catch(() => false)) {
    await getStartedBtn.click();
    await page.waitForSelector('text=Continue with Google', { timeout: 15000 }).catch(() => {});
  }
}

/**
 * Login using the quick demo shortcut for alice@demo.com.
 * Taps the "Alice Demo" row in the Demo Access card.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDemo(page) {
  await page.goto(APP_URL);

  // Handle onboarding if first visit
  await skipOnboardingIfPresent(page);

  // Wait for auth screen — Google button signals it's ready
  await page.waitForSelector('text=Continue with Google', { timeout: 30000 });

  // Wait for demo section
  await page.waitForSelector('text=Quick Demo Access', { timeout: 30000 });

  // Tap the "Alice Demo" demo row
  await page.getByText('Alice Demo').click();

  // Wait for Home screen
  await page.waitForSelector('text=Total balance', { timeout: 30000 });
}

/**
 * Login as Bob Demo via the demo card.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDemoB(page) {
  await page.goto(APP_URL);

  await skipOnboardingIfPresent(page);
  await page.waitForSelector('text=Continue with Google', { timeout: 30000 });
  await page.waitForSelector('text=Quick Demo Access', { timeout: 30000 });

  await page.getByText('Bob Demo').click();

  await page.waitForSelector('text=Total balance', { timeout: 30000 });
}

/**
 * Alias for loginAsDemo — kept for backward compatibility with specs
 * that call loginAs(page, email, password).
 * Since OAuth can't be automated, all loginAs calls now use Alice Demo.
 */
export async function loginAs(page, _email, _password) {
  await loginAsDemo(page);
}

/**
 * Logout the currently authenticated user via the profile screen.
 * Handles the confirmation dialog that appears on Sign Out.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  const avatarBtn = page.locator('[data-testid="header-avatar"]');
  await avatarBtn.waitFor({ state: 'visible', timeout: 10000 });
  await avatarBtn.click();

  await page.waitForSelector('text=Profile', { timeout: 15000 });

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.getByText('Sign Out').click();

  try {
    const confirmBtn = page.getByRole('button', { name: /sign out/i });
    if (await confirmBtn.isVisible({ timeout: 3000 })) {
      await confirmBtn.click();
    }
  } catch {
    // dialog handler above already accepted
  }

  // Wait to land back on the Auth screen
  await page.waitForSelector('text=Continue with Google', { timeout: 20000 });
}
