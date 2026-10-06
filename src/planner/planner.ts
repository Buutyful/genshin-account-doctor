import metaSnapshot from '../data/meta.json';
import contractsSnapshot from '../data/team-contracts.json';
import benchmarkSnapshot from '../data/benchmarks.json';
import { accountIdentity, byId, teamMask } from '../account';
import type { Account } from '../account';
import { graph, relationship, reviewed } from '../knowledge';
import { mechanicalContracts } from './mechanics';
import type { BenchmarkPack, Candidate, MetaEntry, MetaPack, PlannerOptions, TeamContract } from './types';
export type { Candidate, PlannerOptions } from './types';
export const metaPack: MetaPack = metaSnapshot;
export const benchmarkPack = benchmarkSnapshot as BenchmarkPack;
export const teamContracts: TeamContract[] = [...contractsSnapshot as TeamContract[], ...mechanicalContracts];
export const compositionKey = (members: string[]) => [...members].sort().join('|');

export function metaIsFresh(meta: MetaPack, now = new Date().toISOString().slice(0, 10)) {
  return now >= meta.updatedAt && now <= meta.expiresAt;
}
function affinity(members: string[]) {
  let sum = 0;
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) sum += relationship(members[i], members[j])?.priority ?? 0;
  return sum;
}
function qualifies(entry: MetaEntry, members: string[], account: Account) {
  return (entry.constellation === 0 || (account.constellations?.[entry.id] ?? -1) >= entry.constellation) && entry.partners.every(id => members.includes(id));
}

/** A full bijection is needed: one character cannot satisfy two overlapping recipe slots. */
export function matchSlots(slots: string[][], members: string[]): string[] | undefined {
  if (slots.length !== members.length) return;
  function visit(index: number, chosen: string[]): string[] | undefined {
    if (index === slots.length) return chosen;
    for (const id of slots[index]) if (members.includes(id) && !chosen.includes(id)) {
      const result = visit(index + 1, [...chosen, id]); if (result) return result;
    }
  }
  return visit(0, []);
}

/** Retrieval only. Preserve complete slot constraints; never form teams from four popular nodes. */
export function discover(account: Account, includeMissing = false, options: PlannerOptions = {}): Candidate[] {
  const owned = new Set(account.owned);
  const meta = options.meta ?? metaPack;
  const contracts = options.contracts ?? teamContracts;
  const results = new Map<string, Candidate>();
  // Contracts are seeds, not privileged scores. Every source goes through the same expansion/ranker.
  const originals = [...contracts.map(c => ({ ...c, owner: c.anchor, archetype: c.name })), ...graph.recipes];
  // Constrain before beam pruning so a requested substitute is not lost to popular alternatives.
  const recipes = options.requiredCharacter ? originals.flatMap(recipe => recipe.slots.flatMap((slot, i) => slot.includes(options.requiredCharacter!) ? [{ ...recipe, slots: recipe.slots.map((s, j) => i === j ? [options.requiredCharacter!] : s) }] : [])) : originals;
  for (const recipe of recipes) {
    if (recipe.slots.length !== 4 || recipe.slots.some(s => s.some(id => !Object.hasOwn(byId, id)))) continue;
    if (recipe.slots.filter(slot => !slot.some(id => owned.has(id))).length > (includeMissing ? 1 : 0)) continue;
    let beam: string[][] = [[]];
    for (const slot of recipe.slots) {
      beam = beam.flatMap(prefix => slot.filter(id => !prefix.some(p => accountIdentity(p) === accountIdentity(id))).map(id => [...prefix, id]))
        .filter(members => members.filter(id => !owned.has(id)).length <= (includeMissing ? 1 : 0))
        .sort((a, b) => affinity(b) - affinity(a) || compositionKey(a).localeCompare(compositionKey(b))).slice(0, 24);
    }
    for (const members of beam) {
      const id = compositionKey(members);
      const existing = results.get(id);
      if (existing) { if (!existing.sources.includes(recipe.source)) existing.sources.push(recipe.source); continue; }
      const contract = contracts.find(c => !c.origin && matchSlots(c.slots, members));
      const mechanical = contracts.find(c => c.origin === 'mechanical' && matchSlots(c.slots, members));
      const review = reviewed.find(r => matchSlots(r.slots, members));
      // Explicit roles take precedence. Extracted captions only permit a tentative anchor inference.
      const carryEntries = meta.entries.filter(e => e.role === 'carry' && members.includes(e.id)).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
      const anchor = contract?.anchor ?? (review ? matchSlots(review.slots, members)![0] : mechanical ? matchSlots(mechanical.slots, members)![0] : carryEntries[0]?.id ?? (members.includes(recipe.owner) ? recipe.owner : members[0]));
      const annotation = contract ?? review ?? mechanical;
      const ordered = annotation ? matchSlots(annotation.slots, members)! : [anchor, ...members.filter(id => id !== anchor)];
      results.set(id, {
        id, name: annotation?.name ?? `${byId[anchor].name} · ${recipe.archetype}`,
        members: ordered, roles: annotation?.roles ?? ordered.map((_, i) => i ? 'Guide teammate' : 'Inferred driver'), anchor,
        origin: !contract && !review && mechanical ? 'mechanical' : 'guide',
        reviewed: Boolean(contract ?? review), why: annotation?.why ?? 'A complete guide example. Its inferred driver and mechanical conditions need review.',
        caution: annotation?.caution ?? 'Check rotation, roles, sustain, equipment and constellation conditions in the original guide.',
        sources: [...new Set([recipe.source, ...(annotation ? [annotation.source] : [])])],
        ...(annotation ? { encounterTags: annotation.encounterTags, minimumConstellations: annotation.minimumConstellations, rotationOutline: annotation.rotationOutline, buildNotes: annotation.buildNotes, buildTargets: annotation.buildTargets } : {}),
        score: 0, missing: members.filter(id => !owned.has(id)), mask: teamMask(members), retrieval: affinity(members),
        ranking: 'unrated', metaTier: null, assumptions: [], unsupported: members.filter(id => !byId[id].engineId),
      });
    }
  }
  return [...results.values()];
}

