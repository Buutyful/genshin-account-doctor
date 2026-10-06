import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import archive from '../../src/data/clear-archive.json' with { type: 'json' };
import roster from '../../src/data/roster.json' with { type: 'json' };

const runIds = ['4f61bddb-25d4-46a5-9331-ebe5baaeddf2', '722b63e5-e780-44eb-a080-5026741c9543', '4ce1885a-04ae-4410-827f-b9b596201a69'];
const runs = runIds.map(id => archive.records.find(r => r.id === id)!);
const members = runs.flatMap(r => r.members);
const recordedAccount = { version: 1, demo: false, mode: 'stygian', readiness: {}, owned: members.map(m => m.character), constellations: Object.fromEntries(members.map(m => [m.character, m.constellation])), details: Object.fromEntries(members.map(m => [m.character, { level: 'level' in m ? m.level : 90, weapon: { key: m.weapon, refinement: m.refinement } }])) };
const identity = (id: string) => roster.characters.find(c => c.id === id)!.accountId;

test.beforeEach(async ({ page }) => {
  await page.route('https://static.nanoka.cc/**', route => route.fulfill({ status: 503, body: 'Source offline in browser test' }));
});
async function seed(page: Page, account = recordedAccount) { await page.addInitScript(a => localStorage.setItem('account-doctor-v1', JSON.stringify(a)), account); }
async function open(page: Page) {
  await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Clear finder', exact: true }).click();
  const finder = page.getByRole('region', { name: 'Recorded clear finder' });
  await expect(finder.getByRole('heading', { name: 'Find a clear with your characters.' })).toBeVisible();
  return finder;
}
async function selectedIds(page: Page) { return page.locator('.recorded-boss > .recorded-team').evaluateAll(els => els.map(el => el.getAttribute('data-record-id')!)); }
async function downloadPlan(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export recorded plan', exact: true }).click();
  const downloaded = await pending, stream = await downloaded.createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('real archive works offline with honest demo coverage, strict unknowns and original proof links', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const finder = await open(page);
  await expect(finder).toContainText('914 recorded teams');
  await expect(finder).toContainText('550 complete records');
  await expect(finder).toContainText('1 / 3 bosses');
  await expect(page.locator('.recorded-boss > .recorded-team')).toHaveCount(1);
  const id = (await selectedIds(page))[0], source = archive.records.find(r => r.id === id)!;
  await expect(page.locator('.recorded-boss > .recorded-team a').filter({ hasText: 'Watch clear' })).toHaveAttribute('href', source.proofUrl);
  await page.locator('.recorded-boss > .recorded-team summary').click();
  await expect(page.locator('.recorded-boss > .recorded-team')).toContainText('your constellation is unknown');
  await page.getByLabel('Recorded clear match filter').selectOption('investment');
  await expect(finder.getByRole('heading', { name: 'No recorded plan matches these filters' })).toBeVisible();
  await expect(page.locator('.recorded-boss > .recorded-team')).toHaveCount(0);
  await finder.getByRole('button', { name: 'Show roster matches', exact: true }).click();
  await expect(page.locator('.recorded-boss > .recorded-team')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fearless', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fearless', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(finder).toContainText('364 complete records');
  await page.reload(); await page.getByRole('button', { name: 'Clear finder', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fearless', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('three real runs match listed investment and export a sourced plan with unique characters and weapon copies', async ({ page }) => {
  await seed(page); await open(page);
  await page.getByLabel('Recorded clear match filter').selectOption('investment');
  await expect(page.locator('.clear-plan-heading')).toContainText('3 / 3 bosses');
  await expect(page.locator('.recorded-boss > .recorded-team')).toHaveCount(3);
  await expect(page.locator('.recorded-boss > .recorded-team .clear-match-label')).toHaveText(['Listed investment matched', 'Listed investment matched', 'Listed investment matched']);
  const result = await downloadPlan(page);
  expect(result.format).toBe('AccountDoctorRecordedPlan'); expect(result.complete).toBe(true);
  expect(result.records).toHaveLength(3);
  expect(new Set(result.records.flatMap((r: typeof runs[number]) => r.members.map(m => identity(m.character)))).size).toBe(12);
  expect(new Set(result.records.map((r: typeof runs[number]) => r.bossId)).size).toBe(3);
  expect(new Set(result.weaponAllocation.assigned.map((w: { copy: { id: string } }) => w.copy.id)).size).toBe(12);
  expect(result.weaponAllocation.missing).toEqual([]);
  expect(result.snapshots.every((s: { sha256: string }) => /^[a-f0-9]{64}$/.test(s.sha256))).toBe(true);
  expect(result.records.every((r: typeof runs[number]) => r.verification === 'source-listed' && result.snapshots.some((s: { id: string }) => s.id === r.snapshotId))).toBe(true);
  expect(result.timeMeaning).toContain('no prediction');
});

test('locks survive whole-plan alternatives, conflicts are actionable and exclusions reassign the account', async ({ page }) => {
  await seed(page, { ...recordedAccount, owned: roster.characters.map(c => c.id), constellations: {}, details: {} });
  await open(page); await expect(page.locator('.recorded-boss > .recorded-team')).toHaveCount(3);
  const first = page.locator('.recorded-boss > .recorded-team').first(), lockedId = await first.getAttribute('data-record-id');
  await first.getByRole('button', { name: 'Keep this team', exact: true }).click();
  await expect(page.locator('.recorded-boss > .recorded-team').first()).toHaveAttribute('data-record-id', lockedId!);
  const alternatives = page.locator('.recorded-plan-options > button');
  await expect(alternatives).toHaveCount(3);
  await alternatives.nth(1).click();
  await expect(page.locator('.recorded-boss > .recorded-team').first()).toHaveAttribute('data-record-id', lockedId!);
  const plan = await downloadPlan(page);
  expect(new Set(plan.records.flatMap((r: typeof runs[number]) => r.members.map(m => identity(m.character)))).size).toBe(12);
  const excluded = plan.records[0].members[0].character;
  await page.getByText('Weapons, execution & exclusions', { exact: true }).click();
  await page.getByLabel('Exclude character from recorded clears').selectOption(excluded);
  await page.getByRole('button', { name: 'Exclude', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('locked run is unavailable');
  await page.getByRole('button', { name: 'Unlock all teams', exact: true }).click();
  await expect(page.locator('.recorded-boss > .recorded-team')).toHaveCount(3);
  const changed = await downloadPlan(page);
  expect(changed.records.flatMap((r: typeof runs[number]) => r.members.map(m => identity(m.character)))).not.toContain(identity(excluded));
  await page.getByRole('button', { name: 'Reset team requests', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const beforeSkip = await downloadPlan(page), skipped = beforeSkip.records[0];
  await page.locator('.recorded-boss > .recorded-team').first().getByRole('button', { name: 'Another team', exact: true }).click();
  const afterSkip = await downloadPlan(page), replacement = afterSkip.records.find((r: typeof runs[number]) => r.bossId === skipped.bossId);
  if (replacement) expect(replacement.members.map((m: { character: string }) => m.character).sort()).not.toEqual(skipped.members.map((m: { character: string }) => m.character).sort());
  await expect(page.getByRole('status')).toContainText('Skipped this composition');
});

test('recorded team editing updates matching immediately and Stygian planner opens the recorded workflow', async ({ page }) => {
  await seed(page); await page.goto('/doctor/');
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Recorded clears', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.recorded-boss > .recorded-team')).toHaveCount(3);
  await page.getByLabel('Recorded clear match filter').selectOption('investment');
  const first = page.locator('.recorded-boss > .recorded-team').first();
  await first.getByRole('button', { name: /Edit .* from recorded team/ }).first().click();
  await page.getByLabel('Constellation', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.locator('.clear-plan-heading')).toContainText('2 / 3 bosses');
  await page.getByRole('tab', { name: 'Team plans', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Account-aware builder' })).toBeVisible();
  await page.getByRole('tab', { name: 'Recorded clears', exact: true }).click();
  await expect(page.locator('.clear-plan-heading')).toContainText('2 / 3 bosses');
  await page.getByRole('button', { name: 'Edit roster', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Owned only', exact: true })).toBeChecked();
});

test('mobile alternatives, one-character-away records, source hashes and nav fit without overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page); const finder = await open(page);
  await page.locator('.recorded-alternatives').first().locator(':scope > summary').click();
  await expect(page.locator('.recorded-alternatives[open] .recorded-team').first()).toBeVisible();
  await page.locator('.recorded-near').first().locator(':scope > summary').click();
  await expect(page.locator('.recorded-near[open]')).toContainText('Missing');
  await finder.getByText('Source coverage & search limits', { exact: true }).click();
  await finder.getByText('Exact source hashes (101)', { exact: true }).click();
  await expect(finder.locator('.clear-coverage-table tbody tr')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'output/clear-finder-mobile-verified.png', fullPage: true });
  await page.getByRole('button', { name: 'Pull priorities', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Clear finder', exact: true })).toBeVisible();
});

test('an expired snapshot stays inspectable and has an explicit refresh notice', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
  const finder = await open(page);
  await expect(finder.getByRole('status')).toContainText('source snapshot is due for refresh');
  await expect(page.locator('.recorded-boss > .recorded-team')).toHaveCount(1);
});
