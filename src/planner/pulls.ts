import { accountIdentity, byId, characters } from '../account';
import type { Account } from '../account';
import { generateConfigurations, configurationCandidate } from './configurations';
import type { Configuration, GenerationOptions } from './configurations';
import { comparePlans, planMetrics, solvePlan } from './account-plans';
import type { PlanningContext } from './account-plans';
import { buildTasks, projectBuilds, uniqueBuildTasks } from './builds';
import { discover, metaPack } from './planner';
import type { BuilderPlan } from './feedback';
import { equipmentLocation } from '../import-good';

export const pullCandidates = (account: Account) => characters.filter(c => c.accountId !== 'traveler' && c.id !== 'aloy' && !account.owned.some(id => accountIdentity(id) === accountIdentity(c.id)));

function rebase(input: PlanningContext, previous: Configuration[], next: Configuration[]): PlanningContext {
  const remap = (id: string) => {
    const old = previous.find(c => c.id === id);
    return next.find(c => c.compositionId === old?.compositionId && c.driver === old.driver && c.playstyle === old.playstyle && c.rebuilds.join() === old.rebuilds.join())?.id ?? id;
  };
  return { ...input, preferences: input.preferences.map(p => ({ ...p, action: 'configurationId' in p.action ? { ...p.action, configurationId: remap(p.action.configurationId) } : p.action.kind === 'plan' ? { ...p.action, configurationIds: p.action.configurationIds.map(remap) } : p.action })) };
}

export function preparePullStudy(account: Account, input: PlanningContext, options: GenerationOptions = {}, supplied?: { configurations: Configuration[]; plan: BuilderPlan }) {
  const configurations = supplied?.configurations ?? generateConfigurations(account, options).configurations;
  const baseline = supplied?.plan ?? solvePlan(configurations, input);
  const tasks = uniqueBuildTasks(baseline.assignments.flatMap(r => buildTasks(account, r.config)));
  const upgrades = tasks.filter(t => t.status === 'upgrade');
  const improvedAccount = projectBuilds(account, upgrades);
  const improvedConfigurations = upgrades.length ? generateConfigurations(improvedAccount, options).configurations : configurations;
  const improved = upgrades.length ? solvePlan(improvedConfigurations, rebase(input, configurations, improvedConfigurations)) : baseline;
  return { account, input, options, configurations, baseline, improvedAccount, improved, upgrades, tasks };
}
export type PullStudy = ReturnType<typeof preparePullStudy>;

export function evaluatePull(study: PullStudy, character: string) {
  if (!pullCandidates(study.account).some(c => c.id === character)) throw new Error('Choose an unowned wish character.');
  // Stale details from a deselected character must never become the hypothetical pull's gear/C6.
  const account: Account = { ...study.account, owned: [...study.account.owned, character],
    constellations: { ...study.account.constellations, [character]: 0 },
    details: { ...study.account.details, [character]: {} },
    readiness: { ...study.account.readiness, [character]: 'unknown' },
    ...(study.account.inventory ? { inventory: { ...study.account.inventory } } : {}),
  };
  if (account.inventory) {
    // No equipment can be treated as already equipped on a newly acquired character.
    for (const kind of ['artifacts', 'weapons'] as const) {
      const equipped = (row: Record<string, unknown>) => accountIdentity(equipmentLocation(String(row.location)) ?? '') === accountIdentity(character);
      if (account.inventory[kind]?.some(equipped)) account.inventory[kind] = account.inventory[kind]!.map(row => equipped(row) ? { ...row, location: '' } : row);
    }
  }
  const generated = generateConfigurations(account, study.options);
  const after = solvePlan(generated.configurations, rebase(study.input, study.configurations, generated.configurations), { reservedIds: study.baseline.assignments.map(r => r.config.id) });
  const beforeMetrics = planMetrics(study.baseline, study.account), afterMetrics = planMetrics(after, account), buildMetrics = planMetrics(study.improved, study.improvedAccount);
  const beforeCompositions = new Set(study.configurations.map(c => c.compositionId));
  const unlocked = generated.configurations.filter(c => !c.exploratory && c.members.includes(character) && !beforeCompositions.has(c.compositionId)).sort((a, b) => configurationCandidate(b).score - configurationCandidate(a).score).filter((c, i, rows) => rows.findIndex(r => r.compositionId === c.compositionId) === i);
  const selected = after.assignments.find(r => r.config.members.includes(character));
  const delta = comparePlans(study.baseline.assignments, after.assignments);
  const teamsAdded = afterMetrics.teams - beforeMetrics.teams;
  const matchupGains = after.assignments.flatMap(row => row.fit.matched.filter(m => !study.baseline.assignments.some(old => old.encounter?.id === row.encounter?.id && old.fit.matched.includes(m))).map(text => ({ encounter: row.encounter?.name, text })));
  const requiredConditions = (selected?.config ?? unlocked[0])?.checks.filter(c => c.id.startsWith('recipe-constellation:') && c.state !== 'supported').map(c => c.text) ?? [];
  const qualified = selected && !requiredConditions.length && (selected.config.seed?.reviewed || selected.config.roles.length === 4);
  const improves = Boolean(qualified && (teamsAdded > 0 || afterMetrics.fit > beforeMetrics.fit || afterMetrics.reviewed > beforeMetrics.reviewed || delta.released.some(r => r.to) || afterMetrics.priority >= beforeMetrics.priority + 4));
  const buildFirst = study.upgrades.length > 0 && teamsAdded <= 0 && afterMetrics.fit <= buildMetrics.fit && (!improves || buildMetrics.priority >= afterMetrics.priority);
  const verdict = buildFirst ? 'Build first' : improves ? 'Pull priority' : 'Save';
  const reason = buildFirst ? 'Known upgrades improve the owned plan before this pull adds a stronger account option.' : requiredConditions.length ? 'This guide example has an unestablished constellation requirement. It does not establish a C0 pull priority.' : improves ? teamsAdded > 0 ? 'Adds a complete team to the account plan.' : delta.released.some(r => r.to) ? 'Improves the support allocation across your teams.' : afterMetrics.fit > beforeMetrics.fit ? 'Covers more of your selected matchup requirements.' : 'Adds a better supported option under the recorded builds and conditional ratings.' : !unlocked.length ? 'No complete team unlock is established with this roster. Check the missing partners and coverage.' : !selected ? 'New teams are possible, but the owned plan still wins under your preferences.' : 'No clear account advantage is established over building or keeping your existing teams.';
  const investment = uniqueBuildTasks(after.assignments.flatMap(r => buildTasks(account, r.config)));
  if (!selected && unlocked[0]) investment.push(...buildTasks(account, unlocked[0]));
  const partnerTeams = discover(account, true, { requiredCharacter: character }).filter(c => c.missing.length).sort((a, b) => a.missing.length - b.missing.length || Number(b.reviewed) - Number(a.reviewed)).slice(0, 3);
  const ratingPartners = [...new Set(metaPack.entries.filter(e => e.id === character).flatMap(e => e.partners))];
  return { character, assumedConstellation: 0 as const, account, after, verdict, reason, selected,
    teamsAdded, unlocked: unlocked.slice(0, 3), unlockedCount: unlocked.length, delta, matchupGains, investment: uniqueBuildTasks(investment),
    requiredPartners: selected?.config.members.filter(id => id !== character) ?? unlocked[0]?.members.filter(id => id !== character) ?? [],
    partnerTeams, ratingPartners, requiredConditions, coverage: generated.coverage,
    metrics: { before: beforeMetrics, after: afterMetrics, build: buildMetrics },
  };
}
export type PullEvaluation = ReturnType<typeof evaluatePull>;

