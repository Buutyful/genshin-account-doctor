import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import providerShapes from '../fixtures/nanoka-response-shapes.json' with { type: 'json' };

// Legacy preference flows use their own provider fixtures. Production publications
// and the fresh current-cycle default are exercised in account-decisions.spec.ts.
test.beforeEach(async ({ page }) => {
  await page.route('**/doctor/challenges/**', route => route.fulfill({ status: 404, body: 'No fixture publication' }));
  await page.addInitScript(() => {
    if (!localStorage.getItem('account-doctor-builder-options-v3')) localStorage.setItem('account-doctor-builder-options-v3', JSON.stringify({ activity: 'general', allowRebuild: false }));
  });
});

async function openBuilder(page: Page) {
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 503, body: 'Fixture provider failure' }));
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Team plans', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#guides-panel')).not.toBeVisible();
  const builder = page.getByRole('region', { name: 'Account-aware builder' });
  if (!await builder.locator('.builder-settings').evaluate(el => (el as HTMLDetailsElement).open)) await builder.locator('.builder-settings > summary').click();
  await expect(builder.getByRole('button', { name: 'General', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  return builder;
}
async function jsonDownload(page: Page, action: () => Promise<unknown>) {
  const event = page.waitForEvent('download'); await action(); const download = await event;
  const stream = await download.createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('challenge setup works during provider failure, persists matchups and exports an honest preparation plan', async ({ page }) => {
  const builder = await openBuilder(page);
  await builder.getByRole('button', { name: 'Custom targets', exact: true }).click();
  await builder.getByLabel('First half opponents').fill('My first-half bosses');
  await builder.getByRole('group', { name: 'First half team preferences', exact: true }).getByRole('button', { name: 'Hydro', exact: true }).click();
  await builder.getByRole('group', { name: 'Second half team preferences', exact: true }).getByRole('button', { name: 'Pyro', exact: true }).click();
  await expect(builder.locator('.configuration-card').first().locator('.matchup-fit')).toContainText('Hydro');
  await expect(builder.locator('.configuration-card').nth(1).locator('.matchup-fit')).toContainText('Pyro');
  const report = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  expect(report.activity).toBe('challenge-preparation');
  expect(report.pack).toBeUndefined();
  expect(report.practiceTargets[0].stages).toHaveLength(3);
  expect(report.practiceTargets[0].stages[2].enemies[0].name).toBe('My first-half bosses');
  await page.reload();
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await expect(builder.getByLabel('First half opponents')).toHaveValue('My first-half bosses');
  await expect(builder.getByRole('group', { name: 'First half team preferences', exact: true }).getByRole('button', { name: 'Hydro', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await builder.getByText('Backup & restore account workspace', { exact: true }).click();
  const backup = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export workspace backup', exact: true }).click());
  expect(backup.challengeStrategy.drafts['Europe:abyss-practice-0'].opponents).toBe('My first-half bosses');
  await builder.getByLabel('Challenge server').selectOption('Asia');
  await expect(builder.getByLabel('First half opponents')).toHaveValue('');
  await builder.getByLabel('Workspace backup file').setInputFiles({ name: 'strategy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await builder.getByRole('button', { name: 'Apply workspace restore', exact: true }).click();
  await expect(builder.getByLabel('First half opponents')).toHaveValue('My first-half bosses');
});

test('reference Stygian lineups are useful without being promoted to verified current challenges', async ({ page }) => {
  await page.route('https://static.nanoka.cc/**', route => {
    const url = route.request().url();
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(url.endsWith('/manifest.json') ? { gi: { live: '7.1' } } : url.endsWith('/tower.json') ? providerShapes.towerIndex : url.endsWith('/leyline.json') ? providerShapes.leylineIndex : url.includes('/tower/') ? providerShapes.towerDetail : providerShapes.leylineDetail) });
  });
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await page.getByLabel('Game mode', { exact: true }).selectOption('stygian');
  const builder = page.getByRole('region', { name: 'Account-aware builder' });
  await expect(builder.locator('.configuration-card')).toHaveCount(3);
  await builder.getByRole('button', { name: 'Custom targets', exact: true }).click();
  await expect(builder.locator('.challenge-target').first()).toContainText('Secret Source Automaton');
  const report = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  expect(report.activity).toBe('challenge-preparation');
  expect(report.reference.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  await builder.getByRole('button', { name: 'Current challenge', exact: true }).click();
  await expect(builder.locator('.configuration-card')).toHaveCount(3);
  await expect(builder.getByText('No verified live challenge is available', { exact: false })).toBeVisible();
  await builder.getByRole('button', { name: 'General', exact: true }).click();
  await expect(builder.locator('.configuration-card')).toHaveCount(3);
});

test('primary character focus and visible team alternatives change the account plan and undo cleanly', async ({ page }) => {
  const builder = await openBuilder(page);
  await builder.getByText('Preferences, builds & exclusions', { exact: true }).click();
  await builder.getByLabel('Build around a character').selectOption('neuvillette');
  await builder.getByRole('button', { name: 'Build around them', exact: true }).click();
  await expect(builder.locator('.configuration-grid')).toContainText('Neuvillette');
  const before = await builder.locator('.configuration-card').first().getAttribute('data-composition-id');
  await builder.locator('.configuration-card').first().getByText('Change this team', { exact: true }).click();
  await builder.locator('.configuration-card').first().getByRole('button', { name: 'Another team', exact: true }).click();
  await expect(builder.locator(`.configuration-card[data-composition-id="${before}"]`)).toHaveCount(0);
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  await builder.getByRole('button', { name: 'Undo last feedback', exact: true }).click();
  await expect(builder.locator(`.configuration-card[data-composition-id="${before}"]`)).toHaveCount(1);
  await builder.getByRole('button', { name: 'Browse team options', exact: true }).click();
  await expect(builder.locator('.builder-alternatives article')).not.toHaveCount(0);
});

test('an empty personal account shows a useful setup state instead of a broken challenge panel', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('account-doctor-v1', JSON.stringify({ version: 1, owned: [], readiness: {}, mode: 'abyss', demo: false }));
    localStorage.setItem('account-doctor-builder-options-v1', JSON.stringify({ activity: 'current', allowRebuild: false }));
  });
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  const builder = page.getByRole('region', { name: 'Account-aware builder' });
  await expect(builder.getByRole('heading', { name: 'Add at least four characters', exact: true })).toBeVisible();
  await expect(builder.getByRole('button', { name: 'General', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Endgame challenges' })).not.toBeVisible();
});

test('opens with a useful account plan during feed failure and exposes whole-team rotation checks', async ({ page }) => {
  const builder = await openBuilder(page);
  await expect(builder.getByRole('button', { name: 'General', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const card = builder.locator('.configuration-card').first();
  await card.getByText('Build & rotation', { exact: true }).click();
  await expect(card.getByText('proposed loop.', { exact: false })).toBeVisible();
  await card.getByText('Sources & checks', { exact: true }).click();
  await expect(card.locator('[data-state="unresolved"]')).not.toHaveCount(0);
  await expect(card.getByText('Particle catches', { exact: false }).first()).toBeVisible();
  const report = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  expect(report.activity).toBe('general-exploration');
  expect(report.configurations).toHaveLength(2);
  expect(new Set(report.configurations.flatMap((r: any) => r.config.members)).size).toBe(8);
  expect(report.configurations[0].config.id).not.toBe(report.configurations[0].config.compositionId);
});

test('skipping preserves members for other teams and undo restores the original proposal', async ({ page }) => {
  const builder = await openBuilder(page);
  const first = builder.locator('.configuration-card').first();
  const skipped = await first.getAttribute('data-composition-id');
  await first.getByText('Change this team', { exact: true }).click();
  await first.getByRole('button', { name: 'Skip this composition', exact: true }).click();
  await expect(builder.locator(`.configuration-card[data-composition-id="${skipped}"]`)).toHaveCount(0);
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  await expect(builder.locator('.plan-change')).toContainText('replaced');
  await builder.getByRole('button', { name: 'Undo last feedback', exact: true }).click();
  await expect(builder.locator(`.configuration-card[data-composition-id="${skipped}"]`)).toHaveCount(1);
});

test('account exclusions persist, can be removed specifically, and workspace restore rechecks them', async ({ page }) => {
  const builder = await openBuilder(page);
  await builder.getByText('Preferences, builds & exclusions', { exact: true }).click();
  await builder.getByLabel('Feedback scope').selectOption('account');
  await builder.getByLabel('Builder excluded character').selectOption('xingqiu');
  await builder.getByRole('button', { name: 'Apply exclusion', exact: true }).click();
  await expect(builder.locator('.configuration-grid')).not.toContainText('Xingqiu');
  await builder.getByText('Backup & restore account workspace', { exact: true }).click();
  const backup = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export workspace backup', exact: true }).click());
  expect(backup.preferences).toHaveLength(1);
  await builder.getByRole('button', { name: 'Reset builder preferences', exact: true }).click();
  await builder.getByLabel('Workspace backup file').setInputFiles({ name: 'workspace.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(builder.getByRole('heading', { name: 'Review workspace restore' })).toBeVisible();
  await builder.getByRole('button', { name: 'Apply workspace restore', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await expect(builder.getByText('Exclude Xingqiu · account', { exact: true })).toBeVisible();
  await expect(builder.locator('.configuration-grid')).not.toContainText('Xingqiu');
  await builder.getByRole('button', { name: 'Remove preference: Exclude Xingqiu', exact: true }).click();
  await expect(builder.locator('.active-builder-preferences')).toContainText('Active constraints (0)');
});

test('keeps selected core for a variant or gives a specific removable conflict', async ({ page }) => {
  const builder = await openBuilder(page);
  const card = builder.locator('.configuration-card').first();
  const composition = await card.getAttribute('data-composition-id');
  await card.getByText('Change this team', { exact: true }).click();
  await card.getByRole('button', { name: 'Same-core variant', exact: true }).click();
  await expect(builder.locator(`.configuration-card[data-composition-id="${composition}"]`)).toHaveCount(0);
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  // A rerender can leave this control under the pointer. Hover must not move it.
  const exportButton = builder.getByRole('button', { name: 'Export plan', exact: true });
  await exportButton.hover();
  await expect(exportButton).toHaveCSS('transform', 'none');
  const report = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  const core = report.preferences.find((p: any) => p.action.kind === 'variant').action.core;
  expect(report.configurations.some((r: any) => core.every((id: string) => r.config.members.includes(id)))).toBe(true);
  await builder.getByRole('button', { name: 'Undo last feedback', exact: true }).click();
  const restored = builder.locator('.configuration-card').first();
  await restored.getByText('Change this team', { exact: true }).click();
  await restored.getByRole('button', { name: 'Lock configuration', exact: true }).click();
  await restored.getByRole('button', { name: 'Skip this composition', exact: true }).click();
  await expect(builder.getByText('Conflicting preferences', { exact: true })).toBeVisible();
  await builder.getByRole('button', { name: 'Undo last feedback', exact: true }).click();
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
});

test('imports evidence only through preview and keeps fixtures and unpermitted records out of learning', async ({ page }) => {
  const builder = await openBuilder(page);
  await builder.getByText('Data & sources', { exact: true }).click();
  await builder.getByText('Reviewed player clears & learning boundary', { exact: true }).click();
  await builder.getByLabel('Reviewed clear publication file').setInputFiles({ name: 'empty-permission-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, sourceId: 'stygian-moe', records: [] })) });
  await expect(builder.getByRole('heading', { name: 'Review clear publication' })).toBeVisible();
  await builder.getByRole('button', { name: 'Import evidence records', exact: true }).click();
  const manifest = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export evaluation manifest', exact: true }).click());
  expect(manifest.modelAvailable).toBe(false);
  expect(manifest.withheldLabels).toContain('success probability');
  expect(manifest.train).toEqual([]);
  await builder.getByText('Backup & restore account workspace', { exact: true }).click();
  await builder.getByLabel('Workspace backup file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"AccountDoctorWorkspace","version":1}') });
  await expect(builder.getByRole('heading', { name: 'Review workspace restore' })).toHaveCount(0);
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
});

test('open generation, controls and exported report fit a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const builder = await openBuilder(page);
  await builder.locator('.configuration-card').first().getByText('Build & rotation', { exact: true }).click();
  await builder.locator('.configuration-card').first().getByText('Change this team', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await builder.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('account-builder-mobile.png'), fullPage: true });
});

test('an imported account produces a sourced configuration absent from recipes and reacts to a build edit', async ({ page }) => {
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 503, body: 'Fixture failure' }));
  await page.goto('/doctor/');
  const account = { version: 1, owned: ['nahida', 'xingqiu', 'kuki', 'fischl'], readiness: {}, mode: 'general', details: { kuki: { level: 80, elementalMastery: 500 } } };
  await page.getByLabel('Import roster file').setInputFiles({ name: 'pilot-account.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(account)) });
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  const builder = page.getByRole('region', { name: 'Account-aware builder' }), card = builder.locator('.configuration-card').first();
  await expect(card.getByText('TEAM 1', { exact: true })).toBeVisible();
  await expect(card.getByText('Role-based team', { exact: true })).toBeVisible();
  const oldId = await card.getAttribute('data-configuration-id');
  await card.getByText('Build & rotation', { exact: true }).click();
  await card.getByText('Sources & checks', { exact: true }).click();
  await expect(card.getByText('Composition absent from the guide recipe set', { exact: false })).toBeVisible();
  await expect(card.locator('[data-state="contradicted"]').filter({ hasText: 'level 80' })).toHaveCount(1);
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  await page.getByLabel('Search characters').fill('Kuki');
  await page.getByRole('button', { name: 'Edit Kuki Shinobu details', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Character level').fill('90');
  await page.getByRole('dialog').getByRole('button', { name: 'Save details', exact: true }).click();
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await expect(card).not.toHaveAttribute('data-configuration-id', oldId!);
  await card.getByText('Build & rotation', { exact: true }).click();
  await card.getByText('Sources & checks', { exact: true }).click();
  await expect(card.locator('[data-state="supported"]').filter({ hasText: 'level 90' })).toHaveCount(1);
});

test('a requested replacement retains the other three members and a different playstyle changes the core', async ({ page }) => {
  const builder = await openBuilder(page);
  const original = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  const firstConfig = original.configurations[0].config;
  const card = builder.locator('.configuration-card').first();
  await card.getByText('Change this team', { exact: true }).click();
  const selector = card.getByLabel('Replace teammate in configuration 1');
  const teammate = await selector.inputValue();
  await expect(selector.locator(`option[value="${teammate}"]`)).not.toBeDisabled();
  // Uncovered replacements must be explained before a request can empty the plan.
  await expect(selector.locator('option:disabled')).not.toHaveCount(0);
  await card.getByRole('button', { name: 'Replace selected teammate', exact: true }).click();
  const replaced = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  const retained = firstConfig.members.filter((id: string) => id !== teammate);
  expect(replaced.configurations.some((r: any) => retained.every((id: string) => r.config.members.includes(id)) && !r.config.members.includes(teammate))).toBe(true);
  await builder.getByRole('button', { name: 'Undo last feedback', exact: true }).click();
  await card.getByText('Change this team', { exact: true }).click();
  await card.getByRole('button', { name: 'Different playstyle', exact: true }).click();
  const alternative = await jsonDownload(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
  expect(alternative.configurations.some((r: any) => r.config.playstyle !== firstConfig.playstyle && !firstConfig.core.every((id: string) => r.config.members.includes(id)))).toBe(true);
});

test('verified fixture assignment expires and cycle preferences stop applying to current planning', async ({ page }) => {
  const now = Date.now();
  await page.clock.install({ time: now });
  const index = { 1: { live_begin: new Date(now - 86400000).toISOString(), live_end: new Date(now + 86400000).toISOString() } };
  const detail = { leyline: { desc: 'TEST ONLY' }, floor: { 12: { buff: [], room: Object.fromEntries([1, 2, 3].map(i => [i, { first: [{ id: i, name: 'Fixture enemy' }], second: [{ id: i + 3, name: 'Fixture enemy' }] }])) } } };
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().url().endsWith('/manifest.json') ? { gi: { live: 'fixture' } } : route.request().url().endsWith('/tower.json') ? index : detail) }));
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  const builder = page.getByRole('region', { name: 'Account-aware builder' });
  await builder.getByRole('button', { name: 'Current challenge', exact: true }).click();
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  await expect(builder.locator('[data-current-cycle="true"]')).toBeVisible();
  await builder.getByText('Preferences, builds & exclusions', { exact: true }).click();
  await builder.getByLabel('Feedback scope').selectOption('cycle');
  await builder.getByLabel('Builder excluded character').selectOption('bennett');
  await builder.getByRole('button', { name: 'Apply exclusion', exact: true }).click();
  await expect(builder.getByText('Exclude Bennett · cycle', { exact: true })).toBeVisible();
  await page.clock.fastForward(86460000);
  await expect(builder.getByText('No verified live challenge is available', { exact: false })).toBeVisible();
  await expect(builder.locator('.configuration-card')).toHaveCount(2);
  await expect(builder.getByText('1 inactive preference(s)', { exact: false })).toBeVisible();
});
