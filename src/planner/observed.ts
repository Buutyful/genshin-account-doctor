import { accountIdentity, byId, object, parseDetails } from '../account';
import type { Account, CharacterDetails } from '../account';
import { compositionKey } from './planner';
import type { Configuration } from './configurations';
import type { EncounterPack } from './encounters';

export interface ObservedSource {
  id: string; name: string; url: string; policies: string[]; reviewedAt: string;
  access: { discovery: boolean; comparison: boolean; training: boolean; evaluation: boolean; basis: string };
}
export const observedSources: ObservedSource[] = [{
  id: 'stygian-moe', name: 'Stygian.moe', url: 'https://www.stygian.moe/', reviewedAt: '2026-10-01',
  policies: ['https://www.stygian.moe/about', 'https://www.stygian.moe/guide/submission-guide', 'https://www.stygian.moe/policies', 'https://www.stygian.moe/terms-of-service'],
  // The public terms support informational/community reference use. This scope
  // covers individually reviewed, attributed references, not bulk collection,
  // archive redistribution or a licensed training/evaluation dataset.
  access: { discovery: true, comparison: true, training: false, evaluation: false, basis: 'Independently reviewed, attributed references may support discovery and contextual comparison after proof/review checks. Public source listings have a separate finder and do not satisfy these independent-review gates. No training/evaluation reuse agreement is established; no independently reviewed runs are bundled.' },
}];
export interface ClearMember { character: string; actual: { constellation?: number; build?: CharacterDetails; artifacts?: { slot: string; set: string; level: number; mainStat: string; substats: Record<string, number> }[]; stats?: Record<string, number> }; reduced?: { constellation?: number; weaponRefinement?: number }; }
export interface ObservedClear {
  sourceId: string; sourceRecordId: string; sourceUrl: string; originalRunId: string;
  proof: { url: string; segment: string; status: 'verified' | 'unreviewed' | 'broken'; checkedAt: string };
  revision: number; review: 'approved' | 'edited' | 'pending' | 'retracted'; reviewedAt: string;
  encounter: { mode: 'abyss' | 'stygian'; patch: string; cycleId: string; variantId: string; difficulty: string; cycleStartsAt: string };
  members: ClearMember[]; core: string[]; creatorId: string; buildSeriesId: string;
  buildCompleteness: 'complete' | 'partial' | 'unknown'; rotation: { status: 'reviewed' | 'unknown'; notes: string };
  clearSeconds?: number; timeConvention: 'in-game-timer' | 'video-wall-time' | 'unknown'; tags: string[];
  snapshot: { url: string; sha256: string; fetchedAt: string; parserVersion: string }; fixture: boolean;
}
export interface ObservedPublication { version: 1; sourceId: string; records: ObservedClear[]; }
const https = (v: unknown): v is string => typeof v === 'string' && /^https:\/\//.test(v) && v.length < 2000;
const date = (v: unknown): v is string => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
const short = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 500;
const bounded = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
export function parseObservedPublication(raw: unknown, sources = observedSources): ObservedPublication {
  const p = object(raw, 'Observed publication');
  if (p.version !== 1 || !sources.some(s => s.id === p.sourceId) || !Array.isArray(p.records) || p.records.length > 1000) throw new Error('Invalid observed publication or unregistered source.');
  const records = p.records.map(rawRecord => {
    const r = object(rawRecord, 'Observed result') as unknown as ObservedClear;
    if (r.sourceId !== p.sourceId || ![r.sourceRecordId, r.originalRunId, r.creatorId, r.buildSeriesId].every(short) || !https(r.sourceUrl) || !bounded(r.revision, 1, 100000) || !['approved', 'edited', 'pending', 'retracted'].includes(r.review) || !date(r.reviewedAt) || typeof r.fixture !== 'boolean') throw new Error('Invalid source identity or review state.');
    if (!r.proof || !https(r.proof.url) || !short(r.proof.segment) || !['verified', 'unreviewed', 'broken'].includes(r.proof.status) || !date(r.proof.checkedAt)) throw new Error('Invalid run proof.');
    const e = r.encounter;
    if (!e || !['abyss', 'stygian'].includes(e.mode) || ![e.patch, e.cycleId, e.variantId, e.difficulty].every(short) || !date(e.cycleStartsAt)) throw new Error('Invalid encounter mapping.');
    if (!Array.isArray(r.members) || r.members.length !== 4 || r.members.some(m => !m || !Object.hasOwn(byId, m.character) || !m.actual) || new Set(r.members.map(m => accountIdentity(m.character))).size !== 4) throw new Error('A clear needs four distinct known account identities.');
    for (const m of r.members) {
      if ((m.actual.constellation !== undefined && !bounded(m.actual.constellation, 0, 6)) || (m.reduced?.constellation !== undefined && !bounded(m.reduced.constellation, 0, 6)) || (m.reduced?.weaponRefinement !== undefined && !bounded(m.reduced.weaponRefinement, 1, 5))) throw new Error('Invalid actual/reduced investment.');
      if (m.actual.build) m.actual.build = parseDetails(m.actual.build);
      if (m.actual.stats !== undefined && (typeof m.actual.stats !== 'object' || !m.actual.stats || Array.isArray(m.actual.stats) || Object.entries(m.actual.stats).some(([k, v]) => !short(k) || typeof v !== 'number' || !Number.isFinite(v) || v < 0))) throw new Error('Invalid showcased stats.');
      if (m.actual.artifacts !== undefined && (!Array.isArray(m.actual.artifacts) || m.actual.artifacts.length > 5 || new Set(m.actual.artifacts.map(a => a.slot)).size !== m.actual.artifacts.length || m.actual.artifacts.some(a => !a || !['flower', 'plume', 'sands', 'goblet', 'circlet'].includes(a.slot) || !short(a.set) || !short(a.mainStat) || !bounded(a.level, 0, 20) || !a.substats || typeof a.substats !== 'object' || Array.isArray(a.substats) || Object.values(a.substats).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0)))) throw new Error('Invalid showcased artifacts.');
      // Never promote reduced-cost metadata to actual showcase investment.
    }
    if (!Array.isArray(r.core) || !r.core.length || r.core.length > 4 || r.core.some(id => !r.members.some(m => m.character === id)) || new Set(r.core).size !== r.core.length) throw new Error('Invalid clear core.');
    if (!['complete', 'partial', 'unknown'].includes(r.buildCompleteness) || !r.rotation || !['reviewed', 'unknown'].includes(r.rotation.status) || typeof r.rotation.notes !== 'string' || r.rotation.notes.length > 12000) throw new Error('Invalid build or rotation coverage.');
    if (!['in-game-timer', 'video-wall-time', 'unknown'].includes(r.timeConvention) || (r.clearSeconds !== undefined && (typeof r.clearSeconds !== 'number' || !Number.isFinite(r.clearSeconds) || r.clearSeconds <= 0 || r.clearSeconds > 86400)) || !Array.isArray(r.tags) || r.tags.length > 50 || r.tags.some(t => !short(t))) throw new Error('Invalid time or execution evidence.');
    if (!r.snapshot || !https(r.snapshot.url) || !/^[a-f0-9]{64}$/.test(r.snapshot.sha256) || !date(r.snapshot.fetchedAt) || !short(r.snapshot.parserVersion)) throw new Error('Invalid exact snapshot provenance.');
    return structuredClone(r);
  });
  return { version: 1, sourceId: String(p.sourceId), records };
}
/** Adapter boundary accepts individually reviewed references or a permitted export; never probes an undocumented backend. */
export const stygianAdapter = { sourceId: 'stygian-moe', version: 'normalized-export-v1', import: (raw: unknown) => {
  const result = parseObservedPublication(raw);
  if (result.sourceId !== 'stygian-moe') throw new Error('Not a Stygian.moe publication.');
  return result;
} };
export function canonicalProof(url: string) {
  const u = new URL(url), host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return `youtube:${u.pathname.slice(1)}`;
  if (host === 'youtube.com' && u.searchParams.has('v')) return `youtube:${u.searchParams.get('v')}`;
  if (host === 'youtube.com' && /^\/(?:shorts|embed)\//.test(u.pathname)) return `youtube:${u.pathname.split('/')[2]}`;
  return `${host}${u.pathname.replace(/\/$/, '')}`;
}
/** Apply revisions first. Then group originals across publishers; any broken/retracted copy quarantines a run. */
export function reconcileClears(records: ObservedClear[]) {
  const revisions = new Map<string, ObservedClear>();
  for (const r of records) {
    const key = `${r.sourceId}:${r.sourceRecordId}`, old = revisions.get(key);
    if (!old || r.revision > old.revision || (r.revision === old.revision && Date.parse(r.reviewedAt) > Date.parse(old.reviewedAt))) revisions.set(key, r);
    else if (old.revision === r.revision && JSON.stringify(old) !== JSON.stringify(r)) revisions.set(key, { ...old, review: 'pending' });
  }
  const groups: ObservedClear[][] = [];
  for (const r of revisions.values()) {
    const proof = `${canonicalProof(r.proof.url)}:${r.proof.segment}`;
    const matches = groups.filter(g => g.some(x => x.originalRunId === r.originalRunId || `${canonicalProof(x.proof.url)}:${x.proof.segment}` === proof));
    const merged = [r, ...matches.flat()];
    for (const g of matches) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  return groups.map(copies => {
    const quarantined = copies.some(r => r.review === 'retracted' || r.proof.status === 'broken');
    const conflicts = new Set(copies.map(r => JSON.stringify({ members: r.members, encounter: r.encounter, time: r.clearSeconds }))).size > 1;
    const record = copies.slice().sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt) || a.sourceId.localeCompare(b.sourceId))[0];
    return { record: quarantined ? { ...record, review: 'retracted' as const } : conflicts ? { ...record, review: 'pending' as const } : record, copies: copies.map(r => ({ sourceId: r.sourceId, sourceRecordId: r.sourceRecordId, url: r.sourceUrl, snapshot: r.snapshot })), quarantined, conflicts };
  });
}
export function clearEligibility(r: ObservedClear, sources = observedSources) {
  const source = sources.find(s => s.id === r.sourceId), reasons: string[] = [];
  const base = !r.fixture && ['approved', 'edited'].includes(r.review) && r.proof.status === 'verified';
  if (r.fixture) reasons.push('Test fixture, excluded from production evidence.');
  if (!base && !r.fixture) reasons.push('Review or proof needs resolution.');
  const actualComplete = r.members.every(m => m.actual.constellation !== undefined && m.actual.build?.level !== undefined && m.actual.build.talents?.auto !== undefined && m.actual.build.talents.skill !== undefined && m.actual.build.talents.burst !== undefined && m.actual.build.weapon?.key && m.actual.build.weapon.refinement !== undefined && m.actual.build.weapon.level !== undefined && m.actual.artifacts?.length === 5 && m.actual.stats && ['hp', 'atk', 'def', 'critRate', 'critDamage', 'energyRecharge', 'elementalMastery'].every(key => typeof m.actual.stats![key] === 'number'));
  const comparable = base && actualComplete && r.buildCompleteness === 'complete' && r.rotation.status === 'reviewed' && r.timeConvention === 'in-game-timer' && r.clearSeconds !== undefined;
  if (!actualComplete || r.buildCompleteness !== 'complete') reasons.push('Actual showcase builds are incomplete; reduced cost does not fill unknowns.');
  if (!source?.access.discovery) reasons.push(source?.access.basis ?? 'Unknown source.');
  return { discovery: base && Boolean(source?.access.discovery), comparison: comparable && Boolean(source?.access.comparison), training: comparable && Boolean(source?.access.training), evaluation: comparable && Boolean(source?.access.evaluation), reasons };
}
export function matchClear(r: ObservedClear, config: Configuration, account: Account, pack?: EncounterPack, sources = observedSources) {
  const eligibility = clearEligibility(r, sources), differences: string[] = [];
  if (compositionKey(r.members.map(m => m.character)) !== config.compositionId) differences.push('Different composition.');
  if (!pack || r.encounter.mode !== pack.mode || r.encounter.cycleId !== pack.cycleId || r.encounter.patch !== pack.patch || r.encounter.difficulty !== pack.difficulty || !pack.encounters.some(e => e.stages.some(s => s.enemies.some(enemy => enemy.variantId === r.encounter.variantId || enemy.id === r.encounter.variantId)))) differences.push('Encounter, variant, cycle or difficulty differs or is unknown.');
  for (const m of r.members) {
    const actual = m.actual, build = account.details?.[m.character];
    if (actual.constellation === undefined || account.constellations?.[m.character] === undefined || actual.constellation !== account.constellations[m.character]) differences.push(`${byId[m.character].name}: actual constellation differs or is unknown.`);
    if (!actual.build || !build || JSON.stringify(actual.build) !== JSON.stringify(build)) differences.push(`${byId[m.character].name}: build details differ or are incomplete.`);
    if (actual.stats || actual.artifacts) differences.push(`${byId[m.character].name}: complete artifact and combat-stat equivalence is outside the current account comparison model.`);
  }
  return { ...eligibility, differences, matchedComparison: eligibility.comparison && differences.length === 0 };
}

