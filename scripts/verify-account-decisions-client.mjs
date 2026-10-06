import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = 'output/account-decisions-live';
await mkdir(directory, { recursive: true });
const report = { checkedAt: new Date().toISOString(), browsers: [], evidenceBoundary: 'Live client and source delivery verification, not DPS or clear-performance validation.' };
async function download(page, action) {
  const pending = page.waitForEvent('download'); await action();
  const stream = await (await pending).createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], responses = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    page.on('response', response => { if (/nanoka|\/challenges\//.test(response.url())) responses.push({ url: response.url(), status: response.status() }); });
    // No routes or frozen clock: use real source requests and the actual local date.
    await page.goto('http://127.0.0.1:4184/doctor/');
    await page.getByRole('button', { name: 'Team planner', exact: true }).click();
    const builder = page.getByRole('region', { name: 'Account-aware builder' });
    await builder.locator('[data-current-cycle="true"]').waitFor();
    const abyss = await download(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
    await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
    await page.screenshot({ path: `${directory}/${name}-teams.png`, fullPage: true });
    await page.getByLabel('Game mode', { exact: true }).selectOption('stygian');
    await builder.locator('[data-current-cycle="true"]').filter({ hasText: 'Difficulty 6' }).waitFor();
    const stygian = await download(page, () => builder.getByRole('button', { name: 'Export plan', exact: true }).click());
    await page.getByRole('button', { name: 'Pull priorities', exact: true }).click();
    await page.locator('[data-comparison-state="complete"]').waitFor({ timeout: 120000 });
    const shortlist = await page.getByLabel('Pull shortlist').innerText();
    await page.getByRole('button', { name: 'Team planner', exact: true }).click();
    await page.getByRole('button', { name: 'Pull priorities', exact: true }).click();
    await page.locator('[data-comparison-state="complete"][data-comparison-source="cache"]').waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Pull priorities', exact: true }).click();
    await page.locator('[data-comparison-state="complete"][data-comparison-source="cache"]').waitFor();
    const cachedShortlist = await page.getByLabel('Pull shortlist').innerText();
    await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
    await page.screenshot({ path: `${directory}/${name}-pulls.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${directory}/${name}-pulls-mobile.png`, fullPage: true });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const row = { browser: name, abyss: { publication: abyss.pack?.publication?.id, activity: abyss.activity, teams: abyss.configurations.length, stages: abyss.pack?.encounters.map(e => e.stages.length) }, stygian: { publication: stygian.pack?.publication?.id, activity: stygian.activity, teams: stygian.configurations.length }, shortlist, cacheRestoredAfterReload: cachedShortlist === shortlist, mobileFits: fits, errors, sourceResponses: responses, simulationRequests: requests.filter(url => /\.wasm|\/simulation\/|\/worker\.js/.test(url)) };
    if (row.abyss.activity !== 'verified-current' || row.stygian.activity !== 'verified-current' || row.abyss.teams !== 2 || row.stygian.teams !== 3 || !row.cacheRestoredAfterReload || !fits || errors.length || row.simulationRequests.length) throw new Error(JSON.stringify(row));
    report.browsers.push(row);
    console.log(`${name}: current Abyss/Stygian, automatic pull shortlist, mobile layout passed`);
  } finally { await browser.close(); }
}
await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2) + '\n');
