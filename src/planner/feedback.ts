import { accountIdentity, byId, modeCount, teamMask } from '../account';
import type { Mode } from '../account';
import type { Configuration } from './configurations';
import { configurationCandidate } from './configurations';
import type { EncounterPack, Encounter, Region } from './encounters';
import { encounterStatus } from './encounters';

export type Scope = 'session' | 'cycle' | 'account';
export interface PreferenceContext { mode: Mode; region: Region; cycleId?: string; }
export type FeedbackAction =
  | { kind: 'exclude'; character: string }
  | { kind: 'keep'; members: string[] }
  | { kind: 'lock'; configurationId: string }
  | { kind: 'skip'; compositionId: string }
  | { kind: 'skip-configuration'; configurationId: string }
  | { kind: 'variant'; core: string[]; compositionId: string; encounterId?: string }
  | { kind: 'replace'; members: string[]; character: string; compositionId: string; encounterId?: string }
  | { kind: 'alternative'; core: string[]; playstyle: string; compositionId: string; encounterId?: string }
  | { kind: 'plan'; configurationIds: string[] }
  | { kind: 'comfort'; easier: boolean; sustain: boolean; maxRebuilds: number };
export interface Preference { id: string; scope: Scope; context: PreferenceContext; action: FeedbackAction; }
export function preferenceApplies(p: Preference, context: PreferenceContext) {
  if (p.scope === 'account') return true;
  if (p.context.mode !== context.mode || p.context.region !== context.region) return false;
  return p.scope === 'session' || Boolean(context.cycleId && p.context.cycleId === context.cycleId);
}
export function effectivePreferences(preferences: Preference[], context: PreferenceContext) {
  const scoped = preferences.filter(p => preferenceApplies(p, context));
  return scoped.filter((p, i) => {
    if (p.action.kind === 'comfort') return !scoped.slice(i + 1).some(n => n.action.kind === 'comfort');
    if (!['variant', 'replace', 'alternative'].includes(p.action.kind)) return true;
    const target = 'encounterId' in p.action ? p.action.encounterId : undefined;
    return !scoped.slice(i + 1).some(n => ['variant', 'replace', 'alternative'].includes(n.action.kind) && ('encounterId' in n.action ? n.action.encounterId : undefined) === target);
  });
}
const known = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length <= 4 && ids.every(id => typeof id === 'string' && Object.hasOwn(byId, id));
const strings = (ids: unknown, max = 3): ids is string[] => Array.isArray(ids) && ids.length <= max && ids.every(id => typeof id === 'string' && id.length < 2000);
export function parsePreferences(raw: unknown): Preference[] {
  if (!Array.isArray(raw) || raw.length > 200) throw new Error('Invalid builder preferences.');
  for (const p of raw) {
    if (!p || typeof p.id !== 'string' || p.id.length > 100 || !['session', 'cycle', 'account'].includes(p.scope) || !p.context || !['general', 'abyss', 'stygian'].includes(p.context.mode) || !['Europe', 'America', 'Asia'].includes(p.context.region) || (p.context.cycleId !== undefined && (typeof p.context.cycleId !== 'string' || p.context.cycleId.length > 100))) throw new Error('Invalid preference scope.');
    if (p.scope === 'cycle' && !p.context.cycleId) throw new Error('Cycle preferences need a verified cycle.');
    const a = p.action;
    if (!a || !['exclude', 'keep', 'lock', 'skip', 'skip-configuration', 'variant', 'replace', 'alternative', 'plan', 'comfort'].includes(a.kind)) throw new Error('Unknown feedback action.');
    if ((a.kind === 'exclude' || a.kind === 'replace') && !Object.hasOwn(byId, a.character)) throw new Error('Unknown excluded character.');
    if (['keep', 'replace'].includes(a.kind) && (!known(a.members) || !a.members.length)) throw new Error('Invalid retained core.');
    if (['variant', 'alternative'].includes(a.kind) && (!known(a.core) || !a.core.length)) throw new Error('Invalid interaction core.');
    if (['skip', 'variant', 'replace', 'alternative'].includes(a.kind) && (typeof a.compositionId !== 'string' || !known(a.compositionId.split('|')) || a.compositionId.split('|').length !== 4)) throw new Error('Invalid skipped composition.');
    if (['lock', 'skip-configuration'].includes(a.kind) && (typeof a.configurationId !== 'string' || a.configurationId.length > 2000)) throw new Error('Invalid configuration identity.');
    if (a.kind === 'alternative' && !['core-reactions', 'swirl-driver', 'burst-window', 'charged-carry', 'guide-outline'].includes(a.playstyle)) throw new Error('Invalid requested playstyle.');
    if (a.encounterId !== undefined && (typeof a.encounterId !== 'string' || a.encounterId.length > 100)) throw new Error('Invalid feedback encounter.');
    if (a.kind === 'plan' && !strings(a.configurationIds)) throw new Error('Invalid rejected plan.');
    if (a.kind === 'comfort' && (typeof a.easier !== 'boolean' || typeof a.sustain !== 'boolean' || !Number.isInteger(a.maxRebuilds) || a.maxRebuilds < 0 || a.maxRebuilds > 12)) throw new Error('Invalid comfort preference.');
  }
  if (new Set(raw.map(p => p.id)).size !== raw.length) throw new Error('Duplicate preference IDs.');
  return structuredClone(raw);
}
export function feedbackLabel(a: FeedbackAction) {
  const names = (ids: string[]) => ids.map(id => byId[id].name).join(' + ');
  switch (a.kind) {
    case 'exclude': return `Exclude ${byId[a.character].name}`;
    case 'keep': return `Keep ${names(a.members)} together`;
    case 'lock': return 'Keep this exact configuration';
    case 'skip': return `Skip ${names(a.compositionId.split('|'))}`;
    case 'skip-configuration': return 'Skip this role/build/rotation configuration';
    case 'variant': return `Same core: ${names(a.core)}; change a teammate`;
    case 'replace': return `Replace ${byId[a.character].name}; retain ${names(a.members)}`;
    case 'alternative': return `Different core and playstyle from ${a.playstyle}`;
    case 'plan': return 'Request a different complete account plan';
    case 'comfort': return `${a.easier ? 'Favor easier inputs; ' : ''}${a.sustain ? 'favor sustain; ' : ''}at most ${a.maxRebuilds} planned rebuilds`;
  }
}

