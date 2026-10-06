import { byId } from '../account';
import type { Account } from '../account';
import { configurationCandidate } from './configurations';
import type { Configuration } from './configurations';
import { planConfigurations } from './feedback';
import type { BuilderPlan, ConfigurationAssignment, Preference, PreferenceContext, PlanSearchOptions } from './feedback';
import type { Encounter, EncounterPack } from './encounters';
import { buildTasks, uniqueBuildTasks } from './builds';

export interface PlanningContext {
  context: PreferenceContext; preferences: Preference[]; pack?: EncounterPack; targets?: Encounter[];
  locks?: string[]; now?: number; budget?: number;
}
export function solvePlan(configs: Configuration[], input: PlanningContext, search: PlanSearchOptions = {}) {
  return planConfigurations(configs, input.context, input.preferences, input.pack, input.budget ?? 48, input.locks ?? [], input.now ?? Date.now(), input.targets, search);
}
export function planMetrics(plan: BuilderPlan, account: Account) {
  const tasks = uniqueBuildTasks(plan.assignments.flatMap(r => buildTasks(account, r.config)));
  return {
    teams: plan.assignments.length, reviewed: plan.assignments.filter(r => r.config.seed?.reviewed).length,
    priority: plan.assignments.reduce((n, r) => n + configurationCandidate(r.config).score, 0),
    upgrades: tasks.filter(t => t.status === 'upgrade').length,
    unknownBuilds: [...new Set(plan.assignments.flatMap(r => r.config.members))].filter(id => !account.details?.[id]?.level || !account.details[id].weapon?.key).length,
    fit: plan.assignments.reduce((n, r) => n + r.fit.score, 0),
    sustain: plan.assignments.filter(r => r.config.dimensions.sustain > 0).length,
  };
}

/** Match complete teams by encounter, driver, then shared members; never compare arbitrary row indexes. */
export function comparePlans(before: ConfigurationAssignment[], after: ConfigurationAssignment[]) {
  let best: number[] = [], bestScore = -Infinity;
  function visit(i: number, used: Set<number>, pairs: number[], score: number) {
    if (i === after.length) { if (score > bestScore) { best = pairs; bestScore = score; } return; }
    visit(i + 1, used, [...pairs, -1], score);
    before.forEach((row, j) => {
      if (used.has(j)) return;
      const current = after[i], overlap = row.config.members.filter(id => current.config.members.includes(id)).length;
      if (row.encounter && current.encounter && row.encounter.id !== current.encounter.id) return;
      if (overlap < 2) return;
      visit(i + 1, new Set([...used, j]), [...pairs, j], score + overlap * 10 + (row.config.driver === current.config.driver ? 3 : 0));
    });
  }
  visit(0, new Set(), [], 0);
  const changes = after.map((row, i) => {
    const previous = before[best[i]];
    return { before: previous, after: row,
      removed: previous?.config.members.filter(id => !row.config.members.includes(id)) ?? [],
      added: row.config.members.filter(id => !previous?.config.members.includes(id)) };
  });
  const released = changes.flatMap(change => change.removed.filter(id => id !== change.before?.config.driver).map(character => {
    const destination = after.find(row => row !== change.after && row.config.members.includes(character));
    return { character, from: change.before!.config.driver, to: destination?.config.driver, team: destination ? after.indexOf(destination) + 1 : undefined };
  }));
  return { changes, released, dropped: before.filter((_, i) => !best.includes(i)) };
}

export interface PlanOption { id: string; label: string; reason: string; plan: BuilderPlan; }
export function shortlistPlans(configs: Configuration[], account: Account, input: PlanningContext, recommended = solvePlan(configs, input)): PlanOption[] {
  const baseline = planMetrics(recommended, account);
  const options: PlanOption[] = [{ id: 'recommended', label: 'Recommended', reason: `Best combined guide, rating and matchup fit. ${baseline.upgrades ? `${baseline.upgrades} known build upgrades.` : baseline.unknownBuilds ? `${baseline.unknownBuilds} builds still need checking.` : 'No recorded build shortfalls.'}`, plan: recommended }];
  if (!recommended.assignments.length) return options;
  const rejected = [recommended.assignments.map(r => r.config.compositionId)];
  for (const objective of ['investment', 'comfort', 'balanced'] as const) {
    if (options.length === 3) break;
    const plan = solvePlan(configs, input, { objective, rejectCompositions: rejected });
    if (plan.assignments.length !== recommended.assignments.length || plan.conflicts.length) continue;
    rejected.push(plan.assignments.map(r => r.config.compositionId));
    const metrics = planMetrics(plan, account);
    const change = comparePlans(recommended.assignments, plan.assignments);
    const moved = change.released.find(r => r.to);
    const newDriver = plan.assignments.find(r => !recommended.assignments.some(p => p.config.driver === r.config.driver));
    const different = newDriver ?? plan.assignments.find(r => !recommended.assignments.some(p => p.config.compositionId === r.config.compositionId))!;
    const previous = recommended.assignments.find(r => r.config.driver === different.config.driver);
    const newPartners = different.config.members.filter(id => id !== different.config.driver && !previous?.config.members.includes(id));
    const label = metrics.upgrades < baseline.upgrades && metrics.unknownBuilds <= baseline.unknownBuilds ? 'Less building' : metrics.sustain > baseline.sustain ? 'More sustain' : moved ? `Free ${byId[moved.character].name}` : newDriver ? `${byId[newDriver.config.driver].name} team` : `${byId[different.config.driver].name}${newPartners.length ? ` + ${newPartners.map(id => byId[id].name).join(' / ')}` : ' variant'}`;
    const reason = moved ? `${byId[moved.character].name} moves to ${byId[moved.to!].name}’s team. ${metrics.upgrades} known upgrades; ${metrics.reviewed} reviewed teams.`
      : `${metrics.upgrades} known upgrades; ${metrics.sustain} teams with covered sustain. ${different.config.members.filter(id => !recommended.assignments.some(r => r.config.members.includes(id))).map(id => byId[id].name).join(', ') || byId[different.config.driver].name} takes a different place in the plan.`;
    options.push({ id: `alternative-${options.length}`, label, reason, plan });
  }
  return options;
}
