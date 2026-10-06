import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import data from '../src/data/clear-archive.json';
import { accountIdentity, characters, demoAccount } from '../src/account';
import type { Account } from '../src/account';
import { assignListedWeapons, findRecordedPlans, matchListedClear, parseClearArchive, weaponCopies } from '../src/planner/clear-archive';
import type { ClearArchive, ClearFinderOptions, ListedClear } from '../src/planner/clear-archive';
import { normalizeListing, publicPageProps } from '../scripts/lib/stygian-public.mjs';

const archive = parseClearArchive(data);
const version = archive.versions[0];
const defaults: ClearFinderOptions = { versionId: version.id, difficulty: 'Dire', filter: 'roster', objective: 'fastest', exclude: [], locks: {}, skip: [], swaps: false, easyOnly: false };
const teams = [ ['mavuika', 'citlali', 'xilonen', 'bennett'], ['neuvillette', 'furina', 'kazuha', 'zhongli'], ['nahida', 'kuki', 'xingqiu', 'yelan'] ];
function row(id: string, boss: number, members: string[], seconds = 90): ListedClear {
  return { ...archive.records[0], id, bossId: version.bossIds[boss], versionId: version.id, difficulty: 'Dire', seconds, cost: 4, members: members.map(character => ({ character, constellation: 0, weapon: `Test ${character}`, refinement: 1 })), tags: [], investment: 'listed', proofUrl: `https://www.youtube.com/watch?v=${id}` };
}
function fixture(records: ListedClear[]): ClearArchive { return { ...archive, records, coverage: [] }; }
function accountFor(records: ListedClear[]): Account {
  const members = records.flatMap(r => r.members);
  return { version: 1, demo: false, mode: 'stygian', readiness: {}, owned: [...new Set(members.map(m => m.character))], constellations: Object.fromEntries(members.map(m => [m.character, m.constellation])), details: Object.fromEntries(members.map(m => [m.character, { level: m.level ?? 90, weapon: { key: m.weapon, refinement: m.refinement } }])) };
}

