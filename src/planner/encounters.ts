import { object } from '../account';
import type { Candidate } from './types';
import { capabilities } from './mechanics';

export type EndgameMode = 'abyss' | 'stygian';
export type Region = 'Europe' | 'America' | 'Asia';
export interface Enemy { id?: string; variantId?: string; name: string; hp?: number; }
export interface EncounterRequirement {
  id: string; stage: string; kind: 'utility' | 'immunity' | 'modifier'; tags: string[];
  interpretation: string; source: string; sourceHash: string; reviewedAt: string;
}
export interface EncounterStage { name: string; level?: number; enemies: Enemy[]; notes: string[]; objectives?: { type: string; values: number[][] }; }
export interface Encounter {
  id: string; name: string; stages: EncounterStage[];
  preferred: string[]; avoid: string[]; // User strategy preferences; never inferred from enemy names.
  requirements?: EncounterRequirement[];
}
export interface EncounterPack {
  version: 1; mode: EndgameMode; region: Region; patch: string; cycleId: string;
  startsAt: string; endsAt: string; fetchedAt: string; source: string; sourceHash: string;
  encounters: Encounter[]; notes: string[]; difficulty: string;
  provenance?: { url: string; sha256: string }[];
  publication?: { id: string; reviewedAt: string; validUntil: string; dateBasis: string; sources: string[] };
  coverage?: string[];
}
const origin = 'https://static.nanoka.cc';
export const encounterProvider = origin;
const regions: Record<Region, string> = { Europe: '+01:00', America: '-05:00', Asia: '+08:00' };
export const plain = (v: unknown) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/\\n/g, '\n').slice(0, 12000) : '';
function text(v: unknown, name: string) { const s = plain(v); if (!s.trim()) throw new Error(`Encounter feed: missing ${name}.`); return s; }
function list(v: unknown, name: string): unknown[] { if (!Array.isArray(v) || v.length > 500) throw new Error(`Encounter feed: invalid ${name}.`); return v; }
function entries(v: unknown, name: string) { return Object.entries(object(v, name)); }
function numeric(v: unknown, min: number, max: number) { return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined; }
/** The provider's timezone-less dates represent server wall time, not the browser's zone. */
export function serverDate(value: unknown, region: Region): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1e9 && value < 1e11) return new Date(value * 1000).toISOString();
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)) throw new Error('Encounter feed: invalid cycle date.');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) throw new Error('Encounter feed: invalid calendar date.');
  const date = new Date(value.replace(' ', 'T') + (/(Z|[+-]\d\d:\d\d)$/.test(value) ? '' : regions[region]));
  if (!Number.isFinite(date.getTime())) throw new Error('Encounter feed: invalid cycle date.');
  return date.toISOString();
}
export function encounterStatus(pack: EncounterPack, now = Date.now()): 'current' | 'expired' | 'upcoming' | 'stale' {
  if (![now, Date.parse(pack.startsAt), Date.parse(pack.endsAt), Date.parse(pack.fetchedAt)].every(Number.isFinite)) return 'stale';
  if (now < Date.parse(pack.startsAt)) return 'upcoming';
  if (now >= Date.parse(pack.endsAt)) return 'expired';
  const age = now - Date.parse(pack.fetchedAt);
  if (pack.publication) return now < Date.parse(pack.publication.reviewedAt) || now >= Date.parse(pack.publication.validUntil) ? 'stale' : 'current';
  return age < -300000 || age > 86400000 ? 'stale' : 'current';
}
export function validateEncounterPack(raw: unknown): EncounterPack {
  const p = object(raw, 'Encounter pack') as unknown as EncounterPack;
  if (p.version !== 1 || !['abyss', 'stygian'].includes(p.mode) || !Object.hasOwn(regions, p.region) || typeof p.patch !== 'string' || !p.patch || typeof p.cycleId !== 'string' || typeof p.difficulty !== 'string') throw new Error('Invalid encounter pack identity.');
  if (!/^https:\/\//.test(p.source) || !/^[a-f0-9]{64}$/.test(p.sourceHash) || ![p.startsAt, p.endsAt, p.fetchedAt].every(d => typeof d === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(d) && Number.isFinite(Date.parse(d))) || Date.parse(p.startsAt) >= Date.parse(p.endsAt)) throw new Error('Invalid encounter provenance or dates.');
  if (p.provenance !== undefined && (!Array.isArray(p.provenance) || p.provenance.length > 10 || p.provenance.some(s => !s || !/^https:\/\//.test(s.url) || !/^[a-f0-9]{64}$/.test(s.sha256)))) throw new Error('Invalid encounter source lineage.');
  const strings = (a: unknown): a is string[] => Array.isArray(a) && a.length <= 100 && a.every(s => typeof s === 'string' && s.length <= 12000);
  if (p.coverage !== undefined && !strings(p.coverage)) throw new Error('Invalid encounter coverage.');
  if (p.publication && (!p.publication.id || !p.publication.dateBasis || !strings(p.publication.sources) || !p.publication.sources.length || p.publication.sources.some(s => !/^https:\/\//.test(s)) || !Number.isFinite(Date.parse(p.publication.reviewedAt)) || !Number.isFinite(Date.parse(p.publication.validUntil)) || Date.parse(p.publication.validUntil) > Date.parse(p.endsAt) || Date.parse(p.publication.reviewedAt) >= Date.parse(p.publication.validUntil))) throw new Error('Invalid publication review.');
  if (!strings(p.notes) || !Array.isArray(p.encounters) || p.encounters.length !== (p.mode === 'abyss' ? 2 : 3) || new Set(p.encounters.map(e => e.id)).size !== p.encounters.length) throw new Error('Incomplete encounter set.');
  for (const e of p.encounters) {
    if (typeof e.id !== 'string' || !e.id || typeof e.name !== 'string' || !strings(e.preferred) || !strings(e.avoid) || !Array.isArray(e.stages) || !e.stages.length || e.stages.length > 20) throw new Error('Invalid encounter.');
    if (p.mode === 'abyss' && e.stages.length !== 3) throw new Error('Every Abyss half must retain all three chambers.');
    if (e.requirements !== undefined && (!Array.isArray(e.requirements) || e.requirements.length > 100 || e.requirements.some(r => !r || !r.id || !e.stages.some(s => s.name === r.stage) || !['utility', 'immunity', 'modifier'].includes(r.kind) || !strings(r.tags) || !r.tags.length || !r.interpretation || !/^https:\/\//.test(r.source) || !/^[a-f0-9]{64}$/.test(r.sourceHash) || !Number.isFinite(Date.parse(r.reviewedAt))))) throw new Error('Invalid reviewed encounter requirement.');
    for (const s of e.stages) {
      if (typeof s.name !== 'string' || !strings(s.notes) || !Array.isArray(s.enemies) || !s.enemies.length || s.enemies.length > 100 || (s.level !== undefined && numeric(s.level, 1, 200) === undefined)) throw new Error('Invalid encounter stage.');
      if (s.objectives && (typeof s.objectives.type !== 'string' || !Array.isArray(s.objectives.values) || s.objectives.values.length > 10 || s.objectives.values.some(v => !Array.isArray(v) || v.length > 10 || v.some(n => numeric(n, 0, 1e6) === undefined)))) throw new Error('Invalid objectives.');
      for (const enemy of s.enemies) if (typeof enemy.name !== 'string' || !enemy.name.trim() || (enemy.id !== undefined && !/^[a-zA-Z0-9_-]{1,100}$/.test(enemy.id)) || (enemy.variantId !== undefined && !/^[a-zA-Z0-9_-]{1,100}$/.test(enemy.variantId)) || (enemy.hp !== undefined && numeric(enemy.hp, 1, 1e12) === undefined)) throw new Error('Invalid enemy.');
    }
  }
  return p;
}
export function normalizeEncounter(mode: EndgameMode, raw: unknown, context: Omit<EncounterPack, 'version' | 'mode' | 'encounters' | 'notes' | 'difficulty'>, difficulty = 6): EncounterPack {
  const data = object(raw, 'Challenge detail');
  let encounters: Encounter[], notes: string[], label: string;
  if (mode === 'abyss') {
    const floors = object(data.floor, 'Abyss floors'), floor = object(floors['12'], 'Floor 12');
    const rooms = entries(floor.room, 'Floor 12 chambers').sort(([a], [b]) => Number(a) - Number(b));
    if (rooms.length !== 3) throw new Error('Encounter feed: Floor 12 must include all three chambers.');
    notes = [...list(floor.buff, 'Ley Line Disorders').map(plain), plain(object(data.leyline, 'Blessing').desc)].filter(Boolean);
    label = 'Floor 12 · all chambers';
    encounters = ['first', 'second'].map((half, index) => ({
      id: `abyss-${half}`, name: `${index === 0 ? 'First' : 'Second'} half`, preferred: [], avoid: [],
      stages: rooms.map(([roomId, value]) => {
        const room = object(value, 'Chamber');
        const lineup = list(room[half], 'Enemy lineup');
        if (!lineup.length) throw new Error(`Encounter feed: Floor 12 chamber ${roomId} ${half} half has no published enemy lineup.`);
        return { name: `12-${roomId}`, level: numeric(room.level, 1, 200), ...(room.cond && room.type ? { objectives: { type: String(room.type), values: room.cond as number[][] } } : {}), notes: [plain(floor[`${half}_half_buff`])].filter(Boolean), enemies: lineup.map(rawEnemy => {
          const enemy = object(rawEnemy, 'Enemy'); return { ...(enemy.id !== undefined ? { id: String(enemy.id) } : {}), name: text(enemy.name, 'enemy name'), ...(numeric(enemy.hp, 1, 1e12) ? { hp: enemy.hp as number } : {}) };
        }) };
      }),
    }));
  } else {
    const levels = entries(data.level, 'Stygian difficulties');
    const selection = levels.map(([, v]) => object(v, 'Difficulty')).find(v => object(v.difficulty_config, 'Difficulty config').level === difficulty);
    if (!selection) throw new Error(`Encounter feed: difficulty ${difficulty} is unavailable.`);
    const config = object(selection.difficulty_config, 'Difficulty config');
    notes = list(config.desc_list, 'Difficulty descriptions').map(plain); label = text(config.name, 'difficulty name');
    encounters = entries(selection.level_config, 'Stygian bosses').map(([id, value], index) => {
      const enemy = object(value, 'Boss');
      const buffs = enemy.monster_buff_detail_list ?? enemy.MonsterBuffDetailList ?? [];
      const recommendations = enemy.recommend_list ?? enemy.RecommendList ?? [];
      return { id: `stygian-${id}`, name: `Boss ${index + 1}`, preferred: [], avoid: [], stages: [{ name: text(enemy.name, 'boss name'), level: numeric(selection.monster_level, 1, 200), enemies: [{ variantId: id, ...(enemy.id !== undefined ? { id: String(enemy.id) } : {}), name: text(enemy.name, 'boss name') }], notes: [...list(buffs, 'Boss mechanics'), ...list(recommendations, 'Boss recommendations')].map(v => typeof v === 'string' ? plain(v) : Object.values(object(v, 'Mechanic')).map(plain).filter(Boolean).join(': ')) }] };
    });
  }
  return validateEncounterPack({ version: 1, ...context, mode, encounters, notes, difficulty: label, coverage: ['Enemy resistance, immunity, shield gauges, vulnerability windows and wave timing are unverified.', 'No executable requirement is inferred from enemy names or unreviewed prose.', ...(mode === 'stygian' ? ['HP and objective time budgets are absent from this provider schema.'] : [])] });
}
async function fetchChallengeData(mode: EndgameMode, region: Region, signal: AbortSignal | undefined, fetcher: typeof fetch, now: number, reference = false): Promise<EncounterPack> {
  const provenance: NonNullable<EncounterPack['provenance']> = [];
  async function get(url: string) {
    const response = await fetcher(url, { signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`Challenge provider returned HTTP ${response.status}.`);
    if (Number(response.headers.get('content-length')) > 5_000_000) throw new Error('Challenge feed exceeds the size limit.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 5_000_000) throw new Error('Challenge feed exceeds the size limit.');
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
    provenance.push({ url, sha256 });
    return { sha256, data: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  }
  const manifest = object((await get(`${origin}/manifest.json`)).data, 'Manifest');
  const patch = text(object(manifest.gi, 'Live Genshin version').live, 'live version');
  if (!/^[a-zA-Z0-9._-]{1,40}$/.test(patch)) throw new Error('Invalid live version.');
  const endpoint = mode === 'abyss' ? 'tower' : 'leyline';
  const index = await get(`${origin}/gi/${patch}/${endpoint}.json`);
  const current = entries(index.data, 'Challenge index').flatMap(([id, raw]) => {
    const value = object(raw, 'Cycle');
    // Never use beta begin/end fields as evidence for live dates.
    if (!reference && (value.live_begin == null || value.live_end == null)) return [];
    if (reference && (value.begin == null || value.end == null)) return [];
    const start = serverDate(reference ? value.begin : value.live_begin, region), end = serverDate(reference ? value.end : value.live_end, region);
    return Date.parse(start) <= now && now < Date.parse(end) ? [{ id, start, end }] : [];
  });
  if (current.length !== 1 || !/^\d+$/.test(current[0].id)) throw new Error('No unambiguous live cycle is published for this server.');
  const cycle = current[0], source = `${origin}/gi/${patch}/en/${endpoint}/${cycle.id}.json`;
  const detail = await get(source);
  return normalizeEncounter(mode, detail.data, { patch, region, cycleId: cycle.id, startsAt: cycle.start, endsAt: cycle.end, fetchedAt: new Date(now).toISOString(), source, sourceHash: detail.sha256, provenance });
}
export async function fetchCurrentEncounters(mode: EndgameMode, region: Region, signal?: AbortSignal, fetcher: typeof fetch = fetch, now = Date.now()): Promise<EncounterPack> {
  return fetchChallengeData(mode, region, signal, fetcher, now);
}
export interface ChallengeReference { mode: EndgameMode; region: Region; label: string; encounters: Encounter[]; source: string; sourceHash: string; fetchedAt: string; }
/** Generic provider dates select a reference snapshot only. They never certify a live cycle. */
export async function fetchChallengeReference(mode: EndgameMode, region: Region, signal?: AbortSignal, fetcher: typeof fetch = fetch, now = Date.now()): Promise<ChallengeReference> {
  const pack = await fetchChallengeData(mode, region, signal, fetcher, now, true);
  return { mode, region, label: `${pack.patch} · ${pack.difficulty} · provider reference ${pack.cycleId}`, encounters: pack.encounters, source: pack.source, sourceHash: pack.sourceHash, fetchedAt: pack.fetchedAt };
}
export function encounterFit(team: Candidate, encounter: Encounter) {
  const available = capabilities(team.members);
  const matched = encounter.preferred.filter(tag => available.includes(tag));
  const avoided = encounter.avoid.filter(tag => available.includes(tag));
  return { matched, avoided, score: matched.length - avoided.length, unknown: encounter.preferred.filter(tag => !available.includes(tag)) };
}
export interface Assignment { encounter: Encounter; team: Candidate; fit: ReturnType<typeof encounterFit>; }
/** Joint side assignment: cardinality, then user matchup preferences, then the chosen team objective. */
export function allocateEncounters(candidates: Candidate[], encounters: Encounter[], budget = 96, lockedIds: string[] = []): Assignment[] {
  if (!encounters.length || encounters.length > 3) return [];
  const locked = lockedIds.map(id => candidates.find(t => t.id === id && !t.missing.length));
  if (locked.length > encounters.length || locked.some(t => !t) || new Set(lockedIds).size !== lockedIds.length) return [];
  for (let i = 0; i < locked.length; i++) for (let j = i + 1; j < locked.length; j++) if (locked[i]!.mask & locked[j]!.mask) return [];
  const pools = encounters.map(e => {
    const sorted = candidates.filter(t => !t.missing.length).map(team => ({ encounter: e, team, fit: encounterFit(team, e) })).sort((a, b) => b.fit.score - a.fit.score || b.team.score - a.team.score || a.team.id.localeCompare(b.team.id));
    const chosen = new Map<string, Assignment>(), drivers = new Map<string, number>();
    for (const item of sorted) if (lockedIds.includes(item.team.id)) chosen.set(item.team.id, item);
    for (const item of sorted) if ((drivers.get(item.team.anchor) ?? 0) < 2 && chosen.size < budget) { chosen.set(item.team.id, item); drivers.set(item.team.anchor, (drivers.get(item.team.anchor) ?? 0) + 1); }
    for (const item of sorted) if (chosen.size < budget) chosen.set(item.team.id, item);
    return [...chosen.values()];
  });
  let best: Assignment[] = [], bestFit = -Infinity, bestScore = -Infinity;
  function visit(side: number, used: bigint, chosen: Assignment[], fit: number, score: number) {
    const remainingLocks = locked.filter(t => !chosen.some(a => a.team.id === t!.id));
    if (remainingLocks.length > pools.length - side || remainingLocks.some(t => Boolean(t!.mask & used))) return;
    if (!remainingLocks.length && (chosen.length > best.length || (chosen.length === best.length && (fit > bestFit || (fit === bestFit && score > bestScore))))) { best = [...chosen]; bestFit = fit; bestScore = score; }
    if (side === pools.length || chosen.length + pools.length - side < best.length) return;
    for (const row of pools[side]) if (!(used & row.team.mask)) visit(side + 1, used | row.team.mask, [...chosen, row], fit + row.fit.score, score + row.team.score);
    visit(side + 1, used, chosen, fit, score);
  }
  visit(0, 0n, [], 0, 0);
  return best;
}
