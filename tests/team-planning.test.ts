import { describe, expect, it, vi } from 'vitest';
import { demoAccount, teamMask } from '../src/account';
import { allocate, discover } from '../src/planner/planner';
import { analyzeSynergy } from '../src/planner/mechanics';
import { calculateHit, calculateRotation, resistanceMultiplier } from '../src/planner/damage';
import type { DamageRow } from '../src/planner/damage';
import { allocateEncounters, encounterStatus, fetchCurrentEncounters, normalizeEncounter, serverDate, validateEncounterPack } from '../src/planner/encounters';
import type { Encounter } from '../src/planner/encounters';
import type { Candidate } from '../src/planner/types';
import { customCandidate } from '../src/CustomTeamBuilder';

const context = { patch: 'test-live', cycleId: '1', region: 'Europe' as const, startsAt: '2026-09-16T03:00:00Z', endsAt: '2026-10-16T03:00:00Z', fetchedAt: '2026-09-30T10:00:00Z', source: 'https://static.nanoka.cc/gi/test/en/tower/1.json', sourceHash: 'a'.repeat(64) };
const abyss = { leyline: { desc: '<color=#fff>Test blessing</color>' }, floor: { 12: { buff: ['Fixture only'], first_half_buff: 'Test first-side mechanic', room: Object.fromEntries([1, 2, 3].map(i => [i, { level: 100, first: [{ name: `First ${i}`, hp: 1000000 }], second: [{ name: `Second ${i}`, hp: 2000000 }] }])) } } };
const baseRow: DamageRow = { id: 'hit', character: 'raiden', label: 'Fixture', reaction: 'none', hits: 10, level: 90, baseDamage: 1000, bonus: 50, critRate: 50, critDamage: 100, resistance: 10, shred: 0, defenseReduction: 0, defenseIgnore: 0, em: 0, reactionBonus: 0 };

describe('Independent rotation calculations', () => {
  it('applies defense, expected crit and resistance without a tier or readiness multiplier', () => {
    // 10 hits × 1000 base × 1.5 bonus × 1.5 average crit × .5 defense × .9 RES.
    expect(calculateHit(baseRow, 90).damage).toBeCloseTo(10125);
    expect(calculateHit({ ...baseRow, defenseReduction: 100 }, 90).damage).toBeCloseTo(20250);
    expect(calculateHit({ ...baseRow, defenseIgnore: 100 }, 90).damage).toBeCloseTo(20250);
  });
  it('handles negative and high resistance branches and amplifier direction', () => {
    expect(resistanceMultiplier(-.4)).toBe(1.2);
    expect(resistanceMultiplier(.75)).toBe(.25);
    expect(resistanceMultiplier(1)).toBe(.2);
    expect(calculateHit({ ...baseRow, reaction: 'vaporize', amplification: 1.5 }, 90).damage).toBeCloseTo(15187.5);
    expect(calculateHit({ ...baseRow, reaction: 'melt', amplification: 2 }, 90).damage).toBeCloseTo(20250);
  });
  it('uses trigger EM and level for Hyperbloom, independently of crit, defense and direct damage bonus', () => {
    const row = { ...baseRow, reaction: 'hyperbloom' as const, em: 1000, hits: 1 };
    expect(calculateHit(row, 200).damage).toBeCloseTo(24741.1941318);
    expect(calculateHit({ ...row, critRate: 100, critDamage: 300, bonus: 400, defenseReduction: 100 }, 1).damage).toBe(calculateHit(row, 200).damage);
    expect(calculateHit({ ...row, level: 80 }, 100).damage).toBeUndefined();
  });
  it('withholds DPS for missing values, missing members, invalid inputs and zero duration', () => {
    const sheet = { version: 1 as const, seconds: 20, enemyLevel: 90, rows: [baseRow], noDamage: ['nahida', 'xingqiu', 'barbara'] };
    const team = ['raiden', 'nahida', 'xingqiu', 'barbara'];
    expect(calculateRotation(sheet, team).dps).toBe(506.25);
    expect(calculateRotation({ ...sheet, noDamage: [] }, team).dps).toBeUndefined();
    expect(calculateRotation({ ...sheet, seconds: 0 }, team).dps).toBeUndefined();
    expect(calculateRotation({ ...sheet, rows: [{ ...baseRow, baseDamage: undefined }] }, team).dps).toBeUndefined();
    expect(calculateHit({ ...baseRow, critRate: NaN }, 90).damage).toBeUndefined();
    expect(calculateHit({ ...baseRow, hits: -1 }, 90).damage).toBeUndefined();
    expect(calculateRotation({ ...sheet, noDamage: [...sheet.noDamage, 'raiden'] }, team).dps).toBeUndefined();
    expect(calculateRotation(sheet, ['kuki', 'nahida', 'xingqiu', 'barbara']).dps).toBeUndefined();
  });
});

