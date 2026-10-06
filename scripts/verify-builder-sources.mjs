// Read-only verification; no publisher contact, bulk clear collection or training.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from '@playwright/test';

const directory = 'output/builder-verification';
await mkdir(directory, { recursive: true });
const browserOnly = process.argv.includes('--browser-only');
const report = browserOnly ? JSON.parse(await readFile(`${directory}/source-audit.json`, 'utf8')) : { checkedAt: new Date().toISOString(), purpose: 'Source accessibility and shape verification; NOT live-cycle certification', responses: [], browser: [], gates: { liveCycle: false, stygianDataset: false, learnedModel: false } };
report.browser = [];
async function get(url) {
  const row = { url };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), credentials: 'omit' });
    const bytes = Buffer.from(await response.arrayBuffer());
    Object.assign(row, { status: response.status, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, cors: response.headers.get('access-control-allow-origin') });
    report.responses.push(row);
    return { row, text: bytes.toString('utf8') };
  } catch (error) { row.error = String(error); report.responses.push(row); return { row, text: '' }; }
}
if (!browserOnly) {
const manifest = await get('https://static.nanoka.cc/manifest.json');
const version = manifest.row.status === 200 ? JSON.parse(manifest.text).gi.live : undefined;
manifest.row.liveVersion = version;
if (version) for (const endpoint of ['tower', 'leyline']) {
  const index = await get(`https://static.nanoka.cc/gi/${version}/${endpoint}.json`);
  if (index.row.status !== 200) continue;
  const entries = Object.entries(JSON.parse(index.text));
  index.row.cycles = entries.length;
  index.row.withExplicitLiveDates = entries.filter(([, v]) => v.live_begin && v.live_end).length;
  const day = report.checkedAt.slice(0, 10);
  const candidates = entries.filter(([, v]) => v.begin?.slice(0, 10) <= day && day < v.end?.slice(0, 10));
  index.row.genericDateCandidates = candidates.map(([id, value]) => ({ id, begin: value.begin, end: value.end }));
  await writeFile(`${directory}/${endpoint}-index.json`, index.text);
  for (const [id] of candidates.slice(0, 1)) {
    const detail = await get(`https://static.nanoka.cc/gi/${version}/en/${endpoint}/${id}.json`);
    if (detail.row.status !== 200) continue;
    const data = JSON.parse(detail.text);
    detail.row.keys = Object.keys(data);
    if (endpoint === 'tower') detail.row.floor12 = { chambers: Object.keys(data.floor?.['12']?.room ?? {}), names: Object.values(data.floor?.['12']?.room ?? {}).flatMap(r => [...r.first, ...r.second].map(e => ({ id: e.id, name: e.name, hp: e.hp }))) };
    else { const level = Object.values(data.level ?? {}).find(v => v.difficulty_config?.level === 6); detail.row.difficulty6 = { keys: Object.keys(level ?? {}), bosses: Object.entries(level?.level_config ?? {}).map(([variantId, value]) => ({ variantId, name: value.name, mechanicKeys: Object.keys(value).filter(k => /buff|recommend/.test(k)) })) }; }
    await writeFile(`${directory}/${endpoint}-detail.json`, detail.text);
  }
}
for (const url of [
  'https://www.stygian.moe/', 'https://www.stygian.moe/about', 'https://www.stygian.moe/guide/submission-guide', 'https://www.stygian.moe/policies', 'https://www.stygian.moe/terms-of-service', 'https://www.stygian.moe/clears',
  'https://www.stygian.moe/guide/pioneer-secret-source-control-array-will-of-the-hive-guide',
  'https://www.stygian.moe/guide/secret-source-automaton-configuration-device-lysis-shears-guide',
  'https://raw.githubusercontent.com/seriaati/hakushin-py/main/hakushin/models/gi/stygian.py',
  ...['nahida', 'shinobu', 'raiden', 'xingqiu', 'yelan', 'barbara', 'sucrose', 'fischl', 'beidou', 'neuvillette', 'furina', 'bennett', 'xiangling', 'kazuha', 'zhongli', 'nilou', 'chevreuse'].map(id => `https://keqingmains.com/q/${id}-quickguide/`),
]) { const page = await get(url); page.row.title = page.text.match(/<title>(.*?)<\/title>/)?.[1]; }
}

// A local /doctor/ server must already be running. This deliberately has no network fixtures.
if (process.argv.includes('--browser') || browserOnly) for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage(), requests = [], pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('response', response => { if (response.url().startsWith('https://static.nanoka.cc/')) requests.push({ url: response.url(), status: response.status() }); });
    await page.goto('http://127.0.0.1:4184/doctor/');
    const abyssResponse = page.waitForResponse(r => r.url().endsWith('/tower.json'));
    await page.getByRole('button', { name: 'Team planner', exact: true }).click();
    await abyssResponse;
    const builder = page.getByRole('region', { name: 'Account-aware builder' });
    const initialGeneralTeams = await builder.locator('.configuration-card').count();
    await builder.getByRole('button', { name: 'Current challenge', exact: true }).click();
    const challenges = page.getByRole('region', { name: 'Endgame challenges' });
    await challenges.getByText('No unambiguous live cycle is published for this server.', { exact: false }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Refresh challenges', exact: true }).waitFor({ timeout: 20000 });
    const abyss = await challenges.innerText();
    const stygianResponse = page.waitForResponse(r => r.url().endsWith('/leyline.json'));
    await page.getByRole('button', { name: /Stygian Onslaught/ }).click();
    await stygianResponse;
    await challenges.getByText('No unambiguous live cycle is published for this server.', { exact: false }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Refresh challenges', exact: true }).waitFor({ timeout: 20000 });
    const stygian = await challenges.innerText();
    const detailAccess = await page.evaluate(async urls => Promise.all(urls.map(async url => {
      try { const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(12000) }); return { url, status: response.status, keys: Object.keys(await response.json()) }; }
      catch (error) { return { url, error: String(error) }; }
    })), report.responses.filter(r => /\/en\/(tower|leyline)\//.test(r.url)).map(r => r.url));
    const unavailableCurrentTeams = await builder.locator('.configuration-card').count();
    const mainTabSelected = await page.getByRole('tab', { name: 'Team plans', exact: true }).getAttribute('aria-selected');
    await builder.getByRole('button', { name: 'General', exact: true }).click();
    await builder.locator('.configuration-card').nth(2).waitFor({ timeout: 20000 });
    const generalTeams = await builder.locator('.configuration-card').count();
    await builder.getByRole('button', { name: 'Custom targets', exact: true }).click();
    const referenceTargets = await builder.locator('.challenge-target').allTextContents();
    const preparationTeams = await builder.locator('.configuration-card').count();
    report.browser.push({ name, checkedAt: new Date().toISOString(), origin: 'http://127.0.0.1:4184/doctor/', requests, abyss, stygian, detailAccess, mainTabSelected, initialGeneralTeams, unavailableCurrentTeams, generalTeams, referenceTargets, preparationTeams, pageErrors });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${directory}/live-${name}.png`, fullPage: false, animations: 'disabled' });
  } catch (error) { report.browser.push({ name, error: String(error) }); }
  finally { await browser.close(); }
}
await writeFile(`${directory}/source-audit.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: `${directory}/source-audit.json`, responses: report.responses.map(r => ({ url: r.url, status: r.status, liveDates: r.withExplicitLiveDates, error: r.error })), browser: report.browser.map(r => ({ name: r.name, requests: r.requests?.length, error: r.error })), gates: report.gates }, null, 2));
