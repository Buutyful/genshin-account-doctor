import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const capture = await readFile('output/decision-sources/ratings-web-reader.txt', 'utf8');
const roster = JSON.parse(await readFile('src/data/roster.json', 'utf8')).characters;
const old = JSON.parse(await readFile('src/data/meta.json', 'utf8'));
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const names = roster.slice().sort((a, b) => b.name.length - a.name.length);
const entries = [], missing = [];
let tier, role;
for (const raw of capture.split(/L\d+: /)) {
  const text = raw.trim();
  if (/^T\d/.test(text)) tier = Number(text.match(/^T(\d(?:\.5)?)/)[1]);
  if (text.startsWith('On-Field DPS')) role = 'carry';
  if (text.startsWith('Damage Support')) role = 'damage';
  if (text.startsWith('Pure Support / Sustain')) role = 'support';
  for (const match of text.matchAll(/†C([0-6]) ([^]+)/g)) {
    if (tier === undefined || !role) continue;
    const character = names.find(c => norm(match[2]).startsWith(norm(c.name)));
    if (!character) { missing.push(match[2]); continue; }
    const partners = [...match[2].matchAll(/partner \(([^)]+)\)/g)].map(m => roster.find(c => norm(c.name) === norm(m[1]) || c.id === m[1])?.id);
    if (partners.some(p => !p)) throw new Error('Unknown rating partner');
    entries.push({ id: character.id, role, tier, constellation: Number(match[1]), partners });
  }
}
if (entries.length < 120 || missing.length) throw new Error(`Incomplete rating review: ${entries.length} entries; missing ${missing.join(', ')}`);
const changes = entries.filter(e => !old.entries.some(o => JSON.stringify(o) === JSON.stringify(e)));
const sourceHash = createHash('sha256').update(capture).digest('hex');
await writeFile('src/data/meta.json', JSON.stringify({ ...old, id: 'prydwen-overall-7.1-2026-10-03', updatedAt: '2026-10-01', checkedAt: '2026-10-03', expiresAt: '2026-10-15', entries, sourceCapture: { sha256: sourceHash, kind: 'web-reader-text', checkedAt: '2026-10-03', note: 'Direct HTML request blocked; the rendered public Overall tier list was read using the web reader. Ordinal ratings, not measured team damage.' } }, null, 2) + '\n');
await writeFile('docs/verification/conditional-ratings-2026-10-03.json', JSON.stringify({ source: old.source, capturedAt: '2026-10-03', sourceHash, captureKind: 'web-reader-text', entries: entries.length, changedRows: changes, removedRows: old.entries.filter(o => !entries.some(e => e.id === o.id && e.role === o.role)), scope: 'Full Overall list, role, constellation and named partner conditions. Execution conditions remain explicit in rating-conditions.json.' }, null, 2) + '\n');
console.log(JSON.stringify({ entries: entries.length, changed: changes.length }));
