import { describe, expect, it } from 'vitest';
import { applyGood, goodCharacterId, parseGood } from '../src/import-good';
import { demoAccount, parseAccount, parseDetails } from '../src/account';
import { benchmarkPack, compositionKey, discover, matchSlots, rank, recommend } from '../src/planner/planner';
import type { BenchmarkPack, MetaPack } from '../src/planner/types';

const weapon = { key: 'FavoniusSword', location: 'Bennett', level: 90, ascension: 6, refinement: 3, lock: true };
const artifact = { setKey: 'NoblesseOblige', slotKey: 'flower', level: 20, rarity: 5, mainStatKey: 'hp', location: 'Bennett', lock: true, substats: [{ key: 'enerRech_', value: 12.3 }], astralMark: false };
const good = { format: 'GOOD', version: 3, source: 'Test scanner', characters: [{ key: 'Bennett', constellation: 6, level: 90, ascension: 6, talent: { auto: 1, skill: 8, burst: 10 } }], weapons: [weapon], artifacts: [artifact] };

describe('GOOD ingestion and actual character details', () => {
  it('reads supported GOOD versions, maps aliases, and preserves equipment extensions across export/reload', () => {
    for (const version of [1, 2, 3]) {
      const imported = parseGood({ ...good, version });
      expect(imported.account.owned).toEqual(['bennett']);
      expect(imported.account.readiness).toEqual({});
      expect(imported.account.constellations).toEqual({ bennett: 6 });
      expect(imported.account.details?.bennett).toMatchObject({ level: 90, talents: { burst: 10 }, weapon: { key: 'FavoniusSword', refinement: 3 } });
      expect(parseAccount(JSON.parse(JSON.stringify(imported.account)))).toEqual(imported.account);
      expect(imported.account.inventory?.artifacts?.[0]).toEqual(artifact);
    }
    expect(goodCharacterId('KaedeharaKazuha')).toBe('kazuha');
    expect(goodCharacterId('RaidenShogun')).toBe('raiden');
    expect(goodCharacterId('KukiShinobu')).toBe('kuki');
    expect(goodCharacterId('TravelerDendro')).toBe('travelerdendro');
    expect(goodCharacterId('constructor')).toBeUndefined();
  });
  it('merges partial scans, preserves readiness and replaces supplied equipment categories without duplicates', () => {
    const current = { ...demoAccount, demo: false, inventory: parseGood(good).account.inventory, details: { bennett: { energyRecharge: 240, weapon: { key: 'OldWeapon' } } } };
    const characterOnly = parseGood({ format: 'GOOD', version: 1, source: 'Partial', characters: good.characters });
    const merged = applyGood(current, characterOnly);
    expect(merged.owned).toEqual(current.owned);
    expect(merged.readiness).toEqual(current.readiness);
    expect(merged.inventory?.artifacts).toEqual([artifact]);
    expect(merged.details?.bennett.energyRecharge).toBe(240);
    expect(merged.details?.bennett.weapon?.key).toBe('OldWeapon');
    const again = applyGood(applyGood(merged, parseGood(good)), parseGood(good));
    expect(again.inventory?.weapons).toHaveLength(1);
    expect(again.details?.bennett.weapon?.key).toBe('FavoniusSword');
    const cleared = applyGood(again, parseGood({ ...good, weapons: [] }));
    expect(cleared.details?.bennett.weapon).toBeUndefined();
    expect(applyGood(current, parseGood(good), true).owned).toEqual(['bennett']);
    expect(applyGood(demoAccount, parseGood(good)).owned).toEqual(['bennett']);
  });
  it('supports equipment-only files without inventing roster ownership and warns about unmatched variants', () => {
    const imported = parseGood({ ...good, characters: [{ ...good.characters[0], key: 'Traveler' }] });
    expect(imported.account.owned).toEqual([]);
    expect(imported.warnings.join(' ')).toContain('explicit element');
    expect(imported.warnings.join(' ')).toContain('Equipment-only');
    expect(applyGood({ ...demoAccount, demo: false }, imported).owned).toEqual(demoAccount.owned);
  });
  it('rejects malformed values atomically and keeps unknown distinct from zero', () => {
    for (const input of [{ ...good, version: 4 }, { ...good, source: null }, { ...good, characters: {} }, { ...good, characters: [good.characters[0], good.characters[0]] }, { ...good, characters: [{ ...good.characters[0], constellation: 7 }] }, { ...good, weapons: [{ ...weapon, refinement: 0 }] }, { ...good, artifacts: [{ ...artifact, level: 50 }] }]) expect(() => parseGood(input)).toThrow();
    expect(parseDetails({})).toEqual({});
    expect(parseDetails({ elementalMastery: 0 })).toEqual({ elementalMastery: 0 });
    expect(() => parseDetails({ talents: { burst: 13 } })).toThrow();
    expect(() => parseAccount({ ...demoAccount, details: { bennett: { level: NaN } } })).toThrow();
    expect(() => parseAccount({ ...demoAccount, constellations: { bennett: -1 } })).toThrow();
  });
});

