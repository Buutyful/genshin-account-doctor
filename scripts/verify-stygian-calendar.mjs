// Read only: compare public calendar labels, regional countdowns and source hashes.
// No clear collection, undocumented API calls, publisher contact or training.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const urls = ['https://www.stygian.moe/', 'https://www.stygian.moe/terms-of-service', 'https://static.nanoka.cc/gi/7.1/leyline.json', 'https://static.nanoka.cc/gi/7.1/en/leyline/5269012.json'];
const responses = await Promise.all(urls.map(async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { url, status: response.status, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const navigation = await page.goto(urls[0]);
  const responseHash = createHash('sha256').update(await navigation.body()).digest('hex');
  await page.getByText('Stygian Ends in', { exact: true }).waitFor();
  const regions = [];
  for (const region of ['Asia', 'Europe', 'America']) {
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'Asia' }) }).selectOption({ label: region });
    const current = await page.evaluate(() => ({ now: new Date().toISOString(), text: document.body.innerText }));
    const calendar = current.text.split('Stygian boss guide cards')[0].split('Stygian Onslaught')[1];
    const countdown = calendar.match(/(\d+)\nDays\n(\d+)\nHours\n(\d+)\nMinutes\n(\d+)\nSeconds/);
    const seconds = countdown ? [86400, 3600, 60, 1].reduce((sum, factor, i) => sum + factor * Number(countdown[i + 1]), 0) : undefined;
    regions.push({ region, now: current.now, calendar, countdownDeadlineEstimate: seconds === undefined ? undefined : new Date(Date.parse(current.now) + seconds * 1000).toISOString() });
  }
  const report = { checkedAt: new Date().toISOString(), scope: 'Source label/countdown comparison only, not live certification. Countdown deadlines are inferred from visible UI with about one-second precision.', responses, browser: { name: 'chromium', url: urls[0], status: navigation.status(), responseHash }, regions };
  const path = 'docs/verification/stygian-followup-2026-10-01.json';
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
