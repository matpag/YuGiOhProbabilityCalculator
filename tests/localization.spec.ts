import { test, expect } from '@playwright/test';
import { translator, UI_LANGUAGES, formatProbability } from '../src/i18n/messages';
import { decodeState } from '../src/state/persistence';

for (const language of UI_LANGUAGES) {
  test(`${language}: translates the calculator, operators, help and accessible controls`, async ({ page }) => {
    const t = translator(language);
    await page.goto(`./?ui_lang=${language}`);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.getByLabel(t('language.label'))).toHaveValue(language);
    await expect(page.getByRole('heading', { name: t('intro.title') })).toBeVisible();
    await page.getByRole('button', { name: t('example.open') }).click();
    await page.getByRole('button', { name: t('example.basic'), exact: false }).click();
    await expect(page.locator('#opening-result').getByText(formatProbability(0.4678, language), { exact: true })).toBeVisible();
    await expect(page.getByLabel(t('group.copies', { name: 'Starters' }))).toHaveValue('12');
    const operators = page.getByLabel(t('requirement.condition', { position: '1.1' }), { exact: true });
    await expect(operators.locator('option')).toHaveText(['atLeast', 'exactly', 'atMost', 'between'].map(operator => t(`operator.${operator as 'atLeast' | 'exactly' | 'atMost' | 'between'}`)));
    await operators.selectOption('between');
    await expect(page.getByLabel(t('requirement.upper', { position: '1.1' }))).toBeVisible();
    await page.getByRole('button', { name: t('help.open') }).click();
    await expect(page.getByRole('dialog')).toContainText(t('help.flexibleBody'));
    await expect(page.getByRole('dialog')).toContainText(t('help.assumptionsBody'));
    await expect(page.getByRole('button', { name: t('modal.close') })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: t('help.open') })).toBeFocused();
    await page.locator('.rf-suite-switcher > summary').click();
    for (const link of await page.locator('.rf-suite-nav a').all()) expect(new URL((await link.getAttribute('href'))!).searchParams.get('ui_lang')).toBe(language);
    await page.locator('.rf-suite-switcher > summary').click();
    await page.getByLabel(t('deck.drawn'), { exact: true }).fill('');
    await expect(page.getByText(t('error.drawSize'))).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('switching language preserves results, names, edits and worker results; reload follows the new query', async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    let starts = 0;
    Object.defineProperty(window, 'probabilityWorkerStarts', { get: () => starts });
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); starts++; }
    };
    localStorage.setItem('retroformats-ui-language', 'fr');
  });
  await page.goto('./?ui_lang=en&campaign=kept#notes');
  await page.getByRole('button', { name: 'Load an example' }).click();
  await page.getByRole('button', { name: 'Starter + extender', exact: false }).click();
  await expect(page.locator('#opening-result').getByText('46.78%', { exact: true })).toBeVisible();
  const snapshot = await page.evaluate(() => localStorage.getItem('opening-hand:v1'));
  const starts = await page.evaluate(() => (window as unknown as { probabilityWorkerStarts: number }).probabilityWorkerStarts);
  for (const language of UI_LANGUAGES) {
    await page.locator('[data-ui-language-select]').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('#opening-result').getByText(formatProbability(0.4678, language), { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('opening-hand:v1'))).toBe(snapshot);
    expect(await page.evaluate(() => (window as unknown as { probabilityWorkerStarts: number }).probabilityWorkerStarts)).toBe(starts);
    const url = new URL(page.url());
    expect(url.searchParams.get('campaign')).toBe('kept'); expect(url.searchParams.get('ui_lang')).toBe(language); expect(url.hash).toBe('#notes');
  }
  await page.getByLabel(translator('fr')('deck.drawn'), { exact: true }).fill('');
  const incomplete = await page.evaluate(() => localStorage.getItem('opening-hand:v1'));
  await page.locator('[data-ui-language-select]').selectOption('de');
  await expect(page.getByLabel(translator('de')('deck.drawn'), { exact: true })).toHaveValue('');
  await expect(page.getByText(translator('de')('error.drawSize'))).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('opening-hand:v1'))).toBe(incomplete);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByLabel(translator('de')('deck.drawn'), { exact: true })).toHaveValue('');
});

test('uses the stored/browser preference and works with blocked storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'it-IT', 'de-DE'] });
    Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('./?ui_lang=unsupported');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await page.locator('[data-ui-language-select]').selectOption('es');
  await expect(page.getByRole('heading', { name: translator('es')('intro.title') })).toBeVisible();
  await expect(page.getByText(translator('es')('storage.unavailable'))).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('shared calculations include UI language without changing the v1 data payload', async ({ page, context }) => {
  await page.goto('./?ui_lang=it&source=kept');
  const t = translator('it');
  await page.getByRole('button', { name: t('example.open') }).click();
  await page.getByRole('button', { name: t('example.basic'), exact: false }).click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: t('share.open') }).click();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  const url = new URL(shared);
  expect(url.searchParams.get('ui_lang')).toBe('it'); expect(url.searchParams.get('source')).toBe('kept');
  expect(decodeState(url.hash)).toEqual(JSON.parse((await page.evaluate(() => localStorage.getItem('opening-hand:v1')))!));
  const second = await context.newPage();
  await second.goto(shared);
  await expect(second.locator('html')).toHaveAttribute('lang', 'it');
  await expect(second.locator('#opening-result').getByText('46,78%', { exact: true })).toBeVisible();
  await expect(second.getByText(t('notice.sharedLoaded'))).toBeVisible();
  await second.locator('[data-ui-language-select]').selectOption('fr');
  await expect(second.getByText(translator('fr')('notice.sharedLoaded'))).toBeVisible();
});

test('already reported worker errors translate without restarting the calculation', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      postMessage(request: { scenarios: { id: string }[] }) {
        setTimeout(() => this.onmessage?.({ data: request.scenarios.map(scenario => ({ id: scenario.id, error: 'complexity' })) } as MessageEvent), 0);
      }
      terminate() { /* Controlled worker response for this UI contract check. */ }
    } as unknown as typeof Worker;
  });
  await page.goto('./?ui_lang=en');
  await page.getByRole('button', { name: 'Load an example' }).click();
  await page.getByRole('button', { name: 'Starter + extender', exact: false }).click();
  for (const language of UI_LANGUAGES) {
    await page.locator('[data-ui-language-select]').selectOption(language);
    await expect(page.getByText(translator(language)('error.complexity'))).toBeVisible();
  }
});
