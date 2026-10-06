import snapshot from './data/roster.json';

export const characters = snapshot.characters;
export type Character = (typeof characters)[number];
export const byId: Record<string, Character> = Object.fromEntries(characters.map(c => [c.id, c]));
export type Mode = 'general' | 'abyss' | 'stygian';
export type Readiness = 'ready' | 'building' | 'unknown';
export interface CharacterDetails {
  level?: number; ascension?: number;
  talents?: { auto?: number; skill?: number; burst?: number };
  weapon?: { key?: string; level?: number; ascension?: number; refinement?: number };
  energyRecharge?: number; elementalMastery?: number;
}
export interface InventorySnapshot {
  format: 'GOOD'; version: number; source: string;
  weapons?: Record<string, unknown>[]; artifacts?: Record<string, unknown>[];
}
export interface Account { version: 1; owned: string[]; readiness: Record<string, Readiness>; constellations?: Record<string, number>; details?: Record<string, CharacterDetails>; inventory?: InventorySnapshot; mode: Mode; demo: boolean; }
export const modeCount: Record<Mode, number> = { general: 1, abyss: 2, stygian: 3 };
export const demoAccount: Account = { version: 1, demo: true, mode: 'abyss',
  owned: ['mavuika', 'citlali', 'xilonen', 'bennett', 'neuvillette', 'furina', 'kazuha', 'zhongli', 'nahida', 'kuki', 'xingqiu', 'yelan', 'raiden', 'xiangling', 'iansan', 'barbara'],
  readiness: Object.fromEntries(['mavuika', 'citlali', 'xilonen', 'bennett', 'neuvillette', 'furina', 'kazuha', 'zhongli', 'nahida', 'kuki', 'xingqiu', 'yelan'].map(id => [id, 'ready' as const])) };

export function parseAccount(input: unknown): Account {
  if (!input || typeof input !== 'object') throw new Error('Choose an Account Doctor or Team Atlas roster JSON file.');
  const data = input as Record<string, unknown>;
  if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.owned) || data.owned.length > 200 || data.owned.some(id => typeof id !== 'string' || !Object.hasOwn(byId, id))) throw new Error('The file contains an unsupported roster or unknown character.');
  const mode = data.mode ?? 'abyss';
  if (!['general', 'abyss', 'stygian'].includes(String(mode))) throw new Error('The selected game mode is invalid.');
  const readiness: Record<string, Readiness> = {};
  if (data.readiness !== undefined) {
    if (!data.readiness || typeof data.readiness !== 'object' || Array.isArray(data.readiness)) throw new Error('Readiness must be a character map.');
    for (const [id, value] of Object.entries(data.readiness)) {
      if (!Object.hasOwn(byId, id) || !['ready', 'building', 'unknown'].includes(String(value))) throw new Error('The file contains invalid character readiness.');
      readiness[id] = value as Readiness;
    }
  }
  let constellations: Record<string, number> | undefined;
  if (data.constellations !== undefined) {
    if (!data.constellations || typeof data.constellations !== 'object' || Array.isArray(data.constellations)) throw new Error('Constellations must be a character map.');
    constellations = {};
    for (const [id, value] of Object.entries(data.constellations)) {
      if (!Object.hasOwn(byId, id) || typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 6) throw new Error('Constellations must be numbers from C0 to C6.');
      constellations[id] = value;
    }
  }
  const details: Record<string, CharacterDetails> = {};
  if (data.details !== undefined) {
    for (const [id, value] of Object.entries(object(data.details, 'Character details'))) {
      if (!Object.hasOwn(byId, id)) throw new Error('Unknown character in build details.');
      details[id] = parseDetails(value);
    }
  }
  const inventory = data.inventory === undefined ? undefined : parseInventory(data.inventory);
  return { version: 1, owned: [...new Set(data.owned as string[])], readiness, ...(constellations ? { constellations } : {}), ...(data.details !== undefined ? { details } : {}), ...(inventory ? { inventory } : {}), mode: mode as Mode, demo: data.demo === true };
}

