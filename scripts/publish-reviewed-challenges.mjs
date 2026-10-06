// Reproduce the reviewed publication from exact captured sources. Network capture is separate.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const audit = JSON.parse(await readFile('output/decision-sources/audit.json', 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const source = i => { const row = audit.sources[i]; if (row.status !== 200) throw new Error(`Unusable source: ${row.url}`); return row; };
for (const i of [0, 2, 3, 4, 5]) if (sha(await readFile(`output/decision-sources/${i}.txt`)) !== source(i).sha256) throw new Error('Captured source changed; review again.');
const reviewedAt = audit.capturedAt, validity = '2026-10-10T00:00:00Z';
const stygianRaw = JSON.parse(await readFile('output/decision-sources/4.txt', 'utf8'));
const difficulty = Object.values(stygianRaw.level).find(v => v.difficulty_config.level === 6);
const requirements = (stage, tags, interpretation, row, id, kind = 'utility') => ({ id, stage, kind, tags, interpretation, source: row.url, sourceHash: row.sha256, reviewedAt });
const stygian = Object.entries(difficulty.level_config).map(([id, boss], i) => {
  const name = boss.name;
  const cryo = name.includes('Overseer'), statue = name.includes('Domovoy');
  return { id: `stygian-${id}`, name: `Boss ${i + 1}`, preferred: [], avoid: [],
    stages: [{ name, level: 110, enemies: [{ name, variantId: id }], notes: [cryo ? 'Cryo hits reduce the rotating boss’s momentum. Sustained application matters.' : statue ? 'Stellar Glimmer interrupts the sculpture and reduces resistance.' : 'Stellar Glimmer changes the Cryo ward; break the shield before the recovery window.'] }],
    requirements: [requirements(name, cryo ? ['cryo'] : ['stellar-glimmer'], cryo ? 'Sustained Cryo application can stop the rotating attacks; hit rate remains a check.' : statue ? 'Trigger Stellar Glimmer during the sculpture window.' : 'Use Stellar Glimmer to transform the Cryo ward.', source(0), `stygian-${id}-mechanic`)] };
});
const abyssNames = [
  [['Battle-Hardened Chimeric Burrowbeast'], ['Immortal Construct'], ['Battle-Hardened Domovoy Sculptor']],
  [['Wilderness Exile ×9', 'Battle-Hardened Fireblade Shock Trooper'], ['Fisher of Hidden Depths ×4', 'Lord of the Hidden Depths: Whisperer of Nightmares'], ['Battle-Hardened Lightkeeper']],
];
const abyss = abyssNames.map((rooms, half) => ({ id: `abyss-${half ? 'second' : 'first'}`, name: half ? 'Second half' : 'First half', preferred: [], avoid: [],
  stages: rooms.map((names, i) => ({ name: `12-${i + 1}`, level: [95, 98, 100][i], enemies: names.map(name => ({ name })), notes: [half ? 'Multiple waves; preserve application through target changes.' : 'Single-boss encounter.'] })),
  requirements: [
    ...rooms.map((_, i) => requirements(`12-${i + 1}`, half ? ['electro-charged', 'lunar-charged'] : ['swirl', 'stellar-glimmer'], half ? 'The second-half disorder favors Electro-Charged or Lunar-Charged damage.' : 'The first-half disorder favors Swirl or Stellar Swirl damage.', source(5), `abyss-${half}-${i}-disorder`, 'modifier')),
    ...(half ? [] : [requirements('12-1', ['electro'], 'Electro attacks accelerate the Burrowbeast’s state change.', source(5), 'burrowbeast-electro')]),
  ] }));
const reviews = [];
await mkdir('public/challenges', { recursive: true });
for (const region of ['Europe', 'America', 'Asia']) for (const mode of ['abyss', 'stygian']) {
  const id = `${mode}-review-2026-10-03-${region.toLowerCase()}`;
  const rows = mode === 'abyss' ? [source(2), source(5)] : [source(0), source(3), source(4)];
  const pack = { version: 1, mode, region, patch: '7.1', cycleId: mode === 'abyss' ? '123' : '5269012',
    // These bounds certify this publication's checked window, not an invented exact cycle reset.
    startsAt: reviewedAt, endsAt: validity, fetchedAt: reviewedAt,
    source: rows[0].url, sourceHash: rows[0].sha256, provenance: rows.map(r => ({ url: r.url, sha256: r.sha256 })),
    difficulty: mode === 'abyss' ? 'Floor 12 · all chambers' : 'Difficulty 6', encounters: mode === 'abyss' ? abyss : stygian,
    notes: [mode === 'abyss' ? 'September 16 lineup; next reset reported October 16. All three chambers retained.' : 'September 30 lineup confirmed by the provider and Stygian.moe. Its date label and regional countdown disagree on the November endpoint.'],
    coverage: ['Only the reviewed mechanics listed for each encounter affect ranking; exact damage and application rates are not predicted.', 'Publication validity is deliberately shorter than the reported season. Re-review is required after 10 October.'],
    publication: { id, reviewedAt, validUntil: validity, sources: rows.map(r => r.url), dateBasis: mode === 'abyss' ? 'Live September 16–October 16 cycle independently described in the dated guide, cross-checked with provider cycle 123 and the Icy Veins chamber guide. Certified only during this review window.' : 'Lineup and September 30 opening agree across the provider and current Stygian.moe guide. The certification window ends October 10, before both conflicting November endpoints. No exact season-end claim.' },
  };
  const bytes = JSON.stringify(pack, null, 2) + '\n', path = `challenges/${id}.json`;
  await writeFile(`public/${path}`, bytes);
  reviews.push({ id, path, sha256: sha(bytes), mode, region });
}
await writeFile('src/data/encounter-publications.json', JSON.stringify({ version: 1, reviews }, null, 2) + '\n');
await writeFile('docs/verification/challenge-source-review-2026-10-03.json', JSON.stringify({ ...audit, review: 'Lineups and date windows checked against rendered guides; Icy Veins accessed with web reader, direct request blocked. No blocked response used as source data.', validUntil: validity, reviews }, null, 2) + '\n');
console.log(`Published ${reviews.length} region/mode packs; valid only until ${validity}.`);
