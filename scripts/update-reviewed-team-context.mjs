import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/data/team-contracts.json';
const contracts = JSON.parse(await readFile(path, 'utf8'));
const source = 'https://www.icy-veins.com/genshin-impact/spiral-abyss-floor-12-guide';
const examples = [
  ['sandrone-stellar-alyosha', 'Sandrone Stellar', ['sandrone', 'yaemiko', 'odette', 'alyosha'], ['stellar-glimmer']],
  ['mizuki-stellar', 'Mizuki Stellar Swirl', ['mizuki', 'odette', 'faruzan', 'travelercryo'], ['stellar-glimmer', 'swirl']],
  ['vesna-stellar-vodyanitsa', 'Vesna Stellar Swirl', ['vesna', 'odette', 'faruzan', 'vodyanitsa'], ['stellar-glimmer', 'swirl']],
  ['nefer-lunar-nahida', 'Nefer Lunar-Bloom', ['nefer', 'lauma', 'columbina', 'nahida'], ['lunar-bloom']],
  ['zibai-lunar', 'Zibai Lunar-Crystallize', ['zibai', 'linnea', 'columbina', 'illuga'], ['lunar-crystallize']],
];
for (const [id, name, members, encounterTags] of examples) if (!contracts.some(c => c.id === id)) contracts.push({ id, name, anchor: members[0], slots: members.map(id => [id]), roles: ['On-field carry', 'Damage support', 'Reaction support', 'Team support'], source, checkedAt: '2026-10-03', encounterTags, why: 'Complete current encounter-guide example with its reaction core retained.', caution: 'Follow the linked build and rotation; check constellation assumptions.' });
for (const c of contracts) {
  if (c.id === 'nefer-lunar-bloom') Object.assign(c, { encounterTags: ['lunar-bloom'],
    rotationOutline: 'Lauma Burst and held Skill → Columbina Burst and Skill → Sucrose Skill → Nefer Skill and charged-attack sequences; Burst every other loop. Finish with Columbina’s charged attack.',
    buildNotes: { sucrose: 'EM support with Instructor or Deepwood; Viridescent Venerer does not buff Lunar-Bloom.', nefer: 'Prioritize the Lunar-Bloom charged-attack sequence. Check ER against the guide’s every-other-loop Burst.' } });
  if (c.id === 'sandrone-stellar') Object.assign(c, { encounterTags: ['stellar-glimmer'], minimumConstellations: { yaemiko: 1 } });
  if (c.id === 'vesna-cryo') Object.assign(c, { encounterTags: ['stellar-glimmer', 'swirl'], minimumConstellations: { travelercryo: 2 } });
  if (c.id === 'flins-lunar') Object.assign(c, { encounterTags: ['lunar-charged'], rotationOutline: 'Set up Ineffa and Columbina, then Sucrose’s support. Flins uses two special Skill into short-Burst sequences per C0 field window; follow the full guide combo.' });
}
await writeFile(path, JSON.stringify(contracts, null, 2) + '\n');
