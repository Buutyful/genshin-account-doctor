import { describe, expect, it } from 'vitest';
import type { Account } from '../src/account';
import { evaluatePull, preparePullStudy } from '../src/planner/pulls';
import { PULL_CACHE_REVISION, pullCacheKey, validPullCache } from '../src/planner/pull-cache';

const account: Account = { version: 1, owned: ['nahida', 'xingqiu', 'raiden', 'zhongli', 'bennett', 'xiangling', 'yelan'], readiness: {}, mode: 'abyss', demo: false };
const planning = { context: { mode: 'abyss' as const, region: 'Europe' as const }, preferences: [], now: Date.parse('2026-10-04T12:00:00Z') };
const evidence = { hash: 'reviewed-character-data', fresh: true };

describe('Pull comparison caching', () => {
  it('keeps a deterministic key across object/roster ordering and demo status', async () => {
    const key = await pullCacheKey(account, planning, evidence);
    expect(await pullCacheKey({ ...account, owned: [...account.owned].reverse(), demo: true }, { ...planning, context: { region: 'Europe', mode: 'abyss' } }, { fresh: true, hash: evidence.hash })).toBe(key);
  });
  it('invalidates ownership, builds, constellations, equipment, preferences, mode, challenges and source revisions', async () => {
    const key = await pullCacheKey(account, planning, evidence);
    const inputs: [Account, unknown, unknown][] = [
      [{ ...account, owned: [...account.owned, 'kuki'] }, planning, evidence],
      [{ ...account, details: { nahida: { level: 90 } } }, planning, evidence],
      [{ ...account, constellations: { raiden: 2 } }, planning, evidence],
      [{ ...account, inventory: { artifacts: [{ setKey: 'FlowersOfParadiseLost', level: 20 }], format: 'GOOD', version: 1, source: 'test' } }, planning, evidence],
      [account, { ...planning, preferences: [{ kind: 'exclude', character: 'bennett' }] }, evidence],
      [{ ...account, mode: 'stygian' }, { ...planning, context: { mode: 'stygian', region: 'Europe' } }, evidence],
      [account, { ...planning, pack: { cycleId: 'next-cycle', sourceHash: 'new-opponents' } }, evidence],
      [account, planning, { ...evidence, hash: 'updated-ratings-and-kit-review' }],
      [account, planning, { ...evidence, fresh: false }],
    ];
    for (const [a, p, e] of inputs) expect(await pullCacheKey(a, p, e)).not.toBe(key);
  });
  it('accepts a completed C0 comparison and rejects partial, damaged, older and overlapping plans', () => {
    const result = evaluatePull(preparePullStudy(account, planning), 'kuki');
    const entry = { key: 'key', revision: PULL_CACHE_REVISION, savedAt: '2026-10-04T12:00:00Z', candidates: ['kuki'], results: [result] };
    expect(validPullCache(entry, 'key', ['kuki'], account)).toBe(true);
    expect(validPullCache(entry, 'other-key', ['kuki'], account)).toBe(false);
    expect(validPullCache(entry, 'key', ['kuki', 'furina'], account)).toBe(false);
    expect(validPullCache({ ...entry, revision: 0 }, 'key', ['kuki'], account)).toBe(false);
    expect(validPullCache({ ...entry, results: [] }, 'key', ['kuki'], account)).toBe(false);
    expect(validPullCache({ ...entry, results: [null] }, 'key', ['kuki'], account)).toBe(false);
    const damaged = structuredClone(entry);
    damaged.results[0].account.constellations!.kuki = 6;
    expect(validPullCache(damaged, 'key', ['kuki'], account)).toBe(false);
    const overlapping = structuredClone(entry);
    overlapping.results[0].after.assignments[1].config.members[0] = overlapping.results[0].after.assignments[0].config.members[0];
    expect(validPullCache(overlapping, 'key', ['kuki'], account)).toBe(false);
  });
});
