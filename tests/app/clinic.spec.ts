import { expect, test } from '@playwright/test';

test('clinic loads with demo data, accessible navigation and no simulator requests', async ({ page }) => {
  const errors: string[] = []; const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('/doctor/');
  await expect(page.getByRole('heading', { name: 'Your account, in good hands.' })).toBeVisible();
  await expect(page.getByText('You’re exploring a demo account.', { exact: false })).toBeVisible();
  await expect(page.locator('.doctor-art')).toBeVisible();
  await expect(page.locator('.team-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'View prescription' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Before you head out' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByRole('button', { name: 'Stygian Onslaught' }).click();
  await expect(page.getByRole('heading', { name: '3 of 3 teams in your plan' })).toBeVisible();
  const names = await page.locator('.planner-grid').first().locator('.team-member > strong').allTextContents();
  expect(new Set(names).size).toBe(12);
  await expect(page.getByText('General preparation · current cycle not connected')).toBeVisible();
  expect(requests.filter(url => /\.wasm|\/simulation\/|\/worker\.js/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});

test('roster editing persists and recommends an owned Mavuika recipe', async ({ page }) => {
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Add my characters', exact: true }).click();
  for (const name of ['Mavuika', 'Citlali', 'Iansan', 'Bennett']) {
    await page.getByRole('textbox', { name: 'Search characters' }).fill(name);
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  }
  await page.getByLabel('Bennett readiness').selectOption('ready');
  await page.getByRole('button', { name: 'Build my team plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mavuika Melt' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('You’re exploring a demo account.', { exact: false })).not.toBeVisible();
  await page.getByRole('button', { name: 'My characters', exact: false }).click();
  await page.getByRole('textbox', { name: 'Search characters' }).fill('Bennett');
  await expect(page.getByLabel('Bennett readiness')).toHaveValue('ready');
});

test('atlas distinguishes missing evidence and exposes source links', async ({ page }) => {
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Synergy atlas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mavuika & Citlali' })).toBeVisible();
  await expect(page.locator('.source-list a').first()).toHaveAttribute('href', /https:\/\/keqingmains.com\//);
  await page.getByLabel('Compare character').selectOption('barbara');
  await expect(page.getByRole('heading', { name: 'No recorded relationship' })).toBeVisible();
  await page.getByLabel('Atlas character').selectOption('nahida');
  await expect(page.getByRole('heading', { name: /Nahida &/ })).toBeVisible();
});

test('imports valid rosters, handles errors without changing data, and exports JSON', async ({ page }) => {
  await page.goto('/doctor/');
  const input = page.getByLabel('Import roster file');
  await input.setInputFiles({ name: 'roster.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, owned: ['mavuika', 'citlali', 'xilonen', 'bennett'], readiness: {}, mode: 'general' })) });
  await expect(page.locator('.team-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Mavuika Melt' })).toBeVisible();
  await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('status')).toContainText('unsupported roster');
  await expect(page.locator('.team-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'My characters', exact: false }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('account-doctor-roster.json');
});

test('mobile navigation and panels fit the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/doctor/');
  await expect(page.getByRole('heading', { name: 'Your account, in good hands.' })).toBeVisible();
  for (const name of ['Account checkup', 'My characters', 'Team planner', 'Synergy atlas', 'Our knowledge']) {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: false }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Account checkup', exact: true }).click();
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'output/doctor-mobile.png', fullPage: true });
});

test('desktop artwork and layout render', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/doctor/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.doctor-art')).toHaveJSProperty('complete', true);
  expect(await page.locator('.doctor-art').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'output/doctor-desktop.png', fullPage: true });
});