export interface ConfigurationFit { matched: string[]; unresolved: string[]; contradicted: string[]; score: number; weight?: number; preferenceScore?: number; }
export function configurationFit(config: Configuration, encounter?: Encounter): ConfigurationFit {
  const effects = new Set(config.roles.flatMap(p => p.effects));
  const available = new Set<string>([...effects, ...config.roles.filter(p => byId[p.character].weapon === 'Bow').map(() => 'bow')]);
  for (const tag of config.seed?.encounterTags ?? []) available.add(tag);
  if (effects.has('hydro') && effects.has('electro') && !config.members.some(id => ['Dendro', 'Pyro'].includes(byId[id].element))) available.add('electro-charged');
  const covers = (tag: string) => available.has(tag.toLowerCase());
  const result: ConfigurationFit = { matched: [], unresolved: [], contradicted: [], score: 0, weight: 0, preferenceScore: 0 };
  if (!encounter) return result;
  for (const r of encounter.requirements ?? []) {
    if (r.kind === 'immunity') {
      // Resistance never enters this branch. An elemental immunity need not invalidate a mixed team.
      const attackElements = config.roles.flatMap(p => p.effects.filter(e => ['hydro', 'pyro', 'electro', 'dendro', 'cryo', 'swirl'].includes(e)));
      const blocked = config.roles.length === 4 && attackElements.length > 0 && attackElements.every(e => r.tags.map(t => t.toLowerCase()).includes(e));
      (blocked ? result.contradicted : result.unresolved).push(`${r.stage}: ${r.interpretation}`);
    } else if (r.tags.some(covers)) {
      result.matched.push(`${r.stage}: ${r.interpretation}`); result.score++;
      result.weight! += r.kind === 'modifier' ? 2 : 6;
    } else result.unresolved.push(`${r.stage}: ${r.interpretation}`);
  }
  // Element and weapon selections are explicit roster preferences. Reviewed
  // encounter requirements above still require a covered executable effect.
  const coversPreference = (tag: string) => ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Dendro', 'Anemo', 'Geo'].includes(tag) ? config.members.some(id => byId[id].element === tag) : tag === 'bow' ? config.members.some(id => byId[id].weapon === 'Bow') : covers(tag);
  for (const tag of encounter.preferred) if (coversPreference(tag)) { result.matched.push(`Your preference: ${tag}`); result.score++; result.preferenceScore!++; } else result.unresolved.push(`Your ${tag} preference is not established for this team.`);
  for (const tag of encounter.avoid) if (coversPreference(tag)) { result.score--; result.preferenceScore!--; }
  if (!encounter.requirements?.length) result.unresolved.push('Encounter mechanics have no reviewed executable interpretation.');
  return result;
}
export interface ConfigurationAssignment { config: Configuration; encounter?: Encounter; fit: ConfigurationFit; }
export interface BuilderPlan { assignments: ConfigurationAssignment[]; conflicts: string[]; considered: number; poolSizes: number[]; omitted: number; nodes: number; complete: boolean; }
export interface PlanSearchOptions {
  rejectCompositions?: string[][]; reservedIds?: string[];
  objective?: 'balanced' | 'investment' | 'comfort';
}