describe('Live challenge boundary', () => {
  it('preserves all chambers for each Abyss side and rejects incomplete lineups', () => {
    const pack = normalizeEncounter('abyss', abyss, context);
    expect(pack.encounters).toHaveLength(2);
    expect(pack.encounters[0].stages).toHaveLength(3);
    expect(pack.encounters[0].stages[0].enemies[0].hp).toBe(1000000);
    expect(pack.encounters[0].preferred).toEqual([]);
    expect(pack.notes).toContain('Test blessing');
    expect(() => normalizeEncounter('abyss', { ...abyss, floor: { 12: { ...abyss.floor[12], room: {} } } }, context)).toThrow();
    expect(() => validateEncounterPack({ ...pack, endsAt: pack.startsAt })).toThrow();
    expect(() => validateEncounterPack({ ...pack, source: 'javascript:alert(1)' })).toThrow();
  });
  it('keeps Stygian HP unknown and preserves its selected difficulty and mechanics', () => {
    const pack = normalizeEncounter('stygian', { level: { 6: { monster_level: 110, difficulty_config: { level: 6, name: 'Test dire', desc_list: ['Hard'] }, level_config: Object.fromEntries([1, 2, 3].map(i => [i, { name: `Boss ${i}`, monster_buff_detail_list: ['Test shield'], recommend_list: ['Test advice'] }])) } } }, context);
    expect(pack.encounters).toHaveLength(3);
    expect(pack.encounters[0].stages[0].enemies[0].hp).toBeUndefined();
    expect(pack.encounters[0].stages[0].notes).toEqual(['Test shield', 'Test advice']);
    expect(pack.difficulty).toBe('Test dire');
  });
  it('uses server offsets, exclusive end times, cache expiry and future-date rejection', () => {
    expect(serverDate('2026-09-16 04:00:00', 'Europe')).toBe('2026-09-16T03:00:00.000Z');
    expect(serverDate('2026-09-16 04:00:00', 'Asia')).toBe('2026-09-15T20:00:00.000Z');
    expect(serverDate('2026-09-16 04:00:00', 'America')).toBe('2026-09-16T09:00:00.000Z');
    expect(serverDate('2026-09-16T04:00:00Z', 'America')).toBe('2026-09-16T04:00:00.000Z');
    const pack = normalizeEncounter('abyss', abyss, context);
    expect(encounterStatus(pack, Date.parse(context.fetchedAt))).toBe('current');
    expect(encounterStatus(pack, Date.parse(context.endsAt))).toBe('expired');
    expect(encounterStatus(pack, Date.parse(context.startsAt) - 1)).toBe('upcoming');
    expect(encounterStatus(pack, Date.parse(context.fetchedAt) + 86400001)).toBe('stale');
    expect(encounterStatus(pack, Date.parse(context.fetchedAt) - 600000)).toBe('stale');
  });
  it('fetches the live manifest version, skips beta rows and records the exact response hash', async () => {
    const responses = [{ gi: { live: '7.1', latest: '7.2-beta' } }, { 1: { live_begin: context.startsAt, live_end: context.endsAt }, 2: { begin: context.startsAt, end: context.endsAt } }, abyss];
    const fetcher = vi.fn(async () => new Response(JSON.stringify(responses.shift())));
    const pack = await fetchCurrentEncounters('abyss', 'Europe', undefined, fetcher as typeof fetch, Date.parse(context.fetchedAt));
    expect(pack.patch).toBe('7.1');
    expect(pack.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fetcher.mock.calls).toHaveLength(3);
    expect((fetcher.mock.calls as unknown as [string][])[2][0]).toBe('https://static.nanoka.cc/gi/7.1/en/tower/1.json');
  });
  it('fails closed on provider errors, missing live dates and overlapping cycles', async () => {
    const denied = vi.fn(async () => new Response('', { status: 403 }));
    await expect(fetchCurrentEncounters('abyss', 'Europe', undefined, denied as typeof fetch)).rejects.toThrow('HTTP 403');
    for (const index of [{ 1: { begin: context.startsAt, end: context.endsAt } }, { 1: { live_begin: context.startsAt, live_end: context.endsAt }, 2: { live_begin: context.startsAt, live_end: context.endsAt } }]) {
      const responses = [{ gi: { live: '7.1' } }, index];
      await expect(fetchCurrentEncounters('abyss', 'Europe', undefined, (async () => new Response(JSON.stringify(responses.shift()))) as typeof fetch, Date.parse(context.fetchedAt))).rejects.toThrow('unambiguous live cycle');
    }
  });
});

