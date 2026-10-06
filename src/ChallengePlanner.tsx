import { useEffect, useMemo, useState } from 'react';
import type { Mode } from './account';
import { encounterProvider, encounterStatus, fetchCurrentEncounters, fetchChallengeReference, validateEncounterPack } from './planner/encounters';
import type { Encounter, EncounterPack, ChallengeReference, Region } from './planner/encounters';
import { fetchPublication } from './planner/publications';
import { matchupTags, parseChallengeStrategy } from './planner/practice';
import type { ChallengeStrategy } from './planner/practice';

type Preferences = Record<string, { preferred: string[]; avoid: string[] }>;
const tags = matchupTags;
function readStrategy(): ChallengeStrategy { try { return parseChallengeStrategy(JSON.parse(localStorage.getItem('account-doctor-challenge-strategy-v1') ?? '{}')); } catch { return { manual: false, drafts: {} }; } }
function readPreferences(): Preferences { try { const v: unknown = JSON.parse(localStorage.getItem('account-doctor-matchups-v1') ?? '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) return {}; return Object.fromEntries(Object.entries(v).filter(([, x]) => x && Array.isArray(x.preferred) && Array.isArray(x.avoid)).map(([k, x]) => [k, { preferred: x.preferred.filter((t: unknown) => typeof t === 'string' && tags.includes(t)), avoid: x.avoid.filter((t: unknown) => typeof t === 'string' && tags.includes(t)) }])); } catch { return {}; } }
export function useChallenges(mode: Mode, enabled: boolean) {
  const [region, setRegion] = useState<Region>(() => { try { const r = localStorage.getItem('account-doctor-server'); return r === 'America' || r === 'Asia' ? r : 'Europe'; } catch { return 'Europe'; } });
  const [pack, setPack] = useState<EncounterPack>();
  const [reference, setReference] = useState<ChallengeReference>();
  const [strategy, setStrategy] = useState(readStrategy);
  const { manual, drafts } = strategy;
  function setManual(manual: boolean) { setStrategy(old => ({ ...old, manual })); }
  function draft(id: string) { return drafts[`${region}:${id}`]; }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [preferences, setPreferences] = useState(readPreferences);
  const [storageError, setStorageError] = useState('');
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { try { localStorage.setItem('account-doctor-server', region); localStorage.setItem('account-doctor-matchups-v1', JSON.stringify(preferences)); } catch { setStorageError('Browser storage is unavailable; export your prescription to keep the challenge and strategy.'); } }, [region, preferences]);
  useEffect(() => { try { localStorage.setItem('account-doctor-challenge-strategy-v1', JSON.stringify(strategy)); } catch { setStorageError('Challenge strategy could not be saved.'); } }, [strategy]);
  useEffect(() => {
    if (!enabled || mode === 'general') return;
    const controller = new AbortController(), fallback = new AbortController(), key = `account-doctor-encounters-v1:${region}:${mode}`;
    let active = true;
    setError(''); setPack(undefined); setReference(undefined); setClock(Date.now());
    try { const raw = localStorage.getItem(key); if (raw) { const cached = validateEncounterPack(JSON.parse(raw)); if (!cached.publication && cached.mode === mode && cached.region === region) setPack(cached); } } catch { /* Publications must be reloaded against their reviewed byte hash, not a cache's self-declared review. */ }
    setLoading(true);
    // Reviewed local publications render immediately; a slow live provider must not hide them.
    const publication = fetchPublication(mode, region, fallback.signal).catch(() => undefined);
    void publication.then(published => { if (active && published) { setPack(published); setClock(Date.now()); } });
    const timer = setTimeout(() => controller.abort(), 12000);
    fetchCurrentEncounters(mode, region, controller.signal).catch(async error => {
      const fallbackTimer = setTimeout(() => fallback.abort(), 12000);
      const published = await publication;
      if (!published && active) {
        try { const next = await fetchChallengeReference(mode, region, fallback.signal); if (active) setReference(next); } catch { /* The manual strategy remains usable when the reference is incomplete. */ }
      }
      clearTimeout(fallbackTimer);
      if (published) return published;
      throw error;
    }).then(next => {
      if (!active) return;
      setPack(next); setClock(Date.now());
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { setStorageError('Fetched challenges could not be cached. Export your prescription to keep them.'); }
    }).catch((e: unknown) => { if (active) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Challenge request timed out. Retry when the provider is reachable.'); }).finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); fallback.abort(); };
  }, [mode, region, generation, enabled]);
  const visible = pack?.mode === mode && pack.region === region ? pack : undefined;
  const status = visible ? encounterStatus(visible, clock) : undefined;
  const activePack = useMemo(() => visible && status === 'current' ? { ...visible, encounters: visible.encounters.map(e => ({ ...e, ...(preferences[`${region}:${visible.mode}:${visible.cycleId}:${e.id}`] ?? {}) })) } : undefined, [visible, status, region, preferences]);
  function preference(id: string, tag: string, value: string) {
    if (!visible) return;
    const key = `${region}:${visible.mode}:${visible.cycleId}:${id}`;
    setPreferences(p => ({ ...p, [key]: { preferred: [...(p[key]?.preferred ?? []).filter(t => t !== tag), ...(value === 'prefer' ? [tag] : [])], avoid: [...(p[key]?.avoid ?? []).filter(t => t !== tag), ...(value === 'avoid' ? [tag] : [])] } }));
  }
  const visibleReference = reference?.mode === mode && reference.region === region ? reference : undefined;
  const useManual = manual || !visibleReference;
  const practiceTargets: Encounter[] = mode === 'general' ? [] : useManual ? Array.from({ length: mode === 'abyss' ? 2 : 3 }, (_, i) => {
    const id = `${mode}-practice-${i}`, target = draft(id);
    return { id, name: mode === 'abyss' ? `${i === 0 ? 'First' : 'Second'} half` : `Boss ${i + 1}`, preferred: target?.preferred ?? [], avoid: [], stages: (mode === 'abyss' ? [1, 2, 3] : [1]).map(n => ({ name: mode === 'abyss' ? `12-${n}` : target?.opponents || `Boss ${i + 1}`, enemies: [{ name: target?.opponents || 'Opponents not specified' }], notes: ['Player-supplied target; matchup preferences are not verified enemy mechanics.'] })) };
  }) : visibleReference.encounters.map(e => ({ ...e, preferred: draft(e.id)?.preferred ?? e.preferred }));
  function editTarget(id: string, update: Partial<{ opponents: string; preferred: string[] }>) { const key = `${region}:${id}`; setStrategy(old => ({ ...old, drafts: { ...old.drafts, [key]: { ...(old.drafts[key] ?? { opponents: '', preferred: [] }), ...update } } })); }
  return { region, setRegion, pack: visible, activePack, status, error, storageError, loading, refresh: () => setGeneration(g => g + 1), preference, reference: visibleReference, useManual, setManual, practiceTargets, draft, editTarget, strategy, restoreStrategy: (next?: ChallengeStrategy) => setStrategy(next ?? { manual: false, drafts: {} }) };
}
export function ChallengePlanner({ mode, challenges, practice = false, compact = false }: { mode: Mode; challenges: ReturnType<typeof useChallenges>; practice?: boolean; compact?: boolean }) {
  const { pack, activePack, loading, error, storageError, status, region, setRegion, refresh, preference } = challenges;
  if (mode === 'general') return <div className="encounter-note">One-team preparation · choose Abyss or Stygian to load challenges.</div>;
  if (practice) return <section className={`challenge-setup ${compact ? 'compact-targets' : ''}`} aria-label="Challenge setup"><div className="section-heading"><div><h3>{compact ? 'Custom targets' : 'Choose your matchups'}</h3>{!compact && <p>{challenges.useManual ? 'Your opponents and preferences · no live-cycle claim' : challenges.reference!.label}</p>}</div><label className="field-label">Server<select aria-label="Challenge server" value={region} onChange={e => setRegion(e.target.value as Region)}>{['Europe', 'America', 'Asia'].map(r => <option key={r}>{r}</option>)}</select></label></div>
    {!compact && <p className="quiet-note">{mode === 'abyss' ? 'Each half keeps the same team across all three chambers.' : 'Three teams are assigned together without sharing characters.'} Element choices favor matching characters. Utility choices use covered roles; neither predicts damage or shield-breaking speed.</p>}
    <div className="challenge-target-grid">{challenges.practiceTargets.map(e => <div className="challenge-target" key={e.id}><strong>{e.name}</strong>{challenges.useManual ? <label className="field-label">Opponents<input aria-label={`${e.name} opponents`} placeholder="Bosses or enemy groups" maxLength={200} value={challenges.draft(e.id)?.opponents ?? ''} onChange={v => challenges.editTarget(e.id, { opponents: v.target.value })}/></label> : <p>{e.stages.flatMap(s => s.enemies.map(enemy => enemy.name)).join(', ')}</p>}<div className="target-preferences" role="group" aria-label={`${e.name} team preferences`}>{tags.map(tag => <button key={tag} aria-pressed={e.preferred.includes(tag)} onClick={() => challenges.editTarget(e.id, { preferred: e.preferred.includes(tag) ? e.preferred.filter(t => t !== tag) : [...e.preferred, tag] })}>{tag}</button>)}</div></div>)}</div>
    <details className="challenge-source-status"><summary>{activePack ? 'Verified live lineup available' : loading ? 'Checking live sources…' : 'Live-cycle verification unavailable'}</summary><p>{error || 'Live dates and lineups are checked before current-cycle recommendations.'}</p>{challenges.reference && <p>Reference lineup: <a href={challenges.reference.source} target="_blank" rel="noreferrer">provider snapshot ↗</a>. Its generic dates do not verify a live cycle.</p>}<button className="text-button" disabled={loading} onClick={refresh}>Refresh challenges</button></details>
    {challenges.reference && <button className="text-button" onClick={() => challenges.setManual(!challenges.useManual)}>{challenges.useManual ? 'Use provider reference lineup' : 'Enter my own opponents'}</button>}
  </section>;
  if (compact) return <section className="compact-challenges" aria-label="Endgame challenges">
    <div className="challenge-toolbar"><div><h3>{activePack ? mode === 'abyss' ? 'Current Abyss' : 'Current Stygian' : 'Challenge lineup'}</h3><p data-current-cycle={Boolean(activePack)}>{activePack ? `${pack!.patch} · ${pack!.difficulty}` : loading ? 'Checking lineup…' : 'Current lineup unavailable'}</p></div>
      <label className="field-label"><span className="sr-only">Server</span><select aria-label="Challenge server" value={region} onChange={e => setRegion(e.target.value as Region)}>{['Europe', 'America', 'Asia'].map(r => <option key={r}>{r}</option>)}</select></label>
      <button className="text-button" disabled={loading} onClick={refresh} aria-label="Refresh challenges">{loading ? 'Checking…' : 'Refresh'}</button>
    </div>
    {storageError && <p role="alert">{storageError}</p>}
    {pack && <details className="challenge-lineup"><summary>Opponents &amp; matchup strategy</summary>
      <div className="challenge-grid">{(activePack ?? pack).encounters.map(encounter => <article className="challenge-card" key={encounter.id}><h3>{encounter.name}</h3>{encounter.stages.map((stage, i) => <div key={i}><strong>{stage.name}{stage.level ? ` · Lv. ${stage.level}` : ''}</strong><ul>{stage.enemies.map((enemy, j) => <li key={j}>{enemy.name}{enemy.hp ? ` · ${Math.round(enemy.hp).toLocaleString()} HP` : ''}</li>)}</ul>{stage.notes.length > 0 && <details><summary>Encounter mechanics</summary>{stage.notes.map((n, j) => <p key={j}>{n}</p>)}</details>}</div>)}
        {activePack && <details className="matchup-controls"><summary>Set matchup strategy</summary>{tags.map(tag => <label className="matchup-row" key={tag}>{tag}<select aria-label={`${encounter.name} ${tag} preference`} value={encounter.preferred.includes(tag) ? 'prefer' : encounter.avoid.includes(tag) ? 'avoid' : ''} onChange={e => preference(encounter.id, tag, e.target.value)}><option value="">Neutral / unknown</option><option value="prefer">Prefer</option><option value="avoid">Avoid</option></select></label>)}</details>}
      </article>)}</div>
      <details><summary>Cycle data &amp; sources</summary><p>{status}. <a href={pack.source} target="_blank" rel="noreferrer">Source ↗</a>{pack.publication && ` · checked ${new Date(pack.publication.reviewedAt).toLocaleDateString()} · review valid until ${new Date(pack.publication.validUntil).toLocaleDateString()}`}</p><ul>{pack.notes.map((n, i) => <li key={i}>{n}</li>)}</ul><p>{pack.publication?.dateBasis ?? 'Provider: Hakushin / Nanoka live manifest.'}</p><ul>{pack.coverage?.map((n, i) => <li key={i}>{n}</li>)}</ul><p>Detail SHA-256: <code className="configuration-id">{pack.sourceHash}</code></p>{pack.provenance?.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">Source snapshot ↗</a> <code className="configuration-id">{source.sha256}</code></p>)}</details>
    </details>}
    {error && <details className="challenge-source-status"><summary>Source status</summary><p>{error}</p></details>}
  </section>;
  return <section className="panel challenge-planner" aria-label="Endgame challenges"><div className="section-heading"><div><h3>{mode === 'abyss' ? 'Current Abyss' : 'Current Stygian'}</h3><p>{activePack ? `Current published cycle · ${pack!.patch} · ${pack!.difficulty}` : loading ? 'Loading the latest reviewed lineup…' : 'Current lineup unavailable'}</p></div><button className="text-button" disabled={loading} onClick={refresh}>{loading ? 'Fetching challenges…' : 'Refresh challenges'}</button></div>
    <label className="field-label">Game server<select aria-label="Challenge server" value={region} onChange={e => setRegion(e.target.value as Region)}>{['Europe', 'America', 'Asia'].map(r => <option key={r}>{r}</option>)}</select></label>
    {error && <p className="challenge-status" role="status">{error} {activePack ? 'Using the still-current cached snapshot.' : 'General team planning remains available.'}</p>}{storageError && <p role="alert">{storageError}</p>}
    {pack ? <><p className="quiet-note">{pack.publication ? `Lineup checked ${new Date(pack.publication.reviewedAt).toLocaleDateString()}; review valid until ${new Date(pack.publication.validUntil).toLocaleDateString()}` : `${new Date(pack.startsAt).toLocaleString()} – ${new Date(pack.endsAt).toLocaleString()}`} · {status}. <a href={pack.source} target="_blank" rel="noreferrer">Source ↗</a></p>{status !== 'current' && <p>Saved lineup is {status}; it is excluded from current-cycle assignment.</p>}
      <details><summary>Cycle modifiers &amp; data coverage</summary><ul>{pack.notes.map((n, i) => <li key={i}>{n}</li>)}</ul><p>{pack.publication ? `Reviewed publication: ${pack.publication.dateBasis}` : 'Provider: Hakushin / Nanoka live manifest.'}</p><ul>{(pack.coverage ?? ['Enemy resistance, shield gauges, wave timing and Stygian HP are unavailable in this adapter.']).map((note, i) => <li key={i}>{note}</li>)}</ul><p>Missing mechanics stay unknown. Imaginarium Theater vigor and cast allocation are not covered.</p><details><summary>Exact source provenance</summary><p>Detail SHA-256: <code className="configuration-id">{pack.sourceHash}</code></p>{pack.provenance?.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">Source snapshot ↗</a> <code className="configuration-id">{source.sha256}</code></p>)}{pack.publication && <p>Reviewed {pack.publication.reviewedAt}; usable until {pack.publication.validUntil}.</p>}</details></details>
      <details className="challenge-lineup"><summary>Opponents &amp; matchup strategy</summary><div className="challenge-grid">{(activePack ?? pack).encounters.map(encounter => <article className="challenge-card" key={encounter.id}><h3>{encounter.name}</h3>{encounter.stages.map((stage, i) => <div key={i}><strong>{stage.name}{stage.level ? ` · Lv. ${stage.level}` : ''}</strong><ul>{stage.enemies.map((enemy, j) => <li key={j}>{enemy.name}{enemy.hp ? ` · ${Math.round(enemy.hp).toLocaleString()} HP` : ''}</li>)}</ul>{stage.notes.length > 0 && <details><summary>Encounter mechanics</summary>{stage.notes.map((n, j) => <p key={j}>{n}</p>)}</details>}</div>)}
        {activePack && <details className="matchup-controls"><summary>Set matchup strategy</summary><p>Choose preferences after reviewing the mechanics. Element and kit coverage is a heuristic; it does not prove shield-breaking speed or damage.</p>{tags.map(tag => <label className="matchup-row" key={tag}>{tag}<select aria-label={`${encounter.name} ${tag} preference`} value={encounter.preferred.includes(tag) ? 'prefer' : encounter.avoid.includes(tag) ? 'avoid' : ''} onChange={e => preference(encounter.id, tag, e.target.value)}><option value="">Neutral / unknown</option><option value="prefer">Prefer</option><option value="avoid">Avoid</option></select></label>)}</details>}
      </article>)}</div></details></> : !loading && <p>No verified current lineup is available. <a href={encounterProvider} target="_blank" rel="noreferrer">Open the data provider ↗</a></p>}
  </section>;
}