export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
export function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
export function parseDetails(value: unknown): CharacterDetails {
  const data = object(value, 'Character details'), result: CharacterDetails = {};
  for (const [key, min, max] of [['level', 1, 100], ['ascension', 0, 6], ['elementalMastery', 0, 5000], ['energyRecharge', 100, 1000]] as const) {
    if (data[key] !== undefined) {
      const v = data[key];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || ((key === 'level' || key === 'ascension') && !Number.isInteger(v))) throw new Error(`${key} must be between ${min} and ${max}.`);
      result[key] = v;
    }
  }
  if (data.talents !== undefined) {
    const talents = object(data.talents, 'Talents'); result.talents = {};
    for (const key of ['auto', 'skill', 'burst'] as const) if (talents[key] !== undefined) result.talents[key] = integer(talents[key], 1, 10, 'Base talent');
  }
  if (data.weapon !== undefined) {
    const weapon = object(data.weapon, 'Weapon'); result.weapon = {};
    if (weapon.key !== undefined) {
      if (typeof weapon.key !== 'string' || weapon.key.length > 120) throw new Error('Weapon name is invalid.');
      if (weapon.key.trim()) result.weapon.key = weapon.key.trim();
    }
    for (const [key, min, max] of [['level', 1, 90], ['ascension', 0, 6], ['refinement', 1, 5]] as const) if (weapon[key] !== undefined) result.weapon[key] = integer(weapon[key], min, max, `Weapon ${key}`);
  }
  return result;
}
/** Keep equipment observations verbatim, including GOOD extensions. They are not optimized builds. */
export function parseInventory(value: unknown): InventorySnapshot {
  const data = object(value, 'GOOD inventory');
  if (data.format !== 'GOOD' || ![1, 2, 3].includes(Number(data.version)) || typeof data.version !== 'number' || typeof data.source !== 'string' || !data.source.trim() || data.source.length > 200) throw new Error('Unsupported GOOD version or source. Expected GOOD version 1, 2 or 3.');
  const result: InventorySnapshot = { format: 'GOOD', version: data.version, source: data.source };
  for (const key of ['weapons', 'artifacts'] as const) {
    if (data[key] === undefined) continue;
    if (!Array.isArray(data[key]) || data[key].length > 5000) throw new Error(`GOOD ${key} must be an array of at most 5000 items.`);
    result[key] = data[key].map((raw: unknown) => {
      const row = object(raw, `GOOD ${key} item`);
      const name = key === 'weapons' ? row.key : row.setKey;
      if (typeof name !== 'string' || !name || name.length > 120 || typeof row.location !== 'string' || row.location.length > 120) throw new Error(`Invalid GOOD ${key} name or location.`);
      integer(row.level, key === 'weapons' ? 1 : 0, key === 'weapons' ? 90 : 20, `${key} level`);
      if (key === 'weapons') { integer(row.ascension, 0, 6, 'Weapon ascension'); integer(row.refinement, 1, 5, 'Weapon refinement'); }
      else {
        integer(row.rarity, 1, 5, 'Artifact rarity');
        if (!['flower', 'plume', 'sands', 'goblet', 'circlet'].includes(String(row.slotKey)) || typeof row.mainStatKey !== 'string' || !Array.isArray(row.substats) || row.substats.length > 4) throw new Error('Invalid GOOD artifact slot or stats.');
        for (const stat of row.substats) { const s = object(stat, 'Artifact substat'); if (typeof s.key !== 'string' || typeof s.value !== 'number' || !Number.isFinite(s.value) || s.value < 0) throw new Error('Invalid GOOD artifact substat.'); }
      }
      return structuredClone(row);
    });
  }
  return result;
}

export function accountIdentity(id: string) { return byId[id]?.accountId ?? id; }
const identityIndex = new Map([...new Set(characters.map(c => c.accountId))].map((id, i) => [id, i]));
export function teamMask(members: string[]) { return members.reduce((mask, id) => mask | (1n << BigInt(identityIndex.get(accountIdentity(id))!)), 0n); }

export const portrait = (id: string) => `${import.meta.env.BASE_URL}portraits/${byId[id]?.portraitId ?? id}.png`;
