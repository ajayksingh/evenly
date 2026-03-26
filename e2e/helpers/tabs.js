/**
 * Tab navigation helpers.
 *
 * The bottom tabs are rendered with role="tab" by React Navigation.
 * Their accessible name includes whitespace around the label text, so we
 * use a regex to match. Example DOM:
 *   <div role="tab" aria-label="  Activity  ">...</div>
 *
 * getByRole('tab', { name: /Activity/ }) is the robust way to click a tab.
 */

/** Click the Home tab and wait for the hero card. */
export async function goHome(page) {
  await page.getByRole('tab', { name: /Home/ }).click();
  await page.waitForSelector('text=Total balance', { timeout: 15000 });
}

/** Click the Activity tab. */
export async function goActivity(page) {
  await page.getByRole('tab', { name: /Activity/ }).click();
  await page.waitForTimeout(1500);
}

/** Click the Groups tab and wait for the FAB. */
export async function goGroups(page) {
  await page.getByRole('tab', { name: /Groups/ }).click();
  await page.waitForTimeout(1500);
}

/** Click the Friends tab. */
export async function goFriends(page) {
  await page.getByRole('tab', { name: /Friends/ }).click();
  await page.waitForTimeout(1500);
}
