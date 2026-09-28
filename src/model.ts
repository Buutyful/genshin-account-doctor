import snapshot from './data/roster.json';
import knowledge from './data/knowledge.json';

export const characters = snapshot.characters;
export type Character = (typeof characters)[number];
export const byId: Record<string, Character> = Object.fromEntries(characters.map(c => [c.id, c]));
export const graph = knowledge;
export type Edge = (typeof knowledge.edges)[number];
export type Mode = 'general' | 'abyss' | 'stygian';
export type Readiness = 'ready' | 'building' | 'unknown';
export interface Account { version: 1; owned: string[]; readiness: Record<string, Readiness>; mode: Mode; demo: boolean; }
export const modeCount: Record<Mode, number> = { general: 1, abyss: 2, stygian: 3 };
export const demoAccount: Account = { version: 1, demo: true, mode: 'abyss',
  owned: ['mavuika', 'citlali', 'xilonen', 'bennett', 'neuvillette', 'furina', 'kazuha', 'zhongli', 'nahida', 'kuki', 'xingqiu', 'yelan', 'raiden', 'xiangling', 'iansan', 'barbara'],
  readiness: Object.fromEntries(['mavuika', 'citlali', 'xilonen', 'bennett', 'neuvillette', 'furina', 'kazuha', 'zhongli', 'nahida', 'kuki', 'xingqiu', 'yelan'].map(id => [id, 'ready' as const])) };

export function parseAccount(input: unknown): Account {
  if (!input || typeof input !== 'object') throw new Error('Choose an Account Doctor or Team Atlas roster JSON file.');
  const data = input as Record<string, unknown>;
  if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.owned) || data.owned.length > 200 || data.owned.some(id => typeof id !== 'string' || !Object.hasOwn(byId, id))) throw new Error('The file contains an unsupported roster or unknown character.');
  const mode = data.mode ?? 'abyss';
  if (!['general', 'abyss', 'stygian'].includes(String(mode))) throw new Error('The selected game mode is invalid.');
  const readiness: Record<string, Readiness> = {};
  if (data.readiness !== undefined) {
    if (!data.readiness || typeof data.readiness !== 'object' || Array.isArray(data.readiness)) throw new Error('Readiness must be a character map.');
    for (const [id, value] of Object.entries(data.readiness)) {
      if (!Object.hasOwn(byId, id) || !['ready', 'building', 'unknown'].includes(String(value))) throw new Error('The file contains invalid character readiness.');
      readiness[id] = value as Readiness;
    }
  }
  return { version: 1, owned: [...new Set(data.owned as string[])], readiness, mode: mode as Mode, demo: data.demo === true };
}

const adjacency = new Map<string, Edge[]>();
for (const edge of graph.edges) for (const id of [edge.a, edge.b]) adjacency.set(id, [...(adjacency.get(id) ?? []), edge]);
const pairs = new Map(graph.edges.map(e => [[e.a, e.b].sort().join('|'), e]));
export function neighbors(id: string) { return [...(adjacency.get(id) ?? [])].sort((a, b) => b.priority - a.priority).map(edge => ({ id: edge.a === id ? edge.b : edge.a, edge })); }
export function relationship(a: string, b: string) { return pairs.get([a, b].sort().join('|')); }
export function accountIdentity(id: string) { return byId[id]?.accountId ?? id; }
const identityIndex = new Map([...new Set(characters.map(c => c.accountId))].map((id, i) => [id, i]));
export function teamMask(members: string[]) { return members.reduce((mask, id) => mask | (1n << BigInt(identityIndex.get(accountIdentity(id))!)), 0n); }

interface ReviewedRecipe { name: string; slots: string[][]; roles: string[]; why: string; caution: string; source: string; }
const reviewed: ReviewedRecipe[] = [
  { name: 'Mavuika Melt', slots: [['mavuika'], ['citlali'], ['xilonen', 'iansan', 'sucrose', 'kazuha'], ['bennett']],
    roles: ['On-field carry', 'Cryo & shield', 'Buff support', 'ATK & healing'],
    why: 'Citlali enables Melt; Bennett and the flex support amplify Mavuika’s damage window.',
    caution: 'Set up Cryo before the Burst and use a compatible charged-attack combo. Iansan’s buff depends on movement. Coordinate support artifact sets.', source: 'https://keqingmains.com/q/mavuika-quickguide/' },
  { name: 'Neuvillette Hypercarry', slots: [['neuvillette'], ['furina'], ['kazuha'], ['xilonen', 'zhongli']],
    roles: ['On-field carry', 'Damage & buffs', 'Anemo support', 'Sustain support'],
    why: 'This guide example builds around Neuvillette with Furina and resistance-reducing supports.',
    caution: 'At C0, double Hydro sacrifices a passive stack. Xilonen provides healing; Zhongli offers interruption protection. Check Furina’s healing needs.', source: 'https://keqingmains.com/q/neuvillette-quickguide/' },
  { name: 'Nahida Hyperbloom', slots: [['nahida'], ['xingqiu'], ['yelan'], ['kuki']],
    roles: ['Dendro driver', 'Hydro & protection', 'Hydro damage', 'Trigger & healing'],
    why: 'Dendro and Hydro create cores, with Kuki assigned as the Hyperbloom trigger.',
    caution: 'Kuki’s level and Elemental Mastery matter. Maintain Hydro application and enough Energy Recharge to repeat the rotation.', source: 'https://keqingmains.com/q/nahida-quickguide/' },
  { name: 'Alhaitham Quickbloom', slots: [['alhaitham'], ['nahida'], ['xingqiu'], ['kuki']],
    roles: ['On-field carry', 'Dendro support', 'Hydro support', 'Trigger & healing'],
    why: 'Alhaitham drives a Dendro core while Kuki handles Hyperbloom and healing.',
    caution: 'Keep Alhaitham’s field time and mirror management in mind. Build Kuki for her reaction-trigger role.', source: 'https://keqingmains.com/q/nahida-quickguide/' },
  { name: 'Raiden National', slots: [['raiden'], ['xiangling'], ['xingqiu'], ['bennett']],
    roles: ['On-field & energy', 'Pyro damage', 'Hydro application', 'ATK & healing'],
    why: 'A guide-listed reaction team with Raiden’s field window following the off-field setup.',
    caution: 'Energy Recharge and Burst availability still need an equipment check. This team reserves Bennett and Xingqiu from your other teams.', source: 'https://keqingmains.com/q/raiden-quickguide/' },
];

