import { accountIdentity, byId, teamMask } from '../account';
import type { Account } from '../account';
import { equipmentLocation } from '../import-good';
import { compositionKey, discover, matchSlots } from './planner';
import { graph } from '../knowledge';
import mechanicsProvenance from '../data/mechanics-provenance.json';
import type { Candidate } from './types';
import type { MetaPack } from './types';
import { conditionalRatings } from './ratings';
import { buildTasks } from './builds';

export type CheckState = 'supported' | 'contradicted' | 'unresolved';
export interface Check { id: string; state: CheckState; text: string; source?: string; hard?: boolean; }
export type Effect = 'hydro' | 'dendro' | 'electro' | 'pyro' | 'cryo' | 'swirl' | 'core-trigger' | 'healing' | 'shield' | 'grouping' | 'normal-driver' | 'charged-driver' | 'burst-driver' | 'normal-proc' | 'hit-proc' | 'damage-proc' | 'atk-buff' | 'hp-drain';
export interface CapabilityProfile {
  id: string; character: string; role: string; field: 'driver' | 'support'; effects: Effect[];
  setup: string; cooldown: number; burstCost?: number; source: string; checkedAt: string;
  sourceSnapshot?: { sha256: string; accessedAt: string; ruleRevision: string };
}
const guide = (id: string) => `https://keqingmains.com/q/${id === 'kuki' ? 'shinobu' : id}-quickguide/`;
function profile(character: string, field: CapabilityProfile['field'], role: string, effects: Effect[], setup: string, cooldown: number, burstCost?: number): CapabilityProfile {
  const source = guide(character), snapshot = mechanicsProvenance.sources.find(s => s.url === source && s.status === 200);
  return { id: `${character}:${field}`, character, field, role, effects, setup, cooldown, burstCost, source, checkedAt: snapshot ? '2026-09-30' : '2026-10-03', ...(snapshot ? { sourceSnapshot: { sha256: snapshot.sha256, accessedAt: mechanicsProvenance.accessCheckedAt, ruleRevision: mechanicsProvenance.ruleRevision } } : {}) };
}
/** Narrow kit coverage. Durations below are cooldowns, not certified animation or application timings. */
export const profiles: CapabilityProfile[] = [
  profile('citlali', 'support', 'Cryo application and shield', ['cryo', 'shield'], 'Use Skill and Burst to establish Cryo before the carry window; verify application timing.', 16, 60),
  profile('xilonen', 'support', 'Resistance support and healing', ['healing'], 'Use Skill and two normal attacks to activate samples; Burst for healing. Check team-element conditions.', 7, 60),
  profile('escoffier', 'support', 'Off-field Cryo and healing', ['cryo', 'healing'], 'Use Skill for Cryo and Burst for healing; resistance reduction depends on the Hydro/Cryo team count.', 15, 60),
  profile('kaeya', 'support', 'Off-field Cryo', ['cryo'], 'Skill then Burst near the target; maintain close range.', 15, 60),
  profile('rosaria', 'support', 'Off-field Cryo', ['cryo'], 'Skill and Burst; keep the enemy inside the field.', 15, 60),
  profile('nahida', 'driver', 'Dendro normal-attack driver', ['dendro', 'normal-driver'], 'Mark enemies with Skill; use normal attacks during the driver window.', 6),
  profile('nahida', 'support', 'Off-field Dendro', ['dendro'], 'Mark enemies with Skill; reapply marks on new waves. Burst is optional and not budgeted.', 6),
  profile('kuki', 'support', 'EM core trigger and healing', ['electro', 'core-trigger', 'healing'], 'Use Skill near the cores. Stay in ring range; manage HP loss on cast.', 15),
  profile('raiden', 'support', 'Off-field EM core trigger', ['electro', 'core-trigger', 'damage-proc'], 'Use Skill; coordinated hits require enemy damage. Do not use Burst in this role.', 10),
  profile('raiden', 'driver', 'Burst driver', ['electro', 'burst-driver', 'normal-driver'], 'Skill before support setup; Burst and normal-attack combos in the driver window.', 18, 90),
  profile('xingqiu', 'support', 'Coordinated Hydro', ['hydro', 'normal-proc'], 'Skill then Burst; weave normal attacks to launch Rain Swords.', 21, 80),
  profile('yelan', 'support', 'Coordinated Hydro', ['hydro', 'normal-proc'], 'Skill then Burst; weave normal attacks to launch coordinated attacks.', 18, 70),
  profile('barbara', 'driver', 'Hydro healing driver', ['hydro', 'normal-driver', 'healing'], 'Skill then normal attacks in range; Burst is emergency healing, not assumed each loop.', 32),
  profile('barbara', 'support', 'Healing support', ['healing'], 'Skill for healing; do not assume sustained off-field Hydro from its contact ring.', 32),
  profile('sucrose', 'driver', 'Swirl normal-attack driver', ['swirl', 'grouping', 'normal-driver'], 'Apply an aura before Skill and normal attacks. Burst is optional.', 15),
  profile('sucrose', 'support', 'Swirl and grouping', ['swirl', 'grouping'], 'Use Skill on an applied aura; Burst is optional.', 15),
  profile('fischl', 'support', 'Off-field Electro', ['electro'], 'Summon Oz with Skill; alternate Burst to refresh Oz. Refresh energy remains a check.', 25, 60),
  profile('beidou', 'support', 'Hit-triggered Electro', ['electro', 'hit-proc'], 'Skill and Burst; discharge needs normal or charged attack damage, not Raiden Burst damage.', 20, 80),
  profile('neuvillette', 'driver', 'Hydro charged-attack carry', ['hydro', 'charged-driver'], 'Skill / Burst droplets, then charged beams. This outline does not weave normal attacks.', 18, 70),
  profile('furina', 'support', 'Hydro and conditional damage buff', ['hydro', 'hp-drain'], 'Skill and Burst; healing and HP changes determine Fanfare.', 20, 60),
  profile('bennett', 'support', 'Healing and ATK support', ['pyro', 'healing', 'atk-buff'], 'Skill then Burst; stay in the field. Particle funneling must be checked.', 15, 60),
  profile('xiangling', 'support', 'Off-field Pyro', ['pyro'], 'Skill and Burst after buffs; catch particles on Xiangling.', 20, 80),
  profile('kazuha', 'support', 'Swirl and grouping', ['swirl', 'grouping'], 'Swirl the intended aura with Skill; Burst and its energy are not assumed.', 9),
  profile('zhongli', 'support', 'Shield support', ['shield'], 'Hold Skill for shield; remain near enemies for resistance reduction.', 12),
];
export type Playstyle = 'core-reactions' | 'swirl-driver' | 'burst-window' | 'charged-carry' | 'guide-outline';
export interface RotationStep { character: string; action: string; seconds: number; }
export interface Configuration {
  id: string; compositionId: string; members: string[]; driver: string; roles: CapabilityProfile[];
  playstyle: Playstyle; core: string[]; origin: 'generated' | 'guide' | 'custom' | 'observed';
  seed?: Candidate; recipeMembership: boolean; rotation: { seconds: number; steps: RotationStep[]; assumption: string };
  checks: Check[]; sources: string[]; equipmentIds: string[]; rebuilds: string[];
  selection: { score: number; reasons: string[]; ratings: ReturnType<typeof conditionalRatings>; buildIssues: number };
  exploratory: boolean;
  dimensions: { supported: number; unresolved: number; buildGaps: number; sustain: number; execution: number; investment: number };
}
export interface GenerationOptions { allowRebuild?: boolean; maxCompositions?: number; extraSeeds?: Candidate[]; meta?: MetaPack; now?: string; }

