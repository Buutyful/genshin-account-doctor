import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/doctor/challenges/**', route => route.fulfill({ status: 404, body: 'Provider fixture only' }));
  await page.addInitScript(() => { localStorage.setItem('account-doctor-builder-options-v3', JSON.stringify({ activity: 'general', allowRebuild: false })); });
});

async function challengeFeed(page: Page) {
  const index = { 1: { live_begin: new Date(Date.now() - 86400000).toISOString(), live_end: new Date(Date.now() + 86400000).toISOString() } };
  const abyss = { leyline: { desc: 'Fixture blessing' }, floor: { 12: { buff: ['Fixture modifier'], room: Object.fromEntries([1, 2, 3].map(i => [i, { level: 100, first: [{ name: `Test enemy A${i}`, hp: 1000000 }], second: [{ name: `Test enemy B${i}`, hp: 2000000 }] }])) } } };
  const stygian = { level: { 6: { monster_level: 110, difficulty_config: { level: 6, name: 'Fixture difficulty', desc_list: ['Fixture rule'] }, level_config: Object.fromEntries([1, 2, 3].map(i => [i, { name: `Test boss ${i}`, monster_buff_detail_list: ['Fixture shield mechanic'], recommend_list: ['Fixture strategy advice'] }])) } } };
  await page.route('https://static.nanoka.cc/**', route => {
    const url = route.request().url();
    const data = url.endsWith('/manifest.json') ? { gi: { live: '7.1', latest: '7.2-beta' } } : /\/(tower|leyline)\.json$/.test(url) ? index : url.includes('/tower/') ? abyss : stygian;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
}

test('fetches current Abyss and Stygian, applies strategy and exports assigned encounters', async ({ page }) => {
  await challengeFeed(page);
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByRole('tab', { name: 'Guide recipes', exact: true }).click();
  await page.getByText('Challenge sources & matchup strategy', { exact: true }).click();
  await expect(page.getByText('Current published cycle', { exact: false })).toBeVisible();
  await page.getByText('Opponents & matchup strategy', { exact: true }).click();
  await expect(page.locator('.challenge-card')).toHaveCount(2);
  await expect(page.getByText('Test enemy A3', { exact: false })).toBeVisible();
  await page.getByText('Set matchup strategy', { exact: true }).first().click();
  await page.getByLabel('First half Dendro preference').selectOption('prefer');
  await page.getByText('Set matchup strategy', { exact: true }).nth(1).click();
  await page.getByLabel('Second half Pyro preference').selectOption('prefer');
  const plan = page.locator('.planner-grid').first();
  await expect(plan.locator('.team-encounter').first()).toHaveText('Assigned to First half');
  await expect(plan.locator('.team-card').first().locator('.element-Dendro')).not.toHaveCount(0);
  await expect(plan.locator('.team-card').nth(1).locator('.element-Pyro')).not.toHaveCount(0);
  const dlPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export guide prescription', exact: true }).click();
  const download = await dlPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const result = JSON.parse(Buffer.concat(chunks).toString());
  expect(result.encounterPack.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  expect(result.assignments).toHaveLength(2);
  expect(result.encounterPack.encounters[0].preferred).toContain('Dendro');
  await plan.getByRole('button', { name: 'View prescription' }).first().click();
  await page.getByText('Rotation damage calculator', { exact: true }).click();
  await page.getByLabel('Use challenge target').selectOption('0');
  await page.getByLabel('Damage time budget').fill('90');
  await expect(page.getByText('11,111 damage/sec required', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Stygian Onslaught' }).click();
  await expect(page.locator('.challenge-card')).toHaveCount(3);
  await page.getByText('Opponents & matchup strategy', { exact: true }).click();
  await expect(page.getByText('Test boss 3 · Lv. 110', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3 of 3 teams in guide comparison' })).toBeVisible();
});

test('retains valid cached encounters on failure, rejects expired cache and recovers on retry', async ({ page }) => {
  await challengeFeed(page);
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByRole('tab', { name: 'Guide recipes', exact: true }).click();
  await page.getByText('Challenge sources & matchup strategy', { exact: true }).click();
  await expect(page.getByText('Current published cycle', { exact: false })).toBeVisible();
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('button', { name: 'Refresh challenges' }).click();
  await expect(page.getByText('Using the still-current cached snapshot.', { exact: false })).toBeVisible();
  await page.evaluate(() => {
    const key = 'account-doctor-encounters-v1:Europe:abyss';
    const pack = JSON.parse(localStorage.getItem(key)!);
    pack.endsAt = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(pack));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByRole('tab', { name: 'Guide recipes', exact: true }).click();
  await page.getByText('Challenge sources & matchup strategy', { exact: true }).click();
  await expect(page.getByText('Saved lineup is expired', { exact: false })).toBeVisible();
  await expect(page.getByText('Current lineup unavailable', { exact: true })).toBeVisible();
  await expect(page.locator('.team-encounter')).toHaveCount(0);
  await challengeFeed(page);
  await page.getByRole('button', { name: 'Refresh challenges' }).click();
  await expect(page.getByText('Current published cycle', { exact: false })).toBeVisible();
  await page.getByLabel('Challenge server').selectOption('Asia');
  await expect(page.getByText('Current published cycle', { exact: false })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('account-doctor-encounters-v1:Asia:abyss'))).not.toBeNull();
});

test('creates a custom team, calculates damage, locks the composition and persists its sheet', async ({ page }, testInfo) => {
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 403, body: '' }));
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByRole('tab', { name: 'Guide recipes', exact: true }).click();
  await page.getByText('Build a custom team', { exact: true }).click();
  const members = ['raiden', 'nahida', 'xingqiu', 'barbara'];
  for (let i = 0; i < members.length; i++) await page.getByLabel(`Custom team slot ${i + 1}`).selectOption(members[i]);
  await page.getByRole('button', { name: 'Save custom team' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Mechanical synergies & conditions')).toBeVisible();
  await dialog.getByText('Rotation damage calculator', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Add damage action' }).click();
  await dialog.getByLabel('Action 1 reaction').selectOption('hyperbloom');
  await dialog.getByLabel('Raiden Shogun action Character level').fill('90');
  await dialog.getByLabel('Raiden Shogun action Elemental Mastery').fill('1000');
  await dialog.getByLabel('Raiden Shogun action Hit count').fill('20');
  for (const name of ['Nahida', 'Xingqiu', 'Barbara']) await dialog.getByLabel(`Treat ${name} as dealing no damage in this sheet`).check();
  await expect(dialog.getByText('24,741 estimated DPS')).toBeVisible();
  await dialog.getByRole('button', { name: 'Lock into plan' }).click();
  await expect(dialog.getByRole('button', { name: 'Unlock team' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 locked team · this session')).toBeVisible();
  await expect(page.locator('.planner-grid').first().locator('.team-card').filter({ hasText: 'Raiden Shogun' })).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByRole('tab', { name: 'Guide recipes', exact: true }).click();
  await page.getByText('Build a custom team', { exact: true }).click();
  await page.getByRole('button', { name: 'Inspect team' }).click();
  await page.getByText('Rotation damage calculator', { exact: true }).click();
  await expect(page.getByText('24,741 estimated DPS')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  if (testInfo.project.name === 'chromium') {
    await dialog.locator('.calculation-result').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/planner-calculator-mobile.png' });
  }
});
