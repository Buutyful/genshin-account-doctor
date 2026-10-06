import { accountIdentity, byId, characters, integer, object, parseDetails, parseInventory } from './account';
import type { Account, CharacterDetails, InventorySnapshot } from './account';

const normalize = (key: string) => key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const keys = new Map(characters.flatMap(c => [c.id, c.name, c.dataId].map(key => [normalize(key), c.id] as const)));
export function goodCharacterId(key: string): string | undefined { return keys.get(normalize(key)); }
export function equipmentLocation(key: string): string | undefined {
  return normalize(key) === 'traveler' ? 'traveler' : goodCharacterId(key);
}
export interface GoodImport {
  account: Account; source: string; warnings: string[];
  characterCount: number; weaponCount: number; artifactCount: number;
}
export function parseGood(input: unknown): GoodImport {
  const data = object(input, 'GOOD file'), inventory = parseInventory(data);
  const warnings: string[] = [], owned: string[] = [], constellations: Record<string, number> = {}, details: Record<string, CharacterDetails> = {};
  if (data.characters !== undefined && (!Array.isArray(data.characters) || data.characters.length > 300)) throw new Error('GOOD characters must be an array of at most 300 entries.');
  for (const raw of (data.characters ?? []) as unknown[]) {
    const row = object(raw, 'GOOD character');
    if (typeof row.key !== 'string') throw new Error('A GOOD character is missing its key.');
    const id = goodCharacterId(row.key);
    if (!id) { warnings.push(`Skipped ${row.key.slice(0, 120)}: no matching character variant. Traveler needs an explicit element key, such as TravelerDendro.`); continue; }
    if (owned.includes(id)) throw new Error(`Duplicate scanned character: ${byId[id].name}.`);
    constellations[id] = integer(row.constellation, 0, 6, `${byId[id].name} constellation`);
    details[id] = parseDetails({ level: integer(row.level, 1, 100, 'Character level'), ascension: integer(row.ascension, 0, 6, 'Character ascension'), talents: row.talent });
    owned.push(id);
  }
  const weaponsByOwner = new Map<string, Record<string, unknown>[]>();
  for (const weapon of inventory.weapons ?? []) {
    const location = equipmentLocation(String(weapon.location));
    if (location) { const identity = accountIdentity(location); weaponsByOwner.set(identity, [...(weaponsByOwner.get(identity) ?? []), weapon]); }
  }
  for (const id of owned) {
    const weapons = weaponsByOwner.get(accountIdentity(id)) ?? [];
    if (weapons.length > 1) warnings.push(`${byId[id].name} has multiple equipped weapons in this file. No weapon was selected.`);
    if (weapons.length === 1) { const w = weapons[0]; details[id].weapon = { key: String(w.key), level: Number(w.level), ascension: Number(w.ascension), refinement: Number(w.refinement) }; }
  }
  if (!owned.length && !inventory.weapons?.length && !inventory.artifacts?.length) throw new Error('No supported characters or equipment found in this GOOD file.');
  if (!owned.length) warnings.push('Equipment-only scan: it does not establish which characters you own.');
  warnings.push('A scan can be partial. Missing characters are not evidence that you do not own them. Readiness remains your own assessment.');
  return { account: { version: 1, mode: 'abyss', demo: false, owned, readiness: {}, constellations, details, inventory }, source: inventory.source, warnings, characterCount: owned.length, weaponCount: inventory.weapons?.length ?? 0, artifactCount: inventory.artifacts?.length ?? 0 };
}
/** Imports replace each supplied equipment category, avoiding duplicates on repeated scans. */
export function applyGood(current: Account, incoming: GoodImport, replace = false): Account {
  const next = incoming.account;
  if (replace || current.demo) return { ...next, mode: current.mode };
  const details = { ...current.details };
  for (const id of next.owned) {
    const old = details[id] ?? {}, scanned = next.details?.[id] ?? {};
    details[id] = { ...old, ...scanned, talents: { ...old.talents, ...scanned.talents } };
  }
  // A supplied weapons category is a fresh observation: clear obsolete equipped-weapon details.
  if (next.inventory?.weapons !== undefined) for (const id of Object.keys(details)) {
    const matches = next.inventory.weapons.filter(w => accountIdentity(equipmentLocation(String(w.location)) ?? '') === accountIdentity(id));
    const { weapon: _oldWeapon, ...rest } = details[id]; details[id] = rest;
    if (matches.length === 1) { const w = matches[0]; details[id].weapon = { key: String(w.key), level: Number(w.level), ascension: Number(w.ascension), refinement: Number(w.refinement) }; }
  }
  const inventory: InventorySnapshot = { ...current.inventory, ...next.inventory! };
  return { ...current, demo: false, owned: [...new Set([...current.owned, ...next.owned])], constellations: { ...current.constellations, ...next.constellations }, details, inventory };
}

export const scannerTools = [
  { name: 'Inventory Kamera', url: 'https://github.com/taiwenlee/Inventory_Kamera', description: 'Windows · English game UI. OCR scanner for characters, weapons and artifacts; exports GOOD.' },
  { name: 'GOODScanner', url: 'https://github.com/Anyrainel/GOODScanner', description: 'Windows · Simplified Chinese Genshin UI. Use its OCR scanner to export GOOD v3.' },
];
