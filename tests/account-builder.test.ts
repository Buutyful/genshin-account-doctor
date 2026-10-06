import { describe, expect, it } from 'vitest';
import { accountIdentity, demoAccount } from '../src/account';
import type { Account } from '../src/account';
import { assessConfiguration, assessRotationSchedule, configurationCandidate, equipmentFor, generateConfigurations, profiles } from '../src/planner/configurations';
import { configurationFit, effectivePreferences, parsePreferences, planConfigurations, preferenceApplies } from '../src/planner/feedback';
import type { Preference, FeedbackAction } from '../src/planner/feedback';
import { clearEligibility, createSplitManifest, matchClear, parseObservedPublication, reconcileClears } from '../src/planner/observed';
import type { ObservedClear, ObservedSource } from '../src/planner/observed';
import { parseWorkspace, restoreWorkspaceStorage } from '../src/planner/workspace';
import { encounterStatus, normalizeEncounter } from '../src/planner/encounters';
import { readPublication, sha256 } from '../src/planner/publications';
import type { Encounter } from '../src/planner/encounters';
import realShapes from './fixtures/nanoka-response-shapes.json';
import { fetchChallengeReference, fetchCurrentEncounters, serverDate } from '../src/planner/encounters';
import { parseChallengeStrategy } from '../src/planner/practice';

const account: Account = { ...demoAccount, owned: [...demoAccount.owned, 'sucrose', 'fischl', 'beidou'], details: { kuki: { level: 90, elementalMastery: 800 } } };
const context = { mode: 'abyss' as const, region: 'Europe' as const };
const pref = (action: FeedbackAction, id = '1'): Preference => ({ id, scope: 'session', context, action });
const coreTeam = ['nahida', 'xingqiu', 'kuki', 'zhongli'];
const generated = generateConfigurations(account);
const source: ObservedSource = { id: 'test-source', name: 'Test-only permitted source', url: 'https://example.org/', policies: [], reviewedAt: '2026-09-30', access: { discovery: true, comparison: true, training: true, evaluation: true, basis: 'Test contract only; not a production permission.' } };
function clear(overrides: Partial<ObservedClear> = {}): ObservedClear {
  return { sourceId: source.id, sourceRecordId: '1', sourceUrl: 'https://example.org/clear/1', originalRunId: 'run-1', proof: { url: 'https://youtu.be/test1', segment: '0-90', status: 'verified', checkedAt: '2026-09-02T00:00:00Z' }, revision: 1, review: 'approved', reviewedAt: '2026-09-02T00:00:00Z', encounter: { mode: 'stygian', patch: 'test', cycleId: 'cycle-1', variantId: 'boss-1', difficulty: '6', cycleStartsAt: '2026-09-01T00:00:00Z' }, members: coreTeam.map(character => ({ character, actual: { constellation: 0, artifacts: ['flower', 'plume', 'sands', 'goblet', 'circlet'].map(slot => ({ slot, set: 'test', level: 20, mainStat: 'test', substats: {} })), stats: { hp: 20000, atk: 1000, def: 700, critRate: 50, critDamage: 100, energyRecharge: 200, elementalMastery: 100 }, build: { level: 90, talents: { auto: 1, skill: 9, burst: 9 }, weapon: { key: 'test', refinement: 1, level: 90 } } } })), core: ['nahida', 'kuki'], creatorId: 'creator-1', buildSeriesId: 'series-1', buildCompleteness: 'complete', rotation: { status: 'reviewed', notes: 'TEST ONLY' }, clearSeconds: 90, timeConvention: 'in-game-timer', tags: [], snapshot: { url: 'https://example.org/export', sha256: 'a'.repeat(64), fetchedAt: '2026-09-02T00:00:00Z', parserVersion: 'test-v1' }, fixture: false, ...overrides };
}

