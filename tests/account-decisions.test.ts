import { describe, expect, it } from 'vitest';
import { accountIdentity, demoAccount } from '../src/account';
import type { Account } from '../src/account';
import { generateConfigurations, assessConfiguration, equipmentFor } from '../src/planner/configurations';
import { comparePlans, shortlistPlans, solvePlan } from '../src/planner/account-plans';
import type { PlanningContext } from '../src/planner/account-plans';
import { conditionalRatings } from '../src/planner/ratings';
import { buildTasks, projectBuilds } from '../src/planner/builds';
import { bannerAvailability, evaluatePull, preparePullStudy, pullCandidates } from '../src/planner/pulls';
import type { MetaPack } from '../src/planner/types';
import { readFile } from 'node:fs/promises';
import { readPublication, publicationReviews } from '../src/planner/publications';
import { encounterStatus } from '../src/planner/encounters';
import { configurationFit } from '../src/planner/feedback';

const input: PlanningContext = { context: { mode: 'abyss', region: 'Europe' }, preferences: [], now: Date.parse('2026-10-03T12:00:00Z') };
const account = (owned: string[], extra: Partial<Account> = {}): Account => ({ version: 1, owned, readiness: {}, mode: 'abyss', demo: false, ...extra });
const hyper = ['nahida', 'xingqiu', 'yelan', 'kuki'];
const national = ['raiden', 'xingqiu', 'xiangling', 'bennett'];
const meta: MetaPack = { id: 'conditional-fixture', source: 'https://example.com/ratings', patch: 'test', checkedAt: '2026-10-01', updatedAt: '2026-10-01', expiresAt: '2026-10-10', entries: [
  { id: 'raiden', role: 'carry', tier: 0, constellation: 2, partners: ['bennett'] },
  { id: 'yelan', role: 'damage', tier: 1, constellation: 0, partners: [] },
] };

