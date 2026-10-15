import { test, expect } from '@playwright/test';

test('builds a readable opening, reacts to edits, and restores it after reload', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Add a requirement to calculate your odds.')).toBeVisible();
  await page.getByRole('button', { name: 'Load an example' }).click();
  await page.getByRole('button', { name: 'Starter + extender', exact: false }).click();
  await expect(page.locator('#opening-result').getByText('46.78%', { exact: true })).toBeVisible();
  await page.getByLabel('Copies of Starters').fill('0');
  await expect(page.locator('#opening-result').getByText('0.00%', { exact: true })).toBeVisible();
  await page.getByLabel('Copies of Starters').fill('12');
  await page.getByRole('button', { name: '6 · after first draw' }).click();
  await expect(page.getByLabel('Cards drawn')).toHaveValue('6');
  await page.reload();
  await expect(page.getByLabel('Cards drawn')).toHaveValue('6');
  await expect(page.getByLabel('Copies of Starters')).toHaveValue('12');
  await expect(page.locator('#opening-result').getByText('46.78%', { exact: true })).not.toBeVisible();
  await page.getByRole('link', { name: 'Skip to calculator' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('This shared link is invalid.', { exact: false })).not.toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Cards drawn')).toHaveValue('6');
});

test('suppresses stale odds for invalid input and explains the error', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Load an example' }).click();
  await page.getByRole('button', { name: 'Starter + extender', exact: false }).click();
  await expect(page.locator('#opening-result').getByText('46.78%', { exact: true })).toBeVisible();
  await page.getByLabel('Copies of Starters').fill('50');
  await expect(page.getByText('Your groups contain 59 cards, but your deck size is 40.')).toBeVisible();
  await expect(page.locator('#opening-result').getByText('46.78%', { exact: true })).not.toBeVisible();
  await page.getByLabel('Copies of Starters').fill('');
  await expect(page.getByText('Enter a whole number of copies from 0 to 100 for Starters.')).toBeVisible();
});

test('supports flexible cards, OR alternatives, and independent scenario copies', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Load an example' }).click();
  await page.getByRole('button', { name: 'Cards with flexible roles' }).click();
  await expect(page.getByLabel('How flexible cards count')).toBeVisible();
  await page.getByRole('button', { name: 'Duplicate scenario' }).click();
  await page.getByLabel('Scenario name').fill('Avoid bricks');
  await page.getByRole('button', { name: 'Add requirement', exact: true }).click();
  await page.getByLabel('Condition 1.3').selectOption('atMost');
  await page.getByLabel('Quantity 1.3', { exact: true }).fill('0');
  await page.getByLabel('Card group 1.3').selectOption('brick');
  await expect(page.getByRole('heading', { name: 'Compare your scenarios' })).toBeVisible();
  await page.getByRole('button', { name: /Add an alternative opening/ }).click();
  await page.getByRole('button', { name: 'Add requirement', exact: true }).last().click();
  await page.getByLabel('Condition 2.1').selectOption('exactly');
  await page.getByLabel('Quantity 2.1', { exact: true }).fill('2');
  await expect(page.getByText('OR', { exact: true }).first()).toBeVisible();
  await page.getByLabel('How flexible cards count').selectOption('membership');
  await expect(page.getByText('A drawn copy counts toward every selected role at once, including upper limits.', { exact: false })).toBeVisible();
});

test('round-trips an exported calculation in a new page through a share link', async ({ page, context }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Load an example' }).click();
  await page.getByRole('button', { name: 'Starter + extender', exact: false }).click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share calculation' }).click();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  const second = await context.newPage();
  await second.goto(shared);
  await expect(second.locator('#opening-result').getByText('46.78%', { exact: true })).toBeVisible();
  await second.getByLabel('Copies of Starters').fill('10');
  await second.reload();
  await expect(second.getByLabel('Copies of Starters')).toHaveValue('10');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe('opening-hand.json');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Clear calculation', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles((await exported.path())!);
  await expect(page.getByLabel('Copies of Starters')).toHaveValue('12');
  await expect(page.locator('#opening-result').getByText('46.78%', { exact: true })).toBeVisible();
});

test('has no horizontal overflow and supports the help dialog by keyboard', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Load an example' }).click();
  await page.getByRole('button', { name: 'Starter + extender', exact: false }).click();
  await page.getByLabel('Condition 1.1').selectOption('between');
  await expect(page.getByLabel('Upper quantity 1.1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const helpButton = page.getByRole('button', { name: 'How it works' });
  await helpButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(helpButton).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(helpButton).toBeFocused();
});

test('keeps current mobile odds within reach while editing, including pending and invalid states', async ({ page, isMobile }) => {
  await page.goto('./');
  const summary = page.getByRole('complementary', { name: 'Current opening probability' });
  await expect(summary).toHaveCount(0);
  await page.getByRole('button', { name: 'Load an example' }).click();
  await page.getByRole('button', { name: 'Starter + extender', exact: false }).click();
  if (!isMobile) {
    await expect(summary).toBeHidden();
    return;
  }
  await expect(summary.getByText('46.78%', { exact: true })).toBeVisible();
  const copies = page.getByLabel('Copies of Starters');
  await copies.scrollIntoViewIfNeeded();
  const summaryBox = (await summary.boundingBox())!;
  expect(summaryBox.y).toBeGreaterThanOrEqual(0);
  expect(summaryBox.y + summaryBox.height).toBeLessThan(page.viewportSize()!.height);

  let releaseWorker!: () => void;
  const workerGate = new Promise<void>(resolve => { releaseWorker = resolve; });
  await page.route('**/probability.worker-*.js', async route => { await workerGate; await route.continue(); });
  try {
    await copies.fill('0');
    await expect(summary.getByText('Calculating…', { exact: true })).toBeVisible();
    await expect(summary.getByText('46.78%', { exact: true })).toHaveCount(0);
    await expect(summary.getByText('—', { exact: true })).toBeVisible();
  } finally { releaseWorker(); }
  await expect(summary.getByText('0.00%', { exact: true })).toBeVisible();
  await copies.fill('50');
  await expect(summary.getByText('Check deck', { exact: true })).toBeVisible();
  await expect(summary.getByText('0.00%', { exact: true })).toHaveCount(0);
  await copies.fill('');
  await expect(summary.getByText('Check deck', { exact: true })).toBeVisible();
  await copies.fill('12');
  await expect(summary.getByText('46.78%', { exact: true })).toBeVisible();

  await summary.getByRole('link', { name: 'View result' }).click();
  await expect(page.locator('#opening-result')).toBeFocused();
  const resultBox = (await page.locator('#opening-result').boundingBox())!;
  const stickyBox = (await summary.boundingBox())!;
  expect(resultBox.y).toBeGreaterThanOrEqual(stickyBox.y + stickyBox.height);
  await page.getByRole('button', { name: 'Duplicate scenario' }).click();
  await page.getByLabel('Scenario name').fill('Alternative opening');
  await expect(summary.getByText('Alternative opening', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove requirement 1.2', exact: true }).click();
  await page.getByRole('button', { name: 'Remove requirement 1.1', exact: true }).click();
  await expect(summary.getByText('Add a requirement', { exact: true })).toBeVisible();
  await expect(summary.getByText('—', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Starter + extender', exact: true }).click();
  await expect(summary.getByText('46.78%', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByLabel('Scenario name').fill('An opening scenario with a long name that still fits the compact mobile summary');
  await copies.scrollIntoViewIfNeeded();
  await expect(summary.getByText('46.78%', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