describe('Conditional character and whole-team mechanics', () => {
  it('prefers a complete reviewed account example without rewarding extra check counts', () => {
    const configurations = generateConfigurations(demoAccount).configurations;
    const plan = planConfigurations(configurations, context, []);
    expect(plan.assignments).toHaveLength(2);
    expect(plan.assignments.every(row => row.config.seed?.reviewed)).toBe(true);
    expect(plan.assignments.some(row => row.config.driver === 'mavuika')).toBe(true);
    const c = configurations.find(c => c.origin === 'generated')!;
    expect(configurationCandidate({ ...c, dimensions: { ...c.dimensions, supported: 999 } }).score).toBe(configurationCandidate(c).score);
  });
  it('uses player targets to assign the whole account while keeping them separate from a live pack', () => {
    const targets: Encounter[] = [
      { id: 'player-first', name: 'First half', preferred: ['Hydro'], avoid: [], stages: [] },
      { id: 'player-second', name: 'Second half', preferred: ['Pyro'], avoid: [], stages: [] },
    ];
    const plan = planConfigurations(generateConfigurations(demoAccount).configurations, context, [], undefined, 48, [], Date.now(), targets);
    expect(plan.assignments).toHaveLength(2);
    expect(plan.assignments[0].fit.matched).toContain('Your preference: Hydro');
    expect(plan.assignments[1].fit.matched).toContain('Your preference: Pyro');
    expect(new Set(plan.assignments.flatMap(r => r.config.members.map(accountIdentity))).size).toBe(8);
  });
  it('replaces a previous reshaping request while retaining rejection history and undo', () => {
    const first = pref({ kind: 'replace', members: ['nahida', 'kuki', 'xingqiu'], character: 'zhongli', compositionId: coreTeam.slice().sort().join('|') });
    const next = pref({ kind: 'variant', core: ['nahida', 'kuki'], compositionId: ['nahida', 'kuki', 'xingqiu', 'yelan'].sort().join('|') }, '2');
    expect(effectivePreferences([first, next], context)).toEqual([next]);
    expect(effectivePreferences([first], context)).toEqual([first]);
    const plan = planConfigurations(generated.configurations, context, [first, next]);
    expect(plan.complete).toBe(true);
    expect(plan.assignments.some(r => ['nahida', 'kuki'].every(id => r.config.members.includes(id)))).toBe(true);
    expect(plan.assignments.every(r => ![first.action, next.action].some(a => 'compositionId' in a && r.config.compositionId === a.compositionId))).toBe(true);
  });
  it('generates configurations absent from every seed while retaining complete guide seed constraints', () => {
    expect(generated.configurations.some(c => c.origin === 'generated' && !c.recipeMembership && c.checks.some(ch => ch.id === 'core-path' && ch.state === 'supported'))).toBe(true);
    const seed = generated.configurations.find(c => c.seed?.name === 'Raiden National');
    expect(seed?.seed?.caution).toContain('Energy');
    expect(seed?.sources).toContain('https://keqingmains.com/q/raiden-quickguide/');
    expect(generated.coverage.truncated).toBe(false);
  });
  it('changes configuration identity and build fit when actual level or equipment changes', () => {
    const high = assessConfiguration(account, coreTeam, 'nahida');
    const low = assessConfiguration({ ...account, details: { kuki: { level: 50, elementalMastery: 200 } } }, coreTeam, 'nahida');
    expect(high.compositionId).toBe(low.compositionId);
    expect(high.id).not.toBe(low.id);
    expect(high.dimensions.buildGaps).toBeLessThan(low.dimensions.buildGaps);
    expect(configurationCandidate(high).score).toBeGreaterThan(configurationCandidate(low).score);
    expect(low.checks.find(c => c.id === 'level:kuki')?.hard).toBe(false);
  });
  it('supports different drivers and current/planned assumptions for the same composition', () => {
    const a = { ...account, details: {} };
    const both = generateConfigurations(a, { allowRebuild: true }).configurations;
    expect(both.some(c => c.rebuilds.length > 0)).toBe(true);
    expect(both.some(c => c.rebuilds.length === 0)).toBe(true);
    const members = ['nahida', 'barbara', 'raiden', 'zhongli'];
    expect(assessConfiguration(a, members, 'nahida').id).not.toBe(assessConfiguration(a, members, 'barbara').id);
  });
  it('rejects unsupported normal-attack activation and Raiden/Beidou discharges', () => {
    const charged = assessConfiguration(account, ['neuvillette', 'xingqiu', 'kazuha', 'zhongli'], 'neuvillette');
    expect(charged.checks.find(c => c.id === 'normal-activation')?.state).toBe('contradicted');
    const raiden = assessConfiguration(account, ['raiden', 'beidou', 'xingqiu', 'bennett'], 'raiden');
    expect(raiden.checks.find(c => c.id === 'beidou-raiden')?.hard).toBe(true);
  });
  it('catches competing core triggers and preserves unknown aura and Furina ramp', () => {
    const conflict = assessConfiguration(account, ['nahida', 'xingqiu', 'kuki', 'raiden'], 'nahida');
    expect(conflict.checks.find(c => c.id === 'trigger-ownership')?.state).toBe('contradicted');
    const c = assessConfiguration(account, ['nahida', 'furina', 'kuki', 'bennett'], 'nahida');
    expect(c.checks.find(c => c.id === 'pyro-competition')?.state).toBe('unresolved');
    expect(c.checks.find(c => c.id === 'fanfare')?.state).toBe('unresolved');
  });
  it('checks field, cooldown and explicit repeat-loop energy independently', () => {
    const roles = profiles.filter(p => p.character === 'xingqiu');
    const checks = assessRotationSchedule(roles, [{ character: 'xingqiu', action: 'test', seconds: 11 }, { character: 'raiden', action: 'test', seconds: 11 }], 20, [{ character: 'xingqiu', particleEnergyBeforeER: 10, flatEnergy: 10, recharge: 200, casts: 1 }]);
    expect(checks.filter(c => c.state === 'contradicted').map(c => c.id)).toEqual(['field-budget', 'cooldown:xingqiu:support', 'energy-budget:xingqiu']);
    expect(assessRotationSchedule(roles, [], 21, [{ character: 'xingqiu', particleEnergyBeforeER: 30, flatEnergy: 20, recharge: 200, casts: 1 }]).find(c => c.id === 'energy-budget:xingqiu')?.state).toBe('supported');
  });
  it('keeps unknown roles inspectable and sourced restricted passives conditional', () => {
    const c = assessConfiguration({ ...account, owned: [...account.owned, 'nilou'] }, ['nilou', 'nahida', 'kuki', 'barbara'], 'barbara');
    expect(c.checks.find(c => c.id === 'coverage')?.state).toBe('unresolved');
    expect(c.checks.find(c => c.id === 'restriction:nilou')?.state).toBe('contradicted');
    expect(c.checks.find(c => c.id === 'restriction:nilou')?.hard).toBe(false);
  });
  it('keeps equipment identities, partial stat contributions and conditional buffs separate', () => {
    const c: Account = { ...account, inventory: { format: 'GOOD', version: 3, source: 'fixture', artifacts: [{ setKey: 'ViridescentVenerer', location: 'Sucrose', slotKey: 'flower', substats: [{ key: 'eleMas', value: 23 }] }] } };
    const eq = equipmentFor(c, 'sucrose');
    expect(eq.rows[0].id).toBe('artifacts:0');
    expect(eq.substats.eleMas).toBe(23);
    expect(eq.conditionalBuffsIncluded).toBe(false);
    expect(eq.observed?.elementalMastery).toBeUndefined();
  });
});

