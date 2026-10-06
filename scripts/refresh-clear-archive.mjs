// Bounded public-page navigation. No direct backend queries, credentials, media,
// guide text, image copying, or learned-model data collection.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { publicPageProps, normalizeListing } from './lib/stygian-public.mjs';

const origin = 'https://www.stygian.moe';
const cache = '.research-cache/clear-archive';
await mkdir(cache, { recursive: true });
const roster = JSON.parse(await readFile('src/data/roster.json', 'utf8')).characters;
if (process.argv.includes('--publish-cached')) {
  const p = JSON.parse(await readFile(`${cache}/publication.json`, 'utf8'));
  const rowsBySnapshot = new Map();
  for (const s of p.snapshots) {
    const body = await readFile(`${cache}/${s.sha256}.${s.kind === 'html' ? 'html' : 'json'}`);
    if (createHash('sha256').update(body).digest('hex') !== s.sha256) throw new Error('Cached source hash mismatch.');
    try { rowsBySnapshot.set(s.id, s.kind === 'html' ? publicPageProps(body.toString(), 'initialClears').initialClears : JSON.parse(body.toString())); } catch { if (s.kind !== 'html') throw new Error('Cached page schema changed.'); }
  }
  p.records = p.records.map(r => {
    const sourceRow = rowsBySnapshot.get(r.snapshotId)?.find(row => row.id === r.id);
    if (!sourceRow) throw new Error(`Missing exact source row for ${r.id}.`);
    return normalizeListing(sourceRow, roster, r.snapshotId, r.sourceUrl);
  });
  p.parserVersion = 'stygian-public-listings-v2';
  if (!p.records.length || p.coverage.length !== 6 || p.records.length + new Set(p.rejected.map(r => r.id)).size !== p.coverage.reduce((n, c) => n + c.sourceCount, 0)) throw new Error('Incomplete cached capture.');
  await writeFile('src/data/clear-archive.json.pending', JSON.stringify(p));
  await rename('src/data/clear-archive.json.pending', 'src/data/clear-archive.json');
  console.log(`Published ${p.records.length} cached listings after hash and capture-completeness checks.`);
  process.exit(0);
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const snapshots = [], records = new Map(), rejected = [], coverage = [];
const checkedAt = new Date().toISOString();
async function snapshot(body, url, kind) {
  const sha256 = createHash('sha256').update(body).digest('hex');
  const id = sha256.slice(0, 20);
  if (!snapshots.some(s => s.id === id)) {
    snapshots.push({ id, url, sha256, fetchedAt: new Date().toISOString(), kind });
    await writeFile(`${cache}/${sha256}.${kind === 'html' ? 'html' : 'json'}`, body);
  }
  return id;
}
function ingest(rows, snapshotId, sourceUrl, bossId, versionId, difficulty) {
  for (const row of rows) {
    if (row.boss_id !== bossId || row.version_id !== versionId || row.difficulty !== difficulty) continue;
    try { records.set(row.id, normalizeListing(row, roster, snapshotId, sourceUrl)); }
    catch (error) { if (!rejected.some(r => r.id === row.id)) rejected.push({ id: row.id, bossId, versionId, difficulty, reason: error.message }); }
  }
}
try {
  const response = await page.goto(`${origin}/team-finder`);
  if (!response?.ok()) throw new Error('Public finder unavailable. Existing publication retained.');
  const html = await response.text();
  const catalogue = publicPageProps(html, 'bestClearsByVersionId');
  await snapshot(html, `${origin}/team-finder`, 'html');
  const requested = process.argv.find(arg => arg.startsWith('--version='))?.split('=')[1];
  const version = requested ? catalogue.versions.find(v => v.phase === requested) : catalogue.versions[0];
  if (!version || version.boss_ids.length !== 3) throw new Error('Expected a source version with three bosses.');
  const bosses = catalogue.bosses.filter(b => version.boss_ids.includes(b.id)).map(b => ({ id: b.id, name: b.name, shortName: b.nickname }));
  for (const difficulty of ['Dire', 'Fearless']) for (const boss of bosses) {
    const slug = boss.shortName.toLowerCase().replace(/\s+/g, '-');
    const url = `${origin}/clears?boss=${slug}&difficulty=${difficulty}`;
    const res = await page.goto(url);
    if (!res?.ok()) throw new Error(`Source unavailable: ${url}`);
    const body = await res.text(), props = publicPageProps(body, 'initialClears');
    const firstSnapshot = await snapshot(body, url, 'html');
    await page.getByRole('button', { name: 'Boss Filter', exact: true }).waitFor();
    await page.waitForTimeout(1000); // Allow client hydration before interacting.
    await page.getByRole('button', { name: 'Do not consent', exact: true }).click({ timeout: 800 }).catch(() => {});
    const nextRows = () => page.waitForResponse(r => r.request().method() === 'GET' && r.url().includes('/rest/v1/clears?'), { timeout: 20000 });
    const versionFilter = page.getByLabel('Boss version filter');
    if (await versionFilter.count()) {
      const pending = nextRows();
      await versionFilter.selectOption(version.id);
      const filtered = await pending;
      if (!filtered.ok()) throw new Error('Version filter request failed.');
      const text = await filtered.text();
      ingest(JSON.parse(text), await snapshot(text, page.url(), 'json'), page.url(), boss.id, version.id, difficulty);
    } else ingest(props.initialClears, firstSnapshot, url, boss.id, version.id, difficulty);
    await page.getByText(/Showing \d+-\d+ of \d+ clears/).waitFor();
    let pages = 1;
    while (await page.getByRole('button', { name: 'Next', exact: true }).isEnabled()) {
      if (++pages > 100) throw new Error('100-page safety limit reached; publication not replaced.');
      await page.waitForTimeout(750);
      const pending = nextRows();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      const next = await pending;
      if (!next.ok()) throw new Error('Pagination failed; publication not replaced.');
      const text = await next.text();
      ingest(JSON.parse(text), await snapshot(text, page.url(), 'json'), page.url(), boss.id, version.id, difficulty);
      await page.getByText(`Page ${pages} of`, { exact: false }).waitFor();
      if (pages % 10 === 0) console.log(`${version.phase} ${difficulty} ${boss.shortName}: page ${pages}, ${records.size} total indexed`);
    }
    const visible = await page.getByText(/Showing \d+-\d+ of \d+ clears/).innerText();
    const total = Number(visible.match(/of (\d+) clears/)[1]);
    const accepted = [...records.values()].filter(r => r.bossId === boss.id && r.versionId === version.id && r.difficulty === difficulty).length;
    coverage.push({ versionId: version.id, bossId: boss.id, difficulty, sourceCount: total, indexedCount: accepted, pages, url: page.url() });
    console.log(`${version.phase} ${difficulty} ${boss.shortName}: ${accepted}/${total}`);
  }
  const publication = { format: 'AccountDoctorClearArchive', version: 1, parserVersion: 'stygian-public-listings-v2', source: { id: 'stygian-moe', name: 'Stygian.moe', url: origin, termsUrl: `${origin}/terms-of-service`, guideUrl: `${origin}/guide/submission-guide` }, checkedAt, reviewAfter: new Date(Date.parse(checkedAt) + 7 * 86400000).toISOString(), versions: [{ id: version.id, label: version.phase, bossIds: version.boss_ids }], bosses, snapshots, coverage, records: [...records.values()].sort((a, b) => a.id.localeCompare(b.id)), rejected };
  await writeFile(`${cache}/publication.json`, JSON.stringify(publication, null, 2));
  // Empty or incomplete source navigation must never replace the last good publication.
  if (!records.size || coverage.length !== 6 || coverage.some(c => c.indexedCount + rejected.filter(r => r.bossId === c.bossId && r.difficulty === c.difficulty).length !== c.sourceCount)) throw new Error('Incomplete snapshot; inspect cached publication before publishing.');
  const output = 'src/data/clear-archive.json';
  await writeFile(`${output}.pending`, JSON.stringify(publication));
  await rename(`${output}.pending`, output);
  console.log(`Published ${records.size} attributed clear listings from ${coverage.length} boards.`);
} finally { await browser.close(); }