export interface Candidate { id: string; name: string; members: string[]; roles: string[]; reviewed: boolean; why: string; caution: string; sources: string[]; score: number; missing: string[]; mask: bigint; }
function pairPriority(members: string[]) {
  let sum = 0;
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) sum += relationship(members[i], members[j])?.priority ?? 0;
  return sum;
}
export function recommend(account: Account, includeMissing = false): Candidate[] {
  const owned = new Set(account.owned);
  const candidates = new Map<string, Candidate>();
  for (const recipe of graph.recipes) {
    if (recipe.slots.filter(slot => !slot.some(id => owned.has(id))).length > (includeMissing ? 1 : 0)) continue;
    let beam: string[][] = [[]];
    for (const slot of recipe.slots) {
      beam = beam.flatMap(prefix => slot.filter(id => !prefix.some(p => accountIdentity(p) === accountIdentity(id))).map(id => [...prefix, id]))
        .filter(members => members.filter(id => !owned.has(id)).length <= (includeMissing ? 1 : 0))
        .sort((a, b) => b.filter(id => owned.has(id)).length - a.filter(id => owned.has(id)).length || pairPriority(b) - pairPriority(a) || a.join('|').localeCompare(b.join('|'))).slice(0, 24);
    }
    for (const members of beam) {
      if (members.length !== 4) continue;
      const id = [...members].sort().join('|');
      const existing = candidates.get(id);
      if (existing) { if (!existing.sources.includes(recipe.source)) existing.sources.push(recipe.source); continue; }
      const review = reviewed.find(r => r.slots.every(slot => slot.some(id => members.includes(id))));
      const ordered = review ? review.slots.map(slot => members.find(id => slot.includes(id))!) : members;
      const missing = members.filter(id => !owned.has(id));
      const score = (review ? 100 : 30) + members.reduce((s, id) => s + (account.readiness[id] === 'ready' ? 6 : account.readiness[id] === 'building' ? 1 : 0), 0) + pairPriority(members) * 3;
      candidates.set(id, { id, name: review?.name ?? `${byId[recipe.owner]?.name ?? byId[members[0]].name} · ${recipe.archetype}`,
        members: ordered, roles: review?.roles ?? members.map(() => 'Guide example'), reviewed: !!review,
        why: review?.why ?? 'These four characters appear together in an extracted guide recipe. Open the source to check its full conditions.',
        caution: review?.caution ?? 'Role, equipment and constellation conditions have not been individually reviewed for this example.',
        sources: [...new Set([...(review ? [review.source] : []), recipe.source])], score, missing, mask: teamMask(members) });
    }
  }
  return [...candidates.values()].sort((a, b) => a.missing.length - b.missing.length || b.score - a.score || a.id.localeCompare(b.id));
}

// Exact maximum-cardinality, then maximum-priority packing within a bounded candidate pool.
export function allocate(candidates: Candidate[], count: number): Candidate[] {
  const pool = candidates.filter(c => c.missing.length === 0).slice().sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 128);
  let best: Candidate[] = [], bestScore = -Infinity;
  function visit(start: number, chosen: Candidate[], used: bigint, score: number) {
    if (chosen.length > best.length || (chosen.length === best.length && score > bestScore)) { best = [...chosen]; bestScore = score; }
    if (chosen.length === count || chosen.length + pool.length - start < best.length) return;
    const needed = count - chosen.length;
    if (best.length === count && score + pool.slice(start, start + needed).reduce((s, t) => s + t.score, 0) <= bestScore) return;
    for (let i = start; i < pool.length; i++) if (!(used & pool[i].mask)) visit(i + 1, [...chosen, pool[i]], used | pool[i].mask, score + pool[i].score);
  }
  visit(0, [], 0n, 0);
  return best;
}

export const portrait = (id: string) => `${import.meta.env.BASE_URL}portraits/${byId[id]?.portraitId ?? id}.png`;
