import { demoAccount, teamMask } from './account';
import type { Account } from './account';
import type { Candidate } from './planner/types';
import type { Configuration } from './planner/configurations';
import { planConfigurations } from './planner/feedback';

// This is the illustrated onboarding account, never an override for a user's
// roster or a damage-ranked recommendation. The normal solver handles edits.
export function referenceDemoAccount(): Account {
  const account = structuredClone(demoAccount);
  account.owned.push('baizhu');
  account.readiness.baizhu = 'ready';
  return account;
}

export const referenceDemoTeams = [
  { name: 'Mavuika Melt', members: ['mavuika', 'citlali', 'xilonen', 'bennett'] },
  { name: 'Neuvillette Hydro', members: ['neuvillette', 'furina', 'kazuha', 'baizhu'] },
];

export function referenceDemoSeed(account: Account): Candidate[] {
  const { name, members } = referenceDemoTeams[1];
  if (!account.demo || !members.every(id => account.owned.includes(id))) return [];
  return [{
    id: members.slice().sort().join('|'), name, members, anchor: members[0],
    roles: ['Main DPS', 'Sub DPS', 'Support', 'Support'], origin: 'guide', reviewed: false,
    why: 'Illustrative demo team. This complete composition appears in the KQM Neuvillette guide (Version 5.8; checked 8 October 2026). It is not a measured account result.',
    caution: 'At C0, double Hydro gives up one distinct Hydro-reaction passive stack. Swirl Hydro for Kazuha’s buff and Viridescent Venerer. Baizhu’s healing helps Furina, but maximum Fanfare is not assumed; his small shields do not guarantee interruption protection. Check energy and refresh support abilities between Neuvillette’s field windows.',
    sources: ['https://keqingmains.com/neuvillette/#Hypercarry'],
    rotationOutline: 'Set up Neuvillette’s droplets and Furina’s Skill, Swirl Hydro with Kazuha, then use Baizhu’s Burst and Skill before Furina’s Burst and Neuvillette’s charged attacks. Refresh support abilities between field windows; consult the original guide for the full rotation.',
    score: 0, missing: [], mask: teamMask(members), retrieval: 0, ranking: 'unrated', metaTier: null,
    assumptions: ['Illustrative onboarding allocation, not a ranking or a predicted clear.'], unsupported: [],
  }];
}

export function referenceDemoPlan(configurations: Configuration[], account: Account) {
  const sample = referenceDemoAccount();
  if (!account.demo || account.mode !== 'abyss' || account.details || account.inventory || account.constellations
    || account.owned.length !== sample.owned.length || !sample.owned.every(id => account.owned.includes(id))
    || Object.keys(account.readiness).length !== Object.keys(sample.readiness).length
    || sample.owned.some(id => account.readiness[id] !== sample.readiness[id])) return undefined;
  const teams = referenceDemoTeams.map(team => configurations.find(c => c.driver === team.members[0]
    && c.members.length === 4 && team.members.every(id => c.members.includes(id))));
  if (teams.some(c => !c)) return undefined;
  const plan = planConfigurations(teams as Configuration[], { mode: 'abyss', region: 'Europe' }, []);
  if (!plan.complete) return undefined;
  plan.assignments.sort((a, b) => referenceDemoTeams.findIndex(t => t.members[0] === a.config.driver)
    - referenceDemoTeams.findIndex(t => t.members[0] === b.config.driver));
  return plan;
}

export function referenceDemoTeam(configuration: Configuration, account: Account) {
  return account.demo ? referenceDemoTeams.find(t => t.members.length === configuration.members.length
    && t.members.every(id => configuration.members.includes(id))) : undefined;
}