describe('Custom teams, synergies, locking and joint assignment', () => {
  const candidate = (members: string[], score: number) => ({ ...customCandidate(members, { ...demoAccount, owned: members }), score });
  const a = candidate(['mavuika', 'citlali', 'bennett', 'xilonen'], 100);
  const b = candidate(['nahida', 'kuki', 'xingqiu', 'yelan'], 90);
  const c = candidate(['neuvillette', 'furina', 'kazuha', 'zhongli'], 80);
  const encounter = (id: string, preferred: string[]): Encounter => ({ id, name: id, preferred, avoid: [], stages: [] });
  it('permits user teams absent from guides and rejects shared Traveler identities', () => {
    expect(customCandidate(['mavuika', 'barbara', 'qiqi', 'aloy'], demoAccount).origin).toBe('custom');
    expect(() => customCandidate(['travelerdendro', 'traveleranemo', 'xingqiu', 'kuki'], demoAccount)).toThrow();
    expect(analyzeSynergy(['nilou', 'nahida', 'xingqiu', 'kazuha']).some(n => n.kind === 'restriction')).toBe(true);
    expect(analyzeSynergy(['nilou', 'nahida', 'xingqiu', 'yaoyao']).some(n => n.kind === 'restriction')).toBe(false);
    expect(analyzeSynergy(['chevreuse', 'raiden', 'bennett', 'xingqiu']).some(n => n.kind === 'restriction')).toBe(true);
    expect(discover({ ...demoAccount, owned: ['collei', 'barbara', 'raiden', 'yaoyao'] }).some(t => t.origin === 'mechanical' && t.anchor === 'collei' && !t.reviewed)).toBe(true);
  });
  it('assigns against sides jointly instead of ranking each side in isolation', () => {
    const assigned = allocateEncounters([a, b, c], [encounter('first', ['Hydro']), encounter('second', ['Pyro'])]);
    expect(assigned.map(r => r.team.id)).toEqual([b.id, a.id]);
    expect(assigned[0].team.mask & assigned[1].team.mask).toBe(0n);
    expect(allocateEncounters([a], [encounter('first', []), encounter('second', [])])).toHaveLength(1);
  });
  it('honors locks, rejects conflicts and still allocates unused account identities', () => {
    expect(allocate([a, b, c], 2, [c.id]).map(t => t.id)).toContain(c.id);
    expect(allocateEncounters([a, b, c], [encounter('one', ['Pyro']), encounter('two', ['Dendro'])], 96, [c.id]).map(t => t.team.id)).toContain(c.id);
    const conflicting: Candidate = { ...b, id: 'conflict', mask: teamMask(['bennett']) };
    expect(allocate([a, conflicting], 2, [a.id, conflicting.id])).toEqual([]);
    expect(allocateEncounters([a, conflicting], [encounter('one', []), encounter('two', [])], 96, [a.id, conflicting.id])).toEqual([]);
    expect(allocate([a], 1, ['missing'])).toEqual([]);
  });
  it('finds a complete three-side assignment despite a greedy conflicting candidate', () => {
    const pool = [a, b, c, candidate(['raiden', 'xiangling', 'bennett', 'xingqiu'], 120)];
    const encounters = [encounter('one', ['healing']), encounter('two', ['Hydro']), encounter('three', ['Geo'])];
    const actual = allocateEncounters(pool, encounters);
    expect(actual).toHaveLength(3);
    expect(new Set(actual.flatMap(r => r.team.members)).size).toBe(12);
    expect(actual.reduce((s, r) => s + r.team.score, 0)).toBe(270);
  });
});