describe('Account ranking and distinct complete plans', () => {
  it('uses ratings only for the correct role, partners, constellation and review window', () => {
    const a = account(national, { constellations: { raiden: 0 } });
    expect(conditionalRatings(national, 'raiden', a, meta, '2026-10-02').points).toBe(0);
    expect(conditionalRatings(national, 'raiden', { ...a, constellations: { raiden: 2 } }, meta, '2026-10-02').points).toBeGreaterThan(0);
    expect(conditionalRatings(['raiden', 'xiangling', 'xingqiu', 'yelan'], 'raiden', { ...a, constellations: { raiden: 2 } }, meta, '2026-10-02').contributions.find(r => r.character === 'raiden')?.points).toBe(0);
    expect(conditionalRatings(hyper, 'yelan', account(hyper), meta, '2026-10-02').points).toBe(0);
    expect(conditionalRatings(national, 'raiden', a, meta, '2026-10-11').fresh).toBe(false);
  });
  it('offers recommended and two different composition allocations without rewarding check counts', () => {
    const configs = generateConfigurations(demoAccount).configurations;
    const options = shortlistPlans(configs, demoAccount, input);
    expect(options).toHaveLength(3);
    expect(new Set(options.map(o => o.plan.assignments.map(r => r.config.compositionId).sort().join('~'))).size).toBe(3);
    for (const option of options) expect(new Set(option.plan.assignments.flatMap(r => r.config.members.map(accountIdentity))).size).toBe(8);
  });
  it.each([
    ['empty', []], ['sparse', ['amber', 'kaeya', 'lisa']], ['Hyperbloom', hyper], ['National', national],
    ['contested supports', [...new Set([...hyper, ...national, 'zhongli'])]],
    ['charged carry', ['neuvillette', 'furina', 'kazuha', 'zhongli']],
    ['unknown kits', ['aloy', 'amber', 'lisa', 'kaeya']],
    ['Traveler identity', ['travelerdendro', 'travelerhydro', 'barbara', 'kuki', 'fischl', 'xingqiu']],
  ])('keeps identities, evidence and recipe constraints valid for %s', (_label, owned) => {
    const a = account(owned as string[]);
    const generated = generateConfigurations(a);
    for (const mode of ['abyss', 'stygian'] as const) {
      const plan = solvePlan(generated.configurations, { ...input, context: { ...input.context, mode } });
      const ids = plan.assignments.flatMap(r => r.config.members);
      expect(new Set(ids.map(accountIdentity)).size).toBe(ids.length);
      expect(ids.every(id => a.owned.includes(id))).toBe(true);
      expect(plan.assignments.every(r => !r.config.checks.some(c => c.hard && c.state === 'contradicted'))).toBe(true);
      expect(plan.assignments.every(r => !r.config.seed || r.config.seed.members.every(id => r.config.members.includes(id)))).toBe(true);
    }
  });
  it('keeps complete guide examples discoverable for independently inspected KQM examples', () => {
    for (const team of [hyper, national]) {
      const plan = solvePlan(generateConfigurations(account(team)).configurations, { ...input, context: { ...input.context, mode: 'general' } });
      expect(plan.assignments[0].config.seed?.reviewed).toBe(true);
      expect(plan.assignments[0].config.members.slice().sort()).toEqual(team.slice().sort());
      expect(plan.assignments[0].config.sources.some(url => url.startsWith('https://keqingmains.com/'))).toBe(true);
    }
  });
  it.each([
    ['Mavuika', ['mavuika', 'citlali', 'xilonen', 'bennett'], 'mavuika'],
    ['Nefer', ['nefer', 'lauma', 'columbina', 'nahida'], 'nefer'],
    ['Zibai', ['zibai', 'linnea', 'columbina', 'illuga'], 'zibai'],
  ])('places a complete contemporary %s team above the older Hyperbloom option with equal recorded readiness', (_label, modern, driver) => {
    const a = account([...new Set([...(modern as string[]), ...hyper])]);
    const generated = generateConfigurations(a, { now: '2026-10-03' });
    const plan = solvePlan(generated.configurations, { ...input, context: { ...input.context, mode: 'general' } });
    expect(plan.assignments[0].config.driver).toBe(driver);
    expect(plan.assignments[0].config.seed?.reviewed).toBe(true);
  });
  it('keeps mixed core ownership proposals out of primary strongest-plan assignments', () => {
    const generated = generateConfigurations(demoAccount);
    expect(generated.configurations.some(c => c.exploratory)).toBe(true);
    const plan = solvePlan(generated.configurations, input);
    expect(plan.assignments.every(r => !r.config.exploratory)).toBe(true);
    expect(plan.assignments.some(r => r.config.driver === 'mavuika')).toBe(true);
  });
  it('preserves reviewed build priorities and distinct driver rotations in generated configurations', () => {
    const a = account(['mavuika', 'citlali', 'xilonen', 'bennett', 'neuvillette', 'furina', 'kazuha', 'zhongli'], { details: { mavuika: { talents: { skill: 10, burst: 2 } }, neuvillette: { level: 80 } } });
    const configs = generateConfigurations(a).configurations;
    const mavuika = configs.find(c => c.seed?.name === 'Mavuika Melt')!;
    const neuvillette = configs.find(c => c.seed?.name === 'Neuvillette Hypercarry')!;
    expect(buildTasks(a, mavuika).some(t => t.character === 'mavuika' && t.talent === 'burst' && t.status === 'upgrade')).toBe(true);
    expect(buildTasks(a, neuvillette).some(t => t.character === 'neuvillette' && t.target === 90)).toBe(true);
    expect(mavuika.seed?.rotationOutline).toContain('charged-attack');
    expect(neuvillette.seed?.rotationOutline).toContain('Skill');
  });
  it('does not infer Electro-Charged from missing Dendro coverage or require an EM core build without cores', () => {
    const a = account(['neuvillette', 'lauma', 'kuki', 'furina', 'citlali']);
    const encounter = { id: 'test', name: 'test', preferred: [], avoid: [], stages: [], requirements: [{ id: 'bonus', kind: 'modifier' as const, stage: 'test', tags: ['electro-charged'], interpretation: 'Electro-Charged bonus', source: 'https://example.org', sourceHash: 'a'.repeat(64), reviewedAt: '2026-10-03' }] };
    expect(configurationFit(assessConfiguration(a, ['neuvillette', 'lauma', 'kuki', 'furina'], 'neuvillette'), encounter).matched).toEqual([]);
    const ec = assessConfiguration(a, ['neuvillette', 'citlali', 'kuki', 'furina'], 'neuvillette');
    expect(configurationFit(ec, encounter).matched).toHaveLength(1);
    expect(buildTasks(a, ec).some(t => t.character === 'kuki' && t.field === 'em')).toBe(false);
  });
});