/** Ordinal guidance and measured DPS are separate objectives; never add them together. */
export function rank(candidates: Candidate[], account: Account, options: PlannerOptions = {}): Candidate[] {
  const meta = options.meta ?? metaPack, benchmarks = options.benchmarks ?? benchmarkPack;
  const now = options.now ?? new Date().toISOString().slice(0, 10);
  const fresh = metaIsFresh(meta, now);
  const strategy = options.strategy ?? 'meta', scenario = options.scenario ?? 'boss';
  const benchmarkAge = (Date.parse(now) - Date.parse(benchmarks.generatedAt.slice(0, 10))) / 86400000;
  const currentBenchmarks = benchmarks.patch === meta.patch && benchmarkAge >= 0 && benchmarkAge <= 45;
  const provenanceValid = /^[a-f0-9]{40}$/.test(benchmarks.engine.revision) && /^[a-f0-9]{64}$/.test(benchmarks.engine.binarySha256);
  const rows = currentBenchmarks && provenanceValid ? benchmarks.rows.filter(r => r.status === 'passed' && r.rotationStatus === 'validated' && r.diagnostics.length === 0 && r.configPath && r.scenario === scenario && r.profileId === benchmarks.profileId && Number.isInteger(r.samples) && r.samples >= 32 && Number.isFinite(r.meanDps) && Number.isFinite(r.ci95) && r.meanDps > 0 && r.ci95 >= 0 && /^[a-f0-9]{64}$/.test(r.configSha256)) : [];
  return candidates.flatMap(candidate => {
    const team = { ...candidate, benchmark: undefined, assumptions: [] as string[] } as Candidate;
    const carry = fresh ? meta.entries.filter(e => e.id === team.anchor && e.role === 'carry' && qualifies(e, team.members, account)).sort((a, b) => a.tier - b.tier)[0] : undefined;
    team.metaTier = carry?.tier ?? null;
    if (!fresh) team.assumptions.push('The rating snapshot needs refreshing; role-rating ordering is disabled.');
    if (!team.reviewed) team.assumptions.push(team.origin === 'custom' ? 'Custom composition: validate the selected driver, roles and rotation.' : team.origin === 'mechanical' ? 'Experimental role contract: application rates, reaction ownership and energy need rotation validation.' : 'The driver and teammate roles are inferred from an extracted recipe. Check the original guide.');
    for (const id of team.members) {
      const roleEntries = meta.entries.filter(e => e.id === id && (id === team.anchor ? e.role === 'carry' : e.role !== 'carry')).sort((a, b) => a.tier - b.tier);
      const entry = roleEntries[0];
      if (entry && !qualifies(entry, team.members, account)) {
        if ((account.constellations?.[id] ?? -1) < entry.constellation && entry.constellation > 0) team.assumptions.push(`${byId[id].name}’s T${entry.tier} rating assumes C${entry.constellation}; yours is ${account.constellations?.[id] === undefined ? 'unknown' : `C${account.constellations[id]}`}.`);
        for (const partner of entry.partners.filter(p => !team.members.includes(p))) team.assumptions.push(`${byId[id].name}’s rating assumes ${byId[partner].name} in the team.`);
      }
    }
    team.benchmark = rows.find(r => compositionKey(r.members) === team.id && r.anchor === team.anchor);
    if (strategy === 'benchmark') {
      if (!team.benchmark) return []; // Unmeasured stays in the separate meta shortlist; never assigned zero DPS.
      team.ranking = 'benchmark';
      team.score = Math.max(0, team.benchmark.meanDps - team.benchmark.ci95);
      team.assumptions.push(benchmarks.profileLabel, 'Experimental rotation checks passed; no in-game validation. The interval covers seed variability only.');
    } else if (strategy === 'guide' || !fresh) {
      team.ranking = 'guide';
      const readiness = team.members.filter(id => account.readiness[id] === 'ready').length;
      team.scoreParts = { carry: 0, teammates: 0, readiness, review: team.reviewed ? 10 : 0 };
      team.score = (team.reviewed ? 10 : 0) + readiness;
    } else {
      team.ranking = carry ? 'meta' : 'unrated';
      // Explicit, replaceable ordinal prior. Unknown carry is neutral, not zero or incompatible.
      const carryPrior = carry ? (6 - carry.tier) * 10 : 40;
      const supportPrior = fresh ? team.members.filter(id => id !== team.anchor).reduce((s, id) => {
        const entry = meta.entries.filter(e => e.id === id && e.role !== 'carry' && qualifies(e, team.members, account)).sort((a, b) => a.tier - b.tier)[0];
        return s + (entry ? (5 - Math.min(5, entry.tier)) / 5 : 0.5);
      }, 0) : 0;
      const readiness = team.members.filter(id => account.readiness[id] === 'ready').length * .25;
      team.scoreParts = { carry: carryPrior, teammates: supportPrior, readiness, review: team.reviewed ? 1 : 0 };
      team.score = carryPrior + supportPrior + readiness + team.scoreParts.review;
    }
    for (const id of team.members) {
      const details = account.details?.[id];
      if (account.constellations?.[id] === undefined) team.assumptions.push(`${byId[id].name}: constellation unknown.`);
      if (!details?.level || !details.talents || !details.weapon?.key) team.assumptions.push(`${byId[id].name}: level, base talents or weapon still need checking.`);
    }
    return [team];
  }).sort((a, b) => a.missing.length - b.missing.length || b.score - a.score ||
    b.members.filter(id => account.readiness[id] === 'ready').length - a.members.filter(id => account.readiness[id] === 'ready').length || a.id.localeCompare(b.id));
}
export function recommend(account: Account, includeMissing = false, options: PlannerOptions = {}) {
  return rank(discover(account, includeMissing, options), account, options);
}