export interface SplitManifest {
  version: 1; cutoff: string; baseline: string; train: string[]; test: string[]; excluded: string[];
  groups: { key: string; runs: string[]; split: 'train' | 'test' | 'excluded' }[];
  snapshots: ObservedClear['snapshot'][]; features: string[]; labels: string[]; withheldLabels: string[];
  coverage: { runs: number; bosses: number; compositions: number; buildSeries: number }; modelAvailable: false; reason: string;
}
/** Connected groups prevent leakage across all declared axes, including aliases and later cycles. */
export function createSplitManifest(records: ObservedClear[], cutoff: string, sources = observedSources): SplitManifest {
  if (!date(cutoff)) throw new Error('A UTC temporal cutoff is required.');
  const reconciled = reconcileClears(records), groups: ObservedClear[][] = [];
  const keys = (r: ObservedClear) => [`run:${r.originalRunId}`, `proof:${canonicalProof(r.proof.url)}:${r.proof.segment}`, `composition:${compositionKey(r.members.map(m => m.character))}`, `core:${compositionKey(r.core)}`, `creator:${r.creatorId}`, `series:${r.buildSeriesId}`];
  for (const { record } of reconciled) {
    const k = keys(record), overlapping = groups.filter(g => g.some(r => keys(r).some(key => k.includes(key))));
    for (const g of overlapping) groups.splice(groups.indexOf(g), 1);
    groups.push([record, ...overlapping.flat()]);
  }
  const manifest: SplitManifest = { version: 1, cutoff, baseline: 'conditional-mechanics-and-retrieval-v1', train: [], test: [], excluded: [], groups: [], snapshots: records.map(r => r.snapshot),
    features: ['composition and assigned core', 'actual showcased investment with missingness', 'encounter variant / difficulty / cycle', 'execution and rotation tags'], labels: ['observed successful clear seconds under recorded conditions'], withheldLabels: ['success probability', 'failed attempt', 'missing team is negative', 'moderation approval rate as combat outcome', 'account DPS'],
    coverage: { runs: reconciled.length, bosses: new Set(records.map(r => r.encounter.variantId)).size, compositions: new Set(records.map(r => compositionKey(r.members.map(m => m.character)))).size, buildSeries: new Set(records.map(r => r.buildSeriesId)).size }, modelAvailable: false, reason: 'No learned model published. A permitted dataset, independent outcomes where needed, and held-out comparison with the mechanical baseline are required.' };
  for (const group of groups) {
    const later = group.some(r => [r.encounter.cycleStartsAt, r.snapshot.fetchedAt, r.reviewedAt].some(time => Date.parse(time) > Date.parse(cutoff)));
    const split = group.every(r => later ? clearEligibility(r, sources).evaluation : clearEligibility(r, sources).training) ? later ? 'test' : 'train' : 'excluded';
    const runs = group.map(r => r.originalRunId).sort(); manifest[split].push(...runs); manifest.groups.push({ key: runs.join('|'), runs, split });
  }
  return manifest;
}

export const publishedClears: ObservedClear[] = [];
