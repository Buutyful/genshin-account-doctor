import { accountIdentity, byId, object, teamMask } from '../account';
import type { Account } from '../account';
import { equipmentLocation } from '../import-good';
import { canonicalProof } from './observed';

export interface ListedMember { character: string; constellation: number; weapon: string; refinement: number; level?: number; }
export interface ListedClear {
  id: string; bossId: string; versionId: string; difficulty: 'Dire' | 'Fearless'; seconds: number; cost: number;
  proofUrl: string; originalProofUrl?: string; sourceUrl: string; members: ListedMember[]; tags: string[];
  investment: 'listed' | 'reduced'; verification: 'source-listed'; snapshotId: string;
}
export interface ClearArchive {
  format: 'AccountDoctorClearArchive'; version: 1; parserVersion: string;
  source: { id: string; name: string; url: string; termsUrl: string; guideUrl: string };
  checkedAt: string; reviewAfter: string;
  versions: { id: string; label: string; bossIds: string[] }[];
  bosses: { id: string; name: string; shortName: string }[];
  snapshots: { id: string; url: string; sha256: string; fetchedAt: string; kind: string }[];
  coverage: { versionId: string; bossId: string; difficulty: string; sourceCount: number; indexedCount: number; pages: number; url: string }[];
  records: ListedClear[]; rejected: { id: string; reason: string }[];
}
const https = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 2000) return false;
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
};
const short = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 500;
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const date = (v: unknown) => typeof v === 'string' && /Z$/.test(v) && Number.isFinite(Date.parse(v));
export function parseClearArchive(raw: unknown): ClearArchive {
  const p = object(raw, 'Clear archive') as unknown as ClearArchive;
  if (p.format !== 'AccountDoctorClearArchive' || p.version !== 1 || !short(p.parserVersion) || !p.source || !short(p.source.id) || !short(p.source.name) || ![p.source.url, p.source.termsUrl, p.source.guideUrl].every(https) || !date(p.checkedAt) || !date(p.reviewAfter) || Date.parse(p.reviewAfter) <= Date.parse(p.checkedAt)) throw new Error('Invalid clear archive provenance.');
  if (!Array.isArray(p.bosses) || !p.bosses.length || p.bosses.length > 100 || p.bosses.some(b => !b || ![b.id, b.name, b.shortName].every(short)) || new Set(p.bosses.map(b => b.id)).size !== p.bosses.length) throw new Error('Invalid archive bosses.');
  if (!Array.isArray(p.versions) || !p.versions.length || p.versions.length > 50 || p.versions.some(v => !v || !short(v.id) || !short(v.label) || !Array.isArray(v.bossIds) || v.bossIds.length !== 3 || new Set(v.bossIds).size !== 3 || v.bossIds.some(id => !p.bosses.some(b => b.id === id))) || new Set(p.versions.map(v => v.id)).size !== p.versions.length) throw new Error('Invalid archive versions.');
  if (!Array.isArray(p.snapshots) || !p.snapshots.length || p.snapshots.length > 2000 || p.snapshots.some(s => !s || !short(s.id) || !https(s.url) || !/^[a-f0-9]{64}$/.test(s.sha256) || !date(s.fetchedAt)) || new Set(p.snapshots.map(s => s.id)).size !== p.snapshots.length) throw new Error('Invalid archive snapshots.');
  if (!Array.isArray(p.records) || p.records.length > 20000) throw new Error('Invalid archive record count.');
  for (const r of p.records) {
    if (!r || !short(r.id) || !p.versions.some(v => v.id === r.versionId && v.bossIds.includes(r.bossId)) || !['Dire', 'Fearless'].includes(r.difficulty) || !Number.isFinite(r.seconds) || r.seconds <= 0 || r.seconds > 86400 || !Number.isFinite(r.cost) || r.cost < 0 || r.cost > 1000 || !https(r.proofUrl) || !https(r.sourceUrl) || !p.snapshots.some(s => s.id === r.snapshotId) || r.verification !== 'source-listed' || !['listed', 'reduced'].includes(r.investment)) throw new Error('Invalid source-listed clear.');
    if (!Array.isArray(r.tags) || r.tags.length > 50 || r.tags.some(t => !short(t)) || (r.tags.some(t => /reduced cost/i.test(t)) && r.investment !== 'reduced')) throw new Error('Invalid execution or reduced-cost metadata.');
    if (!Array.isArray(r.members) || r.members.length !== 4 || r.members.some(m => !m || !Object.hasOwn(byId, m.character) || !integer(m.constellation, 0, 6) || !short(m.weapon) || !integer(m.refinement, 1, 5) || (m.level !== undefined && !integer(m.level, 1, 100))) || new Set(r.members.map(m => accountIdentity(m.character))).size !== 4) throw new Error('A listed clear needs four distinct known account identities and valid investment.');
  }
  if (new Set(p.records.map(r => r.id)).size !== p.records.length) throw new Error('Duplicate archive record IDs.');
  if (!Array.isArray(p.coverage) || p.coverage.length > 300 || p.coverage.some(c => !c || !p.versions.some(v => v.id === c.versionId && v.bossIds.includes(c.bossId)) || !['Dire', 'Fearless'].includes(c.difficulty) || !integer(c.sourceCount, 0, 100000) || !integer(c.indexedCount, 0, c.sourceCount) || c.indexedCount !== p.records.filter(r => r.versionId === c.versionId && r.bossId === c.bossId && r.difficulty === c.difficulty).length || !https(c.url))) throw new Error('Invalid archive coverage counts.');
  if (!Array.isArray(p.rejected) || p.rejected.some(r => !r || !short(r.id) || !short(r.reason))) throw new Error('Invalid archive exclusions.');
  return p;
}