describe('Open search, feedback and joint account allocation', () => {
  it('matches an independent exhaustive baseline on small two- and three-team pools', () => {
    const pool = [
      assessConfiguration(account, coreTeam, 'nahida'),
      assessConfiguration(account, ['raiden', 'xingqiu', 'xiangling', 'bennett'], 'raiden'),
      assessConfiguration(account, ['neuvillette', 'furina', 'kazuha', 'zhongli'], 'neuvillette'),
      assessConfiguration(account, ['sucrose', 'fischl', 'yelan', 'barbara'], 'sucrose'),
      assessConfiguration(account, ['nahida', 'yelan', 'kuki', 'barbara'], 'nahida'),
    ];
    for (const mode of ['abyss', 'stygian'] as const) {
      const count = mode === 'abyss' ? 2 : 3;
      let optimum: [number, number] = [0, -Infinity];
      for (let mask = 0; mask < 2 ** pool.length; mask++) {
        const subset = pool.filter((_, i) => mask & (1 << i));
        if (subset.length > count || new Set(subset.flatMap(c => c.members.map(accountIdentity))).size !== subset.length * 4) continue;
        const score = subset.reduce((n, c) => n + configurationCandidate(c).score, 0);
        if (subset.length > optimum[0] || subset.length === optimum[0] && score > optimum[1]) optimum = [subset.length, score];
      }
      const plan = planConfigurations(pool, { ...context, mode }, [], undefined, 99);
      expect([plan.assignments.length, plan.assignments.reduce((n, r) => n + configurationCandidate(r.config).score, 0)]).toEqual(optimum);
    }
  });
  it('skips a proposal without banning members and re-allocates a same-core variant', () => {
    const initial = assessConfiguration(account, coreTeam, 'nahida');
    const variant = pref({ kind: 'variant', core: ['nahida', 'kuki'], compositionId: initial.compositionId });
    const plan = planConfigurations(generated.configurations, context, [variant]);
    expect(plan.assignments.length).toBe(2);
    expect(plan.assignments.some(r => ['nahida', 'kuki'].every(id => r.config.members.includes(id)))).toBe(true);
    expect(plan.assignments.some(r => r.config.compositionId === initial.compositionId)).toBe(false);
    expect(new Set(plan.assignments.flatMap(r => r.config.members.map(accountIdentity))).size).toBe(8);
  });
  it('finds a structurally different alternative and explains impossible locked exclusions', () => {
    const initial = assessConfiguration(account, coreTeam, 'nahida');
    const alt = planConfigurations(generated.configurations, { ...context, mode: 'general' }, [{ ...pref({ kind: 'alternative', core: initial.core, playstyle: initial.playstyle, compositionId: initial.compositionId }), context: { ...context, mode: 'general' } }]);
    expect(alt.assignments[0].config.playstyle).not.toBe(initial.playstyle);
    expect(initial.core.every(id => alt.assignments[0].config.members.includes(id))).toBe(false);
    const bad = planConfigurations([initial], context, [pref({ kind: 'lock', configurationId: initial.id }), pref({ kind: 'exclude', character: 'nahida' }, '2')]);
    expect(bad.assignments).toEqual([]);
    expect(bad.conflicts.join(' ')).toContain('locked');
  });
  it('distinguishes configuration rejection from composition rejection and scopes preferences', () => {
    const c = assessConfiguration(account, coreTeam, 'nahida');
    const other = { ...c, id: `${c.id}:test-rotation` };
    const plan = planConfigurations([c, other], context, [pref({ kind: 'skip-configuration', configurationId: c.id })]);
    expect(plan.assignments[0].config.id).toBe(other.id);
    const cycle = { ...pref({ kind: 'exclude', character: 'nahida' }), scope: 'cycle' as const, context: { ...context, cycleId: '1' } };
    expect(preferenceApplies(cycle, { ...context, cycleId: '2' })).toBe(false);
    expect(preferenceApplies({ ...cycle, scope: 'account' }, { ...context, region: 'Asia' })).toBe(true);
    expect(() => parsePreferences([{ ...cycle, context }])).toThrow();
  });
  it('preserves shared Traveler identities, external locks and equipped item conflicts', () => {
    const traveler = { ...assessConfiguration(account, coreTeam, 'nahida'), members: ['travelerdendro', 'xingqiu', 'kuki', 'zhongli'], id: 'traveler-d' };
    const alternate = { ...assessConfiguration(account, ['raiden', 'xiangling', 'bennett', 'yelan'], 'raiden'), members: ['traveleranemo', 'xiangling', 'bennett', 'yelan'], id: 'traveler-a' };
    expect(planConfigurations([traveler, alternate], context, []).assignments).toHaveLength(1);
    const c = assessConfiguration(account, coreTeam, 'nahida');
    const locked = planConfigurations(generated.configurations, context, [], undefined, 48, [c.compositionId]);
    expect(locked.assignments.some(r => r.config.compositionId === c.compositionId)).toBe(true);
    const gear1 = { ...c, equipmentIds: ['weapons:1'] };
    const gear2 = { ...assessConfiguration(account, ['sucrose', 'fischl', 'yelan', 'barbara'], 'sucrose'), equipmentIds: ['weapons:1'] };
    expect(planConfigurations([gear1, gear2], context, []).assignments).toHaveLength(1);
  });
  it('executes reviewed requirements across every chamber without treating resistance as immunity', () => {
    const c = assessConfiguration(account, ['sucrose', 'fischl', 'xingqiu', 'barbara'], 'sucrose');
    const encounter: Encounter = { id: 'first', name: 'First', preferred: [], avoid: [], stages: [1, 2, 3].map(i => ({ name: `12-${i}`, enemies: [{ name: 'test' }], notes: [] })), requirements: [1, 2, 3].map(i => ({ id: `${i}`, stage: `12-${i}`, kind: 'modifier', tags: ['swirl'], interpretation: 'Reviewed fixture Swirl opportunity', source: 'https://example.org/', sourceHash: 'a'.repeat(64), reviewedAt: '2026-09-30' })) };
    expect(configurationFit(c, encounter).matched).toHaveLength(3);
    expect(configurationFit(c, encounter).contradicted).toEqual([]);
    expect(configurationFit(c, { ...encounter, requirements: [] }).unresolved).not.toHaveLength(0);
  });
  it('applies a rebuild budget across the entire account allocation', () => {
    const first = { ...assessConfiguration(account, coreTeam, 'nahida'), rebuilds: ['kuki'] };
    const second = { ...assessConfiguration(account, ['sucrose', 'fischl', 'yelan', 'barbara'], 'sucrose'), rebuilds: ['sucrose'] };
    const budget = pref({ kind: 'comfort', easier: false, sustain: false, maxRebuilds: 1 });
    expect(planConfigurations([first, second], context, [budget]).assignments).toHaveLength(1);
  });
});

