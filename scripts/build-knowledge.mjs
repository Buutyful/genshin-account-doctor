import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const facts = await read('data/guide-facts.json');
const roster = await read('src/data/roster.json');
const ids = new Set(roster.characters.map(c => c.id));
const recipes = [];
const pairSources = new Map();
for (const guide of facts.records) {
  const local = new Map();
  for (const [index, recipe] of guide.teams.entries()) {
    if (recipe.status === 'provisional' || recipe.slots.length !== 4 || recipe.slots.some(s => !s.length || s.some(id => !ids.has(id)))) continue;
    recipes.push({ id: `${guide.character}-${index}`, slots: recipe.slots, archetype: recipe.archetype,
      source: guide.url, checkedAt: guide.checkedAt, owner: guide.character });
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      for (const a of recipe.slots[i]) for (const b of recipe.slots[j]) {
        if (a === b) continue;
        const key = [a, b].sort().join('|');
        const old = local.get(key) ?? { weight: 0, contexts: new Set() };
        old.weight = Math.min(1, old.weight + 1 / (recipe.slots[i].length * recipe.slots[j].length));
        old.contexts.add(recipe.archetype); local.set(key, old);
      }
    }
  }
  for (const [key, value] of local) {
    const sources = pairSources.get(key) ?? new Map();
    const prior = sources.get(guide.url);
    sources.set(guide.url, { url: guide.url, checkedAt: guide.checkedAt,
      weight: Math.max(prior?.weight ?? 0, value.weight), contexts: [...new Set([...(prior?.contexts ?? []), ...value.contexts])] });
    pairSources.set(key, sources);
  }
}
const mass = new Map();
for (const [key, sources] of pairSources) {
  const support = [...sources.values()].reduce((s, x) => s + x.weight, 0);
  for (const id of key.split('|')) mass.set(id, (mass.get(id) ?? 0) + support);
}
const edges = [...pairSources].map(([key, sources]) => {
  const [a, b] = key.split('|');
  const support = [...sources.values()].reduce((s, x) => s + x.weight, 0);
  const association = support / Math.sqrt(mass.get(a) * mass.get(b));
  // Retrieval prior only. Source support is shrunk; no interpretation as usage or damage.
  const priority = Number((0.65 * support / (support + 2) + 0.35 * association).toFixed(4));
  return { a, b, priority, support: Number(support.toFixed(3)), sources: [...sources.values()] };
}).sort((a, b) => `${a.a}|${a.b}`.localeCompare(`${b.a}|${b.b}`));
const digest = createHash('sha256').update(JSON.stringify({ recipes, edges })).digest('hex');
const result = { version: 1, builtAt: '2026-09-28', snapshotAt: facts.checkedAt, sourceFamilies: ['KQM'], digest,
  method: 'Fractional unexpanded slot evidence, capped per source URL. Priority is a retrieval heuristic; absent edges are unknown.', recipes, edges };
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/knowledge.json', import.meta.url), JSON.stringify(result) + '\n');
console.log(`${recipes.length} unexpanded recipes; ${edges.length} evidence edges; ${result.sourceFamilies.length} source family.`);