export const weaponKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export interface WeaponCopy { id: string; key: string; refinement?: number; owner?: string; }
/** Equipped details mirror scanned rows. Never count the same item twice. */
export function weaponCopies(account: Account): WeaponCopy[] {
  const rows: WeaponCopy[] = (account.inventory?.weapons ?? []).map((w, i) => ({ id: `inventory:${i}`, key: weaponKey(String(w.key)), refinement: typeof w.refinement === 'number' ? w.refinement : undefined, owner: equipmentLocation(String(w.location)) }));
  for (const id of account.owned) {
    const weapon = account.details?.[id]?.weapon;
    if (!weapon?.key) continue;
    const key = weaponKey(weapon.key);
    const equipped = rows.filter(row => row.owner && accountIdentity(row.owner) === accountIdentity(id));
    if (equipped.length === 1 && equipped[0].key === key) {
      // The editor can update refinement after a scan. The row is still one copy.
      equipped[0].refinement = weapon.refinement;
      continue;
    }
    if (equipped.length) {
      // A recorded equipment change leaves the old item in inventory, rather
      // than treating the stale scan location as the current equipped weapon.
      equipped.forEach(row => { row.owner = undefined; });
    }
    const spare = rows.find(row => !row.owner && row.key === key && row.refinement === weapon.refinement);
    if (spare) { spare.owner = id; continue; }
    // Traveler elements are one account character and one equipped copy.
    if (rows.some(row => row.id === `equipped:${accountIdentity(id)}`)) continue;
    rows.push({ id: `equipped:${accountIdentity(id)}`, key: weaponKey(weapon.key), refinement: weapon.refinement, owner: id });
  }
  return rows;
}
export interface WeaponAllocation { assigned: { character: string; weapon: string; copy: WeaponCopy; swap: boolean }[]; missing: ListedMember[]; }
/** Bipartite matching preserves physical copy counts and handles refinements without greedy traps. */
export function assignListedWeapons(members: ListedMember[], copies: WeaponCopy[], swaps = true): WeaponAllocation {
  const eligible = members.map(m => copies.map((w, i) => ({ w, i })).filter(({ w }) => w.key === weaponKey(m.weapon) && w.refinement !== undefined && w.refinement >= m.refinement && (swaps || Boolean(w.owner && accountIdentity(w.owner) === accountIdentity(m.character)))).sort((a, b) => Number(b.w.owner === m.character) - Number(a.w.owner === m.character) || a.w.refinement! - b.w.refinement!).map(x => x.i));
  const owners = new Map<number, number>();
  function place(member: number, visited: Set<number>): boolean {
    for (const copy of eligible[member]) {
      if (visited.has(copy)) continue;
      visited.add(copy);
      const previous = owners.get(copy);
      if (previous === undefined || place(previous, visited)) { owners.set(copy, member); return true; }
    }
    return false;
  }
  members.forEach((_, index) => place(index, new Set()));
  const assigned = [...owners].map(([index, member]) => ({ character: members[member].character, weapon: members[member].weapon, copy: copies[index], swap: !copies[index].owner || accountIdentity(copies[index].owner!) !== accountIdentity(members[member].character) }));
  const found = new Set(owners.values());
  return { assigned, missing: members.filter((_, i) => !found.has(i)) };
}
export interface ClearGap { character?: string; kind: 'constellation' | 'level' | 'weapon' | 'unknown' | 'reduced'; text: string; }
export interface ClearMatch { record: ListedClear; mask: bigint; missing: string[]; gaps: ClearGap[]; unknowns: number; deficits: number; execution: string[]; investmentMatch: boolean; weapons: WeaponAllocation; }
const demanding = /macro|3rd.party|unlocker|high cps|hard combo|cheese|ping dependent|theatre buff|over level/i;
export function matchListedClear(record: ListedClear, account: Account, copies = weaponCopies(account), swaps = true): ClearMatch {
  const missing = record.members.filter(m => !account.owned.includes(m.character)).map(m => m.character), gaps: ClearGap[] = [];
  for (const member of record.members) {
    if (missing.includes(member.character)) continue;
    const name = byId[member.character].name, constellation = account.constellations?.[member.character], level = account.details?.[member.character]?.level;
    if (constellation === undefined) gaps.push({ character: member.character, kind: 'unknown', text: `${name}: record C${member.constellation}; your constellation is unknown.` });
    else if (constellation < member.constellation) gaps.push({ character: member.character, kind: 'constellation', text: `${name}: record C${member.constellation}; yours C${constellation}.` });
    if (member.level !== undefined && (level === undefined || level < member.level)) gaps.push({ character: member.character, kind: level === undefined ? 'unknown' : 'level', text: `${name}: record level ${member.level}; yours ${level ?? 'unknown'}.` });
  }
  const weapons = assignListedWeapons(record.members.filter(m => !missing.includes(m.character)), copies, swaps);
  for (const member of weapons.missing) {
    const known = copies.some(w => w.key === weaponKey(member.weapon));
    gaps.push({ character: member.character, kind: known ? 'weapon' : 'unknown', text: `${byId[member.character].name}: R${member.refinement} ${member.weapon} ${known ? 'needs an available copy at the listed refinement' : 'is not recorded in your equipment'}.${swaps ? '' : ' Equipped weapons only.'}` });
  }
  if (record.investment === 'reduced') gaps.push({ kind: 'reduced', text: 'Source-approved reduced cost: listed constellations/refinements may be lower than the actual showcase. Review the video.' });
  if (record.tags.some(t => /theatre buff/i.test(t))) gaps.push({ kind: 'unknown', text: 'The run uses a Theatre Buff; equivalent account buffs are unverified.' });
  if (record.tags.some(t => /over level/i.test(t)) && record.members.some(m => m.level === undefined)) gaps.push({ kind: 'unknown', text: 'The run is tagged Over Level. Complete character-level evidence is unavailable.' });
  const unknowns = gaps.filter(g => g.kind === 'unknown' || g.kind === 'reduced').length;
  return { record, mask: teamMask(record.members.map(m => m.character)), missing, gaps, unknowns, deficits: gaps.length - unknowns, execution: record.tags.filter(t => demanding.test(t)), investmentMatch: !missing.length && !gaps.length, weapons };
}
export interface ClearFinderOptions {
  versionId: string; difficulty: 'Dire' | 'Fearless'; filter: 'roster' | 'investment'; objective: 'closest' | 'fastest' | 'cost';
  exclude: string[]; locks: Record<string, string>; skip: string[]; swaps: boolean; easyOnly: boolean;
}
export interface RecordedPlan { key: string; matches: ClearMatch[]; weapons: WeaponAllocation; gaps: number; unknowns: number; seconds: number; cost: number; investmentMatch: boolean; }
function matchOrder(a: ClearMatch, b: ClearMatch, objective: ClearFinderOptions['objective']) {
  const first = objective === 'fastest' ? a.record.seconds - b.record.seconds : objective === 'cost' ? a.record.cost - b.record.cost : a.deficits - b.deficits || a.unknowns - b.unknowns || a.execution.length - b.execution.length;
  return first || a.gaps.length - b.gaps.length || a.record.cost - b.record.cost || a.record.seconds - b.record.seconds || a.record.id.localeCompare(b.record.id);
}
function planOrder(a: RecordedPlan, b: RecordedPlan, objective: ClearFinderOptions['objective']) {
  return b.matches.length - a.matches.length || (objective === 'fastest' ? a.seconds - b.seconds : objective === 'cost' ? a.cost - b.cost : a.gaps - b.gaps || a.unknowns - b.unknowns) || a.gaps - b.gaps || a.unknowns - b.unknowns || a.cost - b.cost || a.seconds - b.seconds || a.key.localeCompare(b.key);
}
/** One recorded composition per boss. No observed run is moved to another encounter. */
export function findRecordedPlans(archive: ClearArchive, account: Account, options: ClearFinderOptions, nodeLimit = 180000) {
  const version = archive.versions.find(v => v.id === options.versionId), conflicts: string[] = [];
  const copies = weaponCopies(account), exclude = new Set(options.exclude.map(accountIdentity));
  const proofKeys = new Set<string>();
  const matches = archive.records.filter(r => r.versionId === options.versionId && r.difficulty === options.difficulty).filter(r => {
    // Same proof can include multiple bosses. Keep those as distinct encounters.
    const key = `${r.bossId}:${canonicalProof(r.proofUrl)}:${r.members.map(m => `${m.character}:${m.constellation}:${m.weapon}:${m.refinement}`).sort().join('|')}`;
    if (proofKeys.has(key)) return false;
    proofKeys.add(key); return true;
  }).map(r => matchListedClear(r, account, copies, options.swaps));
  const allowed = (m: ClearMatch) => !m.record.members.some(member => exclude.has(accountIdentity(member.character))) && !options.skip.includes(m.record.id) && (!options.easyOnly || !m.execution.length);
  const perBoss = (version?.bossIds ?? []).map(bossId => ({ boss: archive.bosses.find(b => b.id === bossId)!, matches: matches.filter(m => m.record.bossId === bossId && !m.missing.length && allowed(m) && (options.filter !== 'investment' || m.investmentMatch)).sort((a, b) => matchOrder(a, b, options.objective)), near: matches.filter(m => m.record.bossId === bossId && m.missing.length === 1 && allowed(m)).sort((a, b) => matchOrder(a, b, options.objective)) }));
  if (!version) conflicts.push('Choose an available archive version.');
  const locked: ClearMatch[] = [];
  for (const [bossId, id] of Object.entries(options.locks)) {
    const row = perBoss.find(b => b.boss.id === bossId)?.matches.find(m => m.record.id === id);
    if (!row) conflicts.push('A locked run is unavailable under this roster, version, difficulty or filter. Unlock it to continue.');
    else if (locked.some(m => Boolean(m.mask & row.mask))) conflicts.push('Locked teams share a character or Traveler identity. Unlock one of them.');
    else locked.push(row);
  }
  const plans: RecordedPlan[] = [];
  let nodes = 0, bounded = false;
  if (conflicts.length) return { plans, perBoss, conflicts, nodes, bounded, records: matches.length };
  // Retain several investment variants per composition, with a composition-diverse pool.
  const pools = perBoss.map(b => {
    if (options.locks[b.boss.id]) return b.matches.filter(m => m.record.id === options.locks[b.boss.id]);
    const counts = new Map<string, number>();
    const pool = b.matches.filter(m => { const key = m.record.members.map(x => x.character).sort().join('|'); const count = counts.get(key) ?? 0; counts.set(key, count + 1); return count < 3; }).slice(0, 96);
    if (pool.length !== b.matches.length) bounded = true;
    return pool;
  });
  function visit(index: number, selected: ClearMatch[], mask: bigint) {
    if (++nodes > nodeLimit) { bounded = true; return; }
    if (plans.length === 3 && selected.length + pools.length - index < plans[2].matches.length) return;
    if (index === pools.length) {
      if (!selected.length) return;
      const members = selected.flatMap(m => m.record.members);
      const weapons = assignListedWeapons(members, copies, options.swaps);
      if (options.filter === 'investment' && weapons.missing.length) return;
      const individualMissing = selected.reduce((sum, m) => sum + m.weapons.missing.length, 0);
      const extraMissing = Math.max(0, weapons.missing.length - individualMissing);
      const plan: RecordedPlan = { key: selected.map(m => `${m.record.bossId}:${m.record.members.map(x => x.character).sort().join('|')}`).sort().join(';'), matches: [...selected], weapons, gaps: selected.reduce((sum, m) => sum + m.deficits, 0) + extraMissing, unknowns: selected.reduce((sum, m) => sum + m.unknowns, 0), seconds: selected.reduce((sum, m) => sum + m.record.seconds, 0), cost: selected.reduce((sum, m) => sum + m.record.cost, 0), investmentMatch: selected.every(m => m.investmentMatch) && !weapons.missing.length };
      const old = plans.findIndex(p => p.key === plan.key);
      if (old >= 0 && planOrder(plans[old], plan, options.objective) <= 0) return;
      if (old >= 0) plans.splice(old, 1);
      plans.push(plan); plans.sort((a, b) => planOrder(a, b, options.objective)); plans.splice(3);
      return;
    }
    for (const row of pools[index]) {
      if (!(mask & row.mask)) visit(index + 1, [...selected, row], mask | row.mask);
      if (nodes > nodeLimit) break;
    }
    if (!options.locks[perBoss[index].boss.id]) visit(index + 1, selected, mask);
  }
  visit(0, [], 0n);
  if (locked.length && options.filter === 'investment' && assignListedWeapons(locked.flatMap(m => m.record.members), copies, options.swaps).missing.length) conflicts.push('Locked teams need more weapon copies than are recorded. Unlock a team or change the investment filter.');
  // An alternative must preserve the best attainable boss coverage. Dropping a
  // boss is not an alternative complete account allocation.
  return { plans: plans.filter(p => p.matches.length === plans[0]?.matches.length), perBoss, conflicts, nodes, bounded, records: matches.length };
}