describe('Contextual team priority and focused discovery', () => {
  it('enforces the requested character before pruning and shows complete or one-missing recipes', () => {
    const found = recommend(demoAccount, true, { requiredCharacter: 'iansan' });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(t => t.members.includes('iansan') && t.missing.length <= 1)).toBe(true);
    expect(found.some(t => t.name === 'Mavuika Melt')).toBe(true);
    expect(recommend(demoAccount, false, { requiredCharacter: 'not-a-character' })).toEqual([]);
  });
  it('requires a unique full slot assignment rather than accepting overlapping slot membership', () => {
    expect(matchSlots([['bennett'], ['bennett'], ['mavuika'], ['citlali']], ['bennett', 'mavuika', 'citlali', 'iansan'])).toBeUndefined();
    expect(matchSlots([['bennett', 'iansan'], ['bennett'], ['mavuika'], ['citlali']], ['bennett', 'mavuika', 'citlali', 'iansan'])).toEqual(['iansan', 'bennett', 'mavuika', 'citlali']);
  });
  it('applies constellation-conditioned teammate ratings without treating unknown as C0 or DPS', () => {
    const account = { ...demoAccount, constellations: {} };
    const meta: MetaPack = { id: 'fixture', patch: 'fixture', source: 'https://example.com', updatedAt: '2026-09-01', checkedAt: '2026-09-01', expiresAt: '2026-10-01', entries: [{ id: 'mavuika', role: 'carry', tier: 0, constellation: 0, partners: [] }, { id: 'iansan', role: 'support', tier: 0, constellation: 6, partners: [] }] };
    const options = { meta, now: '2026-09-29', requiredCharacter: 'iansan' };
    const unknown = recommend(account, false, options).find(t => t.name === 'Mavuika Melt')!;
    const c6 = recommend({ ...account, constellations: { iansan: 6 } }, false, options).find(t => t.id === unknown.id)!;
    expect(c6.score).toBeGreaterThan(unknown.score);
    expect(unknown.assumptions.join(' ')).toContain('assumes C6; yours is unknown');
    expect(unknown.benchmark).toBeUndefined();
    expect(unknown.scoreParts).toBeDefined();
    expect(recommend(account, false, { ...options, now: '2026-11-01' }).every(t => t.ranking === 'guide')).toBe(true);
  });
  it('accepts only comparable validated benchmark rows and keeps unmeasured teams out of DPS ranking', () => {
    const candidate = discover(demoAccount).find(t => t.name === 'Mavuika Melt')!;
    const benchmarks: BenchmarkPack = { ...benchmarkPack, generatedAt: '2026-09-29', engine: { revision: 'a'.repeat(40), binarySha256: 'b'.repeat(64) }, rows: [{ id: 'fixture', members: candidate.members, anchor: candidate.anchor, scenario: 'boss', profileId: benchmarkPack.profileId, status: 'passed', meanDps: 100, ci95: 2, samples: 32, configSha256: 'c'.repeat(64), configPath: 'fixture-only.txt', rotationStatus: 'validated', diagnostics: [] }] };
    expect(compositionKey(candidate.members)).toBe(candidate.id);
    const options = { strategy: 'benchmark' as const, benchmarks, now: '2026-09-29' };
    expect(rank([candidate], demoAccount, options)[0].score).toBe(98);
    expect(rank([candidate], demoAccount, { ...options, scenario: 'groups' })).toEqual([]);
    expect(rank([candidate], demoAccount, { ...options, now: '2027-01-01' })).toEqual([]);
    expect(rank([candidate], demoAccount, { ...options, benchmarks: { ...benchmarks, engine: { revision: '', binarySha256: '' } } })).toEqual([]);
    expect(rank([candidate], demoAccount, { ...options, benchmarks: { ...benchmarks, rows: [{ ...benchmarks.rows[0], rotationStatus: 'experimental' }] } })).toEqual([]);
    expect(recommend(demoAccount, false, { strategy: 'benchmark' })).toEqual([]);
  });
});