function fingerprint(value: unknown) {
  let hash = 14695981039346656037n;
  for (const char of JSON.stringify(value)) hash = BigInt.asUintN(64, (hash ^ BigInt(char.charCodeAt(0))) * 1099511628211n);
  return hash.toString(16).padStart(16, '0');
}
export interface EnergyBudget { character: string; particleEnergyBeforeER: number; flatEnergy: number; recharge: number; casts: number; }
/** Explicit scheduling/budget arithmetic. Particle amounts must be supplied, never inferred from element presence. */
export function assessRotationSchedule(roles: CapabilityProfile[], steps: RotationStep[], seconds: number, energy: EnergyBudget[] = []): Check[] {
  const checks: Check[] = [];
  const valid = Number.isFinite(seconds) && seconds > 0 && steps.every(s => Number.isFinite(s.seconds) && s.seconds >= 0);
  checks.push({ id: 'field-budget', state: valid && steps.reduce((n, s) => n + s.seconds, 0) <= seconds ? 'supported' : 'contradicted', hard: true, text: 'The proposed field windows must fit inside one loop.' });
  for (const p of roles) {
    checks.push({ id: `cooldown:${p.id}`, state: seconds >= p.cooldown ? 'supported' : 'contradicted', hard: true, text: `${byId[p.character].name}: repeat interval ${seconds}s versus covered cooldown ${p.cooldown}s.`, source: p.source });
    if (!p.burstCost) continue;
    const budget = energy.find(e => e.character === p.character);
    if (!budget) continue;
    const valid = [budget.particleEnergyBeforeER, budget.flatEnergy, budget.recharge, budget.casts].every(n => Number.isFinite(n) && n >= 0) && Number.isInteger(budget.casts);
    const income = budget.particleEnergyBeforeER * budget.recharge / 100 + budget.flatEnergy;
    checks.push({ id: `energy-budget:${p.character}`, state: valid && income >= p.burstCost * budget.casts ? 'supported' : 'contradicted', hard: true, text: `${byId[p.character].name}: supplied repeat-loop budget ${income} Energy versus ${p.burstCost * budget.casts} cost; no initial Energy reused in later loops.`, source: p.source });
  }
  return checks;
}