describe('Observed evidence and learning boundary', () => {
  it('preserves actual versus reduced investment and withholds incomplete comparisons', () => {
    const r = clear({ members: clear().members.map(m => ({ ...m, actual: {}, reduced: { constellation: 0, weaponRefinement: 1 } })) });
    const parsed = parseObservedPublication({ version: 1, sourceId: source.id, records: [r] }, [source]).records[0];
    expect(parsed.members[0].actual.constellation).toBeUndefined();
    expect(clearEligibility(parsed, [source])).toMatchObject({ discovery: true, comparison: false, training: false });
    expect(clearEligibility({ ...clear(), fixture: true }, [source]).discovery).toBe(false);
  });
  it('deduplicates cross-publisher proof URLs and applies corrections and retractions', () => {
    const original = clear();
    const correction = clear({ revision: 2, review: 'edited', clearSeconds: 88 });
    const copy = clear({ sourceId: 'mirror', sourceRecordId: '2', originalRunId: 'alias', clearSeconds: 88, proof: { ...original.proof, url: 'https://www.youtube.com/watch?v=test1&utm_source=mirror' } });
    const reconciled = reconcileClears([original, correction, copy]);
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0].record.clearSeconds).toBe(88);
    expect(reconciled[0].copies).toHaveLength(2);
    expect(reconcileClears([correction, { ...copy, review: 'retracted', revision: 3 }])[0].quarantined).toBe(true);
  });
  it('treats broken proof and conflicting current publications as unavailable', () => {
    const r = clear();
    expect(clearEligibility({ ...r, proof: { ...r.proof, status: 'broken' } }, [source]).training).toBe(false);
    const conflict = reconcileClears([r, clear({ sourceId: 'mirror', sourceRecordId: '2', clearSeconds: 3 })])[0];
    expect(conflict.conflicts).toBe(true);
    expect(clearEligibility(conflict.record, [source]).discovery).toBe(false);
  });
  it('requires permissions separately for discovery, comparison, training and evaluation', () => {
    const limited = { ...source, access: { ...source.access, training: false, evaluation: false } };
    expect(clearEligibility(clear(), [limited])).toMatchObject({ discovery: true, comparison: true, training: false, evaluation: false });
    expect(clearEligibility(clear())).toMatchObject({ discovery: false, comparison: false, training: false });
  });
  it('allows reviewed individual Stygian references without granting bulk training or skipping proof checks', () => {
    const reference = clear({ sourceId: 'stygian-moe' }); // Controlled test record; never published.
    expect(clearEligibility(reference)).toMatchObject({ discovery: true, comparison: true, training: false, evaluation: false });
    expect(clearEligibility({ ...reference, proof: { ...reference.proof, status: 'unreviewed' } }).discovery).toBe(false);
    expect(clearEligibility({ ...reference, fixture: true }).discovery).toBe(false);
    const manifest = createSplitManifest([reference], '2026-10-01T00:00:00Z');
    expect(manifest.train).toEqual([]);
    expect(manifest.excluded).toEqual(['run-1']);
  });
  it('reports account and encounter mismatches without calling a successful run an account prediction', () => {
    const match = matchClear(clear(), assessConfiguration(account, coreTeam, 'nahida'), account, undefined, [source]);
    expect(match.discovery).toBe(true);
    expect(match.matchedComparison).toBe(false);
    expect(match.differences.some(s => s.includes('Encounter'))).toBe(true);
  });
  it('groups duplicates, compositions, cores, creators and later cycles before temporal splitting', () => {
    const early = clear();
    const later = clear({ sourceRecordId: '2', originalRunId: 'run-2', creatorId: 'other', buildSeriesId: 'other', proof: { ...early.proof, url: 'https://youtu.be/test2' }, encounter: { ...early.encounter, cycleId: '2', cycleStartsAt: '2026-10-01T00:00:00Z' } });
    const independent = clear({ sourceRecordId: '3', originalRunId: 'run-3', core: ['sucrose'], creatorId: 'third', buildSeriesId: 'third', proof: { ...early.proof, url: 'https://youtu.be/test3' }, members: ['sucrose', 'fischl', 'yelan', 'barbara'].map((character, i) => ({ ...early.members[i], character })) });
    const manifest = createSplitManifest([early, later, independent], '2026-09-30T00:00:00Z', [source]);
    expect(manifest.train).toEqual(['run-3']);
    expect(manifest.test.sort()).toEqual(['run-1', 'run-2']);
    expect(manifest.withheldLabels).toContain('success probability');
    expect(manifest.modelAvailable).toBe(false);
    expect(createSplitManifest([], '2026-09-30T00:00:00Z').coverage.runs).toBe(0);
  });
  it('uses actual instants for source corrections and temporal splits with timezone offsets', () => {
    const original = clear({ reviewedAt: '2026-09-30T02:00:00+02:00' });
    const correction = clear({ reviewedAt: '2026-09-30T00:30:00Z', clearSeconds: 88 });
    expect(reconcileClears([original, correction])[0].record.clearSeconds).toBe(88);
    const later = clear({ snapshot: { ...original.snapshot, fetchedAt: '2026-09-29T23:30:00-02:00' } });
    const manifest = createSplitManifest([later], '2026-09-30T00:00:00Z', [source]);
    expect(manifest.train).toEqual([]);
    expect(manifest.test).toEqual(['run-1']);
  });
});