/** Reserve two candidates per driver before filling the budget, so one archetype cannot crowd out the account. */
export function allocationPool(candidates: Candidate[], budget = 256) {
  const sorted = candidates.filter(t => !t.missing.length).slice().sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (sorted.length <= budget) return sorted;
  const selected = new Map<string, Candidate>(), counts = new Map<string, number>();
  for (const t of sorted) if ((counts.get(t.anchor) ?? 0) < 2 && selected.size < budget) { selected.set(t.id, t); counts.set(t.anchor, (counts.get(t.anchor) ?? 0) + 1); }
  for (const t of sorted) if (selected.size < budget) selected.set(t.id, t);
  return [...selected.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
/** Maximum cardinality, then maximum objective within the disclosed pool. */
export function allocate(candidates: Candidate[], count: number, lockedIds: string[] = []): Candidate[] {
  if (!Number.isInteger(count) || count < 1 || count > 3) return [];
  const locked = lockedIds.map(id => candidates.find(t => t.id === id && !t.missing.length));
  if (locked.length > count || locked.some(t => !t) || new Set(lockedIds).size !== lockedIds.length) return [];
  for (let i = 0; i < locked.length; i++) for (let j = i + 1; j < locked.length; j++) if (locked[i]!.mask & locked[j]!.mask) return [];
  const initial = locked as Candidate[], initialMask = initial.reduce((m, t) => m | t.mask, 0n);
  const pool = allocationPool(candidates.filter(t => !(t.mask & initialMask)));
  let best: Candidate[] = [], bestScore = -Infinity;
  function visit(start: number, chosen: Candidate[], used: bigint, score: number) {
    if (chosen.length > best.length || (chosen.length === best.length && score > bestScore)) { best = [...chosen]; bestScore = score; }
    if (chosen.length === count || chosen.length + pool.length - start < best.length) return;
    const needed = count - chosen.length;
    if (best.length === count && score + pool.slice(start, start + needed).reduce((s, t) => s + t.score, 0) <= bestScore) return;
    for (let i = start; i < pool.length; i++) if (!(used & pool[i].mask)) visit(i + 1, [...chosen, pool[i]], used | pool[i].mask, score + pool[i].score);
  }
  visit(0, initial, initialMask, initial.reduce((s, t) => s + t.score, 0));
  return best;
}

/** Next offline jobs: prioritize uncovered decisions, reserving 1/4 for different drivers. */
export function researchQueue(candidates: Candidate[], budget = 12) {
  const supported = candidates.filter(t => !t.unsupported.length && !t.benchmark && !t.missing.length);
  const selected = supported.slice(0, Math.ceil(budget * .75));
  for (const team of supported) if (selected.length < budget && !selected.some(t => t.anchor === team.anchor)) selected.push(team);
  for (const team of supported) if (selected.length < budget && !selected.includes(team)) selected.push(team);
  return selected;
}