describe('Real attributed clear publication', () => {
  it('contains real complete source listings for both difficulties and all three bosses', () => {
    expect(archive.records).toHaveLength(914);
    expect(archive.coverage).toHaveLength(6);
    expect(archive.records.every(r => r.verification === 'source-listed' && r.members.length === 4 && archive.snapshots.some(s => s.id === r.snapshotId))).toBe(true);
    expect(archive.coverage.reduce((n, c) => n + c.sourceCount, 0)).toBe(archive.records.length + archive.rejected.length);
    expect(new Set(archive.records.flatMap(r => r.members.map(m => m.character))).size).toBeGreaterThan(40);
    expect(archive.records.some(r => r.id === 'df781716-43f4-4923-8248-a7eb30a3e936' && r.seconds === 114 && r.members[0].character === 'travelercryo')).toBe(true);
  });
  it('validates source identities, copy-safe compositions, reduced cost and provenance', () => {
    const bad = structuredClone(archive);
    bad.records[0].members[3].character = bad.records[0].members[0].character;
    expect(() => parseClearArchive(bad)).toThrow(/distinct/);
    const reduced = structuredClone(archive);
    reduced.records[0].tags = ['Reduced Cost']; reduced.records[0].investment = 'listed';
    expect(() => parseClearArchive(reduced)).toThrow(/reduced/);
    const url = structuredClone(archive); url.records[0].proofUrl = 'javascript:alert(1)';
    expect(() => parseClearArchive(url)).toThrow(/clear/);
    const hash = structuredClone(archive); hash.snapshots[0].sha256 = 'bad';
    expect(() => parseClearArchive(hash)).toThrow(/snapshot/);
  });
  it('normalizes public listing fields without upgrading reduced metadata or missing builds', () => {
    const source = { id: 'test-source-row', boss_id: version.bossIds[0], version_id: version.id, difficulty: 'Dire', cost: 3, time_seconds: 115, link: 'https://www.youtube.com/watch?v=test', is_verified: true, clear_characters: ['Cryo MC', 'Xianyun', 'Bennett', 'Rosaria'].map((name, sort_order) => ({ characters: { name }, constellation: sort_order, weapons: { name: 'Favonius Sword' }, weapon_refinement: 5, sort_order, imported_details: sort_order === 1 ? { characterLevel: 95 } : null })), clear_tag_assignments: [{ clear_tags: { label: 'Reduced Cost' } }] };
    const normalized = normalizeListing(source, characters, archive.snapshots[0].id, 'https://www.stygian.moe/clears');
    expect(normalized.members.map(m => m.character)).toEqual(['travelercryo', 'xianyun', 'bennett', 'rosaria']);
    expect(normalized.members[0].level).toBeUndefined();
    expect(normalized.members[1].level).toBe(95);
    expect(normalized.investment).toBe('reduced');
    expect(normalized.verification).toBe('source-listed');
    expect(() => normalizeListing({ ...source, clear_characters: source.clear_characters.slice(0, 3) }, characters, 'snapshot', source.link)).toThrow(/incomplete/);
    const props = { initialClears: [source] };
    const chunk = `1:${JSON.stringify(['$', 'client', null, props])}\n`;
    expect(publicPageProps(`<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`, 'initialClears')).toEqual(props);
    expect(() => publicPageProps('<script>throw new Error("must not execute")</script>', 'initialClears')).toThrow(/schema/);
  });
  it('matches the audited publication hash and source normalization counts', async () => {
    const body = await readFile(new URL('../src/data/clear-archive.json', import.meta.url));
    const audit = JSON.parse(await readFile(new URL('../docs/verification/recorded-clear-index-2026-10-06.json', import.meta.url), 'utf8'));
    expect(createHash('sha256').update(body).digest('hex')).toBe(audit.publicationSha256);
    expect(audit.records).toBe(archive.records.length);
    expect(audit.checkedSnapshots).toBe(archive.snapshots.length);
    expect(audit.independentlyVerifiedVideos).toBe(0);
  });
});