/** Exact joint search inside each disclosed pool; require cores/locks across the plan, not in every team. */
export function planConfigurations(configurations: Configuration[], context: PreferenceContext, preferences: Preference[], pack?: EncounterPack, budget = 48, externalLocks: string[] = [], now = Date.now(), practiceTargets?: Encounter[], search: PlanSearchOptions = {}): BuilderPlan {
  const actions = preferences.filter(p => preferenceApplies(p, context)).map(p => p.action);
  const comfort = actions.filter(a => a.kind === 'comfort').at(-1);
  const current = pack && pack.mode === context.mode && pack.region === context.region && pack.cycleId === context.cycleId && encounterStatus(pack, now) === 'current' ? pack : undefined;
  const encounters = current?.encounters ?? practiceTargets;
  const count = modeCount[context.mode], excluded = actions.flatMap(a => a.kind === 'exclude' ? [accountIdentity(a.character)] : []);
  const skipped = actions.flatMap(a => ['skip', 'variant', 'replace', 'alternative'].includes(a.kind) ? [(a as { compositionId: string }).compositionId] : []);
  const locks = actions.flatMap(a => a.kind === 'lock' ? [a.configurationId] : []);
  const requirements = effectivePreferences(preferences, context).map(p => p.action).filter(a => ['keep', 'variant', 'replace', 'alternative'].includes(a.kind));
  const fitsRequest = (c: Configuration, a: FeedbackAction, encounter?: Encounter): boolean => {
    if ('encounterId' in a && a.encounterId && encounter?.id !== a.encounterId) return false;
    if (a.kind === 'keep' || a.kind === 'replace') return a.members.every(id => c.members.includes(id)) && (a.kind !== 'replace' || !c.members.includes(a.character));
    if (a.kind === 'variant') return a.core.every(id => c.members.includes(id));
    if (a.kind === 'alternative') return c.playstyle !== a.playstyle && !a.core.every(id => c.members.includes(id));
    return true;
  };
  const eligible = configurations.filter(c => !c.exploratory && !c.members.some(id => excluded.includes(accountIdentity(id))) && !skipped.includes(c.compositionId) && !actions.some(a => a.kind === 'skip-configuration' && a.configurationId === c.id) && c.rebuilds.length <= (comfort?.maxRebuilds ?? 0) && !c.checks.some(ch => ch.hard && ch.state === 'contradicted'));
  const scores = new Map(eligible.map(c => [c.id, configurationCandidate(c, comfort?.easier, comfort?.sustain).score
    - (search.objective === 'investment' ? c.selection.buildIssues * 5 : 0)
    + (search.objective === 'comfort' ? (c.dimensions.sustain > 0 ? 6 : 0) - c.dimensions.execution * 3 : 0)]));
  const conflicts: string[] = [];
  for (const id of locks) if (!eligible.some(c => c.id === id)) conflicts.push('A locked configuration is unavailable under the active exclusions, build policy or skip requests. Remove its lock or the conflicting preference.');
  for (const id of externalLocks) if (!eligible.some(c => c.compositionId === id)) conflicts.push('A guide/custom team lock conflicts with builder constraints. Unlock it in the guide planner or remove the conflicting preference.');
  for (const a of requirements) if (!eligible.some(c => fitsRequest(c, a, 'encounterId' in a && a.encounterId ? encounters?.find(e => e.id === a.encounterId) : undefined))) conflicts.push(`No covered candidate satisfies: ${feedbackLabel(a)}. Remove this specific request to relax it.`);
  const size = Math.max(1, Math.min(256, budget));
  const pools = Array.from({ length: count }, (_, i) => {
    const encounter = encounters?.[i];
    const ranked = eligible.map(config => ({ config, encounter, fit: configurationFit(config, encounter) })).filter(a => !a.fit.contradicted.length).sort((a, b) => (b.fit.preferenceScore ?? 0) - (a.fit.preferenceScore ?? 0) || (scores.get(b.config.id)! + (b.fit.weight ?? 0)) - (scores.get(a.config.id)! + (a.fit.weight ?? 0)) || a.config.id.localeCompare(b.config.id));
    const chosen = new Map<string, ConfigurationAssignment>();
    // Every lock gets space. Requests and driver/playstyle diversity reserve candidates before score filling.
    for (const row of ranked) if (locks.includes(row.config.id) || externalLocks.includes(row.config.compositionId) || search.reservedIds?.includes(row.config.id)) chosen.set(row.config.id, row);
    for (const request of requirements) for (const row of ranked.filter(r => fitsRequest(r.config, request, encounter)).slice(0, 8)) chosen.set(row.config.id, row);
    const groups = new Map<string, number>();
    for (const row of ranked) { const key = `${row.config.driver}:${row.config.playstyle}`; if (chosen.size < size && (groups.get(key) ?? 0) < 2) { chosen.set(row.config.id, row); groups.set(key, (groups.get(key) ?? 0) + 1); } }
    for (const row of ranked) if (chosen.size < size) chosen.set(row.config.id, row);
    return [...chosen.values()];
  });
  let best: ConfigurationAssignment[] = [], bestFit = -Infinity, bestScore = -Infinity, nodes = 0;
  const planKey = (ids: string[]) => ids.slice().sort().join('~');
  function visit(side: number, used: bigint, gear: Set<string>, chosen: ConfigurationAssignment[], fit: number, score: number) {
    nodes++;
    const satisfied = locks.every(id => chosen.some(a => a.config.id === id)) && externalLocks.every(id => chosen.some(a => a.config.compositionId === id)) && requirements.every(r => chosen.some(a => fitsRequest(a.config, r, a.encounter)));
    const rejectedPlan = actions.some(a => a.kind === 'plan' && planKey(a.configurationIds) === planKey(chosen.map(a => a.config.id)))
      || search.rejectCompositions?.some(ids => planKey(ids) === planKey(chosen.map(a => a.config.compositionId)));
    if (satisfied && !rejectedPlan && (chosen.length > best.length || (chosen.length === best.length && (fit > bestFit || (fit === bestFit && score > bestScore))))) { best = [...chosen]; bestFit = fit; bestScore = score; }
    if (side === count || chosen.length + count - side < best.length) return;
    for (const row of pools[side]) {
      const mask = teamMask(row.config.members);
      if ((used & mask) || row.config.equipmentIds.some(id => gear.has(id))) continue;
      if (chosen.reduce((sum, a) => sum + a.config.rebuilds.length, 0) + row.config.rebuilds.length > (comfort?.maxRebuilds ?? 0)) continue;
      const next = [...chosen, row];
      if (locks.some(id => !next.some(a => a.config.id === id) && eligible.find(c => c.id === id) && Boolean(teamMask(eligible.find(c => c.id === id)!.members) & (used | mask)))) continue;
      // Explicit player preferences take precedence. Encounter bonuses inform strength
      // without forcing a weaker team solely to collect every optional modifier.
      visit(side + 1, used | mask, new Set([...gear, ...row.config.equipmentIds]), next, fit + (row.fit.preferenceScore ?? 0), score + scores.get(row.config.id)! + (row.fit.weight ?? 0));
    }
    visit(side + 1, used, gear, chosen, fit, score);
  }
  if (!conflicts.length) visit(0, 0n, new Set(), [], 0, 0);
  if (!best.length && !conflicts.length) conflicts.push('No joint plan satisfies all current cores, locks and exclusions inside the search pool. Remove one listed preference or expand role coverage. Unknown teams are not certified as incompatible.');
  return { assignments: best, conflicts: [...new Set(conflicts)], considered: eligible.length, poolSizes: pools.map(p => p.length), omitted: Math.max(0, eligible.length - new Set(pools.flatMap(p => p.map(r => r.config.id))).size), nodes, complete: best.length === count };
}

export function explainPlanChange(previous: ConfigurationAssignment[], next: ConfigurationAssignment[]) {
  if (!previous.length) return 'Generated a new account plan; inspect the assumptions for each configuration.';
  return next.map((row, i) => {
    const before = previous.find(p => row.encounter ? p.encounter?.id === row.encounter.id : p.config.driver === row.config.driver) ?? previous[i];
    if (!before) return `Added ${row.config.members.map(id => byId[id].name).join(' / ')}.`;
    const removed = before.config.members.filter(id => !row.config.members.includes(id)), added = row.config.members.filter(id => !before.config.members.includes(id));
    return `${row.encounter?.name ?? `Team ${i + 1}`}: ${removed.length || added.length ? `replaced ${removed.map(id => byId[id].name).join(', ') || 'none'} with ${added.map(id => byId[id].name).join(', ') || 'none'}` : before.config.id === row.config.id ? 'retained' : 'same members, changed roles or build assumptions'}. ${row.fit.unresolved.length} encounter checks unresolved.`;
  }).join(' ') + (next.length < previous.length ? ` ${previous.length - next.length} team(s) can no longer be filled under these constraints.` : '');
}