/** Snapshot-local identities survive backup/restore; rows are never implicitly moved or cloned. */
export function equipmentFor(account: Account, character: string) {
  const identity = accountIdentity(character);
  const rows = (['weapons', 'artifacts'] as const).flatMap(kind => (account.inventory?.[kind] ?? []).flatMap((row, index) =>
    accountIdentity(equipmentLocation(String(row.location)) ?? '') === identity ? [{ id: `${kind}:${index}`, kind, row }] : []));
  const artifactSets: Record<string, number> = {};
  const substats: Record<string, number> = {};
  for (const { kind, row } of rows) if (kind === 'artifacts') {
    artifactSets[String(row.setKey)] = (artifactSets[String(row.setKey)] ?? 0) + 1;
    for (const s of row.substats as { key: string; value: number }[]) substats[s.key] = (substats[s.key] ?? 0) + s.value;
  }
  return { rows, artifactSets, substats, observed: account.details?.[character], conditionalBuffsIncluded: false as const };
}

export function assessConfiguration(account: Account, members: string[], driver: string, options: GenerationOptions = {}, seed?: Candidate): Configuration {
  const roles = members.flatMap(id => {
    const p = profiles.find(p => p.character === id && p.field === (id === driver ? 'driver' : 'support'));
    if (!p) return [];
    if (p.character === 'xilonen' && members.filter(m => ['Pyro', 'Hydro', 'Electro', 'Cryo'].includes(byId[m].element)).length < 2) return [{ ...p, effects: p.effects.filter(e => e !== 'healing') }];
    if (p.effects.includes('core-trigger') && !members.some(m => byId[m].element === 'Dendro')) return [{ ...p, effects: p.effects.filter(e => e !== 'core-trigger'), role: p.character === 'kuki' ? 'Electro application and healing' : 'Off-field Electro', setup: p.character === 'kuki' ? 'Use Skill for Electro and healing. Match the HP/EM build to the team; no core-trigger role is assigned.' : p.setup }];
    return [p];
  });
  const effects = roles.flatMap(p => p.effects), has = (e: Effect) => effects.includes(e);
  const trigger = roles.filter(p => p.effects.includes('core-trigger'));
  const playstyle: Playstyle = has('dendro') && has('hydro') && trigger.length ? 'core-reactions' : has('swirl') && has('normal-driver') && roles.find(p => p.character === driver)?.effects.includes('swirl') ? 'swirl-driver' : has('burst-driver') ? 'burst-window' : has('charged-driver') ? 'charged-carry' : 'guide-outline';
  const checks: Check[] = [];
  function check(id: string, state: CheckState, text: string, source?: string, hard = false) { checks.push({ id, state, text, source, hard }); }
  check('identities', members.length === 4 && new Set(members.map(accountIdentity)).size === 4 && members.every(id => account.owned.includes(id)) ? 'supported' : 'contradicted', 'Four owned, distinct account identities.', undefined, true);
  const missing = members.filter(id => !roles.some(p => p.character === id));
  check('coverage', missing.length ? 'unresolved' : 'supported', missing.length ? `Role mechanics not covered: ${missing.map(id => byId[id].name).join(', ')}. Original guide constraints remain necessary.` : 'All assigned roles are inside the pilot kit coverage.');
  const needNormal = roles.some(p => p.effects.includes('normal-proc'));
  if (needNormal) check('normal-activation', has('normal-driver') ? 'supported' : missing.includes(driver) ? 'unresolved' : 'contradicted', 'Coordinated Hydro needs normal attack inputs; this charged-beam outline has none.', guide('xingqiu'), true);
  if (members.includes('beidou') && driver === 'raiden') check('beidou-raiden', 'contradicted', 'Raiden Burst attacks do not trigger Beidou Burst discharges in the proposed shared window.', guide('beidou'), true);
  if (playstyle === 'core-reactions') {
    check('core-path', 'supported', 'A covered Hydro source and Dendro source create cores; the assigned Electro Skill can hit them.', guide('kuki'));
    check('trigger-ownership', trigger.length === 1 ? 'supported' : 'contradicted', trigger.length === 1 ? `${byId[trigger[0].character].name} is the assigned core trigger.` : 'Two core triggers compete: the outline cannot assign all Hyperblooms to one EM build.', guide('kuki'), true);
    if (has('pyro')) check('pyro-competition', 'unresolved', 'Pyro can change aura and consume cores; this mixed reaction ownership is outside pilot coverage.', guide('nahida'));
    if (has('swirl')) check('swirl-ownership', 'unresolved', 'Electro Swirl can trigger cores; ownership between the Anemo driver and Electro trigger needs measurement.', guide('sucrose'));
  }
  check('application', 'unresolved', 'Application rates, ICD, enemy movement and hit counts are not simulated. Reaction totals remain unknown.', guide('nahida'));
  const steps = [...members.filter(id => id !== driver), driver].map(id => ({ character: id, seconds: id === driver ? 10 : 2, action: roles.find(p => p.character === id)?.setup ?? 'Follow the full guide rotation; role timing is unreviewed.' }));
  const seconds = Math.max(20, ...roles.map(p => p.cooldown));
  check('field-time', steps.reduce((n, s) => n + s.seconds, 0) <= seconds ? 'supported' : 'contradicted', `Assumed setup and driver windows fit a ${seconds}s loop; exact animation timing is unresolved.`, undefined, true);
  checks.push(...assessRotationSchedule(roles, steps, seconds));
  for (const p of roles) {
    const d = account.details?.[p.character], c = account.constellations?.[p.character];
    const equipment = equipmentFor(account, p.character);
    if (equipment.rows.filter(r => r.kind === 'weapons').length > 1 || new Set(equipment.rows.filter(r => r.kind === 'artifacts').map(r => r.row.slotKey)).size !== equipment.rows.filter(r => r.kind === 'artifacts').length) check(`equipment:${p.character}`, 'unresolved', `${byId[p.character].name}: duplicate equipped weapons or artifact slots; resolve the scan before treating this as a usable loadout.`);
    if (p.burstCost) check(`energy:${p.character}`, 'unresolved', `${byId[p.character].name}: ${p.burstCost} Energy; observed ER ${d?.energyRecharge ?? '?'}%. Particle catches, starting Energy and repeated-loop income are unverified.`, p.source);
    if (p.effects.includes('core-trigger')) {
      check(`level:${p.character}`, d?.level === undefined ? 'unresolved' : d.level >= 90 ? 'supported' : 'contradicted', `${byId[p.character].name}: level ${d?.level ?? '?'}; level 90 is the guide's reaction investment target, not a minimum for team legality.`, p.source);
      check(`em:${p.character}`, d?.elementalMastery === undefined ? 'unresolved' : 'supported', `${byId[p.character].name}: observed EM ${d?.elementalMastery ?? '?'}; no assumed EM buff or generic damage multiplier.`, p.source);
      if (p.character === 'kuki') check('ring-uptime', c === undefined ? 'unresolved' : 'supported', `Kuki ring: ${c === undefined ? 'constellation unknown; 12–15' : c >= 2 ? '15' : '12'}s duration / 15s cooldown. The loop may include trigger downtime.`, p.source);
    }
    if (p.effects.includes('healing')) check(`healing:${p.character}`, 'unresolved', `${byId[p.character].name}: Skill talent ${d?.talents?.skill ?? '?'}; healing throughput and incoming damage are unverified.`, p.source);
    if (p.effects.includes('swirl')) {
      const vv = (equipmentFor(account, p.character).artifactSets.ViridescentVenerer ?? 0) >= 4;
      check(`vv:${p.character}`, vv ? 'supported' : 'unresolved', vv ? 'Four equipped Viridescent Venerer pieces observed. Shred still requires an on-field Swirl of the intended aura.' : 'Viridescent Venerer set not established; no resistance reduction assumed.', p.source);
    }
    if (p.effects.includes('hp-drain')) check('fanfare', 'unresolved', 'Furina needs HP changes and sufficient healing; neither healer presence nor artifact sets establish maximum Fanfare.', p.source);
    if (p.effects.includes('damage-proc')) check('damage-proc', 'unresolved', 'Raiden Skill needs enemy damage; shield-only hits can stop coordinated attacks.', p.source);
    if (p.character === 'neuvillette') check('past-draconic-glories', c === undefined ? 'unresolved' : 'supported', `C${c ?? '?'}: ${c === 0 && members.some(id => id !== p.character && byId[id].element === 'Hydro') ? 'double Hydro limits distinct reaction stacks at C0' : 'verify distinct Hydro reaction stacks and interruption protection'}.`, p.source);
    if (d?.weapon?.key) check(`weapon:${p.character}`, 'unresolved', `${byId[p.character].name}: ${d.weapon.key} R${d.weapon.refinement ?? '?'} Lv.${d.weapon.level ?? '?'}. Passive activation and total stats are not derived.`, p.source);
  }
  for (const id of ['nilou', 'chevreuse']) if (members.includes(id)) {
    const required = id === 'nilou' ? ['Hydro', 'Dendro'] : ['Pyro', 'Electro'];
    const valid = members.every(m => required.includes(byId[m].element)) && required.every(e => members.some(m => byId[m].element === e));
    check(`restriction:${id}`, valid ? 'supported' : 'contradicted', `${byId[id].name}'s restricted passive requires only ${required.join('/')} with both present. This does not prohibit other roles.`, guide(id));
  }
  const sustain = roles.filter(p => p.effects.includes('healing') || p.effects.includes('shield')).length;
  check('sustain', sustain ? 'supported' : 'unresolved', sustain ? 'A covered healing or shield role is assigned; survival is not certified.' : 'No covered sustain role; dodging or unreviewed kit coverage remains necessary.');
  const rebuilds = options.allowRebuild ? trigger.filter(p => (account.details?.[p.character]?.level ?? 0) < 90 || account.details?.[p.character]?.elementalMastery === undefined).map(p => p.character) : [];
  for (const id of rebuilds) check(`planned:${id}`, 'unresolved', `${byId[id].name}: a level-90 / EM rebuild is explicitly allowed. The current observation stays unchanged; resulting stats, gear and resource cost require confirmation.`, guide(id));
  const compositionId = compositionKey(members);
  const core = playstyle === 'core-reactions' ? roles.filter(p => p.effects.some(e => ['dendro', 'core-trigger'].includes(e))).map(p => p.character).sort() : [driver];
  // Prefer complete, reviewed team examples and coherent roles. Check counts describe
  // coverage and must never act as a proxy for how good a team is.
  const reasons: string[] = [];
  let selectionScore = seed?.reviewed ? 34 : seed?.origin === 'custom' ? 28 : seed ? 27 : 24;
  reasons.push(seed?.reviewed ? 'Complete reviewed guide example, with its original constraints retained.' : seed?.origin === 'custom' ? 'Your saved composition, checked against covered mechanics.' : seed ? 'Complete guide example; inferred roles need checking.' : 'Generated from covered driver and support interactions.');
  const ready = members.filter(id => account.readiness[id] === 'ready').length;
  selectionScore += ready * 2;
  if (ready) reasons.push(`${ready} of four characters marked ready in your account.`);
  if (sustain) { selectionScore += 3; reasons.push('Includes a healing or shield role.'); }
  // Covered roles establish feasibility, not strength; never reward the size of the pilot.
  if (playstyle === 'core-reactions' && has('pyro')) selectionScore -= 12;
  if (playstyle === 'core-reactions' && driver === 'neuvillette') selectionScore -= 8;
  if (has('hp-drain') && !has('healing')) { selectionScore -= 8; reasons.push('Furina’s HP drain needs a healing plan; none is covered here.'); }
  if (sustain > 1 && !has('hp-drain')) selectionScore -= (sustain - 1) * 3;
  if (driver === 'barbara') selectionScore -= 3;
  for (const [id, constellation] of Object.entries(seed?.minimumConstellations ?? {})) {
    if ((account.constellations?.[id] ?? -1) < constellation) {
      selectionScore -= 8;
      check(`recipe-constellation:${id}`, 'unresolved', `${byId[id].name}: this guide example assumes C${constellation}; account C${account.constellations?.[id] ?? '?'}.`, seed?.sources[0]);
      reasons.push(`${byId[id].name}’s guide constellation assumption is not established.`);
    }
  }
  const ratings = conditionalRatings(members, driver, account, options.meta, options.now);
  selectionScore += ratings.points;
  reasons.push(ratings.fresh ? 'Conditional role ratings apply only with their constellation and team partners; missing ratings are neutral.' : 'Rating snapshot expired; selection uses guides, mechanics and recorded builds.');
  const buildIssues = buildTasks(account, { members, driver, roles, sources: seed?.sources ?? [], seed }).filter(t => t.status === 'upgrade').length;
  selectionScore -= buildIssues * 3;
  if (buildIssues) reasons.push(`${buildIssues} recorded level, weapon or talent upgrades need investment.`);
  return {
    id: `config-v1:${compositionId}:${driver}:${playstyle}:${rebuilds.length ? 'planned-em' : 'current'}:${fingerprint({ builds: members.slice().sort().map(id => ({ id, details: account.details?.[id], constellation: account.constellations?.[id], equipment: equipmentFor(account, id).rows })), roles, rotation: { seconds, steps }, revision: mechanicsProvenance.ruleRevision })}`, compositionId, members: [driver, ...members.filter(m => m !== driver)], driver, roles, playstyle, core,
    origin: seed?.origin === 'custom' ? 'custom' : seed ? 'guide' : 'generated', seed,
    recipeMembership: graph.recipes.some(r => matchSlots(r.slots, members)),
    rotation: { seconds, steps, assumption: 'Product-authored outline: 2s per support and 10s driver window are scheduling assumptions, not measured animation times. Unused loop time permits cooldown recovery.' },
    checks, selection: { score: selectionScore, reasons, ratings, buildIssues }, exploratory: !seed && playstyle === 'core-reactions' && (has('pyro') || has('swirl') || driver === 'neuvillette'), sources: [...new Set([...roles.map(p => p.source), ...(seed?.sources ?? [])])], equipmentIds: members.flatMap(id => equipmentFor(account, id).rows.map(r => r.id)), rebuilds,
    dimensions: { supported: checks.filter(c => c.state === 'supported').length, unresolved: checks.filter(c => c.state === 'unresolved').length, buildGaps: checks.filter(c => c.state === 'contradicted' && !c.hard && !rebuilds.some(id => c.id === `level:${id}`)).length, sustain, execution: playstyle === 'burst-window' || playstyle === 'charged-carry' ? 2 : 1, investment: rebuilds.length },
  };
}

