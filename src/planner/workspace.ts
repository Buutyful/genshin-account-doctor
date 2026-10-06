import { accountIdentity, byId, object, parseAccount } from '../account';
import type { Account, Mode } from '../account';
import { parsePreferences } from './feedback';
import type { Preference } from './feedback';
import { parseSheet } from './damage';
import type { RotationSheet } from './damage';
import { parseObservedPublication } from './observed';
import type { ObservedPublication } from './observed';
import type { Region } from './encounters';
import { parseChallengeStrategy } from './practice';
import type { ChallengeStrategy } from './practice';

export interface BuilderWorkspace {
  format: 'AccountDoctorWorkspace'; version: 1; exportedAt: string; account: Account;
  preferences: Preference[]; customTeams: string[][]; locks: Partial<Record<Mode, string[]>>;
  sheets: Record<string, RotationSheet>; observed: ObservedPublication[];
  builder: { allowRebuild: boolean; activity: 'current' | 'general' | 'practice'; };
  server: Region;
  challengeStrategy?: ChallengeStrategy;
}
export function parseWorkspace(raw: unknown): BuilderWorkspace {
  const p = object(raw, 'Workspace');
  if (p.format !== 'AccountDoctorWorkspace' || p.version !== 1) throw new Error('Unsupported workspace backup.');
  const account = parseAccount(p.account), preferences = parsePreferences(p.preferences);
  if (!Array.isArray(p.customTeams) || p.customTeams.length > 50 || p.customTeams.some(m => !Array.isArray(m) || m.length !== 4 || m.some(id => typeof id !== 'string' || !Object.hasOwn(byId, id)) || new Set(m.map(accountIdentity)).size !== 4)) throw new Error('Invalid saved custom teams.');
  const locks: Partial<Record<Mode, string[]>> = {};
  for (const [mode, value] of Object.entries(object(p.locks, 'Team locks'))) {
    if (!['general', 'abyss', 'stygian'].includes(mode) || !Array.isArray(value) || value.length > 3 || value.some(id => typeof id !== 'string' || id.length > 2000)) throw new Error('Invalid team locks.');
    locks[mode as Mode] = value;
  }
  const sheets: Record<string, RotationSheet> = {};
  const sheetRows = Object.entries(object(p.sheets, 'Rotation sheets'));
  if (sheetRows.length > 200) throw new Error('Too many saved sheets.');
  for (const [id, sheet] of sheetRows) {
    if (id.length > 2000 || id === '__proto__' || id === 'constructor' || id === 'prototype') throw new Error('Invalid sheet identity.');
    sheets[id] = parseSheet(sheet);
    if (sheets[id].rows.some(r => !Object.hasOwn(byId, r.character)) || sheets[id].noDamage.some(id => !Object.hasOwn(byId, id))) throw new Error('Unknown sheet character.');
  }
  if (!Array.isArray(p.observed) || p.observed.length > 10) throw new Error('Invalid observed publications.');
  const observed = p.observed.map(v => parseObservedPublication(v));
  const builder = object(p.builder, 'Builder options');
  if (typeof builder.allowRebuild !== 'boolean' || !['current', 'general', 'practice'].includes(String(builder.activity))) throw new Error('Invalid builder options.');
  const server = p.server ?? 'Europe';
  if (!['Europe', 'America', 'Asia'].includes(String(server))) throw new Error('Invalid saved server.');
  const challengeStrategy = p.challengeStrategy === undefined ? undefined : parseChallengeStrategy(p.challengeStrategy);
  return { format: 'AccountDoctorWorkspace', version: 1, exportedAt: typeof p.exportedAt === 'string' ? p.exportedAt : '', account, preferences, customTeams: p.customTeams, locks, sheets, observed, server: server as Region, challengeStrategy, builder: { allowRebuild: builder.allowRebuild, activity: builder.activity as BuilderWorkspace['builder']['activity'] } };
}
export function readSavedSheets(storage: Storage) {
  const sheets: Record<string, RotationSheet> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!;
    if (key.startsWith('account-doctor-rotation-v1:')) try { sheets[key.slice('account-doctor-rotation-v1:'.length)] = parseSheet(JSON.parse(storage.getItem(key)!)); } catch { /* Invalid snapshots do not enter backups. */ }
  }
  return sheets;
}
/** Validate before writes; restore prior storage if a quota failure interrupts the transaction. */
export function restoreWorkspaceStorage(workspace: BuilderWorkspace, storage: Storage, session: Storage) {
  const p = parseWorkspace(workspace);
  const previous = new Map<string, string | null>(), previousSession = session.getItem('account-doctor-builder-session-v1');
  const entries: [string, string][] = [
    ['account-doctor-v1', JSON.stringify(p.account)], ['account-doctor-custom-teams-v1', JSON.stringify(p.customTeams)],
    ['account-doctor-builder-preferences-v1', JSON.stringify(p.preferences.filter(r => r.scope !== 'session'))],
    ['account-doctor-observed-v1', JSON.stringify(p.observed)], ['account-doctor-builder-options-v1', JSON.stringify(p.builder)],
    ['account-doctor-builder-options-v2', JSON.stringify(p.builder)],
    ['account-doctor-builder-options-v3', JSON.stringify(p.builder)],
    ['account-doctor-challenge-strategy-v1', JSON.stringify(p.challengeStrategy ?? { manual: false, drafts: {} })],
    ['account-doctor-server', p.server],
    ...Object.entries(p.sheets).map(([id, sheet]): [string, string] => [`account-doctor-rotation-v1:${id}`, JSON.stringify(sheet)]),
  ];
  const obsoleteSheets: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!;
    if (key.startsWith('account-doctor-rotation-v1:') && !entries.some(([k]) => k === key)) obsoleteSheets.push(key);
  }
  for (const [key] of entries) previous.set(key, storage.getItem(key));
  for (const key of obsoleteSheets) previous.set(key, storage.getItem(key));
  try {
    for (const key of obsoleteSheets) storage.removeItem(key);
    for (const [key, value] of entries) storage.setItem(key, value);
    session.setItem('account-doctor-builder-session-v1', JSON.stringify(p.preferences.filter(r => r.scope === 'session')));
  } catch (error) {
    for (const key of previous.keys()) storage.removeItem(key);
    for (const [key, value] of previous) if (value !== null) storage.setItem(key, value);
    if (previousSession === null) session.removeItem('account-doctor-builder-session-v1'); else session.setItem('account-doctor-builder-session-v1', previousSession);
    throw error;
  }
}
