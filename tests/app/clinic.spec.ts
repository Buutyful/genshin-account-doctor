import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 403, body: 'Provider unavailable in this fixture' }));
});

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
  await page.getByRole('tab', { name: 'Guide recipes & custom teams', exact: true }).click();
  await expect(page.locator('.planner-options')).not.toHaveAttribute('open');
  await expect(page.locator('.character-team-search')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: 'Stygian Onslaught' }).click();
  await expect(page.getByRole('heading', { name: '3 of 3 teams in guide comparison' })).toBeVisible();
  const names = await page.locator('.planner-grid').first().locator('.team-member > strong').allTextContents();
  expect(new Set(names).size).toBe(12);
  await page.getByText('Challenge sources & matchup strategy', { exact: true }).click();
  await expect(page.locator('#guides-panel').getByText('Current published cycle', { exact: false })).toBeVisible();
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
  await page.getByRole('tab', { name: 'Guide recipes & custom teams', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mavuika Melt' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('You’re exploring a demo account.', { exact: false })).not.toBeVisible();
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
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
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('account-doctor-roster.json');
});

test('mobile navigation and panels fit the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/doctor/');
  await expect(page.getByRole('heading', { name: 'Your account, in good hands.' })).toBeVisible();
  for (const name of ['Account checkup', 'My characters', 'Team planner', 'Pull priorities', 'Synergy atlas', 'Our knowledge']) {
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

test('compact navigation stays usable when resizing from desktop to mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByRole('tab', { name: 'Guide recipes & custom teams', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Team planner', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.setViewportSize({ width: 390, height: 844 });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const name of ['Account checkup', 'My characters', 'Team planner', 'Pull priorities', 'Synergy atlas', 'Our knowledge']) {
    const item = nav.getByRole('button', { name, exact: true });
    await expect(item.locator('.nav-label')).toBeVisible();
    const box = await item.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(774);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await item.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('guided setup resets demo filters and leads to a real roster prescription', async ({ page }) => {
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  await page.getByLabel('Search characters').fill('Furina');
  await page.getByRole('button', { name: 'Hydro', exact: true }).click();
  await page.getByLabel('Owned only').check();
  await page.getByRole('navigation', { name: 'Your checkup steps' }).getByRole('button', { name: /Add characters/ }).click();
  await expect(page.getByLabel('Search characters')).toHaveValue('');
  await expect(page.getByLabel('Owned only')).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('0 characters selected', { exact: true })).toBeVisible();
  await expect(page.locator('.demo-banner')).not.toBeVisible();
  for (const name of ['Mavuika', 'Citlali', 'Iansan', 'Bennett']) {
    await page.getByLabel('Search characters').fill(name);
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  }
  const steps = page.getByRole('navigation', { name: 'Your checkup steps' });
  await steps.getByRole('button', { name: /Find your teams/ }).click();
  await page.getByRole('tab', { name: 'Guide recipes & custom teams', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mavuika Melt' })).toBeVisible();
  await page.locator('#guides-panel').getByRole('button', { name: 'View prescription', exact: false }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Before you head out' })).toBeVisible();
});

test('character details save unknowns, constellations and builds, and open focused teams', async ({ page }, testInfo) => {
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  await page.getByLabel('Search characters').fill('Iansan');
  await page.getByRole('button', { name: 'Edit Iansan details' }).click();
  const dialog = page.getByRole('dialog', { name: 'Iansan' });
  await expect(dialog.getByLabel('Constellation', { exact: true })).toHaveValue('');
  await dialog.getByLabel('Constellation', { exact: true }).selectOption('6');
  await dialog.getByLabel('Character level').fill('90');
  await dialog.getByLabel('Elemental burst', { exact: true }).fill('8');
  await dialog.getByLabel('Weapon name').fill('FavoniusLance');
  await dialog.getByLabel('Weapon level').fill('90');
  await dialog.getByLabel('Refinement').selectOption('3');
  await dialog.getByLabel('Energy Recharge').fill('210.5');
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'output/character-details.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Save details' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  await page.getByLabel('Search characters').fill('Iansan');
  await page.getByRole('button', { name: 'Edit Iansan details' }).click();
  await expect(dialog.getByLabel('Constellation', { exact: true })).toHaveValue('6');
  await expect(dialog.getByLabel('Character level')).toHaveValue('90');
  await expect(dialog.getByLabel('Energy Recharge')).toHaveValue('210.5');
  await dialog.getByRole('button', { name: 'Find teams', exact: true }).click();
  await expect(page.getByLabel('Teams for character')).toHaveValue('iansan');
  const results = page.locator('.character-team-search .team-card');
  expect(await results.count()).toBeGreaterThan(0);
  for (const card of await results.all()) await expect(card.locator('.team-member > strong').filter({ hasText: 'Iansan' })).toHaveCount(1);
  await results.first().getByRole('button', { name: 'View prescription' }).click();
  await expect(page.getByRole('heading', { name: 'Why this team is prioritized' })).toBeVisible();
  await expect(page.locator('.ranking-breakdown')).not.toBeVisible();
  await page.locator('.ranking-details summary').click();
  await expect(page.locator('.ranking-breakdown')).toBeVisible();
  await page.getByText(/Assumptions & build checks/).click();
  await expect(page.locator('.assumptions')).toContainText('constellation unknown');
  await page.locator('.guide-details summary').click();
  await expect(page.locator('.guide-details .source-list a').first()).toHaveAttribute('href', /^https:\/\//);
});

test('GOOD preview, cancel, import, equipment persistence and scanner links work', async ({ page }) => {
  await page.goto('/doctor/');
  const good = { format: 'GOOD', version: 3, source: 'Browser test scanner', characters: [{ key: 'Bennett', constellation: 6, level: 90, ascension: 6, talent: { auto: 1, skill: 8, burst: 10 } }], weapons: [{ key: 'FavoniusSword', level: 90, ascension: 6, refinement: 5, location: 'Bennett', lock: true }], artifacts: [{ setKey: 'NoblesseOblige', level: 20, rarity: 5, slotKey: 'flower', mainStatKey: 'hp', substats: [], location: 'Bennett', lock: false }] };
  const file = { name: 'scan.good', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) };
  await page.getByLabel('Import roster file').setInputFiles(file);
  await expect(page.getByRole('dialog', { name: 'Import GOOD data' })).toBeVisible();
  await expect(page.getByText('1 artifacts', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('You’re exploring a demo account.', { exact: false })).toBeVisible();
  await page.getByLabel('Import roster file').setInputFiles(file);
  await page.getByRole('button', { name: 'Apply import' }).click();
  await expect(page.getByText('1 characters selected', { exact: false })).toBeVisible();
  await page.getByText('Import from the game', { exact: false }).click();
  await expect(page.getByRole('link', { name: /Inventory Kamera/ })).toHaveAttribute('href', 'https://github.com/taiwenlee/Inventory_Kamera');
  await page.getByLabel('Search characters').fill('Bennett');
  await page.getByRole('button', { name: 'Edit Bennett details' }).click();
  await expect(page.getByLabel('Constellation', { exact: true })).toHaveValue('6');
  await expect(page.getByLabel('Weapon name')).toHaveValue('FavoniusSword');
  await page.getByText('1 equipped artifacts in your last scan').click();
  await expect(page.getByText('flower · NoblesseOblige', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('account-doctor-v1')!));
  expect(stored.owned).toEqual(['bennett']);
  expect(stored.inventory.artifacts[0].setKey).toBe('NoblesseOblige');
  await page.getByLabel('Import roster file').setInputFiles({ ...file, buffer: Buffer.from(JSON.stringify({ ...good, version: 99 })) });
  await expect(page.getByRole('status')).toContainText('Unsupported GOOD');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('account-doctor-v1')!).owned)).toEqual(['bennett']);
});

test('ranking controls and focused search fit mobile and keep unmeasured DPS unavailable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByRole('tab', { name: 'Guide recipes & custom teams', exact: true }).click();
  await page.locator('.planner-options summary').click();
  await expect(page.getByLabel('Team priority').locator('option[value="benchmark"]')).toHaveJSProperty('disabled', true);
  await page.getByLabel('Team priority').selectOption('guide');
  await expect(page.getByRole('heading', { name: '2 of 2 teams in guide comparison' })).toBeVisible();
  await page.locator('.character-team-search summary').click();
  await page.getByLabel('Teams for character').selectOption('mavuika');
  await expect(page.locator('.character-team-search .team-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'output/character-teams-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  await page.getByLabel('Search characters').fill('Mavuika');
  await page.getByRole('button', { name: 'Edit Mavuika details' }).click();
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
