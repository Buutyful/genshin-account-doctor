import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 503, body: 'General planning fixture' }));
  await page.route('**/doctor/challenges/**', route => route.fulfill({ status: 404, body: 'General planning fixture' }));
  await page.addInitScript(() => localStorage.setItem('account-doctor-builder-options-v3', JSON.stringify({ activity: 'general', allowRebuild: false })));
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
});

test('selected reference layout keeps both portrait rows and the compact settings rail in the desktop viewport', async ({ page }, testInfo) => {
  const builder = page.getByRole('region', { name: 'Account-aware builder' });
  await expect(page.getByText('Demo account', { exact: true })).toBeVisible();
  await expect(builder.locator('.builder-preferences')).not.toHaveAttribute('open', '');
  const frame = await builder.locator('.builder-results').boundingBox();
  const rail = await builder.locator('.builder-settings').boundingBox();
  expect(frame!.x).toBeCloseTo(228, 0); expect(frame!.y).toBeCloseTo(213, 0);
  expect(Math.abs(frame!.width - 974)).toBeLessThan(2);
  expect(frame!.y + frame!.height).toBeLessThan(1012);
  expect(rail!.x).toBeCloseTo(1215, 0); expect(rail!.width).toBeCloseTo(307, 0);
  expect(Math.abs(rail!.height - 284)).toBeLessThan(3);
  const portraits = builder.locator('.viewer-portrait');
  await expect(portraits).toHaveCount(8);
  const boxes = await portraits.evaluateAll(items => items.map(item => {
    const r = item.getBoundingClientRect(); return { y: r.y, height: r.height };
  }));
  expect(new Set(boxes.slice(0, 4).map(r => r.y)).size).toBe(1);
  expect(new Set(boxes.slice(4).map(r => r.y)).size).toBe(1);
  expect(Math.abs(boxes[0].y - 343)).toBeLessThan(2);
  expect(Math.abs(boxes[4].y - 704)).toBeLessThan(3);
  expect(boxes.every(r => r.height === 220)).toBe(true);
  await expect(builder.locator('.viewer-rotation').first()).toBeHidden();
  expect((await page.request.get('/doctor/art/parchment-clinic-reference.png')).ok()).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('parchment-clinic-desktop.png') });
  for (const width of [820, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1024 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const controls = builder.locator('.configuration-card').first().getByRole('button', { name: 'View details', exact: true });
    await expect(controls).toBeVisible();
    const controlBox = await controls.boundingBox();
    expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(width);
  }
});

test('reference controls change real plans, toggle locks and details, and lead to characters and evidence', async ({ page }) => {
  const builder = page.getByRole('region', { name: 'Account-aware builder' });
  const first = builder.locator('.configuration-card').first();
  const choices = builder.getByLabel('Complete account plans');
  const original = await first.getAttribute('data-configuration-id');
  await first.getByRole('button', { name: 'Lock team 1', exact: true }).click();
  const locked = builder.locator(`.configuration-card[data-configuration-id="${original}"]`);
  await expect(locked.getByRole('button', { name: /^Unlock team/ })).toHaveAttribute('aria-pressed', 'true');
  if (await choices.locator('button').count() > 1) await choices.locator('button').nth(1).click();
  await expect(locked).toBeVisible();
  await locked.getByRole('button', { name: /^Unlock team/ }).click();
  await expect(builder.getByRole('button', { name: /^Unlock team/ })).toHaveCount(0);
  await first.getByRole('button', { name: /^Swap characters/ }).click();
  await expect(first.getByLabel('Replace teammate in configuration 1')).toBeVisible();
  await first.getByRole('button', { name: /^Swap characters/ }).click();
  await expect(first.locator('.configuration-feedback')).toBeHidden();
  await first.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(first.locator('.viewer-rotation')).toBeVisible();
  await expect(first.getByRole('heading', { name: 'Build requirements', exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Hide details', exact: true }).click();
  await expect(first.locator('.viewer-rotation')).toBeHidden();
  const modes = page.getByRole('group', { name: 'Planning mode', exact: true });
  await modes.getByRole('button', { name: 'One team', exact: true }).click();
  await expect(builder.getByLabel('Game mode', { exact: true })).toHaveValue('general');
  await expect(builder.locator('.configuration-card')).toHaveCount(1);
  await builder.getByLabel('Game mode', { exact: true }).selectOption('abyss');
  await expect(modes.getByRole('button', { name: 'Spiral Abyss', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  await builder.getByRole('button', { name: 'Open characters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'My characters', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await builder.getByRole('button', { name: /Guide evidence/ }).click();
  await expect(page.getByRole('button', { name: 'Our knowledge', exact: true })).toHaveAttribute('aria-current', 'page');
});