describe('Investment and finite weapon copies', () => {
  it('keeps unknown investment, reduced costs and unmatched buff context out of the strict filter', () => {
    const r = row('one', 0, teams[0]), account = accountFor([r]);
    expect(matchListedClear(r, account).investmentMatch).toBe(true);
    expect(matchListedClear(r, { ...account, constellations: undefined }).investmentMatch).toBe(false);
    expect(matchListedClear(r, { ...account, details: undefined }).gaps.every(g => g.kind === 'unknown')).toBe(true);
    expect(matchListedClear({ ...r, investment: 'reduced', tags: ['Reduced Cost'] }, account).investmentMatch).toBe(false);
    expect(matchListedClear({ ...r, tags: ['Theatre Buff'] }, account).investmentMatch).toBe(false);
    expect(matchListedClear({ ...r, tags: ['Over Level'] }, account).investmentMatch).toBe(false);
    const higher = { ...r, members: r.members.map(m => ({ ...m, constellation: 2, level: 95 })) };
    const diff = matchListedClear(higher, account);
    expect(diff.deficits).toBe(8);
    expect(diff.gaps.some(g => g.text.includes('yours C0'))).toBe(true);
  });
  it('normalizes GOOD keys, avoids double-counting equipped scan mirrors and requires refinements', () => {
    const r = row('one', 0, teams[0]); r.members[0].weapon = "Wolf’s Gravestone"; r.members[0].refinement = 5;
    const account = accountFor([r]); account.details![r.members[0].character].weapon!.key = 'WolfsGravestone';
    account.inventory = { format: 'GOOD', version: 3, source: 'test', weapons: [{ key: 'WolfsGravestone', refinement: 5, location: 'Mavuika' }] };
    expect(weaponCopies(account)).toHaveLength(4);
    expect(matchListedClear(r, account, undefined, false).investmentMatch).toBe(true);
    account.details![r.members[1].character].weapon!.refinement = undefined;
    expect(matchListedClear(r, account).investmentMatch).toBe(false);
    account.details![r.members[0].character].weapon = { key: 'MailedFlower', refinement: 5 };
    expect(weaponCopies(account).find(w => w.owner === 'mavuika')?.key).toBe('mailedflower');
    expect(matchListedClear(r, account, undefined, false).investmentMatch).toBe(false);
  });
  it('finds a complete refinement assignment and respects the equipped-only policy', () => {
    const members = ['bennett', 'xingqiu'].map((character, i) => ({ character, constellation: 0, weapon: 'Favonius Sword', refinement: i ? 5 : 1 }));
    const copies = [{ id: 'low', key: 'favoniussword', refinement: 1, owner: 'bennett' }, { id: 'high', key: 'favoniussword', refinement: 5, owner: 'xingqiu' }];
    expect(assignListedWeapons(members, copies).missing).toHaveLength(0);
    expect(assignListedWeapons(members, copies.slice(1)).missing).toHaveLength(1);
    expect(assignListedWeapons(members, [{ ...copies[0], owner: 'kaeya' }, copies[1]], false).missing).toHaveLength(1);
    expect(assignListedWeapons(members, [{ ...copies[0], owner: 'kaeya' }, copies[1]], true).missing).toHaveLength(0);
  });
  it('never promises the same physical weapon in different teams', () => {
    const rows = teams.map((members, i) => row(`team${i}`, i, members));
    rows.forEach(r => r.members[0].weapon = 'Favonius Sword');
    const account = accountFor(rows); account.details = {};
    account.inventory = { format: 'GOOD', version: 3, source: 'test', weapons: [{ key: 'FavoniusSword', refinement: 5, location: '' }, ...rows.flatMap(r => r.members.slice(1)).map(m => ({ key: m.weapon, refinement: 5, location: '' }))] };
    const individual = rows.map(r => matchListedClear(r, account, undefined, true));
    expect(individual.every(m => m.investmentMatch)).toBe(true);
    const result = findRecordedPlans(fixture(rows), account, { ...defaults, swaps: true, filter: 'investment' });
    expect(result.plans[0].matches).toHaveLength(1);
    const roster = findRecordedPlans(fixture(rows), account, { ...defaults, swaps: true });
    expect(roster.plans[0].matches).toHaveLength(3);
    expect(roster.plans[0].weapons.missing).toHaveLength(2);
    expect(roster.plans[0].investmentMatch).toBe(false);
    const locks = Object.fromEntries(rows.map(r => [r.bossId, r.id]));
    expect(findRecordedPlans(fixture(rows), account, { ...defaults, swaps: true, filter: 'investment', locks }).conflicts.join()).toMatch(/weapon copies/);
  });
});