export function generateConfigurations(account: Account, options: GenerationOptions = {}) {
  const seeds = [...discover(account), ...(options.extraSeeds ?? [])];
  const found = new Map<string, Configuration>();
  const add = (members: string[], driver: string, seed?: Candidate) => {
    for (const allowRebuild of options.allowRebuild ? [false, true] : [false]) {
      const config = assessConfiguration(account, members, driver, { ...options, allowRebuild }, seed);
      if (!config.checks.some(c => c.hard && c.state === 'contradicted')) found.set(config.id, config);
    }
  };
  for (const seed of seeds) add(seed.members, seed.anchor, seed);
  const owned = [...new Set(account.owned)].filter(id => profiles.some(p => p.character === id)).sort();
  const cap = Math.max(1, Math.min(options.maxCompositions ?? 6000, 20000));
  let enumerated = 0, truncated = false;
  outer: for (let a = 0; a < owned.length; a++) for (let b = a + 1; b < owned.length; b++) for (let c = b + 1; c < owned.length; c++) for (let d = c + 1; d < owned.length; d++) {
    if (enumerated >= cap) { truncated = true; break outer; }
    enumerated++;
    const members = [owned[a], owned[b], owned[c], owned[d]];
    for (const driver of members.filter(id => profiles.some(p => p.character === id && p.field === 'driver'))) {
      const config = assessConfiguration(account, members, driver, options);
      const effect = (e: Effect) => config.roles.some(p => p.effects.includes(e));
      // Mechanism predicates, not named-team slot membership. Reserve mixed novel flexes as unresolved.
      const interaction = config.playstyle === 'core-reactions' || (config.playstyle === 'swirl-driver' && effect('hydro') && effect('electro')) || (config.playstyle === 'burst-window' && effect('hydro') && effect('pyro')) || (config.playstyle === 'charged-carry' && (effect('swirl') || effect('shield')));
      if (interaction && config.roles.length === 4 && !config.checks.some(c => c.hard && c.state === 'contradicted')) {
        for (const allowRebuild of options.allowRebuild ? [false, true] : [false]) {
          const candidate = allowRebuild === Boolean(options.allowRebuild) ? config : assessConfiguration(account, members, driver, { ...options, allowRebuild });
          if (!found.has(candidate.id)) found.set(candidate.id, candidate);
        }
      }
    }
  }
  return { configurations: [...found.values()], coverage: { characters: owned.length, unknown: account.owned.filter(id => !owned.includes(id)), enumerated, cap, truncated, seeds: seeds.length, generated: [...found.values()].filter(c => c.origin === 'generated').length } };
}

/** Bridge for the existing identity-aware allocators; points are transparent feasibility preferences, never DPS. */
export function configurationCandidate(c: Configuration, easier = false, sustain = false): Candidate {
  const d = c.dimensions;
  return { ...(c.seed ?? {}), id: c.id, name: `${byId[c.driver].name} · ${c.playstyle.replaceAll('-', ' ')}`, members: c.members, anchor: c.driver,
    roles: c.members.map(id => c.roles.find(p => p.character === id)?.role ?? 'Unreviewed guide role'), origin: c.origin === 'custom' ? 'custom' : c.origin === 'guide' ? 'guide' : 'mechanical',
    reviewed: false, why: 'Conditional role and whole-team checks; no automatic damage or clear prediction.', caution: c.seed?.caution ?? 'Inspect unresolved rotation and build checks.', sources: c.sources,
    score: c.selection.score - d.buildGaps * 4 - d.investment * 2 + (easier ? (3 - d.execution) * 4 : 0) + (sustain ? d.sustain * 4 : 0), missing: [], mask: teamMask(c.members), retrieval: 0, ranking: 'guide', metaTier: null, assumptions: c.checks.filter(c => c.state !== 'supported').map(c => c.text), unsupported: [],
  };
}
