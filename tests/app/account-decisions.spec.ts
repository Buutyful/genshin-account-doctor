import { openPlanningSettings } from './planner-controls';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const roster = ['nahida', 'xingqiu', 'raiden', 'zhongli', 'bennett', 'xiangling', 'yelan'];
async function open(page: Page, account?: object, general = false) {
  await page.clock.install({ time: new Date('2026-10-03T12:00:00Z') });
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 503, body: 'Live provider offline' }));
  await page.addInitScript(({ account, general }) => {
    if (account) localStorage.setItem('account-doctor-v1', JSON.stringify(account));
    if (general) localStorage.setItem('account-doctor-builder-options-v3', JSON.stringify({ activity: 'general', allowRebuild: false }));
  }, { account, general });
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  return page.getByRole('region', { name: 'Account-aware builder' });
}
async function downloadJson(page: Page, action: () => Promise<unknown>) {
  const pending = page.waitForEvent('download'); await action();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('fresh planning uses the reviewed current lineup during provider failure in all regions and both modes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const builder = await open(page);
  await openPlanningSettings(builder);
  await expect(builder.getByRole('button', { name: 'Current challenge', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(builder.locator('[data-current-cycle="true"]')).toBeVisible();
  for (const region of ['Europe', 'America', 'Asia']) {
    await builder.getByLabel('Challenge server').selectOption(region);
    const report = await downloadJson(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
    expect(report.activity).toBe('verified-current'); expect(report.pack.region).toBe(region);
    expect(report.pack.publication.id).toBe(`abyss-review-2026-10-03-${region.toLowerCase()}`);
    expect(report.pack.encounters.every((e: any) => e.stages.length === 3)).toBe(true);
    expect(report.pack.encounters[0].stages[2].enemies[0].name).toBe('Battle-Hardened Domovoy Sculptor');
    expect(report.configurations.some((r: any) => r.config.driver === 'mavuika')).toBe(true);
    expect(new Set(report.configurations.flatMap((r: any) => r.config.members)).size).toBe(8);
  }
  await page.getByLabel('Game mode', { exact: true }).selectOption('stygian');
  await expect(builder.locator('[data-current-cycle="true"]')).toContainText('Difficulty 6');
  const report = await downloadJson(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  expect(report.pack.encounters).toHaveLength(3);
  expect(report.pack.encounters[0].requirements[0].tags).toEqual(['cryo']);
  expect(report.pack.encounters[1].requirements[0].tags).toEqual(['stellar-glimmer']);
  expect(report.configurations).toHaveLength(3);
  expect(new Set(report.configurations.flatMap((r: any) => r.config.members)).size).toBe(12);
  expect(errors).toEqual([]);
});

test('recommended and two alternatives are complete distinct allocations with readable rotation and build details', async ({ page }, testInfo) => {
  const builder = await open(page, undefined, true);
  await expect(page.getByRole('heading', { name: 'Team planner', exact: true })).toBeVisible();
  await expect(page.locator('#main .checkup-journey')).toHaveCount(0);
  await expect(page.locator('#main')).not.toContainText('Better together');
  await expect(page.locator('#main')).not.toContainText('THE TEAM CLINIC');
  await expect(page.locator('.configuration-card .team-explanation')).toHaveCount(0);
  await expect(builder.locator('.team-build-details[open]')).toHaveCount(0);
  const sidebarSelection = await page.getByRole('button', { name: 'Team planner', exact: true }).evaluate(button => {
    const s = getComputedStyle(button);
    return { shadow: s.boxShadow, edges: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth] };
  });
  expect(sidebarSelection).toEqual({ shadow: 'none', edges: ['0px', '0px', '0px', '0px'] });
  const tabSelection = await page.getByRole('tab', { name: 'Account plans', exact: true }).evaluate(button => {
    const s = getComputedStyle(button);
    return { edge: s.borderBottomWidth, decoration: s.textDecorationLine };
  });
  expect(tabSelection).toEqual({ edge: '1px', decoration: 'none' });
  const choices = builder.getByLabel('Complete account plans');
  await expect(choices.locator('button')).toHaveCount(3);
  const before = await builder.locator('.configuration-card').evaluateAll(rows => rows.map(r => r.getAttribute('data-composition-id')).sort());
  await choices.locator('button').nth(1).click();
  const after = await builder.locator('.configuration-card').evaluateAll(rows => rows.map(r => r.getAttribute('data-composition-id')).sort());
  expect(after).not.toEqual(before);
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  await choices.getByRole('button', { name: 'Recommended', exact: false }).click();
  expect(await builder.locator('.configuration-card').evaluateAll(rows => rows.map(r => r.getAttribute('data-composition-id')).sort())).toEqual(before);
  await expect(builder.locator('.rotation-preview')).toHaveCount(2);
  await builder.locator('.configuration-card').first().getByRole('button', { name: 'View details', exact: true }).click();
  await expect(builder.locator('.configuration-card').first().getByRole('heading', { name: 'Build requirements', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('team-plans-desktop.png'), fullPage: true });
  await page.getByLabel('Game mode', { exact: true }).selectOption('stygian');
  await page.getByRole('button', { name: 'Pull priorities', exact: true }).click();
  await builder.getByLabel('Potential pull').selectOption('sucrose');
  const comparison = page.getByRole('article', { name: 'Sucrose pull comparison', exact: true });
  await expect(comparison).toContainText('Save');
  await expect(comparison.locator('.pull-summary')).toContainText('Team option');
  await expect(comparison.locator('.pull-summary')).toContainText('Sucrose');
  // Covered alternatives should not be described as missing their partners.
  await expect(comparison.getByText('Still missing:', { exact: true })).toHaveCount(0);
});

test('Who to pull automatically ranks the roster and a C0 pull reassigns the whole account without changing ownership', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const account = { version: 1, owned: roster, readiness: {}, mode: 'abyss', demo: false };
  const builder = await open(page, account, true);
  await page.getByRole('button', { name: 'Pull priorities', exact: true }).click();
  await expect(page.locator('[data-comparison-state="complete"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByLabel('Pull shortlist').locator('button')).toHaveCount(3);
  await expect(page.getByLabel('Pull shortlist').locator('button').first()).toContainText('Pull priority');
  await expect(page.locator('.pull-result')).toBeVisible();
  await builder.getByLabel('Potential pull').selectOption('kuki');
  await expect(page.getByRole('article', { name: 'Kuki Shinobu pull comparison', exact: true })).toContainText('Pull priority');
  await expect(page.locator('.pull-summary')).toContainText('Kuki Shinobu');
  const afterLineups = page.locator('.plan-comparison > section').nth(1).locator('.visual-lineup');
  await expect(afterLineups).toHaveCount(2);
  // Keep each composition in one row; inherited span styles must not stack its slots.
  const slots = await afterLineups.first().locator('.lineup-slot').evaluateAll(items => items.map(item => item.getBoundingClientRect().top));
  expect(new Set(slots).size).toBe(1);
  await expect(afterLineups.nth(1).getByLabel('Added', { exact: true })).toHaveCount(4);
  await expect(page.locator('.plan-comparison > section').first().getByLabel('Added', { exact: true })).toHaveCount(0);
  const result = await downloadJson(page, () => builder.getByRole('button', { name: 'Export pull comparison', exact: true }).click());
  const kuki = result.pulls.find((r: any) => r.character === 'kuki');
  expect(result.baseline.assignments).toHaveLength(1); expect(kuki.after.assignments).toHaveLength(2);
  expect(kuki.account.constellations.kuki).toBe(0);
  expect(kuki.investment.some((t: any) => t.character === 'kuki' && t.target === 90)).toBe(true);
  expect(new Set(kuki.after.assignments.flatMap((r: any) => r.config.members)).size).toBe(8);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('account-doctor-v1')!).owned)).toEqual(roster);
  await expect(page.locator('.banner-status')).toContainText('Banner unverified');
  await page.screenshot({ path: testInfo.outputPath('pull-advice-desktop.png'), fullPage: true });
});

test('checkup opens pull advice and known build gaps lead to build first on mobile', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const account = { version: 1, owned: ['nahida', 'xingqiu', 'yelan', 'kuki'], readiness: {}, mode: 'abyss', demo: false, details: { kuki: { level: 50, weapon: { key: 'IronSting', level: 20 }, talents: { skill: 2 }, elementalMastery: 100 } } };
  const builder = await open(page, account, true);
  await page.getByRole('button', { name: 'Account checkup', exact: true }).click();
  await page.getByRole('button', { name: 'Who should I pull for this roster?', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Pull priorities', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-comparison-state="complete"]')).toBeVisible({ timeout: 45_000 });
  await builder.getByLabel('Potential pull').selectOption('eula');
  await expect(page.getByRole('article', { name: 'Eula pull comparison', exact: true })).toContainText('Build first');
  await expect(page.locator('.plan-comparison')).toContainText('50 → 90');
  await page.getByText('Builds required', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pull-advice-mobile.png'), fullPage: true });
});

test('expired source review falls back to general advice without a current-cycle claim', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T12:00:00Z') });
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 503, body: 'Offline' }));
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  const builder = page.getByRole('region', { name: 'Account-aware builder' });
  await openPlanningSettings(builder);
  await expect(builder.getByText('No verified live challenge is available', { exact: false })).toBeVisible();
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  const report = await downloadJson(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  expect(report.activity).toBe('general-exploration'); expect(report.pack).toBeUndefined();
});

