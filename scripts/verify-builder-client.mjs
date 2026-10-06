import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'output/builder-verification/client-repair';
const origin = process.argv[2] ?? 'http://127.0.0.1:4184/doctor/';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(origin);
  await page.getByRole('button', { name: 'Team planner', exact: true }).click();
  const builder = page.getByRole('region', { name: 'Account-aware builder' });
  await builder.locator('.configuration-card').nth(1).waitFor();
  const initial = await builder.locator('.configuration-card h3').allTextContents();
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true, animations: 'disabled' });
  await builder.getByRole('button', { name: 'Custom targets', exact: true }).click();
  await builder.getByLabel('First half opponents').fill('Boss with Hydro matchup preference');
  await builder.getByRole('group', { name: 'First half team preferences', exact: true }).getByRole('button', { name: 'Hydro', exact: true }).click();
  await builder.getByRole('group', { name: 'Second half team preferences', exact: true }).getByRole('button', { name: 'Pyro', exact: true }).click();
  await builder.locator('.matchup-fit').first().waitFor();
  const targeted = await builder.locator('.configuration-card').evaluateAll(cards => cards.map(card => ({ title: card.querySelector('h3').textContent, compositionId: card.getAttribute('data-composition-id'), matchedPreference: card.querySelector('.matchup-fit')?.textContent })));
  await page.screenshot({ path: `${output}/challenge.png`, fullPage: true, animations: 'disabled' });
  await page.getByLabel('Game mode', { exact: true }).selectOption('stygian');
  await builder.locator('.configuration-card').nth(2).waitFor();
  await builder.locator('.challenge-source-status').filter({ hasText: 'Live-cycle verification unavailable' }).waitFor({ timeout: 35000 });
  const reference = await builder.locator('.challenge-target').allTextContents();
  const stygian = await builder.locator('.configuration-card h3').allTextContents();
  await builder.getByRole('button', { name: 'General', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true, animations: 'disabled' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const report = { checkedAt: new Date().toISOString(), origin, initial, targeted, reference, stygian, overflow, errors };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (initial.length !== 2 || stygian.length !== 3 || errors.length || overflow) throw new Error('Client repair verification failed.');
} finally { await browser.close(); }
