import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { normalizeListing, publicPageProps } from './lib/stygian-public.mjs';

const bytes = await readFile('src/data/clear-archive.json');
const archive = JSON.parse(bytes.toString());
const roster = JSON.parse(await readFile('src/data/roster.json', 'utf8')).characters;
const rawRows = new Map();
let checkedSnapshots = 0;
for (const s of archive.snapshots) {
  const body = await readFile(`.research-cache/clear-archive/${s.sha256}.${s.kind === 'html' ? 'html' : 'json'}`);
  if (createHash('sha256').update(body).digest('hex') !== s.sha256) throw new Error(`Snapshot hash mismatch: ${s.id}`);
  ++checkedSnapshots;
  try { rawRows.set(s.id, s.kind === 'html' ? publicPageProps(body.toString(), 'initialClears').initialClears : JSON.parse(body.toString())); }
  catch { if (s.kind !== 'html') throw new Error('Invalid JSON snapshot.'); }
}
for (const r of archive.records) {
  const original = rawRows.get(r.snapshotId)?.find(row => row.id === r.id);
  if (!original || JSON.stringify(normalizeListing(original, roster, r.snapshotId, r.sourceUrl)) !== JSON.stringify(r)) throw new Error(`Source normalization mismatch: ${r.id}`);
}
const excluded = new Map();
for (const rows of rawRows.values()) for (const row of rows) if (archive.rejected.some(r => r.id === row.id)) excluded.set(row.id, { id: row.id, members: row.clear_characters.length, sourceVerified: row.is_verified, bossId: row.boss_id, difficulty: row.difficulty });
if (excluded.size !== archive.rejected.length || [...excluded.values()].some(r => !r.sourceVerified || r.members >= 4)) throw new Error('Publication exclusion audit failed.');
for (const c of archive.coverage) {
  const count = archive.records.filter(r => r.bossId === c.bossId && r.versionId === c.versionId && r.difficulty === c.difficulty).length;
  if (count !== c.indexedCount || count + [...excluded.values()].filter(r => r.bossId === c.bossId && r.difficulty === c.difficulty).length !== c.sourceCount) throw new Error('Incomplete board coverage.');
}
const report = { verifiedAt: new Date().toISOString(), publicationCheckedAt: archive.checkedAt, publicationSha256: createHash('sha256').update(bytes).digest('hex'), parserVersion: archive.parserVersion, records: archive.records.length, checkedSnapshots, independentlyVerifiedVideos: 0, scope: 'Exact-byte source snapshots and factual field normalization. Source-listed moderation is not independent proof or complete build verification.', source: archive.source, versions: archive.versions, coverage: archive.coverage, excluded: [...excluded.values()], snapshots: archive.snapshots };
await writeFile('docs/verification/recorded-clear-index-2026-10-06.json', JSON.stringify(report, null, 2));
console.log(`Verified ${archive.records.length} source-listed records against ${checkedSnapshots} exact-hash snapshots; ${excluded.size} incomplete compositions excluded.`);