test('Pull priorities has its own page and completed advice survives navigation and reload, with build and roster invalidation', async ({ page }) => {
  test.setTimeout(90_000);
  const account = { version: 1, owned: roster, readiness: {}, mode: 'abyss', demo: false };
  await open(page, account, true);
  await expect(page.getByRole('tab', { name: 'Who to pull', exact: true })).toHaveCount(0);
  const pulls = page.getByRole('button', { name: 'Pull priorities', exact: true });
  await pulls.click();
  await expect(pulls).toHaveAttribute('aria-current', 'page');
  const complete = page.locator('[data-comparison-state="complete"]');
  await expect(complete).toHaveAttribute('data-comparison-source', 'calculated', { timeout: 45_000 });
  const ranking = await page.getByLabel('Pull shortlist').innerText();
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await pulls.click();
  await expect(complete).toHaveAttribute('data-comparison-source', 'cache');
  expect(await page.getByLabel('Pull shortlist').innerText()).toBe(ranking);
  await page.reload();
  await pulls.click();
  await expect(complete).toHaveAttribute('data-comparison-source', 'cache');
  expect(await page.getByLabel('Pull shortlist').innerText()).toBe(ranking);
  await page.getByLabel('Potential pull').selectOption('kuki');
  const cached = await downloadJson(page, () => page.getByRole('button', { name: 'Export pull comparison', exact: true }).click());
  const kuki = cached.pulls.find((r: any) => r.character === 'kuki');
  expect(kuki.account.constellations.kuki).toBe(0);
  expect(kuki.after.assignments).toHaveLength(2);
  expect(new Set(kuki.after.assignments.flatMap((r: any) => r.config.members)).size).toBe(8);
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  await page.getByLabel('Search characters').fill('Nahida');
  await page.getByRole('button', { name: 'Edit Nahida details', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Character level').fill('90');
  await page.getByRole('dialog').getByRole('button', { name: 'Save details', exact: true }).click();
  await pulls.click();
  await expect(complete).toHaveAttribute('data-comparison-source', 'calculated', { timeout: 45_000 });
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  await page.getByLabel('Search characters').fill('Kuki');
  await page.getByRole('button', { name: 'Add Kuki Shinobu', exact: true }).click();
  await pulls.click();
  await expect(complete).toHaveAttribute('data-comparison-source', 'calculated', { timeout: 45_000 });
  await expect(page.getByLabel('Potential pull').locator('option[value="kuki"]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('account-doctor-v1')!).owned)).toContain('kuki');
  // A deployed evaluation update must reject an older persisted format.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('account-doctor-pull-comparisons', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('comparisons', 'readwrite'), store = transaction.objectStore('comparisons');
      const all = store.getAll();
      all.onsuccess = () => all.result.forEach(entry => store.put({ ...entry, revision: 0 }));
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }));
  await page.reload();
  await pulls.click();
  await expect(complete).toHaveAttribute('data-comparison-source', 'calculated', { timeout: 45_000 });
});

test('mobile results appear before expanded settings and Stygian rows identify their opponents', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const builder = await open(page);
  await expect(builder.locator('.builder-settings')).not.toHaveAttribute('open', '');
  await expect(builder.getByLabel('Complete account plans').getByRole('button', { name: 'Recommended', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(builder.getByLabel('Game mode', { exact: true })).not.toBeVisible();
  await builder.locator('.builder-settings > summary').click();
  await builder.getByLabel('Game mode', { exact: true }).selectOption('stygian');
  await expect(builder.locator('.configuration-card')).toHaveCount(3);
  await expect(builder.locator('.team-opponent').first()).toContainText('Secret Source Automaton');
  await expect(builder.locator('.team-opponent').nth(1)).toContainText('Domovoy Sculptor');
  await expect(builder.locator('.team-opponent').nth(2)).toContainText('Guardian Blade');
  await builder.locator('.builder-settings > summary').click();
  await expect(builder.getByLabel('Game mode', { exact: true })).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('team viewer inspects recorded builds and rotation steps without changing the allocation', async ({ page }) => {
  const builder = await open(page, { version: 1, owned: ['nahida', 'xingqiu', 'kuki', 'zhongli'], readiness: {}, mode: 'general', demo: false, details: { kuki: { level: 90, elementalMastery: 850, weapon: { key: 'IronSting', level: 90 } } } }, true);
  const team = builder.locator('.configuration-card').first();
  const composition = await team.getAttribute('data-composition-id');
  await team.getByRole('button', { name: 'Inspect Kuki Shinobu build', exact: true }).click();
  await expect(team.locator('.viewer-inspector')).toContainText('IronSting');
  await expect(team.locator('.viewer-inspector')).toContainText('850');
  await expect(team.locator('.viewer-inspector')).toContainText('Unknown');
  await team.getByRole('button', { name: 'Close build inspection' }).click();
  await expect(team.locator('.viewer-inspector')).toBeHidden();
  await team.getByRole('button', { name: 'View details', exact: true }).click();
  await team.locator('.viewer-rotation button').first().focus();
  await page.keyboard.press('Enter');
  await expect(team.locator('.viewer-inspector')).toBeVisible();
  await expect(team.locator('.viewer-action')).not.toBeEmpty();
  expect(await team.getAttribute('data-composition-id')).toBe(composition);
  for (const width of [1920, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const positions = await team.locator('.viewer-member').evaluateAll(items => items.map(item => item.getBoundingClientRect().top));
    expect(new Set(positions).size).toBe(1);
  }
});