/** Compare marginal account improvements, rather than the character's standalone tier. */
export function rankPulls(results: PullEvaluation[]) {
  return results.slice().sort((a, b) => ['Pull priority', 'Build first', 'Save'].indexOf(a.verdict) - ['Pull priority', 'Build first', 'Save'].indexOf(b.verdict)
    || b.teamsAdded - a.teamsAdded
    || (b.metrics.after.fit - b.metrics.before.fit) - (a.metrics.after.fit - a.metrics.before.fit)
    || (b.metrics.after.priority - b.metrics.before.priority) - (a.metrics.after.priority - a.metrics.before.priority)
    || b.delta.released.filter(r => r.to).length - a.delta.released.filter(r => r.to).length
    || (b.unlocked[0] ? configurationCandidate(b.unlocked[0]).score : -Infinity) - (a.unlocked[0] ? configurationCandidate(a.unlocked[0]).score : -Infinity)
    || b.unlockedCount - a.unlockedCount
    || a.investment.filter(t => t.status === 'upgrade').length - b.investment.filter(t => t.status === 'upgrade').length
    || a.character.localeCompare(b.character));
}

export interface BannerPublication { characters: string[]; region: string; startsAt: string; endsAt: string; source: string; checkedAt: string; verified: boolean; }
export function bannerAvailability(character: string, region: string, publications: BannerPublication[] = [], now = Date.now()) {
  const known = publications.find(p => p.verified && p.region === region && p.characters.includes(character)
    && /^https:\/\/(?:genshin\.hoyoverse\.com|www\.hoyolab\.com)\//.test(p.source)
    && Date.parse(p.startsAt) <= now && now < Date.parse(p.endsAt) && Date.parse(p.checkedAt) <= now && now - Date.parse(p.checkedAt) < 7 * 86400000);
  return known ? { status: 'Verified available', source: known.source, endsAt: known.endsAt } : { status: 'Banner unverified', source: 'https://genshin.hoyoverse.com/en/news', endsAt: undefined };
}

export function pullSummary(result: PullEvaluation) {
  const team = result.selected?.config ?? result.unlocked[0];
  if (!team) return `${byId[result.character].name}: no covered team unlock with the current partners.`;
  const freed = result.delta.released.find(r => r.to);
  return `${byId[result.character].name} ${result.selected ? 'joins' : 'can unlock'} ${team.members.map(id => byId[id].name).join(' / ')}. ${freed ? `${byId[freed.character].name} moves to team ${freed.team} with ${byId[freed.to!].name}.` : 'No support move to another team is established.'}`;
}