describe('Joint recorded encounter allocation', () => {
  it('maximizes boss coverage before speed and reallocates shared supports', () => {
    const fast = row('fast', 0, teams[0], 10);
    const alternate = row('alternate', 0, ['mavuika', 'citlali', 'xilonen', 'iansan'], 100);
    const second = row('second', 1, ['neuvillette', 'furina', 'kazuha', 'bennett'], 20);
    const third = row('third', 2, teams[2], 30);
    const rows = [fast, alternate, second, third], account = accountFor(rows);
    const result = findRecordedPlans(fixture(rows), account, defaults);
    expect(result.plans[0].matches.map(m => m.record.id)).toEqual(['alternate', 'second', 'third']);
    expect(result.plans.every(p => p.matches.length === 3)).toBe(true);
    expect(new Set(result.plans[0].matches.flatMap(m => m.record.members.map(x => accountIdentity(x.character)))).size).toBe(12);
    expect(result.bounded).toBe(false);
    const locked = findRecordedPlans(fixture(rows), account, { ...defaults, locks: { [fast.bossId]: fast.id } });
    expect(locked.plans[0].matches).toHaveLength(2);
    const conflict = findRecordedPlans(fixture(rows), account, { ...defaults, locks: { [fast.bossId]: fast.id, [second.bossId]: second.id } });
    expect(conflict.plans).toHaveLength(0);
    expect(conflict.conflicts.join()).toMatch(/share/);
  });
  it('shares Traveler identity, keeps original bosses and applies filters and exclusions', () => {
    const first = row('first', 0, ['travelercryo', 'citlali', 'xilonen', 'bennett']);
    const second = row('second', 1, ['travelerdendro', 'furina', 'kazuha', 'zhongli']);
    const third = row('third', 2, teams[2]);
    const rows = [first, second, third], account = accountFor(rows), input = fixture(rows);
    expect(findRecordedPlans(input, account, defaults).plans[0].matches).toHaveLength(2);
    const excluded = findRecordedPlans(input, account, { ...defaults, exclude: ['travelerpyro'] });
    expect(excluded.perBoss[0].matches).toHaveLength(0);
    expect(excluded.perBoss[1].matches).toHaveLength(0);
    expect(excluded.plans[0].matches[0].record.bossId).toBe(third.bossId);
    expect(findRecordedPlans(input, account, { ...defaults, difficulty: 'Fearless' }).plans).toHaveLength(0);
    expect(findRecordedPlans(input, account, { ...defaults, skip: [third.id] }).plans[0].matches).toHaveLength(1);
    const demanding = fixture([{ ...third, tags: ['Macro'] }]);
    expect(findRecordedPlans(demanding, account, { ...defaults, easyOnly: true }).plans).toHaveLength(0);
  });
  it('keeps composition-distinct complete alternatives and honest one-character-away coverage', () => {
    const rows = teams.map((members, i) => row(`team${i}`, i, members));
    rows.push(row('variant1', 0, ['mavuika', 'citlali', 'xilonen', 'iansan']));
    rows.push(row('variant2', 1, ['neuvillette', 'furina', 'kazuha', 'barbara']));
    rows.push(row('gear-only', 0, teams[0], 100));
    const account = accountFor(rows), input = fixture(rows);
    const result = findRecordedPlans(input, account, defaults);
    expect(result.plans).toHaveLength(3);
    expect(new Set(result.plans.map(p => p.key)).size).toBe(3);
    expect(result.plans.every(p => p.matches.length === 3)).toBe(true);
    const missing = { ...account, owned: account.owned.filter(id => id !== 'iansan') };
    const near = findRecordedPlans(input, missing, defaults).perBoss[0].near;
    expect(near[0].missing).toEqual(['iansan']);
    expect(near[0].record.id).toBe('variant1');
    expect(findRecordedPlans(input, missing, { ...defaults, locks: { [version.bossIds[0]]: 'variant1' } }).conflicts.join()).toMatch(/unavailable/);
  });
  it('matches the real demo and large rosters deterministically without fabricated current-cycle claims', () => {
    const start = performance.now();
    const all: Account = { ...demoAccount, owned: characters.map(c => c.id) };
    for (const difficulty of ['Dire', 'Fearless'] as const) {
      const result = findRecordedPlans(archive, all, { ...defaults, difficulty, objective: 'closest' });
      expect(result.plans[0].matches).toHaveLength(3);
      expect(new Set(result.plans[0].matches.flatMap(m => m.record.members.map(x => accountIdentity(x.character)))).size).toBe(12);
      expect(result.plans[0].matches.every(m => m.record.versionId === version.id && m.record.difficulty === difficulty)).toBe(true);
    }
    const a = findRecordedPlans(archive, demoAccount, defaults), b = findRecordedPlans(archive, demoAccount, defaults);
    expect(a.plans.map(p => p.key)).toEqual(b.plans.map(p => p.key));
    expect(a.plans.length).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});
