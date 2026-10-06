import { accountIdentity, byId, modeCount } from '../account';
import type { Account } from '../account';
import type { PullEvaluation } from './pulls';
import type { Configuration } from './configurations';

// Bump when evaluation semantics change, even if the source publications do not.
export const PULL_CACHE_REVISION = 1;
const database = 'account-doctor-pull-comparisons';
const storeName = 'comparisons';
const memory = new Map<string, PullCacheEntry>();
export interface PullCacheEntry { key: string; revision: number; savedAt: string; candidates: string[]; results: PullEvaluation[]; }

function canonical(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
/** Exact account/build, planning and publication inputs; no clock-based cache timeout. */
export async function pullCacheKey(account: Account, planning: unknown, evidence: unknown) {
  const text = JSON.stringify(canonical({ revision: PULL_CACHE_REVISION, account: { ...account, owned: [...account.owned].sort(), demo: undefined }, planning, evidence }));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function validConfiguration(c: Configuration) {
  return typeof c.id === 'string' && typeof c.compositionId === 'string' && Array.isArray(c.members) && c.members.length === 4 && new Set(c.members.map(accountIdentity)).size === 4 && c.members.every(id => Boolean(byId[id])) && c.members.includes(c.driver)
    && Array.isArray(c.sources) && c.sources.every(url => /^https?:\/\//.test(url)) && Array.isArray(c.rotation.steps) && c.rotation.steps.every(s => c.members.includes(s.character) && typeof s.action === 'string')
    && Array.isArray(c.selection.reasons) && Number.isFinite(c.selection.score) && Number.isFinite(c.dimensions.sustain);
}

/** Incomplete, damaged or mismatched studies never count as cached advice. */
export function validPullCache(value: unknown, key: string, candidates: string[], account: Account): value is PullCacheEntry {
  try {
    const entry = value as PullCacheEntry;
    if (!entry || entry.key !== key || entry.revision !== PULL_CACHE_REVISION || !Number.isFinite(Date.parse(entry.savedAt)) || !Array.isArray(entry.results) || !Array.isArray(entry.candidates)) return false;
    if (entry.candidates.length !== candidates.length || new Set(entry.candidates).size !== candidates.length || candidates.some(id => !entry.candidates.includes(id))) return false;
    if (entry.results.length !== candidates.length || new Set(entry.results.map(r => r.character)).size !== candidates.length) return false;
    return entry.results.every(r => {
      if (!candidates.includes(r.character) || r.assumedConstellation !== 0 || r.account.constellations?.[r.character] !== 0 || !['Pull priority', 'Build first', 'Save'].includes(r.verdict)) return false;
      if (r.account.owned.length !== account.owned.length + 1 || !account.owned.every(id => r.account.owned.includes(id)) || !r.account.owned.includes(r.character)) return false;
      if (Object.keys(r.account.details?.[r.character] ?? {}).length || r.account.readiness[r.character] !== 'unknown') return false;
      if (!Array.isArray(r.unlocked) || !Array.isArray(r.investment) || !Array.isArray(r.requiredPartners) || !Array.isArray(r.partnerTeams) || !Array.isArray(r.ratingPartners) || !Array.isArray(r.requiredConditions) || !Array.isArray(r.matchupGains) || !Array.isArray(r.delta.released) || !Array.isArray(r.delta.changes) || !Array.isArray(r.delta.dropped) || !Array.isArray(r.coverage.unknown)) return false;
      if (typeof r.reason !== 'string' || !Number.isFinite(r.teamsAdded) || !Number.isFinite(r.unlockedCount) || !['before', 'after', 'build'].every(k => Object.values(r.metrics[k as keyof typeof r.metrics]).every(Number.isFinite))) return false;
      if (![...r.requiredPartners, ...r.ratingPartners].every(id => Boolean(byId[id])) || !r.partnerTeams.every(t => typeof t.name === 'string' && t.missing.every(id => Boolean(byId[id])))) return false;
      if (!r.investment.every(t => Boolean(byId[t.character]) && typeof t.text === 'string') || !r.delta.released.every(s => Boolean(byId[s.character]) && (!s.to || Boolean(byId[s.to])))) return false;
      if (!r.delta.changes.every(c => [...c.added, ...c.removed].every(id => Boolean(byId[id]))) || !r.delta.dropped.every(row => validConfiguration(row.config))) return false;
      if (!r.unlocked.every(validConfiguration) || !Array.isArray(r.after.assignments) || r.after.assignments.length > modeCount[account.mode] || !Number.isFinite(r.after.omitted)) return false;
      if (r.selected && (!validConfiguration(r.selected.config) || !r.after.assignments.some(row => row.config.id === r.selected!.config.id))) return false;
      const seen = new Set<string>();
      return r.after.assignments.every(row => {
        const c = row.config;
        return validConfiguration(c) && c.members.every(id => {
          const identity = accountIdentity(id);
          if (!byId[id] || !r.account.owned.includes(id) || seen.has(identity)) return false;
          seen.add(identity); return true;
        });
      });
    });
  } catch { return false; }
}

function remember(entry: PullCacheEntry) {
  memory.delete(entry.key); memory.set(entry.key, entry);
  while (memory.size > 4) memory.delete(memory.keys().next().value!);
}
function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Pull cache is unavailable.'));
  });
}
export async function readPullCache(key: string, candidates: string[], account: Account): Promise<PullCacheEntry | undefined> {
  const cached = memory.get(key);
  if (validPullCache(cached, key, candidates, account)) return cached;
  let db: IDBDatabase | undefined;
  try {
    db = await openCache();
    const value: unknown = await new Promise((resolve, reject) => {
      const request = db!.transaction(storeName).objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    if (validPullCache(value, key, candidates, account)) { remember(value); return value; }
  } catch { /* Storage failure leaves the comparison usable. */ }
  finally { db?.close(); }
}
export async function writePullCache(key: string, candidates: string[], results: PullEvaluation[], account: Account): Promise<boolean> {
  const entry: PullCacheEntry = { key, revision: PULL_CACHE_REVISION, candidates, results, savedAt: new Date().toISOString() };
  if (!validPullCache(entry, key, candidates, account)) return false;
  remember(entry);
  let db: IDBDatabase | undefined;
  try {
    db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      store.put(entry);
      // Retain a few modes/rosters without allowing an unbounded account archive.
      const all = store.getAll();
      all.onsuccess = () => (all.result as PullCacheEntry[]).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(4).forEach(old => store.delete(old.key));
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch { return false; }
  finally { db?.close(); }
}
