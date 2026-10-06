import { chromium, firefox, webkit, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const target = new URL(process.argv[2] ?? 'https://buutyful.github.io/genshin-account-doctor/');
const archive = JSON.parse(await readFile(new URL('../src/data/clear-archive.json', import.meta.url), 'utf8'));
const runIds = ['4f61bddb-25d4-46a5-9331-ebe5baaeddf2', '722b63e5-e780-44eb-a080-5026741c9543', '4ce1885a-04ae-4410-827f-b9b596201a69'];
const members = runIds.flatMap(id => archive.records.find(r => r.id === id).members);
const account = { version: 1, demo: false, mode: 'stygian', readiness: {}, owned: members.map(m => m.character), constellations: Object.fromEntries(members.map(m => [m.character, m.constellation])), details: Object.fromEntries(members.map(m => [m.character, { level: m.level ?? 90, weapon: { key: m.weapon, refinement: m.refinement } }])) };
const output = `output/pages-verification/${target.hostname}`;
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), target: target.href, scope: 'Hosted static assets, demo navigation and an explicitly constructed matching test account; no in-game outcome verification.', browsers: [] };

for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], failedResources = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(target.origin + target.pathname) && response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() });
    });
    const response = await page.goto(target.href);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Clear finder', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('.doctor-art').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.getByRole('button', { name: 'Clear finder', exact: true }).click();
    const finder = page.getByRole('region', { name: 'Recorded clear finder' });
    await expect(finder).toContainText('914 recorded teams');
    await expect(finder).toContainText('1 / 3 bosses');
    await page.evaluate(a => localStorage.setItem('account-doctor-v1', JSON.stringify(a)), account);
    await page.reload();
    await page.getByRole('button', { name: 'Clear finder', exact: true }).click();
    await page.getByLabel('Recorded clear match filter').selectOption('investment');
    await expect(page.locator('.clear-plan-heading')).toContainText('3 / 3 bosses');
    await expect(page.locator('.recorded-boss > .recorded-team .clear-match-label')).toHaveText(['Listed investment matched', 'Listed investment matched', 'Listed investment matched']);
    await expect.poll(() => page.locator('.recorded-boss > .recorded-team img').evaluateAll(imgs => imgs.length === 12 && imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    const downloadPending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export recorded plan', exact: true }).click();
    const stream = await (await downloadPending).createReadStream(), chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const exported = JSON.parse(Buffer.concat(chunks).toString());
    expect(exported.complete).toBe(true);
    expect(exported.records).toHaveLength(3);
    expect(new Set(exported.weaponAllocation.assigned.map(w => w.copy.id)).size).toBe(12);
    await page.screenshot({ path: `${output}/${name}-desktop.png`, fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: `${output}/${name}-mobile.png`, fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
    expect(failedResources).toEqual([]);
    report.browsers.push({ name, status: response.status(), recordedTeams: archive.records.length, matchedBosses: exported.records.length, uniqueWeaponCopies: 12, mobileWidth: 390, errors, failedResources });
    console.log(`${name}: hosted assets, 914 records, three matched bosses, export and mobile layout passed.`);
  } finally { await browser.close(); }
}
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`Verification report: ${output}/report.json`);