describe('Publication and workspace verification', () => {
  it('retrieves a reference lineup without manufacturing live dates and rejects incomplete Abyss lineups', async () => {
    const fetcher = async (url: string | URL | Request) => new Response(JSON.stringify(String(url).endsWith('/manifest.json') ? { gi: { live: '7.1' } } : String(url).endsWith('/tower.json') ? realShapes.towerIndex : String(url).endsWith('/leyline.json') ? realShapes.leylineIndex : String(url).includes('/tower/') ? realShapes.towerDetail : realShapes.leylineDetail));
    const reference = await fetchChallengeReference('stygian', 'Europe', undefined, fetcher, Date.parse('2026-10-01T10:30:00Z'));
    expect(reference.encounters).toHaveLength(3);
    expect(reference).not.toHaveProperty('startsAt');
    expect(reference).not.toHaveProperty('endsAt');
    expect(reference.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(fetchChallengeReference('abyss', 'Europe', undefined, fetcher, Date.parse('2026-10-01T10:30:00Z'))).rejects.toThrow('no published enemy lineup');
  });
  it('validates saved matchup strategies without allowing source verification in player input', () => {
    const parsed = parseChallengeStrategy({ manual: true, drafts: { 'Europe:abyss-practice-0': { opponents: 'Player target', preferred: ['Hydro', 'Hydro'] } }, publication: { verified: true } });
    expect(parsed.drafts['Europe:abyss-practice-0'].preferred).toEqual(['Hydro']);
    expect(parsed).not.toHaveProperty('publication');
    expect(() => parseChallengeStrategy({ manual: true, drafts: { 'Europe:abyss-practice-0': { opponents: 'Target', preferred: ['Guaranteed clear'] } } })).toThrow('Invalid challenge target');
  });
  it('replays the captured provider shapes without promoting generic dates into a live cycle', async () => {
    const context = { patch: '7.1', cycleId: 'shape-only', region: 'Europe' as const, startsAt: '2026-09-30T09:00:00Z', endsAt: '2026-11-11T08:59:59Z', fetchedAt: '2026-10-01T10:30:00Z', source: 'https://static.nanoka.cc/gi/7.1/en/leyline/5269012.json', sourceHash: 'a'.repeat(64) };
    // The real generic-date candidate contains chamber objectives but empty enemy
    // arrays. Successful access cannot certify a usable encounter publication.
    expect(() => normalizeEncounter('abyss', realShapes.towerDetail, context)).toThrow('no published enemy lineup');
    const stygian = normalizeEncounter('stygian', realShapes.leylineDetail, context);
    expect(stygian.encounters).toHaveLength(3);
    expect(stygian.encounters.every(e => e.stages[0].enemies[0].variantId && e.stages[0].notes.length)).toBe(true);
    const fetcher = async (url: string | URL | Request) => new Response(JSON.stringify(String(url).endsWith('/manifest.json') ? { gi: { live: '7.1' } } : String(url).endsWith('/tower.json') ? realShapes.towerIndex : realShapes.leylineIndex));
    await expect(fetchCurrentEncounters('abyss', 'Europe', undefined, fetcher, Date.parse('2026-10-01T10:30:00Z'))).rejects.toThrow('unambiguous live cycle');
    await expect(fetchCurrentEncounters('stygian', 'Europe', undefined, fetcher, Date.parse('2026-10-01T10:30:00Z'))).rejects.toThrow('unambiguous live cycle');
    expect(() => serverDate('2026-02-30 04:00:00', 'Europe')).toThrow('calendar');
  });
  it('accepts only a hash-reviewed dated publication and expires it independently of fetch time', async () => {
    const base = { patch: 'test', cycleId: '1', region: 'Europe' as const, startsAt: '2026-09-16T03:00:00Z', endsAt: '2026-10-16T03:00:00Z', fetchedAt: '2026-09-16T03:00:00Z', source: 'https://example.org/data', sourceHash: 'a'.repeat(64) };
    const detail = { floor: { 12: { buff: [], room: Object.fromEntries([1, 2, 3].map(i => [i, { first: [{ id: 123, name: 'test' }], second: [{ id: 321, name: 'test' }] }])) } }, leyline: { desc: '' } };
    const pack = { ...normalizeEncounter('abyss', detail, base), publication: { id: 'fixture', reviewedAt: '2026-09-16T03:00:00Z', validUntil: '2026-10-01T03:00:00Z', dateBasis: 'Test review; not live evidence', sources: ['https://example.org/review'] } };
    const bytes = new TextEncoder().encode(JSON.stringify(pack)).buffer;
    await expect(readPublication(bytes)).rejects.toThrow('reviewed hash');
    const parsed = await readPublication(bytes, [{ id: 'fixture', path: 'challenges/test.json', sha256: await sha256(bytes), mode: 'abyss', region: 'Europe' }]);
    expect(parsed.encounters[0].stages[0].enemies[0].id).toBe('123');
    expect(encounterStatus(parsed, Date.parse('2026-09-30T00:00:00Z'))).toBe('current');
    expect(encounterStatus(parsed, Date.parse('2026-10-01T03:00:00Z'))).toBe('stale');
  });
  it('round-trips account, gear, custom compositions and scoped preferences while rejecting invalid backups', () => {
    const workspace = { format: 'AccountDoctorWorkspace', version: 1, exportedAt: '', account, preferences: [pref({ kind: 'exclude', character: 'bennett' })], customTeams: [coreTeam], locks: {}, sheets: {}, observed: [], builder: { activity: 'general', allowRebuild: false } };
    const parsed = parseWorkspace(JSON.parse(JSON.stringify(workspace)));
    expect(parsed.account.details).toEqual(account.details);
    expect(parsed.preferences[0].action.kind).toBe('exclude');
    expect(() => parseWorkspace({ ...workspace, customTeams: [['nahida', 'nahida', 'kuki', 'xingqiu']] })).toThrow();
    expect(() => parseWorkspace({ ...workspace, preferences: [{ bad: true }] })).toThrow();
  });
  it('rolls back writes if workspace storage fails before restore completes', () => {
    const values = new Map([['account-doctor-v1', 'original']]);
    let written = 0;
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { if (++written === 3) throw new Error('quota'); values.set(k, v); }, removeItem: (k: string) => values.delete(k) } as Storage;
    const p = parseWorkspace({ format: 'AccountDoctorWorkspace', version: 1, account, preferences: [], customTeams: [], locks: {}, sheets: {}, observed: [], builder: { activity: 'general', allowRebuild: false } });
    expect(() => restoreWorkspaceStorage(p, storage, storage)).toThrow('quota');
    expect(values.get('account-doctor-v1')).toBe('original');
    expect(values.size).toBe(1);
  });
});