describe('Reviewed production challenge publications', () => {
  it('uses exact reviewed bytes, all encounter stages and expires the source review in every region', async () => {
    expect(publicationReviews).toHaveLength(6);
    for (const review of publicationReviews) {
      const bytes = new Uint8Array(await readFile(`public/${review.path}`)).buffer;
      const pack = await readPublication(bytes);
      expect(pack.region).toBe(review.region);
      expect(encounterStatus(pack, input.now)).toBe('current');
      expect(encounterStatus(pack, Date.parse('2026-10-11T00:00:00Z'))).not.toBe('current');
      expect(pack.encounters.every(e => e.requirements?.every(r => pack.provenance?.some(p => p.sha256 === r.sourceHash && p.url === r.source)))).toBe(true);
      if (pack.mode === 'abyss') expect(pack.encounters.every(e => e.stages.length === 3)).toBe(true);
      else expect(pack.encounters.map(e => e.stages[0].level)).toEqual([110, 110, 110]);
      const modified = new TextEncoder().encode(new TextDecoder().decode(bytes).replace('7.1', '7.2')).buffer;
      await expect(readPublication(modified)).rejects.toThrow('reviewed hash');
    }
  });
  it('combines challenge modifiers with roster strength rather than forcing every optional bonus', async () => {
    const review = publicationReviews.find(r => r.mode === 'abyss' && r.region === 'Europe')!;
    const pack = await readPublication(new Uint8Array(await readFile(`public/${review.path}`)).buffer);
    const plan = solvePlan(generateConfigurations(demoAccount).configurations, { ...input, pack, context: { ...input.context, cycleId: pack.cycleId } });
    expect(plan.assignments).toHaveLength(2);
    expect(plan.assignments.some(r => r.config.driver === 'mavuika')).toBe(true);
    expect(plan.assignments.every(r => r.encounter?.stages.length === 3)).toBe(true);
  });
});

