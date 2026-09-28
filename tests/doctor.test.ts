import { describe, expect, it } from 'vitest';
import { allocate, accountIdentity, byId, demoAccount, graph, parseAccount, recommend, relationship, teamMask } from '../src/model';
import type { Account, Candidate } from '../src/model';

describe('Account Doctor evidence and planning', () => {
  it('finds Mavuika Melt and preserves the source and role assignment', () => {
    const account: Account = { version: 1, demo: false, mode: 'general', owned: ['mavuika', 'citlali', 'iansan', 'bennett'], readiness: {} };
    const teams = recommend(account);
    expect(teams[0].name).toBe('Mavuika Melt');
    expect(teams[0].members).toEqual(['mavuika', 'citlali', 'iansan', 'bennett']);
    expect(teams[0].roles[0]).toBe('On-field carry');
    expect(teams[0].sources).toContain('https://keqingmains.com/q/mavuika-quickguide/');
    expect(relationship('mavuika', 'citlali')!.priority).toBeGreaterThan(0);
    expect(relationship('mavuika', 'barbara')).toBeUndefined();
  });
  it('does not invent complete teams from graph connections or unowned characters', () => {
    expect(recommend({ ...demoAccount, owned: ['mavuika', 'barbara', 'qiqi', 'aloy'] })).toHaveLength(0);
    for (const team of recommend(demoAccount)) {
      expect(team.members.every(id => demoAccount.owned.includes(id))).toBe(true);
      expect(new Set(team.members.map(accountIdentity)).size).toBe(4);
    }
  });
  it('finds three disjoint teams for the demo roster', () => {
    const teams = allocate(recommend(demoAccount), 3);
    expect(teams).toHaveLength(3);
    expect(new Set(teams.flatMap(t => t.members.map(accountIdentity))).size).toBe(12);
  });
  it('does not greedily consume a support needed for a complete account plan', () => {
    const team = (id: string, members: string[], score: number): Candidate => ({ id, members, score, mask: teamMask(members), name: id, roles: [], reviewed: true, why: '', caution: '', sources: [], missing: [] });
    const a = team('greedy', ['mavuika', 'citlali', 'xingqiu', 'bennett'], 100);
    const b = team('first', ['mavuika', 'citlali', 'xilonen', 'bennett'], 90);
    const c = team('second', ['nahida', 'kuki', 'xingqiu', 'yelan'], 80);
    expect(allocate([a, b, c], 2).map(t => t.id)).toEqual(['first', 'second']);
  });
  it('treats Traveler elements as a single account identity', () => {
    expect(teamMask(['travelerdendro']) & teamMask(['traveleranemo'])).not.toBe(0n);
  });
  it('matches exhaustive allocation for small candidate pools and all requested team counts', () => {
    const pool = recommend(demoAccount).slice(0, 18);
    for (const count of [1, 2, 3]) {
      let bestLength = 0, bestScore = 0;
      const visit = (start: number, mask: bigint, selected: Candidate[]) => {
        const score = selected.reduce((sum, team) => sum + team.score, 0);
        if (selected.length > bestLength || (selected.length === bestLength && score > bestScore)) { bestLength = selected.length; bestScore = score; }
        if (selected.length === count) return;
        for (let i = start; i < pool.length; i++) if (!(pool[i].mask & mask)) visit(i + 1, mask | pool[i].mask, [...selected, pool[i]]);
      };
      visit(0, 0n, []);
      const actual = allocate(pool, count);
      expect(actual.length).toBe(bestLength);
      expect(actual.reduce((s, t) => s + t.score, 0)).toBeCloseTo(bestScore, 8);
    }
  });
  it('keeps missing-character suggestions out of the allocation', () => {
    const account: Account = { ...demoAccount, owned: ['mavuika', 'citlali', 'bennett'] };
    const suggestions = recommend(account, true);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every(t => t.missing.length === 1)).toBe(true);
    expect(allocate(suggestions, 2)).toEqual([]);
    expect(recommend({ ...account, owned: [] }, true)).toEqual([]);
  });
  it('has valid edges with one capped contribution per source URL', () => {
    const unique = new Set<string>();
    for (const edge of graph.edges) {
      expect(byId[edge.a]).toBeDefined(); expect(byId[edge.b]).toBeDefined();
      expect(unique.has(`${edge.a}|${edge.b}`)).toBe(false); unique.add(`${edge.a}|${edge.b}`);
      expect(edge.priority).toBeGreaterThan(0); expect(edge.priority).toBeLessThanOrEqual(1);
      expect(new Set(edge.sources.map(s => s.url)).size).toBe(edge.sources.length);
      expect(edge.sources.every(s => s.weight <= 1 && s.weight > 0)).toBe(true);
    }
  });
});

describe('Account Doctor persistence boundary', () => {
  it('round-trips readiness and modes, and migrates old rosters without inventing readiness', () => {
    expect(parseAccount(JSON.parse(JSON.stringify(demoAccount)))).toEqual(demoAccount);
    expect(parseAccount({ version: 2, owned: ['bennett', 'bennett'], scenario: 'boss', constellations: { bennett: 6 } })).toEqual({ version: 1, owned: ['bennett'], readiness: {}, mode: 'abyss', demo: false });
  });
  it('rejects malformed imports and unknown character IDs', () => {
    for (const value of [null, [], {}, { version: 1, owned: ['invalid'] }, { version: '1', owned: [] }, { version: 1, owned: ['constructor'] }, { ...demoAccount, mode: 'bad' }, { ...demoAccount, readiness: { mavuika: 'yes' } }, { ...demoAccount, readiness: [] }]) expect(() => parseAccount(value)).toThrow();
  });
});