describe('C0 counterfactuals and build-first decisions', () => {
  it('regenerates the whole account, unlocks a second team and never mutates the account', () => {
    const a = account(['nahida', 'xingqiu', 'raiden', 'zhongli', 'bennett', 'xiangling', 'yelan']);
    const original = structuredClone(a), study = preparePullStudy(a, input), pull = evaluatePull(study, 'kuki');
    expect(study.baseline.assignments).toHaveLength(1);
    expect(pull.after.assignments).toHaveLength(2);
    expect(pull.teamsAdded).toBe(1);
    expect(pull.verdict).toBe('Pull priority');
    expect(new Set(pull.after.assignments.flatMap(r => r.config.members)).size).toBe(8);
    expect(a).toEqual(original);
    expect(pull.account.constellations?.kuki).toBe(0);
    expect(pull.account.details?.kuki).toEqual({});
    expect(pull.investment.some(t => t.character === 'kuki' && t.target === 90)).toBe(true);
  });
  it('removes stale C6, builds and equipped items when previewing a deselected character at C0', () => {
    const a = account(['nahida', 'xingqiu', 'yelan'], { constellations: { kuki: 6 }, details: { kuki: { level: 90, elementalMastery: 1000 } }, readiness: { kuki: 'ready' }, inventory: { format: 'GOOD', version: 3, source: 'test', weapons: [{ location: 'KukiShinobu', key: 'IronSting', level: 90 }] } });
    const result = evaluatePull(preparePullStudy(a, input), 'kuki');
    expect(result.account.constellations?.kuki).toBe(0);
    expect(equipmentFor(result.account, 'kuki').rows).toHaveLength(0);
    expect(a.inventory?.weapons?.[0].location).toBe('KukiShinobu');
  });
  it('pairs reordered teams before measuring support moves', () => {
    const a = account([...new Set([...hyper, ...national, 'zhongli'])]);
    const make = (members: string[], driver: string) => ({ config: assessConfiguration(a, members, driver), fit: { matched: [], unresolved: [], contradicted: [], score: 0 } });
    const before = [make(['nahida', 'kuki', 'xingqiu', 'zhongli'], 'nahida')];
    const after = [make(national, 'raiden'), make(['nahida', 'kuki', 'yelan', 'zhongli'], 'nahida')];
    const diff = comparePlans(before, after);
    expect(diff.released).toEqual([{ character: 'xingqiu', from: 'nahida', to: 'raiden', team: 1 }]);
    expect(comparePlans(after, [...after].reverse()).released).toHaveLength(0);
  });
  it('projects known upgrades only, reruns allocation and recommends building when a pull adds no account value', () => {
    const a = account(hyper, { details: { kuki: { level: 50, weapon: { key: 'IronSting', level: 20 }, talents: { skill: 2 }, elementalMastery: 100 } } });
    const study = preparePullStudy(a, input), result = evaluatePull(study, 'eula');
    expect(study.upgrades).toHaveLength(3);
    expect(study.improvedAccount.details?.kuki).toMatchObject({ level: 90, elementalMastery: 100, weapon: { key: 'IronSting', level: 80 }, talents: { skill: 6 } });
    expect(study.improvedAccount.readiness.kuki).toBeUndefined();
    expect(study.improved.assignments[0].config.id).not.toBe(study.baseline.assignments[0].config.id);
    expect(result.verdict).toBe('Build first');
    const unknown = account(hyper), c = assessConfiguration(unknown, hyper, 'nahida');
    expect(projectBuilds(unknown, buildTasks(unknown, c)).details).toEqual({});
  });
  it('respects exclusions and preserves a lock through projected build identities', () => {
    const a = account(national, { details: { raiden: { level: 60 } } });
    const configs = generateConfigurations(a).configurations, locked = configs.find(c => c.seed?.reviewed)!;
    const study = preparePullStudy(a, { ...input, preferences: [
      { id: 'lock', scope: 'account', context: input.context, action: { kind: 'lock', configurationId: locked.id } },
      { id: 'exclude', scope: 'account', context: input.context, action: { kind: 'exclude', character: 'yelan' } },
    ] });
    expect(study.improved.assignments[0].config.compositionId).toBe(locked.compositionId);
    const result = evaluatePull(study, 'yelan');
    expect(result.after.assignments.every(r => !r.config.members.includes('yelan'))).toBe(true);
  });
  it('evaluates unsupported pulls honestly and excludes non-wish identities', () => {
    const study = preparePullStudy(account([]), input);
    expect(evaluatePull(study, 'skirk').verdict).toBe('Save');
    expect(pullCandidates(account([])).some(c => c.accountId === 'traveler' || c.id === 'aloy')).toBe(false);
  });
  it('does not advertise a C0 priority using a guide example that assumes the pulled character at C1', () => {
    const a = account(['sandrone', 'odette', 'escoffier']);
    const result = evaluatePull(preparePullStudy(a, { ...input, context: { ...input.context, mode: 'general' } }), 'yaemiko');
    expect(result.requiredConditions.some(s => s.includes('C1'))).toBe(true);
    expect(result.verdict).toBe('Save');
  });
  it('keeps banner verification separate with region, date and official source gates', () => {
    expect(bannerAvailability('kuki', 'Europe').status).toBe('Banner unverified');
    const banner = { characters: ['kuki'], region: 'Europe', startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-10T00:00:00Z', checkedAt: '2026-10-02T00:00:00Z', source: 'https://genshin.hoyoverse.com/en/news/detail/test', verified: true };
    expect(bannerAvailability('kuki', 'Europe', [banner], input.now).status).toBe('Verified available');
    expect(bannerAvailability('kuki', 'Asia', [banner], input.now).status).toBe('Banner unverified');
    expect(bannerAvailability('kuki', 'Europe', [banner], Date.parse(banner.endsAt)).status).toBe('Banner unverified');
  });
});
